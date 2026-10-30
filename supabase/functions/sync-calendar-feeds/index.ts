import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {occurrences} from "./ics.js";

// Calendar feeds (.ics) added in Admin → Avoti: every active feed daily, or one
// feed when the admin presses "Ielādēt tagad" ({feedId}). Events wait in review
// until their place is approved, like other imports.
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H={"apikey":K,"Authorization":"Bearer "+K,"Content-Type":"application/json"};

async function q(p:string,o:RequestInit={}){
 const r=await fetch(U+"/rest/v1/"+p,{...o,headers:{...H,...(o.headers||{})}});
 const t=await r.text();
 if(!r.ok)throw new Error(r.status+" "+t.slice(0,300));
 return t?JSON.parse(t):null;
}
const rpc=(name:string,body:unknown)=>q("rpc/"+name,{method:"POST",body:JSON.stringify(body)});
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

async function sourceFor(feed:any){
 if(feed.source_id)return feed.source_id;
 const domain=new URL(feed.url).hostname.replace(/^www\./,"");
 const found=(await q("sources?domain=eq."+encodeURIComponent(domain)+"&select=id"))[0];
 if(found)return found.id;
 return (await q("sources",{method:"POST",headers:{"Prefer":"return=representation"},
  body:JSON.stringify({domain,calendar_url:feed.url,municipality_id:feed.municipality_id||null})}))[0].id;
}

async function syncFeed(feed:any,today:string,windowTo:string){
 const run=await q("import_runs",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({
  source_key:"ics-"+feed.id+"-"+new Date().toISOString().replace(/[:.]/g,"-"),source_commit:"ics-feed-v1-3month",
  snapshot_date:today,status:"loading",expected_count:0,imported_count:0})});
 const rid=run[0].id;
 try{
  const res=await fetch(feed.url,{headers:{"User-Agent":"MEETS/1.0 (+https://meets.lv)","Accept":"text/calendar, text/plain, */*"},signal:AbortSignal.timeout(30000)});
  if(!res.ok)throw new Error("HTTP "+res.status);
  const text=await res.text();
  if(!/BEGIN:VCALENDAR/i.test(text))throw new Error("Saite neatgrieza kalendāru (.ics)");
  const items=occurrences(text,{from:today,to:windowTo});
  await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({expected_count:items.length})});
  const sourceId=await sourceFor(feed);
  let created=0,updated=0;
  await inBatches(items,4,async(item:any)=>{
   const key="ics:"+feed.id+":"+item.key;
   const old=await q("events?import_key=eq."+encodeURIComponent(key)+"&select=id");
   const base={
    title:item.title.slice(0,300),description:item.description.slice(0,4000),
    date_from:item.dateFrom,date_to:item.dateTo,time_from:item.timeFrom?item.timeFrom+":00":null,time_to:item.timeTo?item.timeTo+":00":null,
    schedule_type:item.dateFrom===item.dateTo?"single_day":"continuous",
    time_type:item.timeFrom?(item.timeTo?"fixed_interval":"start_only"):"unspecified",
    attendance_mode:"in_person",record_type:"event",primary_category:item.categories[0]||feed.default_category||null,
    price_status:"unknown",review_status:"needs_review",quality_flags:["location_unverified"],import_run_id:rid
   };
   let eid:string;
   if(old.length){eid=old[0].id;await q("events?id=eq."+eid,{method:"PATCH",body:JSON.stringify(base)});updated++;}
   else{eid=(await q("events",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({...base,import_key:key,status:"pending_review"})}))[0].id;created++;}
   await q("event_occurrences?on_conflict=event_id,occurrence_key",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates"},
    body:JSON.stringify({event_id:eid,occurrence_key:"source",occurrence_kind:"confirmed_date",date_from:item.dateFrom,date_to:item.dateTo,
     time_from:base.time_from,time_to:base.time_to,time_type:base.time_type,timezone:"Europe/Riga"})});
   const place=item.location||feed.label;
   const loc:any={venue_name:place.split(",")[0].trim().slice(0,250)||feed.label,address_raw:item.location||null,
    location_basis:"calendar feed: "+feed.label,location_source:item.url||feed.url};
   if(feed.municipality_id){loc.municipality_id=feed.municipality_id;loc.source_municipality_id=feed.municipality_id;}
   // A point given by the feed (GEO) is offered as a suggestion for the admin.
   if(item.geo)Object.assign(loc,{geocode_query:"Kalendāra saites koordinātas",geocode_suggested_at:new Date().toISOString(),
    geocode_candidates:[{id:"geo:"+feed.id,label:loc.venue_name,displayName:item.location||loc.venue_name,
     latitude:item.geo.latitude,longitude:item.geo.longitude,type:"feed_geo",category:"building",source:feed.label}]});
   const existingLoc=await q("event_locations?event_id=eq."+eid+"&select=event_id,verified_at");
   if(existingLoc.length){if(!existingLoc[0].verified_at)await q("event_locations?event_id=eq."+eid,{method:"PATCH",body:JSON.stringify(loc)});}
   else await q("event_locations",{method:"POST",body:JSON.stringify({event_id:eid,...loc,location_precision:"unresolved",
    location_note:"Pasākums no kalendāra saites; kartes punkts jāapstiprina adminā."})});
   await q("rpc/meets_import_publish_if_ready",{method:"POST",body:JSON.stringify({p_event_id:eid})});
   const url=item.url||feed.url;
   const es=await q("event_sources?event_id=eq."+eid+"&source_id=eq."+sourceId+"&select=event_id");
   if(!es.length)await q("event_sources",{method:"POST",body:JSON.stringify({event_id:eid,source_id:sourceId,source_url:url,retrieved_on:today,details_checked:true})});
   else await q("event_sources?event_id=eq."+eid+"&source_id=eq."+sourceId,{method:"PATCH",body:JSON.stringify({source_url:url,retrieved_on:today,details_checked:true})});
  });
  await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({status:"complete",imported_count:items.length,added_count:created,updated_count:updated,skipped_count:0,completed_at:new Date().toISOString(),error_text:null})});
  await rpc("meets_calendar_feed_finished",{p_feed_id:feed.id,p_status:"success",p_found:items.length,p_created:created,p_error:null,p_source_id:sourceId});
  return {feed:feed.id,ok:true,found:items.length,created,updated};
 }catch(e){
  const error=String(e).replace(/^Error: /,"").slice(0,500);
  try{await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({status:"failed",completed_at:new Date().toISOString(),error_text:error})});}catch{}
  try{await rpc("meets_calendar_feed_finished",{p_feed_id:feed.id,p_status:"failed",p_found:null,p_created:null,p_error:error,p_source_id:null});}catch{}
  return {feed:feed.id,ok:false,error};
 }
}

Deno.serve(async(req)=>{
 try{
  const body=await req.json().catch(()=>({}));
  const feeds=await rpc("meets_calendar_feeds_for_sync",{p_feed_id:Number(body?.feedId)||null})||[];
  const today=rigaToday(),windowTo=addMonthsIso(today,3);
  const results=[];
  for(const feed of feeds)results.push(await syncFeed(feed,today,windowTo));
  return Response.json({ok:true,results});
 }catch(e){
  console.error("sync_calendar_feeds_failed",e);
  return Response.json({ok:false,error:String(e)},{status:500});
 }
});
