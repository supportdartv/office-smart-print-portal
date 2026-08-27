"""
Office Smart Print Gateway - Document Converter
Converts Word documents (DOCX/DOC) to standard PDF using LibreOffice headless.
"""
import os
import subprocess
from typing import Optional
from config import LIBREOFFICE_PATH, TEMP_DIR
from logger import get_logger

logger = get_logger("Converter")

class DocumentConverter:
    def __init__(self):
        self.libreoffice_bin = LIBREOFFICE_PATH

    def convert_to_pdf(self, input_path: str) -> Optional[str]:
        """Converts DOCX/DOC/Images into print-ready PDF."""
        ext = os.path.splitext(input_path)[1].lower()
        if ext == ".pdf":
            return input_path

        output_dir = os.path.dirname(input_path) or TEMP_DIR
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        expected_pdf = os.path.join(output_dir, f"{base_name}.pdf")

        # Check if LibreOffice exists
        if os.path.exists(self.libreoffice_bin):
            try:
                cmd = [
                    self.libreoffice_bin,
                    "--headless",
                    "--convert-to", "pdf",
                    "--outdir", output_dir,
                    input_path
                ]
                logger.info(f"Running LibreOffice headless conversion: {' '.join(cmd)}")
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
                if res.returncode == 0 and os.path.exists(expected_pdf):
                    logger.info(f"Conversion succeeded: {expected_pdf}")
                    return expected_pdf
                else:
                    logger.error(f"LibreOffice conversion failed: {res.stderr}")
            except Exception as e:
                logger.error(f"Error during LibreOffice execution: {e}")

        # Fallback for Windows Microsoft Word COM automation if LibreOffice is not installed
        try:
            import win32com.client # type: ignore
            word = win32com.client.Dispatch("Word.Application")
            word.Visible = False
            doc = word.Documents.Open(os.path.abspath(input_path))
            doc.SaveAs(os.path.abspath(expected_pdf), FileFormat=17) # 17 = wdFormatPDF
            doc.Close()
            word.Quit()
            if os.path.exists(expected_pdf):
                logger.info(f"MS Word COM conversion succeeded: {expected_pdf}")
                return expected_pdf
        except Exception as com_err:
            logger.warning(f"Word COM conversion not available: {com_err}")

        logger.warning(f"Cannot convert non-PDF file {input_path} - will attempt direct print if supported.")
        return input_path
