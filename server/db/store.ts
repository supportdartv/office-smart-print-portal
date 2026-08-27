import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  FileRecord,
  PrintJobRecord,
  PaymentRecord,
  OfficialPrintRecord,
  PrinterRecord,
  StationRecord,
  GatewayDeviceRecord,
  AuditLogRecord,
  AppSettings
} from '../types';

class Store {
  private tmpDir: string;
  private storeFile: string;
  
  public files: Map<string, FileRecord> = new Map();
  public printJobs: Map<string, PrintJobRecord> = new Map();
  public payments: Map<string, PaymentRecord> = new Map();
  public officialPrints: Map<string, OfficialPrintRecord> = new Map();
  public printers: Map<string, PrinterRecord> = new Map();
  public stations: Map<string, StationRecord> = new Map();
  public gatewayDevices: Map<string, GatewayDeviceRecord> = new Map();
  public auditLogs: AuditLogRecord[] = [];
  public settings: AppSettings = {
    blackWhitePricePaise: 200,
    colorPricePaise: 500,
    officialPricePaise: 0,
    merchantUpiId: process.env.MERCHANT_UPI_ID || '7006686584@icici',
    merchantName: 'Office Smart Print',
    paymentProvider: process.env.PAYMENT_PROVIDER || (process.env.NODE_ENV === 'production' ? 'UPI_DIRECT' : 'DEMO'),
    demoMode: process.env.DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production',
    fileRetentionMinutes: 10,
    jobExpiryMinutes: 30
  };

  public supabase: SupabaseClient | null = null;
  public isLoaded = false;

  constructor() {
    // Vercel only allows writing to the /tmp directory
    this.tmpDir = '/tmp';
    this.storeFile = path.join(this.tmpDir, 'app-store.json');
    
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (url && key) {
      this.supabase = createClient(url, key, { auth: { persistSession: false } });
    }
    
    this.load().catch(console.error);
  }

  private async load() {
    try {
      let raw = '';
      
      // 1. Fetch latest state from Supabase Cloud Storage
      if (this.supabase) {
        const { data, error } = await this.supabase.storage.from('print-files').download('state/app-store.json');
        if (data) {
          raw = await data.text();
        }
      }
      
      // 2. Fallback to local /tmp cache if cloud fetch failed
      if (!raw && fs.existsSync(this.storeFile)) {
        raw = fs.readFileSync(this.storeFile, 'utf-8');
      }

      if (raw) {
        const data = JSON.parse(raw);
        if (data.files) this.files = new Map(Object.entries(data.files));
        if (data.printJobs) this.printJobs = new Map(Object.entries(data.printJobs));
        if (data.payments) this.payments = new Map(Object.entries(data.payments));
        if (data.officialPrints) this.officialPrints = new Map(Object.entries(data.officialPrints));
        if (data.printers) this.printers = new Map(Object.entries(data.printers));
        if (data.stations) this.stations = new Map(Object.entries(data.stations));
        if (data.gatewayDevices) this.gatewayDevices = new Map(Object.entries(data.gatewayDevices));
        if (data.auditLogs) this.auditLogs = data.auditLogs;
        if (data.settings) this.settings = { ...this.settings, ...data.settings };
      }
    } catch (err) {
      console.error('[Store] Error loading state:', err);
    }

    if (this.printers.size === 0) {
      this.seedDefaults();
    }
    this.isLoaded = true;
  }

  public save() {
    if (!this.isLoaded) return;
    try {
      const payload = {
        files: Object.fromEntries(this.files),
        printJobs: Object.fromEntries(this.printJobs),
        payments: Object.fromEntries(this.payments),
        officialPrints: Object.fromEntries(this.officialPrints),
        printers: Object.fromEntries(this.printers),
        stations: Object.fromEntries(this.stations),
        gatewayDevices: Object.fromEntries(this.gatewayDevices),
        auditLogs: this.auditLogs.slice(-1000),
        settings: this.settings
      };
      
      const jsonStr = JSON.stringify(payload, null, 2);
      
      // Save locally to Vercel's /tmp for immediate hot-caching
      fs.writeFileSync(this.storeFile, jsonStr, 'utf-8');

      // Sync to Supabase in the background
      if (this.supabase) {
        this.supabase.storage.from('print-files')
          .upload('state/app-store.json', jsonStr, { upsert: true, contentType: 'application/json' })
          .catch(err => console.error('[Store] Supabase State Sync Error:', err));
      }
    } catch (err) {
      console.error('[Store] Error saving store:', err);
    }
  }

  private seedDefaults() {
    if (this.printers.size === 0) {
      const printerId = 'printer-main-01';
      this.printers.set(printerId, {
        id: printerId,
        name: 'HP LaserJet Pro M404dw (WLAN)',
        ipAddress: '192.168.1.105',
        hostname: 'hp-laserjet-office.local',
        location: 'Ground Floor Copy & Print Corner',
        status: 'ONLINE',
        health: {
          inkLevel: 82,
          blackInkLevel: 85,
          colorInkLevel: 78,
          paperStatus: 'OK',
          paperLevel: 75,
          paperTrayText: 'Tray 1 (A4) - Ready',
          connectivity: 'ONLINE',
          signalStrength: 'STRONG',
          latencyMs: 14,
          lastUpdated: new Date().toISOString(),
          queueLength: 0
        },
        lastSeen: new Date().toISOString(),
        enabled: true,
        createdAt: new Date().toISOString()
      });

      const stationId = 'station-01';
      this.stations.set(stationId, {
        id: stationId,
        stationCode: 'office-printer-01',
        name: 'Station 1 - Ground Floor Print Hub',
        printerId: printerId,
        qrToken: 'qr-token-sec-9a8b7c',
        locationDesc: 'Near Reception Desk & Workstations',
        enabled: true,
        createdAt: new Date().toISOString()
      });

      const gatewayId = 'gw-office-pc-01';
      const rawToken = 'demo-gateway-token-secret-123';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      this.gatewayDevices.set(gatewayId, {
        id: gatewayId,
        name: 'Office Print Agent (Dell OptiPlex 7090)',
        stationId: stationId,
        deviceTokenHash: tokenHash,
        status: 'ONLINE',
        osInfo: 'Windows 11 Pro 64-bit / LibreOffice 7.6.4 / WinSpool',
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      this.logAudit('STORE_SEEDED', undefined, undefined, { printerId, stationId, gatewayId });
      this.save();
    }
  }

  public logAudit(event: string, jobId?: string, userId?: string, metadata?: Record<string, any>) {
    const log: AuditLogRecord = {
      id: crypto.randomUUID(),
      event,
      jobId,
      userId,
      metadata,
      createdAt: new Date().toISOString()
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 2000) {
      this.auditLogs = this.auditLogs.slice(0, 2000);
    }
    this.save();
    return log;
  }

  public findStationByCode(code: string): StationRecord | undefined {
    for (const station of this.stations.values()) {
      if (station.stationCode.toLowerCase() === code.toLowerCase() || station.id === code) {
        return station;
      }
    }
    return undefined;
  }

  public getStation(id: string): StationRecord | undefined { return this.stations.get(id); }
  public getPrinter(id: string): PrinterRecord | undefined { return this.printers.get(id); }
  public getJob(id: string): PrintJobRecord | undefined { return this.printJobs.get(id); }
  public getFile(id: string): FileRecord | undefined { return this.files.get(id); }
  public getPayment(id: string): PaymentRecord | undefined { return this.payments.get(id); }

  public findPaymentByJobId(jobId: string): PaymentRecord | undefined {
    for (const p of this.payments.values()) {
      if (p.jobId === jobId) return p;
    }
    return undefined;
  }
}

export const store = new Store();