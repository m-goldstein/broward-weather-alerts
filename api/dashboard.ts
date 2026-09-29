import { getDashboard } from '../server/forecast.ts';

export async function GET() {
  try {
    return Response.json(await getDashboard(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Unable to assemble the forecast. Please try again shortly.' }, { status: 503 });
  }
}
