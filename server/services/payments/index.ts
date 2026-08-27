import { IPaymentProvider, CreatePaymentOptions, PaymentCreationResult, PaymentVerificationResult } from './types';
import { UpiDirectAdapter } from './upiAdapter';
import { DemoPaymentAdapter } from './demoAdapter';
import { RazorpayAdapter } from './razorpayAdapter';
import { store } from '../../db/store';
import { PaymentRecord } from '../../types';

export class PaymentManager {
  private providers: Map<string, IPaymentProvider> = new Map();

  constructor() {
    this.providers.set('UPI_DIRECT', new UpiDirectAdapter());
    this.providers.set('DEMO', new DemoPaymentAdapter());
    this.providers.set('RAZORPAY', new RazorpayAdapter());
  }

  public getActiveProvider(): { name: string; provider: IPaymentProvider } {
    // If in production and provider is configured
    const configured = store.settings.paymentProvider;
    if (process.env.NODE_ENV === 'production') {
      if (configured === 'DEMO') {
        // Enforce UPI_DIRECT or RAZORPAY in production
        return { name: 'UPI_DIRECT', provider: this.providers.get('UPI_DIRECT')! };
      }
    }

    if (this.providers.has(configured)) {
      return { name: configured, provider: this.providers.get(configured)! };
    }
    return { name: 'DEMO', provider: this.providers.get('DEMO')! };
  }

  public async createPaymentForJob(jobId: string): Promise<PaymentCreationResult> {
    const job = store.printJobs.get(jobId);
    if (!job) {
      throw new Error('Print job not found');
    }

    if (job.status !== 'WAITING_PAYMENT') {
      throw new Error(`Cannot create payment for job with status ${job.status}`);
    }

    // Check if an active payment already exists (Idempotency Protection)
    const existingPayment = store.findPaymentByJobId(jobId);
    if (existingPayment && existingPayment.status === 'PENDING') {
      // Return existing pending payment details
      const { provider } = this.getActiveProvider();
      const upiResult = await provider.createPayment({
        jobId: job.id,
        amountPaise: job.totalAmount,
        currency: job.currency,
        pageCount: job.pageCount
      });

      // Update existing record
      existingPayment.providerPaymentId = upiResult.providerPaymentId;
      store.payments.set(existingPayment.id, existingPayment);
      store.save();

      return {
        ...upiResult,
        paymentId: existingPayment.id
      };
    }

    const { name, provider } = this.getActiveProvider();
    const result = await provider.createPayment({
      jobId: job.id,
      amountPaise: job.totalAmount,
      currency: job.currency,
      pageCount: job.pageCount
    });

    const paymentRecord: PaymentRecord = {
      id: result.paymentId,
      jobId: job.id,
      provider: name as any,
      providerPaymentId: result.providerPaymentId,
      providerQrId: result.transactionRef,
      amount: job.totalAmount,
      currency: job.currency,
      status: 'PENDING',
      verified: false,
      webhookVerified: false,
      createdAt: new Date().toISOString()
    };

    store.payments.set(result.paymentId, paymentRecord);
    store.logAudit('PAYMENT_CREATED', job.id, undefined, {
      paymentId: result.paymentId,
      amountPaise: job.totalAmount,
      provider: name
    });
    store.save();

    return result;
  }

  public async verifyAndUnlockJob(
    paymentId: string,
    isWebhook: boolean = false,
    rawPayload?: any
  ): Promise<{ success: boolean; message: string; jobStatus?: string }> {
    const payment = store.payments.get(paymentId);
    if (!payment) {
      return { success: false, message: 'Payment record not found' };
    }

    const job = store.printJobs.get(payment.jobId);
    if (!job) {
      return { success: false, message: 'Associated print job not found' };
    }

    // Strict validation: Expected amount must match job total amount
    if (payment.amount !== job.totalAmount) {
      store.logAudit('PAYMENT_AMOUNT_MISMATCH', job.id, undefined, {
        paid: payment.amount,
        expected: job.totalAmount
      });
      return { success: false, message: 'Payment amount mismatch. Verification failed.' };
    }

    // State machine check
    if (job.status === 'PAID' || job.status === 'QUEUED' || job.status === 'PRINTING' || job.status === 'COMPLETED') {
      return { success: true, message: 'Payment already verified and processed', jobStatus: job.status };
    }

    if (job.status !== 'WAITING_PAYMENT') {
      return { success: false, message: `Job in invalid status for payment: ${job.status}` };
    }

    // Mark payment as verified
    const now = new Date().toISOString();
    payment.status = 'VERIFIED';
    payment.verified = true;
    payment.webhookVerified = isWebhook;
    payment.completedAt = now;
    if (rawPayload) payment.rawPayload = rawPayload;
    store.payments.set(payment.id, payment);

    // Atomically transition job: WAITING_PAYMENT -> PAID -> QUEUED
    job.paymentVerified = true;
    job.paidAt = now;
    job.status = 'QUEUED';
    job.queuedAt = now;
    store.printJobs.set(job.id, job);

    store.logAudit('PAYMENT_VERIFIED', job.id, undefined, {
      paymentId: payment.id,
      amountPaise: payment.amount,
      isWebhook
    });
    store.logAudit('JOB_QUEUED', job.id, undefined, {
      stationId: job.stationId,
      pages: job.pageCount,
      printType: job.printType
    });
    store.save();

    return { success: true, message: 'Payment verified and job queued for printing', jobStatus: 'QUEUED' };
  }
}

export const paymentManager = new PaymentManager();
