"""
Office Smart Print Gateway - System & Printer Monitor
Periodically dispatches health status and keeps cloud telemetry up to date.
"""
import time
import threading
from api_client import ApiClient
from printer import PrinterService
from config import HEARTBEAT_INTERVAL_SECONDS
from logger import get_logger

logger = get_logger("Monitor")

class SystemMonitor:
    def __init__(self, api_client: ApiClient, printer_service: PrinterService):
        self.api = api_client
        self.printer = printer_service
        self.running = False
        self.thread = None

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        logger.info("Heartbeat monitor thread started.")

    def stop(self):
        self.running = False

    def _run_loop(self):
        while self.running:
            try:
                is_online, printer_msg = self.printer.check_printer_status()
                status = "ONLINE" if is_online else "OFFLINE"
                health_data = self.printer.get_printer_health()
                self.api.send_heartbeat(status=status, printer_status=status, health_data=health_data)
            except Exception as e:
                logger.error(f"Monitor loop error: {e}")

            time.sleep(HEARTBEAT_INTERVAL_SECONDS)
