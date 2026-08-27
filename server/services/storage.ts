import crypto from 'crypto';
import { store } from '../db/store';
import { FileRecord } from '../types';

export class StorageService {
  private tokenSecret: string;

  constructor() {
    this.tokenSecret = process.env.STORAGE_SIGN_SECRET || 'secret-storage-token-key-print-portal';
    this.startCleanupScheduler();
  }

  public async saveFile(
    fileId: string,
    buffer: Buffer,
    originalFilename: string,
    mimeType: string,
    pageCount: number
  ): Promise<FileRecord> {
    const ext = originalFilename.split('.').pop()?.toLowerCase() || (mimeType === 'application/pdf' ? 'pdf' : '');
    const storagePath = `documents/${fileId}.${ext}`;

    // Upload directly to Supabase Storage
    if (store.supabase) {
      await store.supabase.storage.from('print-files').upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true
      });
    }

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + store.settings.jobExpiryMinutes * 60 * 1000).toISOString();

    const fileRecord: FileRecord = {
      id: fileId,
      originalFilename,
      storagePath,
      mimeType,
      fileSize: buffer.length,
      pageCount,
      checksum,
      status: 'READY',
      createdAt: now.toISOString(),
      expiresAt
    };

    store.files.set(fileId, fileRecord);
    store.logAudit('FILE_UPLOADED', undefined, undefined, {
      fileId,
      filename: originalFilename,
      size: buffer.length,
      pages: pageCount,
      mimeType
    });
    store.save();

    return fileRecord;
  }

  public generateSignedDownloadToken(fileId: string, expirySeconds: number = 900): string {
    const expiresAt = Date.now() + expirySeconds * 1000;
    const payload = `${fileId}:${expiresAt}`;
    const hmac = crypto.createHmac('sha256', this.tokenSecret).update(payload).digest('hex');
    return Buffer.from(JSON.stringify({ fileId, expiresAt, sig: hmac })).toString('base64url');
  }

  public verifySignedDownloadToken(token: string): { valid: boolean; fileId?: string; reason?: string } {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
      if (!decoded.fileId || !decoded.expiresAt || !decoded.sig) {
        return { valid: false, reason: 'Invalid token structure' };
      }
      if (Date.now() > decoded.expiresAt) {
        return { valid: false, reason: 'Download token expired' };
      }
      const payload = `${decoded.fileId}:${decoded.expiresAt}`;
      const expectedHmac = crypto.createHmac('sha256', this.tokenSecret).update(payload).digest('hex');
      if (expectedHmac !== decoded.sig) {
        return { valid: false, reason: 'Signature mismatch' };
      }
      return { valid: true, fileId: decoded.fileId };
    } catch (err: any) {
      return { valid: false, reason: err.message || 'Malformed token' };
    }
  }

  public getSignedDownloadUrl(fileId: string, baseUrl: string = ''): string {
    const token = this.generateSignedDownloadToken(fileId, 1800); // 30 min
    return `${baseUrl}/api/files/download?fileId=${fileId}&token=${encodeURIComponent(token)}`;
  }

  public async deletePhysicalFile(fileId: string) {
    const file = store.files.get(fileId);
    if (file && store.supabase) {
      try {
        await store.supabase.storage.from('print-files').remove([file.storagePath]);
        file.status = 'DELETED';
        store.files.set(fileId, file);
        store.logAudit('FILE_DELETED', undefined, undefined, { fileId, originalFilename: file.originalFilename });
        store.save();
      } catch (err) {
        console.error(`[Storage] Error deleting file ${fileId} from Supabase:`, err);
      }
    }
  }

  private startCleanupScheduler() {
    setInterval(() => {
      this.runFileCleanup();
    }, 2 * 60 * 1000);
  }

  public runFileCleanup() {
    const now = Date.now();
    const retentionMs = store.settings.fileRetentionMinutes * 60 * 1000;

    for (const job of store.printJobs.values()) {
      if (job.status === 'COMPLETED' && job.completedAt) {
        const completedTime = new Date(job.completedAt).getTime();
        if (now - completedTime > retentionMs) {
          const file = store.files.get(job.fileId);
          if (file && file.status !== 'DELETED') {
            this.deletePhysicalFile(job.fileId);
          }
        }
      }

      if (
        (job.status === 'WAITING_PAYMENT' || job.status === 'UPLOADED' || job.status === 'OFFICIAL_PENDING_CONFIRMATION') &&
        new Date(job.expiresAt).getTime() < now
      ) {
        job.status = 'EXPIRED';
        store.printJobs.set(job.id, job);
        store.logAudit('JOB_EXPIRED', job.id, undefined, { fileId: job.fileId });
        this.deletePhysicalFile(job.fileId);
      }
    }
  }
}

export const storageService = new StorageService();