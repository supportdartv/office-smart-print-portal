"""
Office Smart Print Portal - Print Gateway Agent (Main Entry Point)
Runs on an office PC connected to the local WLAN.
Communicates with Cloud Backend via outbound HTTPS only.
"""
import time
import sys
import signal
from api_client import ApiClient
from printer import PrinterService
from queue_manager import QueueManager
from monitor import SystemMonitor
from config import POLL_INTERVAL_SECONDS, PRINTER_NAME, SERVER_URL, STATION_ID, GATEWAY_ID
from logger import get_logger

logger = get_logger("Main")

class GatewayApp:
    def __init__(self):
        self.running = False
        self.api_client = ApiClient()
        self.printer_service = PrinterService(PRINTER_NAME)
        self.queue_manager = QueueManager(self.api_client, self.printer_service)
        self.monitor = SystemMonitor(self.api_client, self.printer_service)

    def start(self):
        self.running = True
        logger.info("=" * 60)
        logger.info("  OFFICE SMART PRINT GATEWAY AGENT")
        logger.info("  Tagline: Upload. Pay. Print.")
        logger.info("=" * 60)
        logger.info(f"Target Server:    {SERVER_URL}")
        logger.info(f"Gateway ID:       {GATEWAY_ID}")
        logger.info(f"Station Code:     {STATION_ID}")
        logger.info(f"Configured Spool: {PRINTER_NAME}")
        logger.info("=" * 60)

        # Check local printer status
        is_online, status_desc = self.printer_service.check_printer_status()
        logger.info(f"Local Printer Status: [{status_desc}]")

        # Initial heartbeat
        logger.info("Registering initial heartbeat with cloud server...")
        if self.api_client.send_heartbeat(status="ONLINE", printer_status="ONLINE" if is_online else "OFFLINE"):
            logger.info("✓ Connected to Cloud Backend successfully.")
        else:
            logger.warning("⚠ Initial heartbeat failed. Will retry in background loop.")

        # Start telemetry monitor thread
        self.monitor.start()

        # Main polling loop
        logger.info(f"Starting job polling loop (Interval: {POLL_INTERVAL_SECONDS}s)...")
        try:
            while self.running:
                try:
                    queued_jobs = self.api_client.fetch_queued_jobs()
                    if queued_jobs:
                        logger.info(f"Found {len(queued_jobs)} queued job(s) for station '{STATION_ID}'.")
                        for job in queued_jobs:
                            self.queue_manager.process_job(job)
                except Exception as e:
                    logger.error(f"Error in polling cycle: {e}")

                time.sleep(POLL_INTERVAL_SECONDS)
        except KeyboardInterrupt:
            logger.info("Shutdown requested by user.")
        finally:
            self.stop()

    def stop(self):
        self.running = False
        self.monitor.stop()
        logger.info("Gateway service stopped gracefully.")

def main():
    app = GatewayApp()

    def handle_signal(sig, frame):
        logger.info("Received termination signal.")
        app.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    app.start()

if __name__ == "__main__":
    main()
