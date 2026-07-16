import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/index.js';
import { AppError, errorHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import dashboardRouter from './routes/dashboard.js';
import gearRouter from './routes/gear.js';
import groupsRouter from './routes/groups.js';
import kgpRouter from './routes/kgp.js';
import tripsRouter from './routes/trips.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '../../client');
const isProd = process.env.NODE_ENV === 'production';

async function start() {
  initDatabase();

  const app = express();
  const PORT = 8082;

  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/gear', gearRouter);
  app.use('/api/groups', groupsRouter);
  app.use('/api/kgp', kgpRouter);
  app.use('/api/trips', tripsRouter);

  app.use('/api', (_req, _res, next) => {
    next(new AppError(404, 'Nie znaleziono zasobu'));
  });

  if (isProd) {
    const dist = path.join(clientRoot, 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(dist, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');

    const vite = await createViteServer({
      root: clientRoot,
      configFile: path.join(clientRoot, 'vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`Aplikacja działa na http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
