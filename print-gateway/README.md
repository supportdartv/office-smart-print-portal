# Office Smart Print Gateway (100% Offline / Zero-Pip Ready)

The Print Gateway is a lightweight Python background service designed to run on an Office PC connected to the local office printer.

## 🚀 100% Zero-Dependency Offline Mode
**No `pip install` or internet connection required on the Office PC!**
- Built entirely on **Python's standard library** (`urllib.request`, `json`, `ssl`, `hashlib`, `subprocess`).
- Works immediately out of the box with standard Python 3.7+.
- Includes one-click offline launchers (`run_gateway.bat`, `install_offline.bat`, `run_gateway.sh`).

---

## Quick Offline Setup (Windows)

### Step 1: Copy the Folder
Copy the `print-gateway` folder to any directory on your PC (e.g. `C:\OfficeSmartPrint\print-gateway`).

### Step 2: Configure Environment
Copy `.env.example` to `.env` (or run `install_offline.bat` which creates it automatically):
```ini
SERVER_URL=https://ais-dev-r23stbv3zof3ahi4xmqvj5-247817327051.asia-southeast1.run.app
GATEWAY_ID=gw-office-pc-01
GATEWAY_DEVICE_TOKEN=demo-gateway-token-secret-123
STATION_ID=office-printer-01
PRINTER_NAME=HP LaserJet Pro M404dw
```

### Step 3: Run the Gateway
Simply double-click **`run_gateway.bat`** (or open command prompt and run `python gateway.py` / `python standalone_gateway.py`).

No packages need to be downloaded from the internet. The gateway will immediately start polling for paid print jobs and dispatching them to your printer.

---

## Architecture

```text
[Mobile Phone / User]
       │
       ▼ (Public HTTPS)
[Cloud Backend Server]
       ▲
       │ (Outbound HTTPS Polling & Heartbeat - Private)
[Office PC: Print Gateway]
       │
       ▼ (Local Windows Spooler / PowerShell / SumatraPDF)
[Office Printer]
```

### Security Highlights
- **No Inbound Ports**: The printer and the Office PC remain completely unexposed to the Internet.
- **Zero Mobile-to-Wi-Fi Requirement**: Users upload and pay using mobile data (4G/5G).
- **Hashed Device Tokens**: Authentication uses unique SHA-256 hashed device tokens.
- **Signed Download URLs**: Documents are downloaded securely via short-lived HMAC signed URLs.
- **Automatic Privacy Sanitization**: Local temporary copies are deleted immediately after spooling.

---

## Running as a Background Windows Service

To ensure the gateway starts automatically on system boot:

### Option A: Windows Task Scheduler (Recommended)
1. Open **Task Scheduler** in Windows.
2. Click **Create Basic Task** -> Name: `OfficePrintGateway`.
3. Trigger: **When the computer starts** or **When I log on**.
4. Action: **Start a program** -> Program: `pythonw.exe`, Arguments: `gateway.py`, Start in: `C:\OfficeSmartPrint\print-gateway`.

### Option B: NSSM (Non-Sucking Service Manager)
```powershell
nssm install OfficePrintGateway "C:\Python311\python.exe" "C:\OfficeSmartPrint\print-gateway\gateway.py"
nssm start OfficePrintGateway
```

