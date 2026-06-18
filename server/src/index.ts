import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { requireAuth } from './auth.js';
import { pipelineRouter } from './routes/pipeline.js';
import { exploreRouter } from './routes/explore.js';
import { scriptsRouter } from './routes/scripts.js';
import { videosRouter } from './routes/videos.js';
import { captionsRouter } from './routes/captions.js';
import { usersRouter } from './routes/users.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Allowed browser origins. CORS_ORIGIN may be a comma-separated list; we also
// allow the common Vite dev ports on both localhost and 127.0.0.1 so the app
// works no matter which port Vite picks (5173, 5174, …) or which host you open.
const envOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const DEV_ORIGINS = [5173, 5174, 5175, 5176].flatMap((p) => [
  `http://localhost:${p}`,
  `http://127.0.0.1:${p}`,
]);

const ALLOWED_ORIGINS = new Set([...envOrigins, ...DEV_ORIGINS]);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/non-browser requests (no Origin header) and any
      // explicitly allowlisted origin.
      if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
  })
);
app.use(express.json({ limit: '6mb' }));

// Public health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'socialvert-api', time: Date.now() });
});

// Who am I — quick way to confirm the token works
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ uid: req.uid, email: req.userEmail });
});

// Protected pipeline API (the SocialVert content dashboard)
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/pipeline', requireAuth, pipelineRouter);
app.use('/api/explore', requireAuth, exploreRouter);
app.use('/api/scripts', requireAuth, scriptsRouter);
app.use('/api/videos', requireAuth, videosRouter);
app.use('/api/captions', requireAuth, captionsRouter);

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

app.listen(PORT, () => {
  console.log(`socialvert-api listening on http://localhost:${PORT}`);
  console.log(`CORS origins allowed: ${[...ALLOWED_ORIGINS].join(', ')}`);
});
