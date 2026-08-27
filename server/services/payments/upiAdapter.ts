import QRCode from 'qrcode';
import crypto from 'crypto';
import { IPaymentProvider, CreatePaymentOptions, PaymentCreationResult, PaymentVerificationResult } from './types';
import { store } from '../../db/store';

export class UpiDirectAdapter implements IPaymentProvider {
  public async createPayment(options: CreatePaymentOptions): Promise<PaymentCreationResult> {
    const merchantUpi = store.settings.merchantUpiId || '7006686584@icici';
    const merchantName = store.settings.merchantName || 'Office Smart Print';
    const amountRupees = (options.amountPaise / 100).toFixed(2);
    const txnRef = `TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const note = `PrintJob_${options.jobId.slice(0, 8)}`;

    // Standard NPCI UPI URI Specification
    const upiUri = `upi://pay?pa=${encodeURIComponent(merchantUpi)}&pn=${encodeURIComponent(
      merchantName
    )}&am=${amountRupees}&cu=INR&tr=${txnRef}&tn=${encodeURIComponent(note)}`;

    // Generate QR Code data URL
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
      provider: 'UPI_DIRECT',
      amountPaise: options.amountPaise,
      amountFormatted: `₹${amountRupees}`,
      currency: 'INR',
      upiUri,
      upiQrDataUrl: qrDataUrl,
      merchantUpiId: merchantUpi,
      transactionRef: txnRef,
      providerPaymentId: txnRef,
      status: 'PENDING',
      expiresInSeconds: 1800
    };
  }

  public async verifyPayment(paymentId: string, jobId: string, expectedAmountPaise: number): Promise<PaymentVerificationResult> {
    // In production UPI webhook or bank API integration, status is confirmed by incoming bank/gateway push
    const payment = store.payments.get(paymentId);
    if (!payment) {
      return {
        verified: false,
        paymentId,
        jobId,
        amountPaidPaise: 0,
        status: 'FAILED',
        error: 'Payment record not found'
      };
    }

    if (payment.verified && payment.status === 'VERIFIED') {
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
    // Webhook verification for incoming bank/PSP webhook
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const computed = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');
      if (computed !== signature) {
        return {
          verified: false,
          paymentId: payload.paymentId || '',
          jobId: payload.jobId || '',
          amountPaidPaise: 0,
          status: 'FAILED',
          error: 'Invalid webhook signature'
        };
      }
    }

    const paymentId = payload.paymentId || payload.payment_id;
    const jobId = payload.jobId || payload.job_id;
    const amount = payload.amountPaise || (payload.amount ? Math.round(Number(payload.amount) * 100) : 0);
    const txnId = payload.transactionId || payload.txn_id || `BANK_${Date.now()}`;

    return {
      verified: true,
      paymentId,
      jobId,
      amountPaidPaise: amount,
      status: 'VERIFIED',
      transactionId: txnId,
      rawPayload: payload
    };
  }
}
