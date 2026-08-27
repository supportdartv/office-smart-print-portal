import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import { publicApiRouter } from './server/routes/api';
import { gatewayRouter } from './server/routes/gateway';
import { adminRouter } from './server/routes/admin';
import { store } from './server/db/store';

const app = express();

// Global Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Office Smart Print Portal',
    timestamp: new Date().toISOString(),
    activeStations: store.stations.size,
    activePrinters: store.printers.size
  });
});

app.use('/api/gateway', gatewayRouter);
app.use('/api/admin', adminRouter);
app.use('/api', publicApiRouter);

app.use('/api', (err: any, req: Request, res: Response, next: Function) => {
  console.error('[API Error]', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || 'An internal server error occurred.'
    }
  });
});

// 1. CRITICAL VERCEL FIX: Export the app directly for Serverless Functions
export default app;

// 2. LOCAL DEV HOOK: Only boot the local server if NOT running on Vercel
if (!process.env.VERCEL) {
  async function startLocalServer() {
    if (process.env.NODE_ENV !== 'production') {
      try {
        // Dynamically import Vite only in local dev to prevent Vercel crashes
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: 'spa'
        });
        app.use(vite.middlewares);
      } catch (e) {
        console.log('Vite not found, skipping dev middleware');
      }
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Office Smart Print Portal] Server running on http://0.0.0.0:${PORT}`);
    });
  }
  startLocalServer().catch(err => console.error('Fatal server boot error:', err));
}
