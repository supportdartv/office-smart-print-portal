export type PrintJobStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'WAITING_PAYMENT'
  | 'PAYMENT_FAILED'
  | 'PAID'
  | 'QUEUED'
  | 'PRINTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'OFFICIAL_PENDING_CONFIRMATION';

export type PrintType = 'BLACK_WHITE' | 'COLOR' | 'OFFICIAL';

export interface FileRecord {
  id: string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  pageCount: number;
  checksum: string;
  status: 'READY' | 'PROCESSING' | 'DELETED';
  createdAt: string;
  expiresAt: string;
}

export interface PrintJobRecord {
  id: string;
  sessionId: string;
  fileId: string;
  stationId?: string;
  printerId?: string;
  printType: PrintType;
  pageCount: number;
  copies: number;
  pricePerPage: number; // in paise
  totalAmount: number; // in paise
  currency: string;
  paymentRequired: boolean;
  paymentVerified: boolean;
  status: PrintJobStatus;
  claimedByGatewayId?: string;
  claimedAt?: string;
  createdAt: string;
  paidAt?: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  failReason?: string;
  expiresAt: string;
}

export interface PaymentRecord {
  id: string;
  jobId: string;
  provider: 'UPI_DIRECT' | 'RAZORPAY' | 'CASHFREE' | 'DEMO';
  providerPaymentId?: string;
  providerQrId?: string;
  amount: number; // in paise
  currency: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED' | 'EXPIRED';
  verified: boolean;
  webhookVerified: boolean;
  rawPayload?: any;
  createdAt: string;
  completedAt?: string;
}

export interface OfficialPrintRecord {
  id: string;
  jobId: string;
  employeeId: string;
  section: string;
  purpose: string;
  approved: boolean;
  createdAt: string;
}

export type PaperStatusType = 'OK' | 'LOW' | 'EMPTY' | 'JAMMED';
export type ConnectivityStatusType = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'BUSY';

export interface PrinterHealthRecord {
  inkLevel: number; // 0-100%
  blackInkLevel?: number;
  colorInkLevel?: number;
  paperStatus: PaperStatusType;
  paperLevel?: number; // 0-100%
  paperTrayText?: string;
  connectivity: ConnectivityStatusType;
  signalStrength?: 'STRONG' | 'MODERATE' | 'WEAK' | 'OFFLINE';
  latencyMs?: number;
  lastUpdated: string;
  queueLength?: number;
}

export interface PrinterRecord {
  id: string;
  name: string;
  ipAddress: string;
  hostname?: string;
  location: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'ERROR';
  health?: PrinterHealthRecord;
  lastSeen: string;
  enabled: boolean;
  createdAt: string;
}

export interface StationRecord {
  id: string;
  stationCode: string; // e.g. 'office-printer-01'
  name: string;
  printerId?: string;
  qrToken: string;
  locationDesc?: string;
  enabled: boolean;
  createdAt: string;
}

export interface GatewayDeviceRecord {
  id: string;
  name: string;
  stationId: string;
  deviceTokenHash: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY';
  osInfo?: string;
  lastSeen: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  event: string;
  jobId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AppSettings {
  blackWhitePricePaise: number; // default 200 (₹2)
  colorPricePaise: number; // default 500 (₹5)
  officialPricePaise: number; // 0
  merchantUpiId: string; // default "7006686584@icici"
  merchantName: string;
  paymentProvider: string; // 'UPI_DIRECT' | 'RAZORPAY' | 'CASHFREE' | 'DEMO'
  demoMode: boolean;
  fileRetentionMinutes: number; // 10 minutes
  jobExpiryMinutes: number; // 30 minutes
}
