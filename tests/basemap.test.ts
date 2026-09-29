import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBasemapTile } from '../server/basemap.ts';

const zoom = 13, lat = 26.011, lon = -80.118;
const x = Math.floor((lon + 180) / 360 * 2 ** zoom);
const y = Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** zoom);
const tileRequest = (extra = '') => new Request(`https://tidewatch.example/api/basemap?z=${zoom}&x=${x}&y=${y}${extra}`);

test('the basemap endpoint authenticates CARTO server-side and returns only PNG bytes', async () => {
  const originalKey = process.env.CARTO_API_KEY, originalFetch = globalThis.fetch;
  process.env.CARTO_API_KEY = 'fixture-secret-key';
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  globalThis.fetch = async (input, options) => {
    const upstream = new URL(String(input));
    assert.equal(upstream.origin, 'https://basemaps.cartocdn.com');
    assert.equal(upstream.pathname, `/rastertiles/light_all/${zoom}/${x}/${y}@2x.png`);
    assert.equal(upstream.searchParams.get('key'), 'fixture-secret-key');
    assert.equal(new Headers(options?.headers).get('Referer'), 'https://tidewatch.example/');
    return new Response(png, { headers: { 'Content-Type': 'image/png' } });
  };
  try {
    const { GET } = await import('../api/basemap.ts');
    const response = await GET(tileRequest('&retina=1'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/png');
    assert.ok(response.headers.get('Cache-Control')?.includes('s-maxage'));
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), png);
    assert.ok(![...response.headers].flat().join(' ').includes('fixture-secret-key'));
  } finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.CARTO_API_KEY; else process.env.CARTO_API_KEY = originalKey; }
});
test('missing CARTO configuration produces a non-cacheable error', async () => {
  const originalKey = process.env.CARTO_API_KEY;
  delete process.env.CARTO_API_KEY;
  try { const response = await getBasemapTile(tileRequest()); assert.equal(response.status, 503); assert.equal(response.headers.get('Cache-Control'), 'no-store'); }
  finally { if (originalKey !== undefined) process.env.CARTO_API_KEY = originalKey; }
});
test('invalid tile coordinates and tiles outside Hollywood are rejected before fetching', async () => {
  assert.equal((await getBasemapTile(new Request('https://tidewatch.example/api/basemap?z=13&x=bad&y=0'))).status, 400);
  assert.equal((await getBasemapTile(tileRequest('&retina=2'))).status, 400);
  assert.equal((await getBasemapTile(new Request('https://tidewatch.example/api/basemap?z=13&x=0&y=0'))).status, 404);
});
test('CARTO failures do not leak the API key or return cached errors', async () => {
  const originalKey = process.env.CARTO_API_KEY, originalFetch = globalThis.fetch;
  process.env.CARTO_API_KEY = 'fixture-secret-key';
  try {
    for (const failure of ['provider', 'network', 'content-type']) {
      globalThis.fetch = async () => {
        if (failure === 'network') throw new Error('Provider URL contained fixture-secret-key');
        return new Response('Provider URL contained fixture-secret-key', { status: failure === 'provider' ? 403 : 200, headers: { 'Content-Type': 'text/html' } });
      };
      const response = await getBasemapTile(tileRequest());
      assert.equal(response.status, 502);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.ok(!(await response.text()).includes('fixture-secret-key'));
    }
  } finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.CARTO_API_KEY; else process.env.CARTO_API_KEY = originalKey; }
});
