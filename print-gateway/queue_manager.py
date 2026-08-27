"""
Office Smart Print Gateway - Queue Manager
Manages job claim lifecycle, prevents duplicate prints, handles pipeline execution.
"""
from typing import Dict, Any
from api_client import ApiClient
from downloader import DocumentDownloader
from converter import DocumentConverter
from printer import PrinterService
from logger import get_logger

logger = get_logger("QueueManager")

class QueueManager:
    def __init__(self, api_client: ApiClient, printer_service: PrinterService):
        self.api = api_client
        self.printer = printer_service
        self.downloader = DocumentDownloader()
        self.converter = DocumentConverter()
        self.processing_job_ids = set()

    def process_job(self, job_meta: Dict[str, Any]):
        job_id = job_meta.get("id")
        if not job_id or job_id in self.processing_job_ids:
            return

        self.processing_job_ids.add(job_id)
        logger.info(f"==> Starting processing for Print Job {job_id} ({job_meta.get('filename')})")

        downloaded_path = None
        converted_path = None

        try:
            # Step 1: Claim job lock atomically from server
            claim_result = self.api.claim_job(job_id)
            if not claim_result:
                logger.warning(f"Could not claim job {job_id} (already claimed by another process or cancelled). Skipping.")
                return

            download_url = claim_result.get("download_url") or job_meta.get("download_url")
            filename = job_meta.get("filename", "document.pdf")
            checksum = job_meta.get("checksum")
            print_type = claim_result.get("print_type") or job_meta.get("print_type", "BLACK_WHITE")
            copies = claim_result.get("copies", 1)

            # Step 2: Download private signed file
            downloaded_path = self.downloader.download_and_verify(
                download_url, job_id, filename, checksum
            )
            if not downloaded_path:
                self.api.report_failed(job_id, "Failed to download document from private secure storage.")
                return

            # Step 3: Convert DOC/DOCX to PDF if needed
            converted_path = self.converter.convert_to_pdf(downloaded_path)
            if not converted_path:
                self.api.report_failed(job_id, "Document conversion to printable format failed.")
                return

            # Step 4: Report PRINTING status to cloud
            self.api.report_printing(job_id)

            # Step 5: Send to Windows Print Spooler
            success, error_msg = self.printer.print_document(
                converted_path, print_type=print_type, copies=copies
            )

            if success:
                logger.info(f"✓ Print job {job_id} successfully spooled to printer.")
                self.api.report_completed(job_id)
            else:
                logger.error(f"✗ Printing failed for {job_id}: {error_msg}")
                self.api.report_failed(job_id, error_msg or "Printer spooler rejection")

        except Exception as e:
            logger.error(f"Unexpected exception processing job {job_id}: {e}", exc_info=True)
            self.api.report_failed(job_id, f"Gateway exception: {str(e)}")

        finally:
            # Step 6: Cleanup local temp files immediately for user privacy
            if downloaded_path:
                self.downloader.cleanup_file(downloaded_path)
            if converted_path and converted_path != downloaded_path:
                self.downloader.cleanup_file(converted_path)

            self.processing_job_ids.discard(job_id)
