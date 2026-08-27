"""
Office Smart Print Gateway - Secure Downloader
Downloads private signed document URLs and validates SHA256 checksums.
Supports 100% Zero-Dependency Offline Mode (Pure Python Standard Library urllib).
"""
import os
import hashlib
import urllib.request
import urllib.error
import ssl
from typing import Optional
from config import TEMP_DIR
from logger import get_logger

logger = get_logger("Downloader")

ssl_context = ssl.create_default_context()

class DocumentDownloader:
    def __init__(self):
        os.makedirs(TEMP_DIR, exist_ok=True)

    def download_and_verify(self, download_url: str, job_id: str, filename: str, expected_checksum: Optional[str] = None) -> Optional[str]:
        """Downloads document to isolated temp path and validates integrity."""
        try:
            ext = os.path.splitext(filename)[1].lower() or ".pdf"
            local_path = os.path.join(TEMP_DIR, f"{job_id}{ext}")

            logger.info(f"Downloading file for job {job_id} from private storage...")
            
            req = urllib.request.Request(
                download_url,
                headers={"User-Agent": "OfficeSmartPrintGateway/1.0"}
            )

            sha256 = hashlib.sha256()
            with urllib.request.urlopen(req, timeout=40, context=ssl_context) as resp:
                if resp.status != 200:
                    logger.error(f"Download failed with HTTP {resp.status}")
                    return None

                with open(local_path, "wb") as f:
                    while True:
                        chunk = resp.read(65536)
                        if not chunk:
                            break
                        f.write(chunk)
                        sha256.update(chunk)

            computed_hash = sha256.hexdigest()
            if expected_checksum and computed_hash != expected_checksum:
                logger.error(f"Checksum mismatch! Expected: {expected_checksum}, Got: {computed_hash}")
                if os.path.exists(local_path):
                    os.remove(local_path)
                return None

            logger.info(f"File verified successfully: {local_path} ({os.path.getsize(local_path)} bytes)")
            return local_path

        except urllib.error.HTTPError as he:
            logger.error(f"HTTPError downloading job {job_id}: {he.code}")
            return None
        except Exception as e:
            logger.error(f"Error during file download for job {job_id}: {e}")
            return None

    def cleanup_file(self, file_path: str):
        """Safely removes temporary local file."""
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"Cleaned up temporary file: {file_path}")
        except Exception as e:
            logger.warning(f"Error deleting temp file {file_path}: {e}")

