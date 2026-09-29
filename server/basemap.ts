import { LocationError, resolveZipPoint } from './location.ts';
const MIN_ZOOM = 11;
const MAX_ZOOM = 19;


function error(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function getBasemapTile(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const readInteger = (name: string) => {
    const value = url.searchParams.get(name);
    return value !== null && /^\d{1,7}$/.test(value) ? Number(value) : NaN;
  };
  const z = readInteger('z'), x = readInteger('x'), y = readInteger('y');
  const retina = url.searchParams.get('retina');
  if (!Number.isInteger(z) || z < MIN_ZOOM || z > MAX_ZOOM || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z || (retina !== null && !['0', '1'].includes(retina))) {
    return error('Invalid map tile coordinates.', 400);
  }
  let location;
  try { location = await resolveZipPoint(url.searchParams.get('zip') ?? undefined); }
  catch (e) { return error(e instanceof LocationError ? e.message : 'Map location unavailable.', e instanceof LocationError ? e.status : 503); }
  const COVERAGE = { west: location.lon - 0.4, east: location.lon + 0.4, south: location.lat - 0.4, north: location.lat + 0.4 };
  // Keep the tile endpoint scoped to the selected ZIP's map.
  const n = 2 ** z;
  const tileLon = (column: number) => column / n * 360 - 180;
  const tileLat = (row: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * row / n))) * 180 / Math.PI;
  if (tileLon(x + 1) < COVERAGE.west || tileLon(x) > COVERAGE.east || tileLat(y) < COVERAGE.south || tileLat(y + 1) > COVERAGE.north) {
    return error('Tile is outside the selected ZIP map area.', 404);
  }
  const key = process.env.CARTO_API_KEY?.trim();
  if (!key) return error('The basemap is not configured.', 503);

  const upstream = new URL(`https://basemaps.cartocdn.com/rastertiles/light_all/${z}/${x}/${y}${retina === '1' ? '@2x' : ''}.png`);
  upstream.searchParams.set('key', key);
  try {
    // Preserve the app's own origin for CARTO keys restricted to this website.
    const response = await fetch(upstream, { headers: { Referer: `${url.origin}/` }, signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok || !response.headers.get('Content-Type')?.toLowerCase().startsWith('image/png')) {
      return error('Basemap tiles are temporarily unavailable.', 502);
    }
    const bytes = await response.arrayBuffer();
    return new Response(bytes, { headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    // Never return provider URLs or upstream messages: they can contain the key.
    return error('Basemap tiles are temporarily unavailable.', 502);
  }
}
