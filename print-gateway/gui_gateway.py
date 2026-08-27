"""
Office Smart Print Gateway - Desktop GUI Control Panel
======================================================
Provides a Windows desktop window interface (Tkinter, built into Python)
showing real-time status, live print queue activity, printer selector,
test print button, and live cloud reconnection settings.
"""
import os
import sys
import time
import threading
import tkinter as tk
from tkinter import ttk, messagebox

import config
from config import SERVER_URL, STATION_ID, GATEWAY_ID, PRINTER_NAME
from printer import PrinterService
from api_client import ApiClient
from queue_manager import QueueManager
from logger import get_logger

logger = get_logger("gui")

class GatewayApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Office Smart Print - PC Control Panel")
        self.root.geometry("680x580")
        self.root.minsize(620, 500)

        # Style & Theme
        self.bg_color = "#f8fafc"
        self.card_bg = "#ffffff"
        self.primary_color = "#2563eb"
        self.root.configure(bg=self.bg_color)

        self.printer_svc = PrinterService()
        self.api = ApiClient()
        self.queue = QueueManager(self.api, self.printer_svc)

        self.is_running = True
        self.jobs_count = 0
        self.connection_ok = False

        self._build_ui()
        self._start_background_worker()

    def _build_ui(self):
        # Header banner
        header_frame = tk.Frame(self.root, bg="#0f172a", padx=16, pady=12)
        header_frame.pack(fill=tk.X)

        title_lbl = tk.Label(
            header_frame,
            text="🖨️ Office Smart Print Gateway",
            font=("Segoe UI", 13, "bold"),
            fg="#ffffff",
            bg="#0f172a"
        )
        title_lbl.pack(side=tk.LEFT)

        self.status_badge = tk.Label(
            header_frame,
            text="● CONNECTING...",
            font=("Segoe UI", 10, "bold"),
            fg="#fbbf24",
            bg="#0f172a"
        )
        self.status_badge.pack(side=tk.RIGHT)

        # Main Container
        container = tk.Frame(self.root, bg=self.bg_color, padx=16, pady=12)
        container.pack(fill=tk.BOTH, expand=True)

        # Top Info Card
        info_card = tk.LabelFrame(
            container,
            text=" Cloud Connection & Hardware Settings ",
            font=("Segoe UI", 9, "bold"),
            fg="#334155",
            bg=self.card_bg,
            padx=12,
            pady=10
        )
        info_card.pack(fill=tk.X, pady=(0, 10))

        grid_frame = tk.Frame(info_card, bg=self.card_bg)
        grid_frame.pack(fill=tk.X)

        # Cloud Server URL
        tk.Label(grid_frame, text="Cloud Server:", font=("Segoe UI", 9, "bold"), fg="#64748b", bg=self.card_bg).grid(row=0, column=0, sticky="w", pady=3)
        self.server_var = tk.StringVar(value=self.api.base_url)
        self.server_entry = tk.Entry(grid_frame, textvariable=self.server_var, font=("Segoe UI", 9), width=38)
        self.server_entry.grid(row=0, column=1, sticky="w", padx=8, pady=3)

        btn_save_server = tk.Button(
            grid_frame,
            text="Save & Reconnect",
            command=self._on_save_server,
            font=("Segoe UI", 8, "bold"),
            bg="#eff6ff",
            fg="#1d4ed8",
            padx=6,
            pady=1
        )
        btn_save_server.grid(row=0, column=2, sticky="w", padx=2, pady=3)

        # Station ID
        tk.Label(grid_frame, text="Station Code:", font=("Segoe UI", 9, "bold"), fg="#64748b", bg=self.card_bg).grid(row=1, column=0, sticky="w", pady=3)
        self.station_lbl = tk.Label(grid_frame, text=config.STATION_ID, font=("Segoe UI", 9, "bold"), fg="#0f172a", bg=self.card_bg)
        self.station_lbl.grid(row=1, column=1, sticky="w", padx=8, pady=3)

        # Printer selector
        tk.Label(grid_frame, text="Active Printer:", font=("Segoe UI", 9, "bold"), fg="#64748b", bg=self.card_bg).grid(row=2, column=0, sticky="w", pady=3)
        
        printers = self.printer_svc.list_installed_printers()
        self.printer_var = tk.StringVar(value=self.printer_svc.printer_name)
        self.printer_combo = ttk.Combobox(grid_frame, textvariable=self.printer_var, values=printers, state="readonly", width=36)
        self.printer_combo.grid(row=2, column=1, sticky="w", padx=8, pady=3)
        self.printer_combo.bind("<<ComboboxSelected>>", self._on_printer_changed)

        btn_refresh_printers = tk.Button(
            grid_frame,
            text="Refresh",
            command=self._refresh_printers,
            font=("Segoe UI", 8),
            bg="#f8fafc",
            fg="#475569",
            padx=6,
            pady=1
        )
        btn_refresh_printers.grid(row=2, column=2, sticky="w", padx=2, pady=3)

        # Action Buttons row
        btn_frame = tk.Frame(info_card, bg=self.card_bg, pady=6)
        btn_frame.pack(fill=tk.X)

        self.btn_test = tk.Button(
            btn_frame,
            text="🖨️ Send Test Print",
            command=self._send_test_print,
            font=("Segoe UI", 9, "bold"),
            bg="#f0fdf4",
            fg="#166534",
            relief=tk.GROOVE,
            padx=10,
            pady=4,
            cursor="hand2"
        )
        self.btn_test.pack(side=tk.LEFT, padx=(0, 8))

        self.btn_beep = tk.Button(
            btn_frame,
            text="🔔 Test Chime",
            command=self._test_sound,
            font=("Segoe UI", 9),
            bg="#f8fafc",
            fg="#334155",
            relief=tk.GROOVE,
            padx=8,
            pady=4,
            cursor="hand2"
        )
        self.btn_beep.pack(side=tk.LEFT, padx=(0, 8))

        self.btn_dashboard = tk.Button(
            btn_frame,
            text="🌐 Open Web Portal",
            command=self._open_web_portal,
            font=("Segoe UI", 9),
            bg="#eff6ff",
            fg="#1e40af",
            relief=tk.GROOVE,
            padx=8,
            pady=4,
            cursor="hand2"
        )
        self.btn_dashboard.pack(side=tk.LEFT)

        # Live Activity Log Card
        log_card = tk.LabelFrame(
            container,
            text=" Live Activity & Spooler Console ",
            font=("Segoe UI", 9, "bold"),
            fg="#334155",
            bg=self.card_bg,
            padx=10,
            pady=8
        )
        log_card.pack(fill=tk.BOTH, expand=True)

        self.log_text = tk.Text(
            log_card,
            wrap=tk.WORD,
            bg="#0f172a",
            fg="#e2e8f0",
            font=("Consolas", 9),
            relief=tk.FLAT,
            padx=8,
            pady=8
        )
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        scrollbar = tk.Scrollbar(log_card, command=self.log_text.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.log_text.config(yscrollcommand=scrollbar.set)

        self.append_log(f"Control Panel initialized.")
        self.append_log(f"Target Server: {self.api.base_url}")
        self.append_log(f"Active Printer: '{self.printer_svc.printer_name}'")

        # Bottom status bar
        footer = tk.Frame(self.root, bg="#f1f5f9", padx=12, pady=6)
        footer.pack(fill=tk.X, side=tk.BOTTOM)
        
        self.footer_lbl = tk.Label(
            footer,
            text="Ready • 0 jobs printed this session",
            font=("Segoe UI", 8),
            fg="#64748b",
            bg="#f1f5f9"
        )
        self.footer_lbl.pack(side=tk.LEFT)

    def append_log(self, message: str):
        ts = time.strftime("%H:%M:%S")
        self.log_text.insert(tk.END, f"[{ts}] {message}\n")
        self.log_text.see(tk.END)

    def _on_save_server(self):
        new_url = self.server_var.get().strip().rstrip("/")
        if not new_url:
            return
        self.api.base_url = new_url
        config.SERVER_URL = new_url
        self.append_log(f"Updated Target Server URL to: {new_url}")
        
        # Save to .env file if present
        try:
            env_path = ".env"
            lines = []
            server_written = False
            if os.path.exists(env_path):
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.startswith("SERVER_URL="):
                            lines.append(f"SERVER_URL={new_url}\n")
                            server_written = True
                        else:
                            lines.append(line)
            if not server_written:
                lines.append(f"SERVER_URL={new_url}\n")
            with open(env_path, "w", encoding="utf-8") as f:
                f.writelines(lines)
            self.append_log("Saved new URL to .env file.")
        except Exception as e:
            self.append_log(f"Note: Could not write .env: {e}")

        # Immediate test heartbeat
        threading.Thread(target=self._send_instant_heartbeat, daemon=True).start()

    def _send_instant_heartbeat(self):
        self.append_log("Testing connection to cloud...")
        ok = self.api.send_heartbeat(status="ONLINE", printer_status="ONLINE")
        if ok:
            self.connection_ok = True
            self.root.after(0, lambda: self.status_badge.config(text="● ONLINE", fg="#34d399"))
            self.append_log("✓ Connected to Cloud Backend successfully!")
        else:
            self.connection_ok = False
            self.root.after(0, lambda: self.status_badge.config(text="● OFFLINE", fg="#f87171"))
            self.append_log("⚠ Could not reach cloud server. Check URL.")

    def _refresh_printers(self):
        printers = self.printer_svc.list_installed_printers()
        self.printer_combo["values"] = printers
        self.append_log(f"Found {len(printers)} installed printers on PC.")

    def _on_printer_changed(self, event=None):
        new_name = self.printer_var.get()
        self.printer_svc.printer_name = new_name
        self.append_log(f"Printer target changed to: '{new_name}'")

    def _test_sound(self):
        self.printer_svc.play_job_alert()
        self.append_log("Played notification chime.")

    def _open_web_portal(self):
        import webbrowser
        webbrowser.open(self.api.base_url)

    def _send_test_print(self):
        import tempfile
        temp_dir = tempfile.gettempdir()
        test_file = os.path.join(temp_dir, f"test_print_{int(time.time())}.txt")
        try:
            with open(test_file, "w", encoding="utf-8") as f:
                f.write("==============================================\n")
                f.write("       OFFICE SMART PRINT - TEST PAGE\n")
                f.write("==============================================\n")
                f.write(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"Target:    {self.printer_svc.printer_name}\n")
                f.write("Status:    PC Gateway Spooler Functional!\n")
                f.write("==============================================\n")
            
            self.append_log(f"Dispatching test page to '{self.printer_svc.printer_name}'...")
            ok, err = self.printer_svc.print_document(test_file, print_type="BLACK_WHITE", copies=1)
            if ok:
                self.append_log("✓ Test document sent to printer spooler successfully!")
                messagebox.showinfo("Test Print", f"Test document sent to spooler for:\n{self.printer_svc.printer_name}")
            else:
                self.append_log(f"✗ Test print failed: {err}")
                messagebox.showerror("Error", f"Print failed: {err}")
        except Exception as e:
            self.append_log(f"Error: {e}")
        finally:
            if os.path.exists(test_file):
                try: os.remove(test_file)
                except Exception: pass

    def _start_background_worker(self):
        def loop():
            last_hb = 0
            while self.is_running:
                try:
                    now = time.time()
                    if now - last_hb > 15:
                        health = self.printer_svc.get_printer_health()
                        is_online, _ = self.printer_svc.check_printer_status()
                        ok = self.api.send_heartbeat(
                            status="ONLINE",
                            printer_status="ONLINE" if is_online else "OFFLINE",
                            health_data=health
                        )
                        if ok:
                            if not self.connection_ok:
                                self.connection_ok = True
                                self.root.after(0, lambda: self.status_badge.config(text="● ONLINE", fg="#34d399"))
                                self.append_log("✓ Connected to Cloud Backend.")
                        else:
                            if self.connection_ok:
                                self.connection_ok = False
                                self.root.after(0, lambda: self.status_badge.config(text="● OFFLINE", fg="#f87171"))
                        last_hb = now
                    
                    # Poll jobs using correct ApiClient method
                    jobs = self.api.fetch_queued_jobs()
                    if jobs:
                        for job in jobs:
                            job_id = job.get("id")
                            self.append_log(f"⚡ Incoming Print Job: {job_id} ({job.get('filename')})")
                            self.queue.process_job(job)
                            self.jobs_count += 1
                            self.root.after(0, lambda: self.footer_lbl.config(
                                text=f"Active • {self.jobs_count} job(s) processed this session"
                            ))
                except Exception as e:
                    logger.error(f"Background worker error: {e}")
                time.sleep(3)

        t = threading.Thread(target=loop, daemon=True)
        t.start()

def main():
    root = tk.Tk()
    app = GatewayApp(root)
    root.protocol("WM_DELETE_WINDOW", lambda: sys.exit(0))
    root.mainloop()

if __name__ == "__main__":
    main()

