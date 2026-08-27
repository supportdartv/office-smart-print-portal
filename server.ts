import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { publicApiRouter } from './server/routes/api';
import { gatewayRouter } from './server/routes/gateway';
import { adminRouter } from './server/routes/admin';
import { store } from './server/db/store';

async function startServer() {
  const app = express();
  
  // FIX: Use the cloud environment's assigned port, fallback to 3000 locally
  const PORT = process.env.PORT || 3000;

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

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'Office Smart Print Portal',
      timestamp: new Date().toISOString(),
      activeStations: store.stations.size,
      activePrinters: store.printers.size
    });
  });

  // API Routes
  app.use('/api/gateway', gatewayRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', publicApiRouter);

  // Global Error Handler for API
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

  // Vite middleware for development vs Static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Office Smart Print Portal] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server boot error:', err);
});