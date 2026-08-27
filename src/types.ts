export type PrintType = 'BLACK_WHITE' | 'COLOR' | 'OFFICIAL';

export type JobStatus =
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

export type PaperStatusType = 'OK' | 'LOW' | 'EMPTY' | 'JAMMED';
export type ConnectivityStatusType = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'BUSY';

export interface PrinterHealth {
  inkLevel: number; // overall percentage (0-100)
  blackInkLevel?: number;
  colorInkLevel?: number;
  paperStatus: PaperStatusType;
  paperLevel?: number; // tray fill percentage (0-100)
  paperTrayText?: string; // e.g. "Tray 1 (A4) • Ready"
  connectivity: ConnectivityStatusType;
  signalStrength?: 'STRONG' | 'MODERATE' | 'WEAK' | 'OFFLINE';
  latencyMs?: number;
  lastUpdated?: string;
  queueLength?: number;
}

export interface StationInfo {
  id: string;
  code: string;
  name: string;
  location?: string;
  enabled: boolean;
}

export interface PrinterInfo {
  id: string;
  name: string;
  location: string;
  status: 'ONLINE' | 'ONLINE_IDLE' | 'OFFLINE' | 'BUSY' | 'ERROR';
  health?: PrinterHealth;
  inkLevel?: number;
  paperStatus?: PaperStatusType;
  connectivity?: ConnectivityStatusType;
}

export interface StationDataResponse {
  station: StationInfo;
  printer: PrinterInfo | null;
  pricing: {
    blackWhitePaise: number;
    colorPaise: number;
    officialPaise: number;
    currency: string;
  };
}

export interface UploadSuccessData {
  jobId: string;
  sessionId: string;
  file: {
    id: string;
    name: string;
    size: number;
    pageCount: number;
    type: string;
  };
  pricingPreview: {
    blackWhite: {
      pricePerPagePaise: number;
      totalAmountPaise: number;
      formatted: string;
    };
    color: {
      pricePerPagePaise: number;
      totalAmountPaise: number;
      formatted: string;
    };
    official: {
      pricePerPagePaise: number;
      totalAmountPaise: number;
      formatted: string;
    };
  };
}

export interface JobDetails {
  job: {
    id: string;
    status: JobStatus;
    printType: PrintType;
    pageCount: number;
    copies: number;
    pricePerPage: number;
    totalAmount: number;
    currency: string;
    paymentRequired: boolean;
    paymentVerified: boolean;
    createdAt: string;
    paidAt?: string;
    queuedAt?: string;
    startedAt?: string;
    completedAt?: string;
    failedAt?: string;
    failReason?: string;
    expiresAt: string;
  };
  file: {
    id: string;
    name: string;
    size: number;
    mimeType: string;
    status: string;
  } | null;
  station: {
    id: string;
    name: string;
    code: string;
  } | null;
  printer: {
    id: string;
    name: string;
    location: string;
  } | null;
  payment: {
    id: string;
    amount: number;
    status: string;
    verified: boolean;
    provider: string;
    transactionRef?: string;
  } | null;
}

export interface PaymentCreationResponse {
  paymentId: string;
  provider: 'UPI_DIRECT' | 'RAZORPAY' | 'CASHFREE' | 'DEMO';
  amountPaise: number;
  amountFormatted: string;
  currency: string;
  upiUri?: string;
  upiQrDataUrl?: string;
  merchantUpiId: string;
  transactionRef: string;
  providerPaymentId?: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED';
  expiresInSeconds: number;
}
