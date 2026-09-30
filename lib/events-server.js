import 'server-only';
import { publicEvent } from './catalog.js';

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
 const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
 if(!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) throw new Error('Catalogue configuration missing');
 const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/meets_public_catalog`, {
  method:'POST',
  headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({}),
  cache:'no-store',
  signal:AbortSignal.timeout(20000)
 });
 if(!response.ok) throw new Error(`Catalogue upstream status ${response.status}`);
 const data=await response.json();
 if(!Array.isArray(data.events)) throw new Error('Invalid catalogue response');

 const today=rigaToday();
 const windowTo=addMonthsIso(today,3);
 const events=data.events
  .filter(event=>
   event.status==='published' &&
   Boolean(event.date_from) &&
   event.date_from<=windowTo &&
   (event.date_to||event.date_from)>=today
  )
  .map(publicEvent);

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
  competitions,
  total:events.length,
  fetchedAt:data.fetchedAt,
  window:{from:today,to:windowTo}
 };
}
