"""
Office Smart Print Gateway - Configuration Module
Supports 100% Zero-Dependency Offline Mode (Pure Python Standard Library)
"""
import os

# Built-in .env reader without requiring python-dotenv
def load_env_file(filepath: str = ".env"):
    if not os.path.exists(filepath):
        return
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    if key not in os.environ:
                        os.environ[key] = val
    except Exception as e:
        pass

# Optional python-dotenv if installed, otherwise uses native parser
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    load_env_file()

# Cloud Server Configuration
SERVER_URL = os.getenv("SERVER_URL", "http://localhost:3000")
GATEWAY_ID = os.getenv("GATEWAY_ID", "gw-office-pc-01")
GATEWAY_DEVICE_TOKEN = os.getenv("GATEWAY_DEVICE_TOKEN", "demo-gateway-token-secret-123")
STATION_ID = os.getenv("STATION_ID", "office-printer-01")

# Printer Settings
PRINTER_NAME = os.getenv("PRINTER_NAME", "AUTO")
PDF_PRINT_COMMAND = os.getenv("PDF_PRINT_COMMAND", "") # Optional custom CLI (e.g. Acrobat Reader / SumatraPDF)

# Polling & Timers
POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "3"))
HEARTBEAT_INTERVAL_SECONDS = int(os.getenv("HEARTBEAT_INTERVAL_SECONDS", "30"))

# File storage & temporary directories
TEMP_DIR = os.getenv("TEMP_DIR", "./temp_jobs")
LIBREOFFICE_PATH = os.getenv("LIBREOFFICE_PATH", r"C:\Program Files\LibreOffice\program\soffice.exe")