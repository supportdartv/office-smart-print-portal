export interface CreatePaymentOptions {
  jobId: string;
  amountPaise: number; // in smallest unit (paise)
  currency: string;
  stationName?: string;
  documentName?: string;
  pageCount: number;
}

export interface PaymentCreationResult {
  paymentId: string;
  provider: 'UPI_DIRECT' | 'RAZORPAY' | 'CASHFREE' | 'DEMO';
  amountPaise: number;
  amountFormatted: string; // e.g. "₹16.00"
  currency: string;
  upiUri?: string;
  upiQrDataUrl?: string;
  merchantUpiId: string;
  transactionRef: string;
  providerPaymentId?: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED';
  expiresInSeconds: number;
}

export interface PaymentVerificationResult {
  verified: boolean;
  paymentId: string;
  jobId: string;
  amountPaidPaise: number;
  status: 'VERIFIED' | 'PENDING' | 'FAILED' | 'EXPIRED';
  transactionId?: string;
  rawPayload?: any;
  error?: string;
}

export interface IPaymentProvider {
  createPayment(options: CreatePaymentOptions): Promise<PaymentCreationResult>;
  verifyPayment(paymentId: string, jobId: string, expectedAmountPaise: number): Promise<PaymentVerificationResult>;
  handleWebhook(payload: any, signature?: string): Promise<PaymentVerificationResult>;
}
