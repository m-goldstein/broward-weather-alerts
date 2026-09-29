import { getBasemapTile } from '../server/basemap.ts';

export async function GET(request: Request) {
  return getBasemapTile(request);
}
