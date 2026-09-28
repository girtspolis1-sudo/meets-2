import { readEvents } from '../../../lib/events-server.js';
export const dynamic = 'force-dynamic';
export async function GET(request) {
 try {
  const {searchParams}=new URL(request.url);
  const includePending=searchParams.get('includePending')==='1';
  return Response.json(await readEvents({includePending}),{headers:{'Cache-Control':'no-store'}});
 } catch (error) {
  console.error('catalogue_read_failed',{name:error?.name||'Error'});
  return Response.json({error:'Pasākumu datus neizdevās ielādēt. Lūdzu, mēģini vēlreiz.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
