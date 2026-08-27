# Office Smart Print Portal

> **Upload. Pay. Print.**
> A secure, mobile-first QR-based document upload and remote-printing system designed for office WLAN printers without exposing hardware to the public Internet.

---

## 1. Architectural Overview

```text
[ Mobile Phone / User (4G/5G) ]
               │
               ▼ (HTTPS - Public Web App)
 [ Cloud Server (Express + Vite + React) ]
   ├── Private Storage (HMAC-Signed URLs)
   ├── State Machine & Pricing Engine
   └── Payment Gateway (NPCI UPI / Razorpay / Webhook)
               ▲
               │ (Outbound Polling & Heartbeat - Private)
 [ Office PC: Print Gateway Agent (Python) ]
               │
               ▼ (Office WLAN / Windows Spooler)
    [ Physical Office Printer ]
```

### Core Security Principles
1. **Zero WLAN Requirement for Users**: Users upload and pay from mobile cellular data (4G/5G). They do not need access to the office Wi-Fi password or subnet.
2. **Zero Inbound Port Exposure**: The office printer is never exposed to the public Internet.
3. **Server-Authoritative Pricing & Verification**: Page counts and monetary totals are strictly calculated server-side. The browser cannot authorize a print job.
4. **Automatic File Sanitization**: Uploaded files are deleted automatically 10 minutes after successful completion (or 30 minutes if unpaid/abandoned).

---

## 2. Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion, PWA Support (`manifest.json`)
- **Backend**: Node.js, Express, Multer (in-memory buffer parsing), `pdf-lib` (server-side PDF parsing), `qrcode`
- **Database**: PostgreSQL / Supabase Compatible SQL Schema (`database/schema.sql`) + Built-in Persistent JSON Store (`data/app-store.json`)
- **Print Gateway Agent**: Python 3.10+, Requests, Win32 Spooler (`win32print`), LibreOffice Headless Converter

---

## 3. Project Structure

```text
office-smart-print/
├── database/
│   └── schema.sql              # Full PostgreSQL/Supabase schema & indexes
├── print-gateway/              # Python Windows print agent
│   ├── gateway.py              # Main polling & execution loop
│   ├── api_client.py           # Authenticated HTTPS cloud communicator
│   ├── printer.py              # Windows print spooler abstraction
│   ├── downloader.py           # Signed URL downloader with SHA-256 verification
│   ├── converter.py            # LibreOffice headless DOCX->PDF converter
│   ├── queue_manager.py        # Atomic job claim & lock manager
│   ├── monitor.py              # Heartbeat & printer telemetry thread
│   ├── config.py               # Gateway environment settings
│   ├── logger.py               # Structured logging
│   ├── requirements.txt        # Python dependencies
│   ├── .env.example            # Gateway environment variables
│   └── README.md               # Windows installation manual
├── server/
│   ├── db/
│   │   └── store.ts            # Persistence & relational store
│   ├── routes/
│   │   ├── api.ts              # Public upload, jobs, & payment routes
│   │   ├── gateway.ts          # Hardware gateway polling & heartbeat API
│   │   └── admin.ts            # Admin dashboard, reports, & pricing API
│   ├── services/
│   │   ├── jobService.ts       # State machine engine & price calculator
│   │   ├── pageCounter.ts      # Server-side PDF & image page counting
│   │   ├── storage.ts          # Private storage, HMAC signing & auto-cleanup
│   │   └── payments/           # UPI QR, Razorpay, and Demo adapters
│   └── types/
│       └── index.ts            # Backend TypeScript types
├── src/
│   ├── components/             # Reusable UI components
│   │   ├── Header.tsx          # Top navigation & admin toggle
│   │   ├── Footer.tsx          # Privacy & security footer
│   │   ├── StationHeader.tsx   # Station & printer status card
│   │   ├── FileUploader.tsx    # Drag-and-drop & mobile upload with progress
│   │   ├── PrintOptionCard.tsx # B&W, Colour, Official print selector
│   │   ├── OfficialPrintModal.tsx # Employee ID & section audit form
│   │   ├── PaymentQR.tsx       # Dynamic UPI QR & live verification poller
│   │   ├── JobStatusView.tsx   # Real-time print stepper & completion badge
│   │   ├── PrintableQrCard.tsx # Downloadable & printable QR standee card
│   │   └── AdminPortal.tsx     # Admin dashboard, printer manager & reports
│   ├── services/api.ts         # Frontend API client
│   ├── types.ts                # Frontend types
│   ├── App.tsx                 # Main application view coordinator
│   └── index.css               # Tailwind CSS entry point
├── tests/
│   └── pricingAndState.test.ts # Unit tests for pricing & state transitions
├── server.ts                   # Full-stack Express + Vite entry point
├── .env.example                # Example environment configuration
└── package.json                # NPM packages & build scripts
```

---

## 4. Getting Started

### Local Development
```bash
# 1. Install dependencies
npm install

# 2. Run test suite
npx tsx tests/pricingAndState.test.ts

# 3. Start development server (Port 3000)
npm run dev
```

Visit `http://localhost:3000` to open the web app.

### Running the Python Print Gateway
```bash
cd print-gateway
pip install -r requirements.txt
python gateway.py
```

---

## 5. Configuration & Payment Setup

Configure your `.env` file based on `.env.example`:

| Variable | Description |
| :--- | :--- |
| `MERCHANT_UPI_ID` | Your merchant UPI VPA (e.g. `7006686584@icici`) |
| `PAYMENT_PROVIDER` | `UPI_DIRECT`, `RAZORPAY`, or `DEMO` |
| `PAYMENT_KEY_ID` | Razorpay Key ID (if using Razorpay) |
| `PAYMENT_KEY_SECRET`| Razorpay Key Secret |
| `PAYMENT_WEBHOOK_SECRET` | Webhook verification secret |
| `DEMO_MODE` | Set to `true` in local development to allow instant test payments |
| `ADMIN_PASSWORD` | Administrator password for `/admin` (Default: `admin123`) |

---

## 6. Admin Portal & Standee QR Generation
1. Click **Admin** in the top-right header or navigate to `/admin`.
2. Login with password `admin123`.
3. Open **Stations & QR** tab -> click **Generate & Print Standee QR**.
4. Print the QR card and place it physically next to your office printer.

---

## 7. Print Job State Machine

```text
[UPLOADED] ──► [PROCESSING]
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
 [WAITING_PAYMENT]   [OFFICIAL_PENDING_CONFIRMATION]
         │                       │
         ▼ (Verified)            ▼ (Confirmed)
      [PAID]                  [QUEUED]
         │                       │
         └───────────┬───────────┘
                     ▼
                 [QUEUED] ──► [PRINTING] ──► [COMPLETED]
```
