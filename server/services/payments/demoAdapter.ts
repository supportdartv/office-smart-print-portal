import QRCode from 'qrcode';
import crypto from 'crypto';
import { IPaymentProvider, CreatePaymentOptions, PaymentCreationResult, PaymentVerificationResult } from './types';
import { store } from '../../db/store';

export class DemoPaymentAdapter implements IPaymentProvider {
  public async createPayment(options: CreatePaymentOptions): Promise<PaymentCreationResult> {
    const merchantUpi = store.settings.merchantUpiId || '7006686584@icici';
    const amountRupees = (options.amountPaise / 100).toFixed(2);
    const txnRef = `DEMO_TXN_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Demo UPI string
    const upiUri = `upi://pay?pa=${encodeURIComponent(merchantUpi)}&pn=OfficeSmartPrint_Demo&am=${amountRupees}&cu=INR&tr=${txnRef}&tn=Test_Print_${options.jobId.slice(0, 8)}`;

    const qrDataUrl = await QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#1e3a8a',
        light: '#ffffff'
      }
    });

    const paymentId = crypto.randomUUID();

    return {
      paymentId,
      provider: 'DEMO',
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
    const payment = store.payments.get(paymentId);
    if (!payment) {
      return {
        verified: false,
        paymentId,
        jobId,
        amountPaidPaise: 0,
        status: 'FAILED',
        error: 'Demo payment record not found'
      };
    }

    if (payment.verified || payment.status === 'VERIFIED') {
      return {
        verified: true,
        paymentId,
        jobId,
        amountPaidPaise: payment.amount,
        status: 'VERIFIED',
        transactionId: payment.providerPaymentId || `DEMO_VERIFIED_${Date.now()}`
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
    const paymentId = payload.paymentId;
    const jobId = payload.jobId;
    const amount = payload.amountPaise || 0;

    return {
      verified: true,
      paymentId,
      jobId,
      amountPaidPaise: amount,
      status: 'VERIFIED',
      transactionId: `DEMO_WEBHOOK_${Date.now()}`,
      rawPayload: payload
    };
  }
}
