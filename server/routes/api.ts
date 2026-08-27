import express, { Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { store } from '../db/store';
import { storageService } from '../services/storage';
import { PageCounterService } from '../services/pageCounter';
import { JobService } from '../services/jobService';
import { paymentManager } from '../services/payments';

export const publicApiRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const allowedExts = ['pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png'];

    if (allowedMimes.includes(file.mimetype) || (ext && allowedExts.includes(ext))) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload PDF, DOCX, JPG or PNG.'));
    }
  }
});

// 1. POST /api/sessions
publicApiRouter.post('/sessions', (req: Request, res: Response) => {
  const sessionId = crypto.randomUUID();
  store.logAudit('USER_SESSION_CREATED', undefined, undefined, {
    sessionId,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  res.json({
    success: true,
    data: {
      sessionId,
      settings: {
        bwPricePaise: store.settings.blackWhitePricePaise,
        colorPricePaise: store.settings.colorPricePaise,
        merchantUpiId: store.settings.merchantUpiId,
        demoMode: store.settings.demoMode
      }
    }
  });
});

// 2. GET /api/stations/:id
publicApiRouter.get('/stations/:id', (req: Request, res: Response) => {
  const stationId = req.params.id;
  const station = store.getStation(stationId) || store.findStationByCode(stationId);

  if (!station) {
    return res.status(404).json({
      success: false,
      error: { code: 'STATION_NOT_FOUND', message: 'The requested printing station was not found.' }
    });
  }

  const printer = station.printerId ? store.getPrinter(station.printerId) : undefined;
  let hasOnlineGateway = false;
  let activeGatewayDevice: any = null;
  const now = Date.now();

  for (const gw of store.gatewayDevices.values()) {
    if (gw.stationId === station.id) {
      const lastSeenMs = new Date(gw.lastSeen).getTime();
      if (now - lastSeenMs < 3 * 60 * 1000) {
        hasOnlineGateway = true;
        activeGatewayDevice = gw;
        break;
      }
    }
  }

  const printerStatus = printer ? (printer.enabled ? (hasOnlineGateway ? 'ONLINE' : 'ONLINE_IDLE') : 'OFFLINE') : 'OFFLINE';

  const defaultHealth = {
    inkLevel: 82,
    blackInkLevel: 85,
    colorInkLevel: 78,
    paperStatus: 'OK' as const,
    paperLevel: 75,
    paperTrayText: 'Tray 1 (A4) - Ready',
    connectivity: printerStatus === 'OFFLINE' ? 'OFFLINE' as const : 'ONLINE' as const,
    signalStrength: 'STRONG' as const,
    latencyMs: 14,
    lastUpdated: printer?.lastSeen || new Date().toISOString(),
    queueLength: 0
  };

  const healthData = printer?.health ? {
    ...defaultHealth,
    ...printer.health,
    connectivity: printerStatus === 'OFFLINE' ? 'OFFLINE' as const : (printer.health.connectivity || 'ONLINE')
  } : defaultHealth;

  res.json({
    success: true,
    data: {
      station: {
        id: station.id,
        code: station.stationCode,
        name: station.name,
        location: station.locationDesc,
        enabled: station.enabled
      },
      printer: printer
        ? {
            id: printer.id,
            name: printer.name,
            location: printer.location,
            status: printerStatus,
            health: healthData,
            inkLevel: healthData.inkLevel,
            paperStatus: healthData.paperStatus,
            connectivity: healthData.connectivity
          }
        : null,
      gateway: activeGatewayDevice
        ? {
            id: activeGatewayDevice.id,
            name: activeGatewayDevice.name,
            status: activeGatewayDevice.status,
            lastSeen: activeGatewayDevice.lastSeen
          }
        : null,
      pricing: {
        blackWhitePaise: store.settings.blackWhitePricePaise,
        colorPaise: store.settings.colorPricePaise,
        officialPaise: 0,
        currency: 'INR'
      }
    }
  });
});

// 2b. GET /api/stations/:id/health
publicApiRouter.get('/stations/:id/health', (req: Request, res: Response) => {
  const stationId = req.params.id;
  const station = store.getStation(stationId) || store.findStationByCode(stationId);

  if (!station) {
    return res.status(404).json({
      success: false,
      error: { code: 'STATION_NOT_FOUND', message: 'The requested printing station was not found.' }
    });
  }

  const printer = station.printerId ? store.getPrinter(station.printerId) : undefined;
  const now = Date.now();
  let hasOnlineGateway = false;

  for (const gw of store.gatewayDevices.values()) {
    if (gw.stationId === station.id) {
      const lastSeenMs = new Date(gw.lastSeen).getTime();
      if (now - lastSeenMs < 3 * 60 * 1000) {
        hasOnlineGateway = true;
        break;
      }
    }
  }

  const printerStatus = printer ? (printer.enabled ? (hasOnlineGateway ? 'ONLINE' : 'ONLINE_IDLE') : 'OFFLINE') : 'OFFLINE';

  const defaultHealth = {
    inkLevel: 82,
    blackInkLevel: 85,
    colorInkLevel: 78,
    paperStatus: 'OK' as const,
    paperLevel: 75,
    paperTrayText: 'Tray 1 (A4) - Ready',
    connectivity: printerStatus === 'OFFLINE' ? 'OFFLINE' as const : 'ONLINE' as const,
    signalStrength: 'STRONG' as const,
    latencyMs: 14,
    lastUpdated: printer?.lastSeen || new Date().toISOString(),
    queueLength: 0
  };

  const healthData = printer?.health ? {
    ...defaultHealth,
    ...printer.health,
    connectivity: printerStatus === 'OFFLINE' ? 'OFFLINE' as const : (printer.health.connectivity || 'ONLINE')
  } : defaultHealth;

  res.json({
    success: true,
    data: {
      printerId: printer?.id,
      printerName: printer?.name,
      status: printerStatus,
      health: healthData,
      timestamp: new Date().toISOString()
    }
  });
});

// 2c. GET /api/gateway/download-zip
publicApiRouter.get('/gateway/download-zip', async (req: Request, res: Response) => {
  try {
    const stationCode = (req.query.stationCode as string) || 'office-printer-01';
    const serverUrl = `${req.protocol}://${req.get('host')}`;
    const gatewayDir = path.join(process.cwd(), 'print-gateway');
    const zip = new JSZip();

    if (fs.existsSync(gatewayDir)) {
      const files = fs.readdirSync(gatewayDir);
      for (const file of files) {
        const fullPath = path.join(gatewayDir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          const content = fs.readFileSync(fullPath);
          zip.file(`office-print-gateway/${file}`, content);
        }
      }
    }

    const preconfiguredEnv = `# Office Smart Print Gateway - Preconfigured Production Settings
SERVER_URL=${serverUrl}
GATEWAY_ID=gw-office-pc-01
GATEWAY_DEVICE_TOKEN=demo-gateway-token-secret-123
STATION_ID=${stationCode}
PRINTER_NAME=HP LaserJet Pro M404dw
POLL_INTERVAL_SECONDS=3
HEARTBEAT_INTERVAL_SECONDS=30
TEMP_DIR=./temp_jobs`;

    zip.file('office-print-gateway/.env', preconfiguredEnv);
    zip.file(
      'office-print-gateway/START_HERE_README.txt',
      `========================================================================
OFFICE SMART PRINT GATEWAY - OFFLINE ZERO-DEPENDENCY PACKAGE
========================================================================

Everything you need to connect your Office PC and Printer is included here!

FAST 1-MINUTE SETUP:
1. Extract this entire zip file to a folder on your Windows PC (e.g. C:\\OfficeSmartPrint)
2. Double-click "run_gateway.bat" (or run "python gateway.py")

3. That's it! The gateway will automatically connect to ${serverUrl} 
   and start processing print jobs dispatched from phones.

FEATURES:
- 100% Offline Ready: Zero pip packages required (Pure Python 3 standard library).
- Auto-configured .env targeting station: ${stationCode}
- Automatic cleanup of temporary print files after sending to Windows spooler.
========================================================================`
    );

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="office-print-gateway-${stationCode}.zip"`);
    res.setHeader('Content-Length', zipBuffer.length.toString());
    res.send(zipBuffer);
  } catch (err: any) {
    console.error('Error generating gateway zip:', err);
    res.status(500).json({
      success: false,
      error: { code: 'ZIP_GENERATION_FAILED', message: 'Failed to generate gateway zip package.' }
    });
  }
});

// 3. POST /api/upload
publicApiRouter.post('/upload', (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) {
      let msg = err.message || 'File upload failed';
      if (err.code === 'LIMIT_FILE_SIZE') {
        msg = 'File size exceeds maximum allowed limit of 20 MB.';
      }
      return res.status(400).json({
        success: false,
        error: { code: 'UPLOAD_ERROR', message: msg }
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'Please select a document or image to upload.' }
      });
    }

    try {
      const sessionId = (req.body.sessionId as string) || crypto.randomUUID();
      const stationCode = req.body.stationId as string;
      const fileId = crypto.randomUUID();

      const pageResult = await PageCounterService.countPages(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );

      // FIX: Changed to await the Supabase Storage upload
      const fileRecord = await storageService.saveFile(
        fileId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        pageResult.pageCount
      );

      const job = JobService.createJobAfterUpload(
        sessionId,
        fileId,
        stationCode,
        pageResult.pageCount
      );

      res.json({
        success: true,
        data: {
          jobId: job.id,
          sessionId,
          file: {
            id: fileRecord.id,
            name: fileRecord.originalFilename,
            size: fileRecord.fileSize,
            pageCount: fileRecord.pageCount,
            type: pageResult.type
          },
          pricingPreview: {
            blackWhite: {
              pricePerPagePaise: store.settings.blackWhitePricePaise,
              totalAmountPaise: fileRecord.pageCount * store.settings.blackWhitePricePaise,
              formatted: `₹${((fileRecord.pageCount * store.settings.blackWhitePricePaise) / 100).toFixed(2)}`
            },
            color: {
              pricePerPagePaise: store.settings.colorPricePaise,
              totalAmountPaise: fileRecord.pageCount * store.settings.colorPricePaise,
              formatted: `₹${((fileRecord.pageCount * store.settings.colorPricePaise) / 100).toFixed(2)}`
            },
            official: {
              pricePerPagePaise: 0,
              totalAmountPaise: 0,
              formatted: 'FREE'
            }
          }
        }
      });
    } catch (countErr: any) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'PAGE_COUNT_FAILED',
          message: countErr.message || 'Unable to determine document pages. Please upload a PDF or contact the administrator.'
        }
      });
    }
  });
});

// 4. GET /api/jobs/:id
publicApiRouter.get('/jobs/:id', (req: Request, res: Response) => {
  const jobId = req.params.id;
  const job = store.getJob(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: 'Print job not found.' }
    });
  }

  const file = store.getFile(job.fileId);
  const station = job.stationId ? store.getStation(job.stationId) : undefined;
  const printer = job.printerId ? store.getPrinter(job.printerId) : undefined;
  const payment = store.findPaymentByJobId(job.id);

  res.json({
    success: true,
    data: {
      job: {
        id: job.id,
        status: job.status,
        printType: job.printType,
        pageCount: job.pageCount,
        copies: job.copies,
        pricePerPage: job.pricePerPage,
        totalAmount: job.totalAmount,
        currency: job.currency,
        paymentRequired: job.paymentRequired,
        paymentVerified: job.paymentVerified,
        createdAt: job.createdAt,
        paidAt: job.paidAt,
        queuedAt: job.queuedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        failedAt: job.failedAt,
        failReason: job.failReason,
        expiresAt: job.expiresAt
      },
      file: file
        ? {
            id: file.id,
            name: file.originalFilename,
            size: file.fileSize,
            mimeType: file.mimeType,
            status: file.status
          }
        : null,
      station: station
        ? {
            id: station.id,
            name: station.name,
            code: station.stationCode
          }
        : null,
      printer: printer
        ? {
            id: printer.id,
            name: printer.name,
            location: printer.location
          }
        : null,
      payment: payment
        ? {
            id: payment.id,
            amount: payment.amount,
            status: payment.status,
            verified: payment.verified,
            provider: payment.provider,
            transactionRef: payment.providerQrId
          }
        : null
    }
  });
});

// 5. POST /api/jobs/:id/select-print-type
publicApiRouter.post('/jobs/:id/select-print-type', (req: Request, res: Response) => {
  const jobId = req.params.id;
  const { printType, copies } = req.body;

  if (!['BLACK_WHITE', 'COLOR', 'OFFICIAL'].includes(printType)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PRINT_TYPE', message: 'Print type must be BLACK_WHITE, COLOR, or OFFICIAL' }
    });
  }

  try {
    const result = JobService.selectPrintType(jobId, printType, copies || 1);
    res.json({
      success: true,
      data: {
        job: result.job,
        nextStep: result.nextStep
      }
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'STATE_ERROR', message: err.message }
    });
  }
});

// 6. POST /api/jobs/:id/official-confirm
publicApiRouter.post('/jobs/:id/official-confirm', (req: Request, res: Response) => {
  const jobId = req.params.id;
  const { employeeId, section, purpose } = req.body;

  try {
    const job = JobService.confirmOfficialPrint(jobId, employeeId, section, purpose);
    res.json({
      success: true,
      data: {
        job,
        message: 'Official print request confirmed and queued.'
      }
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'CONFIRM_ERROR', message: err.message }
    });
  }
});

// 7. POST /api/payments/create
publicApiRouter.post('/payments/create', async (req: Request, res: Response) => {
  const { jobId } = req.body;

  if (!jobId) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_JOB_ID', message: 'Job ID is required' }
    });
  }

  try {
    const paymentResult = await paymentManager.createPaymentForJob(jobId);
    res.json({
      success: true,
      data: paymentResult
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'PAYMENT_CREATION_FAILED', message: err.message }
    });
  }
});

// 8. GET /api/payments/status/:id
publicApiRouter.get('/payments/status/:id', (req: Request, res: Response) => {
  const paymentId = req.params.id;
  const payment = store.getPayment(paymentId);

  if (!payment) {
    return res.status(404).json({
      success: false,
      error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment record not found' }
    });
  }

  const job = store.getJob(payment.jobId);

  res.json({
    success: true,
    data: {
      paymentId: payment.id,
      jobId: payment.jobId,
      status: payment.status,
      verified: payment.verified,
      amountPaise: payment.amount,
      amountFormatted: `₹${(payment.amount / 100).toFixed(2)}`,
      jobStatus: job?.status || 'UNKNOWN',
      completedAt: payment.completedAt
    }
  });
});

// 9. POST /api/payments/simulate-demo
publicApiRouter.post('/payments/simulate-demo', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production' && !store.settings.demoMode) {
    return res.status(403).json({
      success: false,
      error: { code: 'DEMO_DISABLED', message: 'Demo mode is strictly disabled in production.' }
    });
  }

  const { paymentId, jobId } = req.body;
  let targetPaymentId = paymentId;

  if (!targetPaymentId && jobId) {
    const p = store.findPaymentByJobId(jobId);
    if (p) targetPaymentId = p.id;
  }

  if (!targetPaymentId) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_PAYMENT_ID', message: 'Payment ID is required.' }
    });
  }

  const result = await paymentManager.verifyAndUnlockJob(targetPaymentId, false, { simulated: true });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VERIFICATION_FAILED', message: result.message }
    });
  }

  res.json({
    success: true,
    data: {
      message: 'Demo payment simulated and verified successfully.',
      jobStatus: result.jobStatus
    }
  });
});

// 10. POST /api/payments/webhook
publicApiRouter.post('/payments/webhook', async (req: Request, res: Response) => {
  const signature = (req.headers['x-razorpay-signature'] ||
    req.headers['x-webhook-signature'] ||
    req.headers['signature']) as string | undefined;

  try {
    const { provider } = paymentManager.getActiveProvider();
    const verification = await provider.handleWebhook(req.body, signature);

    if (!verification.verified || !verification.paymentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'WEBHOOK_FAILED', message: verification.error || 'Webhook verification failed' }
      });
    }

    const unlockResult = await paymentManager.verifyAndUnlockJob(
      verification.paymentId,
      true,
      verification.rawPayload
    );

    res.json({
      success: true,
      data: unlockResult
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'WEBHOOK_SERVER_ERROR', message: err.message }
    });
  }
});

// 11. GET /api/files/download
publicApiRouter.get('/files/download', async (req: Request, res: Response) => {
  const { fileId, token } = req.query as { fileId: string; token: string };

  if (!fileId || !token) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_PARAMS', message: 'fileId and token are required' }
    });
  }

  const verification = storageService.verifySignedDownloadToken(token);
  if (!verification.valid || verification.fileId !== fileId) {
    return res.status(403).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: verification.reason || 'Unauthorized download token' }
    });
  }

  const file = store.getFile(fileId);
  if (!file || file.status === 'DELETED') {
    return res.status(404).json({
      success: false,
      error: { code: 'FILE_NOT_FOUND', message: 'Document file not found or expired' }
    });
  }

  // FIX: Redirect PC Gateway to Supabase's secure download URL rather than local disk
  if (store.supabase) {
    const { data, error } = await store.supabase.storage.from('print-files').createSignedUrl(file.storagePath, 300);
    if (data?.signedUrl) {
      return res.redirect(data.signedUrl);
    }
  }

  // Fallback to local sendFile if running entirely locally without Supabase
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.originalFilename}"`);
  res.sendFile(file.storagePath);
});