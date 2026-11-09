import { readEventsCached } from '../../../lib/events-server.js';

export const dynamic='force-dynamic';

export async function GET() {
 try {
  // The shared copy (refreshed once a minute): a stream of health checks must not
  // run the whole catalogue query each time.
  const data=await readEventsCached();
  return Response.json(
   {application:'meets 2',status:'ok',database:'connected',events:data.total},
   {headers:{'Cache-Control':'no-store'}}
  );
 } catch(error) {
  console.error(JSON.stringify({
   event:'health_check_failed',
   level:'error',
   message:String(error?.message||'Catalogue health check failed').replace(/[\r\n\t]+/g,' ').slice(0,300),
   deployment:process.env.VERCEL_GIT_COMMIT_SHA||null
  }));
  return Response.json(
   {application:'meets 2',status:'degraded',database:'unavailable'},
   {status:503,headers:{'Cache-Control':'no-store'}}
  );
 }
}
