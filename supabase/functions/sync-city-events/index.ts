import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {SITES,uniqueItems} from "../_shared/city-events.js";

// Events of Daugavpils, Jelgava, Valmiera and Cēsis from their own websites (see
// _shared/city-events.js). Weekly cron; body {"site":"jelgava"} reads one site.
// Events wait in review until their place is known, like the other imports.
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H={"apikey":K,"Authorization":"Bearer "+K,"Content-Type":"application/json"};
const UA={"User-Agent":"MEETS/1.0 (+https://meets.lv)"};

async function q(p:string,o:RequestInit={}){
 const r=await fetch(U+"/rest/v1/"+p,{...o,headers:{...H,...(o.headers||{})}});
 const t=await r.text();
 if(!r.ok)throw new Error(r.status+" "+t.slice(0,300));
 return t?JSON.parse(t):null;
}
function rigaToday(){
 return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Riga",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function addMonthsIso(iso:string,n:number){
 const d=new Date(iso+"T12:00:00Z"),day=d.getUTCDate();
 d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);
 const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(day,max));
 return d.toISOString().slice(0,10);
}
async function inBatches<T>(items:T[],size:number,fn:(x:T)=>Promise<void>){
 for(let i=0;i<items.length;i+=size)await Promise.all(items.slice(i,i+size).map(fn));
}

async function readSite(site:any,today:string,windowTo:string){
 const items:any[]=[];
 for(let n=1;n<=site.maxPages;n++){
  const url=site.pages(n);
  if(!url)break;
  const r=await fetch(url,{headers:UA,signal:AbortSignal.timeout(30000)});
  if(!r.ok){if(n===1)throw new Error(site.domain+" HTTP "+r.status);break;}
  const found=site.parse(site.json?await r.json():await r.text(),today);
  if(!found.length)break;
  const before=items.length;
  items.push(...found);
  if(uniqueItems(items).length===uniqueItems(items.slice(0,before)).length)break; // the page repeated the previous one
  // Lists run by date: a page that starts after the window ends the reading (and keeps within the CPU limit).
  if(found.every((e:any)=>e.dateFrom>windowTo))break;
 }
 return uniqueItems(items);
}

async function syncSite(name:string,today:string,windowTo:string){
 const site=(SITES as any)[name];
 const run=await q("import_runs",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({
  source_key:"city-"+name+"-"+new Date().toISOString().replace(/[:.]/g,"-"),source_commit:"city-events-v1-3month",
  snapshot_date:today,status:"loading",expected_count:0,imported_count:0})});
 const rid=run[0].id;
 try{
  const listed=await readSite(site,today,windowTo);
  const events=listed.filter((e:any)=>e.dateTo>=today&&e.dateFrom<=windowTo);
  await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({expected_count:events.length})});
  const municipality=(await q("municipalities?name=eq."+encodeURIComponent(site.municipality)+"&select=id"))[0]?.id??null;
  let source=(await q("sources?domain=eq."+encodeURIComponent(site.domain)+"&select=id"))[0];
  if(!source)source=(await q("sources",{method:"POST",headers:{"Prefer":"return=representation"},
   body:JSON.stringify({domain:site.domain,calendar_url:site.calendar,municipality_id:municipality})}))[0];
  let created=0,updated=0;
  await inBatches(events,4,async(item:any)=>{
   const key=site.domain+":"+item.key+":"+item.dateFrom;
   const old=await q("events?import_key=eq."+encodeURIComponent(key)+"&select=id");
   const base={
    title:item.title.slice(0,300),description:item.description||null,
    date_from:item.dateFrom,date_to:item.dateTo,time_from:item.timeFrom?item.timeFrom+":00":null,time_to:item.timeTo?item.timeTo+":00":null,
    schedule_type:item.dateFrom===item.dateTo?"single_day":"continuous",
    time_type:item.timeFrom?(item.timeTo?"fixed_interval":"start_only"):"unspecified",
    attendance_mode:"in_person",record_type:"event",primary_category:item.category,
    price_status:item.price_status,price_text:item.price_text,review_status:"needs_review",quality_flags:["location_unverified"],import_run_id:rid
   };
   let eid:string;
   if(old.length){eid=old[0].id;await q("events?id=eq."+eid,{method:"PATCH",body:JSON.stringify(base)});updated++;}
   else{eid=(await q("events",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({...base,import_key:key,status:"pending_review"})}))[0].id;created++;}
   await q("event_occurrences?on_conflict=event_id,occurrence_key",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates"},
    body:JSON.stringify({event_id:eid,occurrence_key:"source",occurrence_kind:"confirmed_date",date_from:item.dateFrom,date_to:item.dateTo,
     time_from:base.time_from,time_to:base.time_to,time_type:base.time_type,timezone:"Europe/Riga"})});
   const loc:any={venue_name:(item.venue||site.municipality).slice(0,250),address_raw:item.address||item.venue||null,country_code:"LV",
    location_basis:site.domain+" event list",location_source:item.url};
   if(municipality){loc.municipality_id=municipality;loc.source_municipality_id=municipality;}
   const existing=await q("event_locations?event_id=eq."+eid+"&select=event_id,verified_at");
   if(existing.length){if(!existing[0].verified_at)await q("event_locations?event_id=eq."+eid,{method:"PATCH",body:JSON.stringify(loc)});}
   else await q("event_locations",{method:"POST",body:JSON.stringify({event_id:eid,...loc,location_precision:"unresolved",
    location_note:"Pasākums no pašvaldības vietnes; kartes punkts jāapstiprina."})});
   await q("rpc/meets_import_publish_if_ready",{method:"POST",body:JSON.stringify({p_event_id:eid})});
   const es=await q("event_sources?event_id=eq."+eid+"&source_id=eq."+source.id+"&select=event_id");
   if(!es.length)await q("event_sources",{method:"POST",body:JSON.stringify({event_id:eid,source_id:source.id,source_url:item.url,retrieved_on:today,details_checked:false})});
   else await q("event_sources?event_id=eq."+eid+"&source_id=eq."+source.id,{method:"PATCH",body:JSON.stringify({source_url:item.url,retrieved_on:today})});
  });
  await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({status:"complete",imported_count:events.length,added_count:created,
   updated_count:updated,skipped_count:listed.length-events.length,completed_at:new Date().toISOString(),error_text:null})});
  return {site:name,ok:true,listed:listed.length,imported:events.length,created,updated};
 }catch(e){
  try{await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({status:"failed",completed_at:new Date().toISOString(),error_text:String(e).slice(0,500)})});}catch{}
  console.error("sync_city_events_failed",name,e);
  return {site:name,ok:false,error:String(e)};
 }
}

Deno.serve(async(req)=>{
 const body=await req.json().catch(()=>({}));
 const names=body?.site&&(SITES as any)[body.site]?[body.site]:Object.keys(SITES);
 const today=rigaToday(),windowTo=addMonthsIso(today,3);
 const results=[];
 for(const name of names)results.push(await syncSite(name,today,windowTo));
 return Response.json({ok:results.every(r=>r.ok),results},{status:results.every(r=>r.ok)?200:500});
});
