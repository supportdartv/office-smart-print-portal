# Database Schema for Office Smart Print Portal
# PostgreSQL / Supabase Compatible

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SETTINGS
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS (Admin / Staff Accounts)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. PRINTERS (Physical WLAN Printers)
CREATE TABLE IF NOT EXISTS printers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    hostname VARCHAR(255),
    location VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'ONLINE', -- ONLINE, OFFLINE, BUSY, ERROR
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. STATIONS (QR Point of Print Locations)
CREATE TABLE IF NOT EXISTS stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_code VARCHAR(100) UNIQUE NOT NULL, -- e.g. 'office-printer-01'
    name VARCHAR(255) NOT NULL,
    printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
    qr_token VARCHAR(255) NOT NULL,
    location_desc VARCHAR(255),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. GATEWAY_DEVICES (Office PC Agents)
CREATE TABLE IF NOT EXISTS gateway_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
    device_token_hash VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'ONLINE', -- ONLINE, OFFLINE, BUSY
    os_info VARCHAR(255),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. FILES (Uploaded Documents - Private)
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    page_count INT NOT NULL DEFAULT 1,
    checksum VARCHAR(64) NOT NULL,
    status VARCHAR(50) DEFAULT 'READY', -- READY, PROCESSING, DELETED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 7. PRINT_JOBS (Core Job State Machine)
CREATE TABLE IF NOT EXISTS print_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) NOT NULL,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
    printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
    print_type VARCHAR(50) NOT NULL, -- 'BLACK_WHITE', 'COLOR', 'OFFICIAL'
    page_count INT NOT NULL DEFAULT 1,
    copies INT NOT NULL DEFAULT 1,
    price_per_page INT NOT NULL, -- In smallest currency unit (paise)
    total_amount INT NOT NULL, -- In smallest currency unit (paise)
    currency VARCHAR(10) DEFAULT 'INR',
    payment_required BOOLEAN DEFAULT true,
    payment_verified BOOLEAN DEFAULT false,
    status VARCHAR(50) NOT NULL DEFAULT 'UPLOADED',
    claimed_by_gateway_id UUID REFERENCES gateway_devices(id) ON DELETE SET NULL,
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP WITH TIME ZONE,
    queued_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    fail_reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 8. PAYMENTS (Transactions & Verification)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'UPI_DIRECT', 'RAZORPAY', 'CASHFREE', 'DEMO'
    provider_payment_id VARCHAR(255),
    provider_qr_id VARCHAR(255),
    amount INT NOT NULL, -- in paise
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, VERIFIED, FAILED, EXPIRED
    verified BOOLEAN DEFAULT false,
    webhook_verified BOOLEAN DEFAULT false,
    raw_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 9. OFFICIAL_PRINTS (Audit for Free Official Documents)
CREATE TABLE IF NOT EXISTS official_prints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) NOT NULL,
    section VARCHAR(150) NOT NULL,
    purpose TEXT NOT NULL,
    approved BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. AUDIT_LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event VARCHAR(100) NOT NULL,
    job_id UUID,
    user_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_station ON print_jobs(station_id);
CREATE INDEX IF NOT EXISTS idx_payments_job ON payments(job_id);
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event);
