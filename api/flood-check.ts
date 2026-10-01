import { getFloodCheck } from '../server/flood-check.ts';
import { LocationError } from '../server/location.ts';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const params = new URL(request.url).searchParams;
    return Response.json(await getFloodCheck(params.get('zip'), params.get('at')), { headers });
  } catch (error) {
    if (error instanceof LocationError) return Response.json({ error: error.message }, { status: error.status, headers });
    return Response.json({ error: 'Unable to check the flood outlook. Please try again shortly.' }, { status: 503, headers });
  }
}
