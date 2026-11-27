import 'server-only';
import { publicEvent } from './catalog.js';
import { catalogHeaders } from './server-keys.js';

function rigaToday(){
 const parts=new Intl.DateTimeFormat('en-CA',{
  timeZone:'Europe/Riga',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(new Date());
 const value=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return `${value.year}-${value.month}-${value.day}`;
}

function addMonthsIso(iso,months){
 const [year,month,day]=iso.split('-').map(Number);
 const target=new Date(Date.UTC(year,month-1+months,1,12));
 const lastDay=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0,12)).getUTCDate();
 target.setUTCDate(Math.min(day,lastDay));
 return target.toISOString().slice(0,10);
}

export async function readEvents() {
 const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY } = process.env;
 if(!SUPABASE_URL || !(SUPABASE_SECRET_KEY || SUPABASE_PUBLISHABLE_KEY)) throw new Error('Catalogue configuration missing');
 const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/meets_public_catalog`, {
  method:'POST',
  headers:catalogHeaders(),
  body:JSON.stringify({}),
  cache:'no-store',
  signal:AbortSignal.timeout(20000)
 });
 if(!response.ok) throw new Error(`Catalogue upstream status ${response.status}`);
 const data=await response.json();
 if(!Array.isArray(data.events)) throw new Error('Invalid catalogue response');

 const today=rigaToday();
 const windowTo=addMonthsIso(today,3);
 const pastFrom=addMonthsIso(today,-6);
 const toPublic=event=>{
  const path=typeof event.cover_image_path==='string'&&/^[a-f\d-]+\/[a-f\d-]+\/[a-f\d-]+\.(jpg|png|webp)$/.test(event.cover_image_path)
   ?event.cover_image_path:'';
  return publicEvent({...event,cover_image_url:path?SUPABASE_URL+'/storage/v1/object/public/meets-event-images/'+path:null});
 };
 const shown=event=>event.status==='published'&&event.map_visible!==false&&Boolean(event.date_from);
 const events=data.events
  .filter(event=>shown(event)&&event.date_from<=windowTo&&(event.date_to||event.date_from)>=today)
  .map(toPublic);
 // Events that ended in the last six months keep their page ("Pasākums ir beidzies").
 // Server only: never sent by /api/events.
 const past=data.events
  .filter(event=>shown(event)&&(event.date_to||event.date_from)<today&&(event.date_to||event.date_from)>=pastFrom)
  .map(toPublic);

 const competitions=(Array.isArray(data.competitions)?data.competitions:[])
  .map(c=>({
   competition_key:String(c.competition_key||''),
   name:String(c.name||''),
   season:c.season?String(c.season):null,
   governing_body:c.governing_body?String(c.governing_body):null,
   sport_format:c.sport_format?String(c.sport_format):null,
   competition_type:c.competition_type?String(c.competition_type):null,
   source_url:c.source_url?String(c.source_url):null
  }))
  .filter(c=>c.competition_key&&c.name);

 return {
  events,
  past,
  competitions,
  total:events.length,
  fetchedAt:data.fetchedAt,
  window:{from:today,to:windowTo}
 };
}

// Build time of the stored catalogue (equals its fetchedAt), as milliseconds.
// A small call: the whole catalogue is about 11 MB.
export async function readCatalogVersion(){
 const {SUPABASE_URL}=process.env;
 const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/meets_public_catalog_version`,{
  method:'POST',
  headers:catalogHeaders(),
  body:'{}',
  cache:'no-store',
  signal:AbortSignal.timeout(5000)
 });
 if(!response.ok)throw new Error(`Catalogue version upstream status ${response.status}`);
 const version=Date.parse(await response.json());
 if(!Number.isFinite(version))throw new Error('Invalid catalogue version');
 return version;
}

// The public catalogue changes a few times an hour, so one server instance
// shares a read for a minute and then refreshes it in the background while
// still answering from the previous copy (also when Supabase is briefly down).
// The refresh first asks for the build time and loads the whole catalogue only
// when it has changed or a new day has started in Riga (the current and past
// lists are split by today's date). When the build time cannot be read, it
// loads the whole catalogue as before.
const FRESH_MS=60*1000;
let shared=null,refreshing=null;
async function unchanged(copy){
 if(!copy||copy.data.window?.from!==rigaToday())return false;
 const version=await readCatalogVersion().catch(()=>null);
 return version!==null&&version===Date.parse(copy.data.fetchedAt);
}
function refreshShared(){
 refreshing??=(async()=>{
  const copy=shared;
  if(await unchanged(copy)){shared={data:copy.data,at:Date.now()};return copy.data;}
  const data=await readEvents();
  shared={data,at:Date.now()};
  return data;
 })().finally(()=>{refreshing=null;});
 return refreshing;
}
export async function readEventsCached(){
 if(shared&&Date.now()-shared.at<FRESH_MS)return shared.data;
 if(shared){refreshShared().catch(()=>{});return shared.data;}
 return refreshShared();
}

// One event page by its address: the current catalogue first, then recently ended events.
// param = full id (old links) or "<slug>-<first 8 characters of the id>".
export async function findPublicEvent(parsed){
 if(!parsed||(parsed.kind!=='uuid'&&parsed.kind!=='key'))return null;
 const {events,past=[]}=await readEventsCached();
 const match=parsed.kind==='uuid'?e=>String(e.id).toLowerCase()===parsed.id:e=>String(e.id).toLowerCase().startsWith(parsed.prefix);
 const current=events.find(match);
 if(current)return {event:current,ended:false};
 const old=past.find(match);
 return old?{event:old,ended:true}:null;
}
