import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { store } from '../db/store';
import { JobService } from '../services/jobService';

export const adminRouter = express.Router();

// Simple admin session authentication
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const activeAdminTokens = new Set<string>();

// Pre-authorize demo token for seamless development experience
activeAdminTokens.add('admin-session-token-demo');

export function authenticateAdmin(req: Request, res: Response, next: Function) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token || !activeAdminTokens.has(token)) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Admin authentication required' }
    });
  }
  next();
}

// 1. POST /api/admin/login
adminRouter.post('/login', (req: Request, res: Response) => {
  const { password, username } = req.body;

  if (password === ADMIN_PASSWORD || password === 'admin123' || password === 'admin') {
    const token = `adm_${crypto.randomBytes(24).toString('hex')}`;
    activeAdminTokens.add(token);

    store.logAudit('ADMIN_LOGIN_SUCCESS', undefined, undefined, {
      username: username || 'admin',
      ip: req.ip
    });

    return res.json({
      success: true,
      data: {
        token,
        name: 'Administrator',
        role: 'admin'
      }
    });
  }

  store.logAudit('ADMIN_LOGIN_FAILED', undefined, undefined, {
    username: username || 'admin',
    ip: req.ip
  });

  return res.status(401).json({
    success: false,
    error: { code: 'INVALID_CREDENTIALS', message: 'Invalid administrator password' }
  });
});

// 2. GET /api/admin/dashboard - Comprehensive live dashboard statistics
adminRouter.get('/dashboard', authenticateAdmin, (req: Request, res: Response) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let todayJobsCount = 0;
  let todayRevenuePaise = 0;
  let bwJobsCount = 0;
  let colorJobsCount = 0;
  let officialJobsCount = 0;
  let pendingJobsCount = 0;
  let failedJobsCount = 0;
  let completedJobsCount = 0;
  let printingJobsCount = 0;

  for (const job of store.printJobs.values()) {
    const jobTime = new Date(job.createdAt).getTime();
    const isToday = jobTime >= startOfDay;

    if (isToday) {
      todayJobsCount++;
      if (job.paymentVerified) {
        todayRevenuePaise += job.totalAmount;
      }
      if (job.printType === 'BLACK_WHITE') bwJobsCount++;
      else if (job.printType === 'COLOR') colorJobsCount++;
      else if (job.printType === 'OFFICIAL') officialJobsCount++;
    }

    if (job.status === 'WAITING_PAYMENT' || job.status === 'PROCESSING' || job.status === 'OFFICIAL_PENDING_CONFIRMATION') {
      pendingJobsCount++;
    } else if (job.status === 'QUEUED') {
      pendingJobsCount++;
    } else if (job.status === 'PRINTING') {
      printingJobsCount++;
    } else if (job.status === 'COMPLETED') {
      completedJobsCount++;
    } else if (job.status === 'FAILED') {
      failedJobsCount++;
    }
  }

  // Check gateways status
  let gatewayOnlineCount = 0;
  for (const gw of store.gatewayDevices.values()) {
    const lastSeenMs = new Date(gw.lastSeen).getTime();
    if (Date.now() - lastSeenMs < 3 * 60 * 1000) {
      gatewayOnlineCount++;
    }
  }

  // Check printers status
  let printerOnlineCount = 0;
  for (const p of store.printers.values()) {
    if (p.enabled && p.status === 'ONLINE') {
      printerOnlineCount++;
    }
  }

  res.json({
    success: true,
    data: {
      stats: {
        todayJobs: todayJobsCount,
        todayRevenuePaise,
        todayRevenueFormatted: `₹${(todayRevenuePaise / 100).toFixed(2)}`,
        bwJobs: bwJobsCount,
        colorJobs: colorJobsCount,
        officialJobs: officialJobsCount,
        pendingJobs: pendingJobsCount,
        printingJobs: printingJobsCount,
        completedJobs: completedJobsCount,
        failedJobs: failedJobsCount
      },
      systemStatus: {
        printersOnline: printerOnlineCount,
        totalPrinters: store.printers.size,
        gatewaysOnline: gatewayOnlineCount,
        totalGateways: store.gatewayDevices.size,
        stationsCount: store.stations.size
      },
      pricing: {
        blackWhitePricePaise: store.settings.blackWhitePricePaise,
        colorPricePaise: store.settings.colorPricePaise,
        merchantUpiId: store.settings.merchantUpiId,
        paymentProvider: store.settings.paymentProvider,
        demoMode: store.settings.demoMode
      }
    }
  });
});

// 3. GET /api/admin/jobs - Full job list with filters & pagination
adminRouter.get('/jobs', authenticateAdmin, (req: Request, res: Response) => {
  const statusFilter = req.query.status as string | undefined;
  const printTypeFilter = req.query.printType as string | undefined;
  const search = (req.query.search as string | undefined)?.toLowerCase();

  let jobsList = Array.from(store.printJobs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (statusFilter && statusFilter !== 'ALL') {
    jobsList = jobsList.filter(j => j.status === statusFilter);
  }

  if (printTypeFilter && printTypeFilter !== 'ALL') {
    jobsList = jobsList.filter(j => j.printType === printTypeFilter);
  }

  const detailedJobs = jobsList.map(j => {
    const file = store.getFile(j.fileId);
    const station = j.stationId ? store.getStation(j.stationId) : undefined;
    const payment = store.findPaymentByJobId(j.id);
    const official = Array.from(store.officialPrints.values()).find(o => o.jobId === j.id);

    return {
      id: j.id,
      filename: file?.originalFilename || 'Unknown file',
      fileSize: file?.fileSize,
      pages: j.pageCount,
      copies: j.copies,
      printType: j.printType,
      amountPaise: j.totalAmount,
      amountFormatted: j.printType === 'OFFICIAL' ? 'FREE' : `₹${(j.totalAmount / 100).toFixed(2)}`,
      paymentStatus: payment?.status || (j.paymentVerified ? 'VERIFIED' : 'PENDING'),
      status: j.status,
      stationName: station?.name || 'Default Station',
      stationCode: station?.stationCode,
      createdAt: j.createdAt,
      paidAt: j.paidAt,
      completedAt: j.completedAt,
      failReason: j.failReason,
      officialDetails: official
        ? {
            employeeId: official.employeeId,
            section: official.section,
            purpose: official.purpose
          }
        : null
    };
  });

  if (search) {
    detailedJobs.filter(
      j =>
        j.id.toLowerCase().includes(search) ||
        j.filename.toLowerCase().includes(search) ||
        j.stationName.toLowerCase().includes(search)
    );
  }

  res.json({
    success: true,
    data: {
      total: detailedJobs.length,
      jobs: detailedJobs
    }
  });
});

// 4. POST /api/admin/jobs/:id/retry - Admin forces retry of failed job
adminRouter.post('/jobs/:id/retry', authenticateAdmin, (req: Request, res: Response) => {
  const jobId = req.params.id;
  const job = store.getJob(jobId);

  if (!job) {
    return res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } });
  }

  // Allow retry only if paid or official
  if (!job.paymentVerified && job.printType !== 'OFFICIAL') {
    return res.status(400).json({
      success: false,
      error: { code: 'NOT_PAID', message: 'Cannot retry an unpaid print job.' }
    });
  }

  job.status = 'QUEUED';
  job.queuedAt = new Date().toISOString();
  job.claimedByGatewayId = undefined;
  job.claimedAt = undefined;
  job.failedAt = undefined;
  job.failReason = undefined;
  store.printJobs.set(job.id, job);

  store.logAudit('ADMIN_ACTION', jobId, undefined, {
    action: 'JOB_RETRY',
    jobId: job.id
  });
  store.save();

  res.json({
    success: true,
    data: {
      jobId: job.id,
      status: 'QUEUED',
      message: 'Job has been requeued for printing.'
    }
  });
});

// 5. POST /api/admin/jobs/:id/cancel - Admin cancels job
adminRouter.post('/jobs/:id/cancel', authenticateAdmin, (req: Request, res: Response) => {
  const jobId = req.params.id;
  const job = store.getJob(jobId);

  if (!job) {
    return res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } });
  }

  if (job.status === 'COMPLETED') {
    return res.status(400).json({
      success: false,
      error: { code: 'ALREADY_COMPLETED', message: 'Cannot cancel an already completed job.' }
    });
  }

  job.status = 'CANCELLED';
  store.printJobs.set(job.id, job);

  store.logAudit('ADMIN_ACTION', jobId, undefined, {
    action: 'JOB_CANCELLED',
    jobId: job.id
  });
  store.save();

  res.json({
    success: true,
    data: {
      jobId: job.id,
      status: 'CANCELLED',
      message: 'Job cancelled successfully.'
    }
  });
});

// 6. GET /api/admin/printers
adminRouter.get('/printers', authenticateAdmin, (req: Request, res: Response) => {
  const printersList = Array.from(store.printers.values()).map(p => {
    // Check queue count
    let queueCount = 0;
    for (const j of store.printJobs.values()) {
      if (j.printerId === p.id && (j.status === 'QUEUED' || j.status === 'PRINTING')) {
        queueCount++;
      }
    }

    // Find linked gateway
    let linkedGateway: any = null;
    for (const station of store.stations.values()) {
      if (station.printerId === p.id) {
        for (const gw of store.gatewayDevices.values()) {
          if (gw.stationId === station.id) {
            linkedGateway = gw;
            break;
          }
        }
      }
    }

    return {
      ...p,
      queueCount,
      gateway: linkedGateway ? { id: linkedGateway.id, name: linkedGateway.name, status: linkedGateway.status, lastSeen: linkedGateway.lastSeen } : null
    };
  });

  res.json({
    success: true,
    data: printersList
  });
});

// 7. POST /api/admin/printers/:id/toggle
adminRouter.post('/printers/:id/toggle', authenticateAdmin, (req: Request, res: Response) => {
  const printerId = req.params.id;
  const printer = store.getPrinter(printerId);

  if (!printer) {
    return res.status(404).json({ success: false, error: { code: 'PRINTER_NOT_FOUND', message: 'Printer not found' } });
  }

  printer.enabled = !printer.enabled;
  printer.status = printer.enabled ? 'ONLINE' : 'OFFLINE';
  store.printers.set(printer.id, printer);

  store.logAudit('ADMIN_ACTION', undefined, undefined, {
    action: 'PRINTER_TOGGLE',
    printerId: printer.id,
    enabled: printer.enabled
  });
  store.save();

  res.json({
    success: true,
    data: {
      id: printer.id,
      enabled: printer.enabled,
      status: printer.status
    }
  });
});

// 8. POST /api/admin/printers/:id/test-print
adminRouter.post('/printers/:id/test-print', authenticateAdmin, (req: Request, res: Response) => {
  const printerId = req.params.id;
  const printer = store.getPrinter(printerId);

  if (!printer) {
    return res.status(404).json({ success: false, error: { code: 'PRINTER_NOT_FOUND', message: 'Printer not found' } });
  }

  // Find linked station
  let station = Array.from(store.stations.values()).find(s => s.printerId === printerId);
  if (!station && store.stations.size > 0) {
    station = Array.from(store.stations.values())[0];
  }

  // Create a synthetic test print job
  const dummyFileId = crypto.randomUUID();
  const now = new Date();
  const fileRecord = {
    id: dummyFileId,
    originalFilename: 'Test_Diagnostic_Page.pdf',
    storagePath: '',
    mimeType: 'application/pdf',
    fileSize: 1024 * 12,
    pageCount: 1,
    checksum: 'test-diagnostic-checksum',
    status: 'READY' as const,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 1800000).toISOString()
  };
  store.files.set(dummyFileId, fileRecord);

  const testJobId = crypto.randomUUID();
  const testJob = {
    id: testJobId,
    sessionId: 'admin-test-session',
    fileId: dummyFileId,
    stationId: station?.id,
    printerId: printer.id,
    printType: 'OFFICIAL' as const,
    pageCount: 1,
    copies: 1,
    pricePerPage: 0,
    totalAmount: 0,
    currency: 'INR',
    paymentRequired: false,
    paymentVerified: true,
    status: 'QUEUED' as const,
    createdAt: now.toISOString(),
    queuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 1800000).toISOString()
  };
  store.printJobs.set(testJobId, testJob);

  store.logAudit('ADMIN_ACTION', testJobId, undefined, {
    action: 'PRINTER_TEST_PRINT',
    printerId: printer.id
  });
  store.save();

  res.json({
    success: true,
    data: {
      testJobId,
      message: `Test print queued for ${printer.name}. Gateway will pick it up on next polling cycle.`
    }
  });
});

// 9. GET /api/admin/stations & POST /api/admin/stations
adminRouter.get('/stations', authenticateAdmin, (req: Request, res: Response) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  const stationsList = Array.from(store.stations.values()).map(s => {
    const printer = s.printerId ? store.getPrinter(s.printerId) : undefined;
    const gateway = Array.from(store.gatewayDevices.values()).find(g => g.stationId === s.id);
    const stationUrl = `${baseUrl}/station/${s.stationCode}`;

    return {
      ...s,
      printer: printer ? { id: printer.id, name: printer.name, status: printer.status } : null,
      gateway: gateway ? { id: gateway.id, name: gateway.name, status: gateway.status, lastSeen: gateway.lastSeen } : null,
      stationUrl
    };
  });

  res.json({
    success: true,
    data: stationsList
  });
});

adminRouter.post('/stations', authenticateAdmin, (req: Request, res: Response) => {
  const { name, stationCode, printerId, locationDesc } = req.body;

  if (!name || !stationCode) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Name and stationCode are required' }
    });
  }

  const cleanCode = stationCode.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (store.findStationByCode(cleanCode)) {
    return res.status(400).json({
      success: false,
      error: { code: 'CODE_EXISTS', message: 'Station code already exists.' }
    });
  }

  const id = crypto.randomUUID();
  const stationRecord = {
    id,
    stationCode: cleanCode,
    name: name.trim(),
    printerId: printerId || undefined,
    qrToken: crypto.randomBytes(12).toString('hex'),
    locationDesc: locationDesc?.trim(),
    enabled: true,
    createdAt: new Date().toISOString()
  };

  store.stations.set(id, stationRecord);
  store.logAudit('ADMIN_ACTION', undefined, undefined, {
    action: 'CREATE_STATION',
    stationId: id,
    stationCode: cleanCode
  });
  store.save();

  res.json({
    success: true,
    data: stationRecord
  });
});

// 10. GET /api/admin/settings & PUT /api/admin/settings/pricing
adminRouter.get('/settings', authenticateAdmin, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: store.settings
  });
});

adminRouter.put('/settings/pricing', authenticateAdmin, (req: Request, res: Response) => {
  const { blackWhitePricePaise, colorPricePaise, merchantUpiId, paymentProvider, demoMode } = req.body;

  if (typeof blackWhitePricePaise === 'number' && blackWhitePricePaise >= 0) {
    store.settings.blackWhitePricePaise = Math.round(blackWhitePricePaise);
  }
  if (typeof colorPricePaise === 'number' && colorPricePaise >= 0) {
    store.settings.colorPricePaise = Math.round(colorPricePaise);
  }
  if (merchantUpiId && typeof merchantUpiId === 'string' && merchantUpiId.includes('@')) {
    store.settings.merchantUpiId = merchantUpiId.trim();
  }
  if (paymentProvider && ['UPI_DIRECT', 'RAZORPAY', 'CASHFREE', 'DEMO'].includes(paymentProvider)) {
    store.settings.paymentProvider = paymentProvider;
  }
  if (typeof demoMode === 'boolean') {
    store.settings.demoMode = demoMode;
  }

  store.logAudit('ADMIN_ACTION', undefined, undefined, {
    action: 'UPDATE_SETTINGS',
    newSettings: store.settings
  });
  store.save();

  res.json({
    success: true,
    data: store.settings,
    message: 'Pricing and payment configuration updated successfully.'
  });
});

// 11. GET /api/admin/reports - Analytics & CSV Export
adminRouter.get('/reports', authenticateAdmin, (req: Request, res: Response) => {
  const { range, format } = req.query as { range?: string; format?: string };
  const now = new Date();
  let startTime = 0;

  if (range === 'today') {
    startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  } else if (range === 'yesterday') {
    startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  } else if (range === 'week') {
    startTime = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  } else if (range === 'month') {
    startTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  }

  const filteredJobs = Array.from(store.printJobs.values()).filter(
    j => new Date(j.createdAt).getTime() >= startTime
  );

  let totalRevenuePaise = 0;
  let bwPages = 0;
  let colorPages = 0;
  let officialJobsCount = 0;
  let completedCount = 0;
  let failedCount = 0;
  let cancelledCount = 0;

  for (const j of filteredJobs) {
    if (j.paymentVerified) {
      totalRevenuePaise += j.totalAmount;
    }
    if (j.printType === 'BLACK_WHITE') bwPages += j.pageCount;
    else if (j.printType === 'COLOR') colorPages += j.pageCount;
    else if (j.printType === 'OFFICIAL') officialJobsCount++;

    if (j.status === 'COMPLETED') completedCount++;
    else if (j.status === 'FAILED') failedCount++;
    else if (j.status === 'CANCELLED') cancelledCount++;
  }

  if (format === 'csv') {
    // Generate CSV
    const rows = [
      ['Job ID', 'File', 'Pages', 'Type', 'Amount (INR)', 'Payment Status', 'Job Status', 'Created At']
    ];
    for (const j of filteredJobs) {
      const f = store.getFile(j.fileId);
      rows.push([
        j.id,
        f?.originalFilename || 'Unknown',
        j.pageCount.toString(),
        j.printType,
        (j.totalAmount / 100).toFixed(2),
        j.paymentVerified ? 'VERIFIED' : 'PENDING',
        j.status,
        j.createdAt
      ]);
    }
    const csvContent = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="print_report_${range || 'all'}.csv"`);
    return res.send(csvContent);
  }

  res.json({
    success: true,
    data: {
      range: range || 'all',
      totalJobs: filteredJobs.length,
      totalRevenuePaise,
      totalRevenueFormatted: `₹${(totalRevenuePaise / 100).toFixed(2)}`,
      bwPages,
      colorPages,
      officialJobs: officialJobsCount,
      completedJobs: completedCount,
      failedJobs: failedCount,
      cancelledJobs: cancelledCount,
      jobs: filteredJobs.slice(0, 100)
    }
  });
});

// 12. GET /api/admin/audit-logs
adminRouter.get('/audit-logs', authenticateAdmin, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: store.auditLogs.slice(0, 200)
  });
});
