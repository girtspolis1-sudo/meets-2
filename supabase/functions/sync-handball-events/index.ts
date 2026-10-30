import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Handball matches from the Latvian Handball Federation calendar (handball.lv/calendar).
// Each match has a league, teams, time and the venue's full address; the place
// search finds the venue in the address register, an admin approves it once.
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H={"apikey":K,"Authorization":"Bearer "+K,"Content-Type":"application/json"};
const CALENDAR="https://handball.lv/calendar";
// National team games abroad ("Opole, Polija") are not events in the Baltics.
const ABROAD=/,\s*(Polija|Vācija|Zviedrija|Somija|Norvēģija|Dānija|Spānija|Itālija|Francija|Čehija|Slovākija|Ungārija|Austrija|Šveice|Horvātija|Serbija|Slovēnija|Portugāle|Nīderlande|Beļģija|Grieķija|Turcija|Ukraina|Islande|Rumānija|Bulgārija|Gruzija|Izraēla|Kipra|Luksemburga|Melnkalne|Bosnija|Ziemeļmaķedonija|Albānija|Moldova|Kosova|Īrija|Lielbritānija|Anglija|Skotija|Fēru salas|Farēru salas)\s*$/i;
const MONTHS:Record<string,number>={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};

async function q(p:string,o:RequestInit={}){
 const r=await fetch(U+"/rest/v1/"+p,{...o,headers:{...H,...(o.headers||{})}});
 const t=await r.text();
 if(!r.ok)throw new Error(r.status+" "+t.slice(0,300));
 return t?JSON.parse(t):null;
}
const text=(s:string)=>String(s||"").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&")
 .replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/\s+/g," ").trim();
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
// The calendar shows day and month only: the year that puts the date nearest after today.
export function dateFor(day:number,month:number,today:string){
 const year=Number(today.slice(0,4));
 const iso=(y:number)=>y+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0");
 return iso(year)<addMonthsIso(today,-2)?iso(year+1):iso(year);
}

export function parseCalendar(html:string,today:string){
 const out:any[]=[];
 for(const day of html.split('<div class="calendar-day">').slice(1)){
  const dm=day.match(/<div>\s*(\d{1,2})\.\s*([A-Za-z]+)\s*<\/div>/);
  const month=dm&&MONTHS[dm[2].toLowerCase()];
  if(!dm||!month)continue;
  const date=dateFor(Number(dm[1]),month,today);
  for(const row of day.split('class="row calendar-row"').slice(1)){
   const id=row.match(/handball\.lv\/calendar\/(\d+)/)?.[1];
   const league=row.match(/handball\.lv\/league\/(\d+)"[^>]*>([^<]+)</);
   const info=row.match(/<div>\s*(?:(\d{1,2}:\d{2})\s*)?·\s*([^<]+)<\/div>/);
   const teams=[...row.matchAll(/class="calendar-team">\s*<div>([^<]+)<\/div>/g)].map(m=>text(m[1]));
   if(!id||teams.length<2||!info)continue;
   const address=text(info[2]);
   out.push({id,date,time:info[1]||null,league_id:league?.[1]||null,league:league?text(league[2]):"Handbols",
    group:text(row.match(/<span>([^<]*)<\/span>/)?.[1]||"")||null,home:teams[0],away:teams[1],
    venue:address.split(",")[0].trim(),address,url:"https://handball.lv/calendar/"+id});
  }
 }
 return out;
}

async function inBatches<T>(items:T[],size:number,fn:(x:T)=>Promise<void>){
 for(let i=0;i<items.length;i+=size)await Promise.all(items.slice(i,i+size).map(fn));
}

Deno.serve(async()=>{
 let rid:string|null=null;
 try{
  const today=rigaToday(),windowTo=addMonthsIso(today,3);
  const run=await q("import_runs",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({
   source_key:"handball-"+new Date().toISOString().replace(/[:.]/g,"-"),source_commit:"handball-calendar-v1-3month",
   snapshot_date:today,status:"loading",expected_count:0,imported_count:0})});
  rid=run[0].id;
  const page=await fetch(CALENDAR,{headers:{"User-Agent":"MEETS/1.0 (+https://meets.lv)"}});
  if(!page.ok)throw new Error("Calendar HTTP "+page.status);
  const games=[...new Map(parseCalendar(await page.text(),today).map(g=>[g.id,g])).values()]
   .filter(g=>g.date>=today&&g.date<=windowTo&&!ABROAD.test(g.address));
  if(!games.length)throw new Error("No matches found on "+CALENDAR);
  await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({expected_count:games.length})});

  const source=(await q("sources?domain=eq.handball.lv&select=id"))[0];
  const category=(await q("categories?name=eq.Handbols&select=id"))[0];
  if(!source||!category)throw new Error("handball.lv source or Handbols category missing");
  let created=0,updated=0;
  await inBatches(games,4,async(g:any)=>{
   const key="handball.lv:"+g.id;
   const old=await q("events?import_key=eq."+encodeURIComponent(key)+"&select=id");
   const base={
    title:g.home+" – "+g.away,
    description:[g.league,g.group].filter(Boolean).join(" · "),
    date_from:g.date,date_to:g.date,time_from:g.time?g.time+":00":null,
    schedule_type:"single_day",time_type:g.time?"start_only":"unspecified",attendance_mode:"in_person",
    record_type:"event",event_type:"sports_match",primary_category:"Handbols",
    price_status:"unknown",review_status:"approved",quality_flags:g.time?[]:["source_time_unspecified"],import_run_id:rid
   };
   let eid:string;
   if(old.length){eid=old[0].id;await q("events?id=eq."+eid,{method:"PATCH",body:JSON.stringify(base)});updated++;}
   else{eid=(await q("events",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({...base,import_key:key,status:"pending_review"})}))[0].id;created++;}
   await q("event_occurrences?on_conflict=event_id,occurrence_key",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates"},
    body:JSON.stringify({event_id:eid,occurrence_key:"source",occurrence_kind:"confirmed_date",date_from:g.date,date_to:g.date,
     time_from:base.time_from,time_type:base.time_type,timezone:"Europe/Riga"})});
   const loc={venue_name:g.venue,address_raw:g.address,location_basis:"handball.lv calendar",location_source:g.url};
   const existingLoc=await q("event_locations?event_id=eq."+eid+"&select=event_id");
   if(existingLoc.length)await q("event_locations?event_id=eq."+eid,{method:"PATCH",body:JSON.stringify(loc)});
   else await q("event_locations",{method:"POST",body:JSON.stringify({event_id:eid,...loc,location_precision:"unresolved",
    location_note:"Handbola spēles vieta nolasīta no handball.lv; kartes punkts jāapstiprina adminā."})});
   await q("rpc/meets_import_publish_if_ready",{method:"POST",body:JSON.stringify({p_event_id:eid})});
   const es=await q("event_sources?event_id=eq."+eid+"&source_id=eq."+source.id+"&select=event_id");
   if(!es.length)await q("event_sources",{method:"POST",body:JSON.stringify({event_id:eid,source_id:source.id,source_url:g.url,retrieved_on:today,details_checked:true})});
   else await q("event_sources?event_id=eq."+eid+"&source_id=eq."+source.id,{method:"PATCH",body:JSON.stringify({source_url:g.url,retrieved_on:today,details_checked:true})});
   await q("event_categories?on_conflict=event_id,category_id",{method:"POST",headers:{"Prefer":"resolution=ignore-duplicates"},body:JSON.stringify({event_id:eid,category_id:category.id})});
  });
  await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({status:"complete",imported_count:games.length,added_count:created,updated_count:updated,skipped_count:0,completed_at:new Date().toISOString(),error_text:null})});
  return Response.json({ok:true,run_id:rid,found:games.length,created,updated,games:games.map(g=>({id:g.id,date:g.date,time:g.time,title:g.home+" – "+g.away,venue:g.address}))});
 }catch(e){
  if(rid){try{await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({status:"failed",completed_at:new Date().toISOString(),error_text:String(e).slice(0,500)})});}catch{}}
  console.error("sync_handball_failed",e);
  return Response.json({ok:false,error:String(e)},{status:500});
 }
});
