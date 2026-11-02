import {readEventsCached} from '../../../lib/events-server.js';
import {encodeCatalog} from '../../../lib/catalog-wire.js';

export const dynamic='force-dynamic';

// The light list form is built once per server copy of the catalogue.
const encoded=new WeakMap();
function listPayload(catalog){
 if(!encoded.has(catalog))encoded.set(catalog,encodeCatalog(catalog));
 return encoded.get(catalog);
}

export async function GET(request){
 try{
  const catalog=await readEventsCached();
  // ?full=1 returns every public field (Excel export); the default is the light list.
  const full=new URL(request.url).searchParams.get('full')==='1';
  // Public data: the CDN may answer for a minute and serve a stale copy while it refreshes.
  return Response.json(full?catalog:listPayload(catalog),{headers:{'Cache-Control':'public, max-age=0, s-maxage=60, stale-while-revalidate=300'}});
 }catch(error){
  console.error('catalogue_read_failed',{name:error?.name||'Error'});
  return Response.json(
   {error:'Pasākumu datus neizdevās ielādēt. Lūdzu, mēģini vēlreiz.'},
   {status:503,headers:{'Cache-Control':'no-store'}}
  );
 }
}
