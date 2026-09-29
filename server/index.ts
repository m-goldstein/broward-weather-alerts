import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDashboard } from './forecast.ts';

const app = express();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/dashboard', async (_req, res) => {
  try { res.set('Cache-Control', 'no-store').json(await getDashboard()); }
  catch { res.status(503).json({ error: 'Unable to assemble the forecast. Please try again shortly.' }); }
});
app.use(express.static(path.join(root, 'dist')));
app.get('/{*splat}', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
app.listen(Number(process.env.API_PORT ?? 3001), '0.0.0.0', () => console.log('Tidewatch API listening on http://localhost:' + (process.env.API_PORT ?? 3001)));
