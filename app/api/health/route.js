import { readEvents } from '../../../lib/events-server.js';
export const dynamic='force-dynamic';
export async function GET() {
 try { const data=await readEvents();return Response.json({application:'meets 2',status:'ok',database:'connected',events:data.total},{headers:{'Cache-Control':'no-store'}}); }
 catch {return Response.json({application:'meets 2',status:'degraded',database:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
