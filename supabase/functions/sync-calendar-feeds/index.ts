import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {occurrences} from "./ics.js";
import {isIcs,isRss,isSkipped,rigaInstant,rssOccurrences} from "./rss.js";

// Calendar feeds added in Admin → Avoti: iCalendar (.ics) and municipality RSS
// (TVP /lv/rss/events). Every active feed daily, or one feed when the admin
// presses "Ielādēt tagad" ({feedId}). Events wait in review until their place is
// approved, like other imports.
//
// An item is matched to an existing event by its import key or, for RSS, by the
// event page address shared with the weekly TVP HTML import
// (meets_feed_event_match), so one event stays one row. Updates never touch the
// status, a verified place, or events an admin archived or cancelled.
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

// Feed content as items, whatever the format; a format the admin fixed must match.
function readFeed(feed:any,text:string,today:string,windowTo:string){
 const format=isRss(text)?"rss":isIcs(text)?"ics":null;
 if(!format)throw new Error("Saite neatgrieza kalendāru (.ics) vai RSS plūsmu");
 if(feed.feed_format_locked&&feed.feed_format!==format)
  throw new Error(feed.feed_format==="rss"?"Saite neatgriež RSS plūsmu":"Saite neatgriež kalendāru (.ics)");
 const skipTypes=Array.isArray(feed.skip_types)?feed.skip_types:[];
 if(format==="rss"){
  const r=rssOccurrences(text,{from:today,to:windowTo,skipTypes});
  return {format,items:r.items,skipped:r.skipped,feedItems:r.count,oldestPub:r.oldestPub};
 }
 const all=occurrences(text,{from:today,to:windowTo});
 const items=all.filter((i:any)=>!isSkipped(i,skipTypes));
 return {format,items,skipped:all.length-items.length,feedItems:all.length,oldestPub:null};
}

async function syncFeed(feed:any,today:string,windowTo:string){
 const run=await q("import_runs",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({
  source_key:(feed.feed_format==="rss"?"rss-":"ics-")+feed.id+"-"+new Date().toISOString().replace(/[:.]/g,"-"),
  source_commit:"calendar-feed-v2-3month",snapshot_date:today,status:"loading",expected_count:0,imported_count:0})});
 const rid=run[0].id;
 try{
  const res=await fetch(feed.url,{headers:{"User-Agent":"MEETS/1.0 (+https://meets.lv)",
   "Accept":"text/calendar, application/rss+xml, application/xml, text/xml, text/plain, */*"},signal:AbortSignal.timeout(30000)});
  if(!res.ok)throw new Error("HTTP "+res.status);
  const text=await res.text();
  const {format,items,skipped,feedItems,oldestPub}=readFeed(feed,text,today,windowTo);
  await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({expected_count:items.length})});
  const sourceId=await sourceFor(feed);
  let created=0,updated=0,protectedCount=0,merged=0;
  await inBatches(items,4,async(item:any)=>{
   const key=format+":"+feed.id+":"+item.key;
   const match=await rpc("meets_feed_event_match",{p_feed_id:feed.id,p_import_key:key,p_url:item.url||null,
    p_date_from:item.dateFrom,p_date_to:item.dateTo});
   merged+=Number(match?.merged)||0;
   // An admin archived or cancelled it: leave it as it is.
   if(match?.event_id&&["archived","cancelled"].includes(match.status)){protectedCount++;return;}
   const timeFrom=item.timeFrom?item.timeFrom+":00":null,timeTo=item.timeTo?item.timeTo+":00":null;
   const base:any={
    title:item.title.slice(0,300),
    date_from:item.dateFrom,date_to:item.dateTo,time_from:timeFrom,time_to:timeTo,
    schedule_type:item.dateFrom===item.dateTo?"single_day":"continuous",
    time_type:timeFrom?(timeTo?"fixed_interval":"start_only"):"unspecified",
    primary_category:item.categories[0]||feed.default_category||null,import_run_id:rid
   };
   if(item.description)base.description=item.description.slice(0,4000);
   let eid:string;
   if(match?.event_id){
    eid=match.event_id;
    await q("events?id=eq."+eid,{method:"PATCH",body:JSON.stringify({...base,updated_at:new Date().toISOString()})});
    updated++;
   }else{
    eid=(await q("events",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({...base,
     description:base.description||"",import_key:key,status:"pending_review",review_status:"needs_review",
     attendance_mode:"in_person",record_type:"event",price_status:"unknown",
     quality_flags:["location_unverified",format==="rss"?"rss_feed":"calendar_feed"]})}))[0].id;
    created++;
   }
   await q("event_occurrences?on_conflict=event_id,occurrence_key",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates"},
    body:JSON.stringify({event_id:eid,occurrence_key:"source",occurrence_kind:"confirmed_date",date_from:item.dateFrom,date_to:item.dateTo,
     time_from:timeFrom,time_to:timeTo,time_type:base.time_type,timezone:"Europe/Riga",
     starts_at:rigaInstant(item.dateFrom,item.timeFrom),ends_at:rigaInstant(item.dateTo,item.timeTo)})});
   const place=item.location||feed.label;
   const loc:any={venue_name:place.split(format==="rss"?/\n/:/,/)[0].trim().slice(0,250)||feed.label,address_raw:item.location||null,
    location_basis:(format==="rss"?"RSS plūsma: ":"calendar feed: ")+feed.label,location_source:item.url||feed.url};
   if(feed.municipality_id){loc.municipality_id=feed.municipality_id;loc.source_municipality_id=feed.municipality_id;}
   // A point given by the feed (GEO) is offered as a suggestion for the admin.
   if(item.geo)Object.assign(loc,{geocode_query:"Kalendāra saites koordinātas",geocode_suggested_at:new Date().toISOString(),
    geocode_candidates:[{id:"geo:"+feed.id,label:loc.venue_name,displayName:item.location||loc.venue_name,
     latitude:item.geo.latitude,longitude:item.geo.longitude,type:"feed_geo",category:"building",source:feed.label}]});
   const existingLoc=await q("event_locations?event_id=eq."+eid+"&select=event_id,verified_at,venue_name,address_raw,venue_point,fallback_point");
   if(existingLoc.length){
    const old=existingLoc[0];
    const known=String(old.address_raw||old.venue_name||"").toLocaleLowerCase("lv");
    // A verified place is never changed. RSS also leaves a place that already has
    // a map point (it would be lost) or whose text already holds this name (the
    // HTML import gives the name with the street address, RSS only the name).
    const keep=format==="rss"&&(old.venue_point||old.fallback_point||(known&&known.includes(loc.venue_name.toLocaleLowerCase("lv"))));
    if(!old.verified_at&&!keep&&(old.venue_name!==loc.venue_name||(old.address_raw||null)!==loc.address_raw))
     await q("event_locations?event_id=eq."+eid,{method:"PATCH",body:JSON.stringify(loc)});
   }else await q("event_locations",{method:"POST",body:JSON.stringify({event_id:eid,...loc,location_precision:"unresolved",
    country_code:"LV",location_note:"Pasākums no "+(format==="rss"?"pašvaldības RSS plūsmas":"kalendāra saites")+"; kartes punkts jāapstiprina adminā."})});
   await rpc("meets_import_publish_if_ready",{p_event_id:eid});
   await rpc("meets_feed_event_source",{p_event_id:eid,p_source_id:sourceId,p_url:item.url||feed.url,p_channel:format,p_day:today});
  });
  await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({status:"complete",imported_count:items.length,added_count:created,
   updated_count:updated,skipped_count:skipped+protectedCount,completed_at:new Date().toISOString(),error_text:null})});
  await rpc("meets_calendar_feed_finished",{p_feed_id:feed.id,p_status:"success",p_found:items.length,p_created:created,p_error:null,
   p_source_id:sourceId,p_updated:updated,p_skipped:skipped+protectedCount,p_format:format,p_feed_items:feedItems,p_oldest_pub:oldestPub});
  return {feed:feed.id,ok:true,format,found:items.length,created,updated,skipped,protected:protectedCount,merged};
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
