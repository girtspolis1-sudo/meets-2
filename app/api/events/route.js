import {readEventsCached} from '../../../lib/events-server.js';

export const dynamic='force-dynamic';

export async function GET(){
 try{
  // Public data: the CDN may answer for a minute and serve a stale copy while it refreshes.
  return Response.json(await readEventsCached(),{headers:{'Cache-Control':'public, max-age=0, s-maxage=60, stale-while-revalidate=300'}});
 }catch(error){
  console.error('catalogue_read_failed',{name:error?.name||'Error'});
  return Response.json(
   {error:'Pasākumu datus neizdevās ielādēt. Lūdzu, mēģini vēlreiz.'},
   {status:503,headers:{'Cache-Control':'no-store'}}
  );
 }
}
