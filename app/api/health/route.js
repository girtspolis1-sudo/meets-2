export function GET() {
  return Response.json({ application: 'meets 2', status: 'ok', database: 'not-connected' }, { headers: { 'Cache-Control': 'no-store' } });
}
