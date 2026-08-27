import crypto from 'crypto';
import { store } from '../db/store';
import { PrintJobRecord, PrintType, PrintJobStatus } from '../types';

export class JobService {
  public static calculatePrice(printType: PrintType, pageCount: number, copies: number = 1): {
    pricePerPage: number;
    totalAmount: number;
  } {
    let pricePerPage = 0;
    if (printType === 'BLACK_WHITE') {
      pricePerPage = store.settings.blackWhitePricePaise;
    } else if (printType === 'COLOR') {
      pricePerPage = store.settings.colorPricePaise;
    } else if (printType === 'OFFICIAL') {
      pricePerPage = store.settings.officialPricePaise;
    }

    const totalAmount = pageCount * copies * pricePerPage;
    return { pricePerPage, totalAmount };
  }

  public static createJobAfterUpload(
    sessionId: string,
    fileId: string,
    stationId?: string,
    pageCount: number = 1
  ): PrintJobRecord {
    const file = store.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    let resolvedStationId = stationId;
    let resolvedPrinterId: string | undefined;

    if (stationId) {
      const station = store.getStation(stationId) || store.findStationByCode(stationId);
      if (station) {
        resolvedStationId = station.id;
        resolvedPrinterId = station.printerId;
      }
    }

    // Default station if not specified
    if (!resolvedStationId && store.stations.size > 0) {
      const firstStation = Array.from(store.stations.values())[0];
      resolvedStationId = firstStation.id;
      resolvedPrinterId = firstStation.printerId;
    }

    const jobId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + store.settings.jobExpiryMinutes * 60 * 1000).toISOString();

    const jobRecord: PrintJobRecord = {
      id: jobId,
      sessionId,
      fileId,
      stationId: resolvedStationId,
      printerId: resolvedPrinterId,
      printType: 'BLACK_WHITE',
      pageCount: file.pageCount || pageCount,
      copies: 1,
      pricePerPage: store.settings.blackWhitePricePaise,
      totalAmount: (file.pageCount || pageCount) * store.settings.blackWhitePricePaise,
      currency: 'INR',
      paymentRequired: true,
      paymentVerified: false,
      status: 'PROCESSING',
      createdAt: now.toISOString(),
      expiresAt
    };

    store.printJobs.set(jobId, jobRecord);
    store.logAudit('PRINT_JOB_CREATED', jobId, undefined, {
      fileId,
      pages: jobRecord.pageCount,
      stationId: resolvedStationId
    });
    store.save();

    return jobRecord;
  }

  public static selectPrintType(
    jobId: string,
    printType: PrintType,
    copies: number = 1
  ): { job: PrintJobRecord; nextStep: 'PAYMENT' | 'OFFICIAL_FORM' } {
    const job = store.printJobs.get(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status !== 'PROCESSING' && job.status !== 'WAITING_PAYMENT' && job.status !== 'UPLOADED') {
      throw new Error(`Cannot change print options when job is ${job.status}`);
    }

    // Server-side strictly calculated price
    const { pricePerPage, totalAmount } = this.calculatePrice(printType, job.pageCount, copies);

    job.printType = printType;
    job.copies = Math.min(1, Math.max(1, copies)); // V1 max 1 copy
    job.pricePerPage = pricePerPage;
    job.totalAmount = totalAmount;

    if (printType === 'OFFICIAL') {
      job.paymentRequired = false;
      job.status = 'OFFICIAL_PENDING_CONFIRMATION';
      store.printJobs.set(jobId, job);
      store.logAudit('PRINT_OPTION_SELECTED', jobId, undefined, { printType, price: 0, status: job.status });
      store.save();
      return { job, nextStep: 'OFFICIAL_FORM' };
    }

    job.paymentRequired = true;
    job.status = 'WAITING_PAYMENT';
    store.printJobs.set(jobId, job);
    store.logAudit('PRINT_OPTION_SELECTED', jobId, undefined, {
      printType,
      totalAmountPaise: totalAmount,
      status: job.status
    });
    store.save();

    return { job, nextStep: 'PAYMENT' };
  }

  public static confirmOfficialPrint(
    jobId: string,
    employeeId: string,
    section: string,
    purpose: string
  ): PrintJobRecord {
    const job = store.printJobs.get(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status !== 'OFFICIAL_PENDING_CONFIRMATION') {
      throw new Error(`Job is not in official confirmation state: ${job.status}`);
    }

    if (!employeeId || !section || !purpose) {
      throw new Error('Employee ID, Section, and Purpose are all required.');
    }

    const officialRecord = {
      id: crypto.randomUUID(),
      jobId,
      employeeId: employeeId.trim(),
      section: section.trim(),
      purpose: purpose.trim(),
      approved: true,
      createdAt: new Date().toISOString()
    };

    store.officialPrints.set(officialRecord.id, officialRecord);

    const now = new Date().toISOString();
    job.status = 'QUEUED';
    job.queuedAt = now;
    job.paymentVerified = true;
    store.printJobs.set(jobId, job);

    store.logAudit('OFFICIAL_PRINT_CONFIRMED', jobId, undefined, {
      employeeId: officialRecord.employeeId,
      section: officialRecord.section,
      purpose: officialRecord.purpose
    });
    store.logAudit('JOB_QUEUED', jobId, undefined, {
      stationId: job.stationId,
      pages: job.pageCount,
      printType: 'OFFICIAL'
    });
    store.save();

    return job;
  }
}
