import {readEventsCached} from '../../../../lib/events-server.js';

export const dynamic='force-dynamic';

// The full public record of one event, for the detail views. Same server copy
// and the same field allowlist as the list.
export async function GET(_request,{params}){
 const {id}=await params;
 if(!id||String(id).length>100){
  return Response.json({error:'Pasākums nav atrasts.'},{status:404,headers:{'Cache-Control':'no-store'}});
 }
 try{
  const {events}=await readEventsCached();
  const event=events.find(item=>String(item.id)===String(id));
  if(!event)return Response.json({error:'Pasākums nav atrasts.'},{status:404,headers:{'Cache-Control':'public, max-age=0, s-maxage=60'}});
  return Response.json({event},{headers:{'Cache-Control':'public, max-age=0, s-maxage=60, stale-while-revalidate=300'}});
 }catch(error){
  console.error('event_read_failed',{name:error?.name||'Error'});
  return Response.json({error:'Pasākumu neizdevās ielādēt. Mēģini vēlreiz.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
