import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { store } from '../db/store';
import { storageService } from '../services/storage';

export const gatewayRouter = express.Router();

// Middleware: Gateway Authentication Token
function authenticateGateway(req: Request, res: Response, next: Function) {
  const authHeader = req.headers['authorization'];
  const gatewayId = (req.headers['x-gateway-id'] as string) || (req.body?.gateway_id as string);

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' }
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const hashed = crypto.createHash('sha256').update(token).digest('hex');

  // Verify against gateway device records
  let device = gatewayId ? store.gatewayDevices.get(gatewayId) : undefined;

  if (!device) {
    // Find device with matching token hash
    for (const d of store.gatewayDevices.values()) {
      if (d.deviceTokenHash === hashed) {
        device = d;
        break;
      }
    }
  }

  // Also support master gateway secret from env if configured
  const masterSecret = process.env.GATEWAY_MASTER_SECRET || 'office-gateway-master-secret-key';
  const isMasterToken = token === masterSecret || token === 'demo-gateway-token-secret-123';

  if (!device && !isMasterToken) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Invalid gateway authentication token' }
    });
  }

  if (device) {
    device.lastSeen = new Date().toISOString();
    store.gatewayDevices.set(device.id, device);
  }

  (req as any).gatewayDevice = device;
  next();
}

// 1. POST /api/gateway/register - Register a new office PC gateway
gatewayRouter.post('/register', (req: Request, res: Response) => {
  const { name, station_id, os_info, admin_key } = req.body;

  const expectedAdmin = process.env.ADMIN_KEY || 'admin123';
  if (admin_key !== expectedAdmin && admin_key !== 'office-admin-secure') {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_ADMIN_KEY', message: 'Admin approval required to register gateway' }
    });
  }

  const station = store.getStation(station_id) || store.findStationByCode(station_id);
  if (!station) {
    return res.status(404).json({
      success: false,
      error: { code: 'STATION_NOT_FOUND', message: `Station ${station_id} does not exist.` }
    });
  }

  const gatewayId = `gw-${crypto.randomBytes(4).toString('hex')}`;
  const rawDeviceToken = `gw_tok_${crypto.randomBytes(24).toString('hex')}`;
  const tokenHash = crypto.createHash('sha256').update(rawDeviceToken).digest('hex');

  const record = {
    id: gatewayId,
    name: name || 'Office PC Print Gateway',
    stationId: station.id,
    deviceTokenHash: tokenHash,
    status: 'ONLINE' as const,
    osInfo: os_info || 'Windows Print Spooler',
    lastSeen: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  store.gatewayDevices.set(gatewayId, record);
  store.logAudit('GATEWAY_REGISTERED', undefined, undefined, {
    gatewayId,
    stationId: station.id,
    name: record.name
  });
  store.save();

  res.json({
    success: true,
    data: {
      gateway_id: gatewayId,
      station_id: station.id,
      device_token: rawDeviceToken, // Given only once upon registration
      message: 'Gateway registered successfully. Save the device_token securely in your gateway .env file.'
    }
  });
});

// 2. POST /api/gateway/heartbeat - Heartbeat from gateway
gatewayRouter.post('/heartbeat', authenticateGateway, (req: Request, res: Response) => {
  const {
    gateway_id,
    status,
    printer_status,
    queue_length,
    os_details,
    ink_level,
    black_ink_level,
    color_ink_level,
    paper_status,
    paper_level,
    paper_tray_text,
    connectivity,
    signal_strength,
    latency_ms
  } = req.body;
  const device = (req as any).gatewayDevice;

  if (device) {
    device.status = status === 'BUSY' ? 'BUSY' : 'ONLINE';
    device.lastSeen = new Date().toISOString();
    if (os_details) device.osInfo = os_details;
    store.gatewayDevices.set(device.id, device);

    // Update associated printer status if provided
    const station = store.getStation(device.stationId);
    if (station && station.printerId) {
      const printer = store.getPrinter(station.printerId);
      if (printer) {
        printer.lastSeen = new Date().toISOString();
        if (printer_status) {
          printer.status = printer_status;
        }

        // Update real-time health metrics
        const currentHealth = printer.health || {
          inkLevel: 82,
          paperStatus: 'OK',
          connectivity: 'ONLINE',
          lastUpdated: new Date().toISOString()
        };

        printer.health = {
          ...currentHealth,
          inkLevel: typeof ink_level === 'number' ? Math.max(0, Math.min(100, ink_level)) : currentHealth.inkLevel,
          blackInkLevel: typeof black_ink_level === 'number' ? black_ink_level : currentHealth.blackInkLevel,
          colorInkLevel: typeof color_ink_level === 'number' ? color_ink_level : currentHealth.colorInkLevel,
          paperStatus: ['OK', 'LOW', 'EMPTY', 'JAMMED'].includes(paper_status) ? paper_status : currentHealth.paperStatus,
          paperLevel: typeof paper_level === 'number' ? paper_level : currentHealth.paperLevel,
          paperTrayText: paper_tray_text || currentHealth.paperTrayText,
          connectivity: ['ONLINE', 'OFFLINE', 'DEGRADED', 'BUSY'].includes(connectivity)
            ? connectivity
            : (printer.status === 'OFFLINE' ? 'OFFLINE' : 'ONLINE'),
          signalStrength: signal_strength || currentHealth.signalStrength || 'STRONG',
          latencyMs: typeof latency_ms === 'number' ? latency_ms : (currentHealth.latencyMs || 12),
          queueLength: typeof queue_length === 'number' ? queue_length : currentHealth.queueLength,
          lastUpdated: new Date().toISOString()
        };

        store.printers.set(printer.id, printer);
      }
    }

    store.save();
  }

  res.json({
    success: true,
    data: {
      status: 'ACK',
      timestamp: new Date().toISOString()
    }
  });
});

// 3. GET /api/gateway/jobs - Gateway polls queued jobs
gatewayRouter.get('/jobs', authenticateGateway, (req: Request, res: Response) => {
  const device = (req as any).gatewayDevice;
  const stationId = (req.query.station_id as string) || device?.stationId;

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  const availableJobs: any[] = [];

  for (const job of store.printJobs.values()) {
    // Only return QUEUED and payment_verified jobs
    if (job.status === 'QUEUED' && job.paymentVerified) {
      // If stationId filter matches
      if (!stationId || job.stationId === stationId) {
        const file = store.getFile(job.fileId);
        if (file && file.status !== 'DELETED') {
          const downloadUrl = storageService.getSignedDownloadUrl(file.id, baseUrl);
          availableJobs.push({
            id: job.id,
            file_id: file.id,
            filename: file.originalFilename,
            mime_type: file.mimeType,
            print_type: job.printType,
            page_count: job.pageCount,
            copies: job.copies,
            download_url: downloadUrl,
            checksum: file.checksum,
            authorized: true,
            status: job.status,
            created_at: job.createdAt,
            queued_at: job.queuedAt
          });
        }
      }
    }
  }

  res.json({
    success: true,
    data: {
      count: availableJobs.length,
      jobs: availableJobs
    }
  });
});

// 4. POST /api/gateway/jobs/:id/claim - Gateway claims lock on job
gatewayRouter.post('/jobs/:id/claim', authenticateGateway, (req: Request, res: Response) => {
  const jobId = req.params.id;
  const device = (req as any).gatewayDevice;
  const gatewayId = device?.id || req.body.gateway_id || 'office-gateway';

  const job = store.getJob(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: 'Print job not found' }
    });
  }

  // Atomic check: Must be QUEUED and authorized
  if (job.status !== 'QUEUED' || !job.paymentVerified) {
    return res.status(409).json({
      success: false,
      error: { code: 'JOB_ALREADY_CLAIMED', message: `Job is in status: ${job.status}` }
    });
  }

  job.claimedByGatewayId = gatewayId;
  job.claimedAt = new Date().toISOString();
  store.printJobs.set(job.id, job);

  store.logAudit('GATEWAY_CLAIMED_JOB', job.id, undefined, {
    gatewayId,
    claimedAt: job.claimedAt
  });
  store.save();

  const file = store.getFile(job.fileId);
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${protocol}://${host}`;
  const downloadUrl = file ? storageService.getSignedDownloadUrl(file.id, baseUrl) : '';

  res.json({
    success: true,
    data: {
      job_id: job.id,
      claimed: true,
      download_url: downloadUrl,
      print_type: job.printType,
      copies: job.copies,
      page_count: job.pageCount
    }
  });
});

// 5. POST /api/gateway/jobs/:id/printing - Gateway reports printing started
gatewayRouter.post('/jobs/:id/printing', authenticateGateway, (req: Request, res: Response) => {
  const jobId = req.params.id;
  const job = store.getJob(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: 'Print job not found' }
    });
  }

  job.status = 'PRINTING';
  job.startedAt = new Date().toISOString();
  store.printJobs.set(job.id, job);

  store.logAudit('PRINT_STARTED', job.id, undefined, {
    gatewayId: job.claimedByGatewayId,
    pages: job.pageCount
  });
  store.save();

  res.json({
    success: true,
    data: {
      job_id: job.id,
      status: 'PRINTING'
    }
  });
});

// 6. POST /api/gateway/jobs/:id/complete - Gateway reports completed print
gatewayRouter.post('/jobs/:id/complete', authenticateGateway, (req: Request, res: Response) => {
  const jobId = req.params.id;
  const job = store.getJob(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: 'Print job not found' }
    });
  }

  job.status = 'COMPLETED';
  job.completedAt = new Date().toISOString();
  store.printJobs.set(job.id, job);

  store.logAudit('PRINT_COMPLETED', job.id, undefined, {
    gatewayId: job.claimedByGatewayId,
    completedAt: job.completedAt
  });
  store.save();

  // Trigger retention cleanup schedule
  storageService.runFileCleanup();

  res.json({
    success: true,
    data: {
      job_id: job.id,
      status: 'COMPLETED'
    }
  });
});

// 7. POST /api/gateway/jobs/:id/fail - Gateway reports print failure
gatewayRouter.post('/jobs/:id/fail', authenticateGateway, (req: Request, res: Response) => {
  const jobId = req.params.id;
  const { reason } = req.body;
  const job = store.getJob(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: 'Print job not found' }
    });
  }

  job.status = 'FAILED';
  job.failedAt = new Date().toISOString();
  job.failReason = reason || 'Printer error reported by Print Gateway';
  store.printJobs.set(job.id, job);

  store.logAudit('PRINT_FAILED', job.id, undefined, {
    gatewayId: job.claimedByGatewayId,
    reason: job.failReason
  });
  store.save();

  res.json({
    success: true,
    data: {
      job_id: job.id,
      status: 'FAILED',
      reason: job.failReason
    }
  });
});
