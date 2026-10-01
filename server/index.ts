import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GET as getDashboardResponse } from '../api/dashboard.ts';
import { GET as getFloodCheckResponse } from '../api/flood-check.ts';
import { getBasemapTile } from './basemap.ts';

const app = express();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/basemap', async (req, res) => {
  const request = new Request(new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`));
  const result = await getBasemapTile(request);
  res.status(result.status);
  result.headers.forEach((value, name) => res.set(name, value));
  res.send(Buffer.from(await result.arrayBuffer()));
});
app.get('/api/dashboard', async (req, res) => {
  const result = await getDashboardResponse(new Request(new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`)));
  res.status(result.status);
  result.headers.forEach((value, name) => res.set(name, value));
  res.send(await result.text());
});
app.get('/api/flood-check', async (req, res) => {
  const result = await getFloodCheckResponse(new Request(new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`)));
  res.status(result.status);
  result.headers.forEach((value, name) => res.set(name, value));
  res.send(await result.text());
});
app.use(express.static(path.join(root, 'dist')));
app.get('/{*splat}', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
app.listen(Number(process.env.API_PORT ?? 3001), '0.0.0.0', () => console.log('Tidewatch API listening on http://localhost:' + (process.env.API_PORT ?? 3001)));
