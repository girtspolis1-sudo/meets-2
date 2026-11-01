// Shared writer for sports schedule imports (hockey, volleyball, floorball).
// Each match becomes one event with a confirmed occurrence, a location the place
// search can resolve, the source link, a category and sports metadata.
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H={"apikey":K,"Authorization":"Bearer "+K,"Content-Type":"application/json"};

export async function q(p:string,o:RequestInit={}){
 const r=await fetch(U+"/rest/v1/"+p,{...o,headers:{...H,...(o.headers||{})}});
 const t=await r.text();
 if(!r.ok)throw new Error(r.status+" "+t.slice(0,300));
 return t?JSON.parse(t):null;
}
export const text=(s:string)=>String(s||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<[^>]+>/g," ")
 .replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'")
 .replace(/&ndash;|&#8211;/g,"–").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/\s+/g," ").trim();
export function rigaToday(){
 return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Riga",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
export function addMonthsIso(iso:string,n:number){
 const d=new Date(iso+"T12:00:00Z"),day=d.getUTCDate();
 d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);
 const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(day,max));
 return d.toISOString().slice(0,10);
}
export async function fetchText(url:string,init:RequestInit={}){
 const r=await fetch(url,{...init,headers:{"User-Agent":"MEETS/1.0 (+https://meets.lv)",...(init.headers||{})},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error("HTTP "+r.status+" "+url);
 return r.text();
}
export async function inBatches<T>(items:T[],size:number,fn:(x:T)=>Promise<void>){
 for(let i=0;i<items.length;i+=size)await Promise.all(items.slice(i,i+size).map(fn));
}
// Venues outside Latvia (away games in Baltic leagues) are not shown on the map.
export const ABROAD=/\b(Igaunija|Lietuva|Estonia|Lithuania|Eesti|Tallin\w*|Tartu|Narva|P[äa]rnu|Viljandi|Rakvere|Kohtla|J[õo]hvi|Haapsalu|Kuressaare|V[õo]ru|Vilni\w*|Kaun\w*|Klaip[ėe]d\w*|[ŠS]iauli\w*|Panev[ėe][žz]\w*|Elektr[ėe]n\w*|Alyt\w*|Marijampol\w*|Utena|pramog\w*)\b/i;

export type Match={
 id:string,date:string,time:string|null,home:string,away:string,
 venue:string,address?:string|null,locality?:string|null,
 competition_key:string,competition:string,group?:string|null,stage?:string|null,age_group?:string|null,url:string
};
export type Family={
 keyPrefix:string,           // import_key prefix, e.g. "lhf.lv"
 runPrefix:string,           // import_runs.source_key prefix, e.g. "hockey-"
 commit:string,
 domain:string,              // sources.domain
 category:string,            // categories.name and events.primary_category
 sport_format:string,
 governing_body:string,
 locationBasis:string,
 locationNote:string
};

export async function startRun(f:Family,today:string){
 const run=await q("import_runs",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({
  source_key:f.runPrefix+new Date().toISOString().replace(/[:.]/g,"-"),source_commit:f.commit,
  snapshot_date:today,status:"loading",expected_count:0,imported_count:0})});
 return run[0].id as string;
}
export async function failRun(rid:string|null,e:unknown){
 if(!rid)return;
 try{await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({status:"failed",completed_at:new Date().toISOString(),error_text:String(e).slice(0,500)})});}catch{}
}

export async function writeMatches(f:Family,rid:string,today:string,matches:Match[],competitions:{key:string,name:string,url:string,age_group?:string|null}[]){
 await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({expected_count:matches.length})});
 const source=(await q("sources?domain=eq."+encodeURIComponent(f.domain)+"&select=id"))[0];
 const category=(await q("categories?name=eq."+encodeURIComponent(f.category)+"&select=id"))[0];
 if(!source||!category)throw new Error(f.domain+" source or "+f.category+" category missing");
 // Competitions are registered on first sight so new leagues need no migration.
 const season=Number(today.slice(5,7))>=7?today.slice(0,4)+"/"+(Number(today.slice(0,4))+1):(Number(today.slice(0,4))-1)+"/"+today.slice(0,4);
 const used=[...new Map(matches.map(m=>[m.competition_key,m])).keys()];
 if(used.length){
  await q("sports_competitions?on_conflict=competition_key",{method:"POST",headers:{"Prefer":"resolution=ignore-duplicates"},
   body:JSON.stringify(used.map(k=>{const c=competitions.find(x=>x.key===k)||{key:k,name:matches.find(m=>m.competition_key===k)!.competition,url:""};
    return {governing_body:f.governing_body,competition_key:k,name:c.name,season,competition_type:"league",sport_format:f.sport_format,
     default_age_group:c.age_group||null,source_url:c.url||null,active:true};}))});
 }
 const comps=used.length?await q("sports_competitions?competition_key=in.("+used.map(k=>'"'+k+'"').join(",")+")&select=id,competition_key"):[];
 const compId=new Map(comps.map((c:any)=>[c.competition_key,c.id]));
 let created=0,updated=0;
 await inBatches(matches,4,async(m)=>{
  const key=f.keyPrefix+":"+m.id;
  const old=await q("events?import_key=eq."+encodeURIComponent(key)+"&select=id");
  const base={
   title:m.home+" – "+m.away,
   description:[m.competition,m.group,m.stage].filter(Boolean).join(" · "),
   date_from:m.date,date_to:m.date,time_from:m.time?m.time+":00":null,
   schedule_type:"single_day",time_type:m.time?"start_only":"unspecified",attendance_mode:"in_person",
   record_type:"event",event_type:"sports_match",primary_category:f.category,
   price_status:"unknown",review_status:"approved",quality_flags:m.time?[]:["source_time_unspecified"],import_run_id:rid
  };
  let eid:string;
  if(old.length){eid=old[0].id;await q("events?id=eq."+eid,{method:"PATCH",body:JSON.stringify(base)});updated++;}
  else{eid=(await q("events",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({...base,import_key:key,status:"pending_review"})}))[0].id;created++;}
  await q("event_occurrences?on_conflict=event_id,occurrence_key",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates"},
   body:JSON.stringify({event_id:eid,occurrence_key:"source",occurrence_kind:"confirmed_date",date_from:m.date,date_to:m.date,
    time_from:base.time_from,time_type:base.time_type,timezone:"Europe/Riga"})});
  const loc:any={venue_name:m.venue,address_raw:m.address||m.venue,location_basis:f.locationBasis,location_source:m.url};
  if(m.locality)loc.locality_text=m.locality;
  const existingLoc=await q("event_locations?event_id=eq."+eid+"&select=event_id,location_source");
  if(existingLoc.length){
   // An admin-approved place mapping stays; only refresh the source link then.
   if(String(existingLoc[0].location_source||"").startsWith("admin mapping:"))delete loc.location_source;
   await q("event_locations?event_id=eq."+eid,{method:"PATCH",body:JSON.stringify(loc)});
  }else await q("event_locations",{method:"POST",body:JSON.stringify({event_id:eid,...loc,country_code:"LV",location_precision:"unresolved",location_note:f.locationNote})});
  await q("event_sports_metadata?on_conflict=event_id",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates"},body:JSON.stringify({
   event_id:eid,competition_id:compId.get(m.competition_key)||null,source_match_id:m.id,stage:m.stage||null,group_name:m.group||null,
   age_group:m.age_group||null,sport_format:f.sport_format,home_team:m.home,away_team:m.away,updated_at:new Date().toISOString()})});
  await q("rpc/meets_import_publish_if_ready",{method:"POST",body:JSON.stringify({p_event_id:eid})});
  const es=await q("event_sources?event_id=eq."+eid+"&source_id=eq."+source.id+"&select=event_id");
  if(!es.length)await q("event_sources",{method:"POST",body:JSON.stringify({event_id:eid,source_id:source.id,source_url:m.url,retrieved_on:today,details_checked:true})});
  else await q("event_sources?event_id=eq."+eid+"&source_id=eq."+source.id,{method:"PATCH",body:JSON.stringify({source_url:m.url,retrieved_on:today,details_checked:true})});
  await q("event_categories?on_conflict=event_id,category_id",{method:"POST",headers:{"Prefer":"resolution=ignore-duplicates"},body:JSON.stringify({event_id:eid,category_id:category.id})});
 });
 await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({status:"complete",imported_count:matches.length,added_count:created,updated_count:updated,skipped_count:0,completed_at:new Date().toISOString(),error_text:null})});
 return {created,updated};
}

export function wantsDry(req:Request){
 return new URL(req.url).searchParams.get("dry")==="1";
}
