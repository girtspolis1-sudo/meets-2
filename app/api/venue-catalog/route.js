import {readEvents} from '../../../lib/events-server.js';

export const dynamic='force-dynamic';

const normalize=value=>String(value||'').toLocaleLowerCase('lv').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

export async function GET(request){
 try{
  const query=new URL(request.url).searchParams.get('q')?.trim()||'';
  if(query.length<2||query.length>120)return Response.json({locations:[]});
  const {events}=await readEvents();
  const seen=new Set();
  const locations=[];
  const needle=normalize(query);
  for(const event of events){
   if(!event.venue_name||event.latitude==null||event.longitude==null)continue;
   if(['municipality_center','settlement_center','fallback_center','missing_point'].includes(event.location_precision))continue;
   const latitude=Number(event.latitude),longitude=Number(event.longitude);
   if(!Number.isFinite(latitude)||!Number.isFinite(longitude))continue;
   const name=String(event.venue_name).trim(),address=String(event.address_raw||event.settlement||event.municipality||'').trim();
   if(!normalize(name+' '+address).includes(needle))continue;
   const id=normalize(name).slice(0,90)+':'+latitude.toFixed(4)+':'+longitude.toFixed(4);
   if(seen.has(id))continue;
   seen.add(id);
   locations.push({id,name,address,latitude,longitude});
   if(locations.length>=15)break;
  }
  locations.sort((a,b)=>normalize(a.name).localeCompare(normalize(b.name),'lv'));
  return Response.json({locations},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){
  console.error('venue_catalog_search_failed',{name:error?.name||'Error'});
  return Response.json({locations:[],error:'MEETS vietu saraksts pašlaik nav pieejams.'},{status:503});
 }
}
