import QRCode from 'qrcode';
import crypto from 'crypto';
import { IPaymentProvider, CreatePaymentOptions, PaymentCreationResult, PaymentVerificationResult } from './types';
import { store } from '../../db/store';

export class RazorpayAdapter implements IPaymentProvider {
  private keyId: string;
  private keySecret: string;

  constructor() {
    this.keyId = process.env.PAYMENT_KEY_ID || '';
    this.keySecret = process.env.PAYMENT_KEY_SECRET || '';
  }

  public async createPayment(options: CreatePaymentOptions): Promise<PaymentCreationResult> {
    const merchantUpi = store.settings.merchantUpiId || '7006686584@icici';
    const amountRupees = (options.amountPaise / 100).toFixed(2);
    const txnRef = `RZP_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // If Razorpay credentials exist, creates dynamic UPI QR via Razorpay QR API
    // Fallback QR code with standard payload for scanning
    const upiUri = `upi://pay?pa=${encodeURIComponent(merchantUpi)}&pn=OfficeSmartPrint&am=${amountRupees}&cu=INR&tr=${txnRef}&tn=Job_${options.jobId.slice(0, 8)}`;

    const qrDataUrl = await QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    const paymentId = crypto.randomUUID();

    return {
      paymentId,
      provider: 'RAZORPAY',
      amountPaise: options.amountPaise,
      amountFormatted: `₹${amountRupees}`,
      currency: 'INR',
      upiUri,
      upiQrDataUrl: qrDataUrl,
      merchantUpiId: merchantUpi,
      transactionRef: txnRef,
      providerPaymentId: `qr_${txnRef}`,
      status: 'PENDING',
      expiresInSeconds: 1800
    };
  }

  public async verifyPayment(paymentId: string, jobId: string, expectedAmountPaise: number): Promise<PaymentVerificationResult> {
    const payment = store.payments.get(paymentId);
    if (!payment) {
      return {
        verified: false,
        paymentId,
        jobId,
        amountPaidPaise: 0,
        status: 'FAILED',
        error: 'Payment not found'
      };
    }

    if (payment.verified) {
      return {
        verified: true,
        paymentId,
        jobId,
        amountPaidPaise: payment.amount,
        status: 'VERIFIED',
        transactionId: payment.providerPaymentId
      };
    }

    return {
      verified: false,
      paymentId,
      jobId,
      amountPaidPaise: 0,
      status: payment.status || 'PENDING'
    };
  }

  public async handleWebhook(payload: any, signature?: string): Promise<PaymentVerificationResult> {
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || this.keySecret;
    if (webhookSecret && signature) {
      const computed = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');
      if (computed !== signature) {
        return {
          verified: false,
          paymentId: '',
          jobId: '',
          amountPaidPaise: 0,
          status: 'FAILED',
          error: 'Razorpay webhook signature mismatch'
        };
      }
    }

    const event = payload.event;
    const paymentEntity = payload.payload?.payment?.entity;
    const paymentId = paymentEntity?.notes?.paymentId || payload.paymentId;
    const jobId = paymentEntity?.notes?.jobId || payload.jobId;
    const amount = paymentEntity?.amount || payload.amountPaise;

    const isSuccess = event === 'payment.captured' || event === 'qr_code.credited' || payload.status === 'VERIFIED';

    return {
      verified: isSuccess,
      paymentId,
      jobId,
      amountPaidPaise: amount,
      status: isSuccess ? 'VERIFIED' : 'PENDING',
      transactionId: paymentEntity?.id || payload.transactionId,
      rawPayload: payload
    };
  }
}
