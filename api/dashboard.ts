import { getDashboard } from '../server/forecast.ts';
import { LocationError, validateZip } from '../server/location.ts';

export async function GET(request?: Request) {
  try {
    return Response.json(await getDashboard(validateZip(request ? new URL(request.url).searchParams.get('zip') ?? undefined : undefined)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof LocationError) return Response.json({ error: e.message }, { status: e.status, headers: { 'Cache-Control': 'no-store' } });
    return Response.json({ error: 'Unable to assemble the forecast. Please try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
