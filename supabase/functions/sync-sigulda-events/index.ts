import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Events of Siguldas novads from sigulda.lv. The WordPress API lists them (title,
// text, category, link); the date, venue and address are read from each event page.
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H={"apikey":K,"Authorization":"Bearer "+K,"Content-Type":"application/json"};
const SITE="https://sigulda.lv",UA={"User-Agent":"MEETS/1.0 (+https://meets.lv)"};
const MONTHS:Record<string,number>={jan:1,feb:2,mar:3,apr:4,mai:5,jun:6,jul:7,aug:8,sep:9,okt:10,nov:11,dec:12};

async function q(p:string,o:RequestInit={}){
 const r=await fetch(U+"/rest/v1/"+p,{...o,headers:{...H,...(o.headers||{})}});
 const t=await r.text();
 if(!r.ok)throw new Error(r.status+" "+t.slice(0,300));
 return t?JSON.parse(t):null;
}
const text=(s:string)=>String(s||"").replace(/<(script|style)[\s\S]*?<\/\1>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ")
 .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
 .replace(/\s+/g," ").trim();
const plain=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
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
// Pages show "10. Nov" without a year: the year that puts the date nearest after today.
function dateFor(day:number,month:number,today:string,after?:string){
 const year=Number((after||today).slice(0,4));
 const iso=(y:number)=>y+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0");
 if(after)return iso(year)<after?iso(year+1):iso(year);
 return iso(year)<addMonthsIso(today,-2)?iso(year+1):iso(year);
}

// The right-hand boxes of an event page: "Datums", "Laiks", "Norises vieta", "Adrese".
export function sideBoxes(html:string){
 const boxes:Record<string,string>={};
 for(const part of html.split('side-box-title">').slice(1)){
  const title=text(part.slice(0,part.indexOf("<")));
  const body=part.slice(part.indexOf("</h5>")+5);
  const end=body.search(/<div[^>]*class="ct-div-block (side-box|divider)/);
  if(title&&!(title in boxes))boxes[title]=body.slice(0,end>0?end:3000);
 }
 return boxes;
}

export function parsePage(html:string,today:string){
 const boxes=sideBoxes(html);
 const days=[...text(boxes["Datums"]||"").matchAll(/(\d{1,2})\.\s*([A-Za-zĀ-ž]+)/g)]
  .map(m=>({day:Number(m[1]),month:MONTHS[plain(m[2]).slice(0,3)]})).filter(d=>d.month);
 if(!days.length)return null;
 const from=dateFor(days[0].day,days[0].month,today);
 const to=days[1]?dateFor(days[1].day,days[1].month,today,from):from;
 const timeText=text(boxes["Laiks"]||"")||text(boxes["Datums"]||"");
 const times=[...timeText.matchAll(/\b(\d{1,2})[:.](\d{2})\b/g)].map(m=>m[1].padStart(2,"0")+":"+m[2]);
 const address=text((boxes["Adrese"]||"").match(/icon-row-text"\s*>([^<]+)</)?.[1]||"");
 return {from,to,timeFrom:times[0]||null,timeTo:times[1]||null,venue:text(boxes["Norises vieta"]||"")||null,address:address||null};
}

async function inBatches<T,R>(items:T[],size:number,fn:(x:T)=>Promise<R>){
 const out:R[]=[];
 for(let i=0;i<items.length;i+=size)out.push(...await Promise.all(items.slice(i,i+size).map(fn)));
 return out;
}

Deno.serve(async()=>{
 let rid:string|null=null;
 try{
  const today=rigaToday(),windowTo=addMonthsIso(today,3);
  const run=await q("import_runs",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({
   source_key:"sigulda-"+new Date().toISOString().replace(/[:.]/g,"-"),source_commit:"sigulda-wp-v1-3month",
   snapshot_date:today,status:"loading",expected_count:0,imported_count:0})});
  rid=run[0].id;

  const categories=new Map<number,string>();
  for(const c of await (await fetch(SITE+"/wp-json/wp/v2/pasakumu-kategorija?per_page=100&_fields=id,name",{headers:UA})).json())categories.set(c.id,text(c.name));
  const listed:any[]=[];
  for(let page=1;page<=10;page++){
   const r=await fetch(SITE+"/wp-json/wp/v2/pasakums?per_page=100&page="+page+"&_fields=id,link,title,content,pasakumu-kategorija",{headers:UA});
   if(r.status===400)break;
   if(!r.ok)throw new Error("sigulda.lv API HTTP "+r.status);
   const items=await r.json();
   listed.push(...items);
   if(page>=Number(r.headers.get("x-wp-totalpages")||1))break;
  }
  const pages=await inBatches(listed,6,async(item:any)=>{
   try{
    const r=await fetch(item.link,{headers:UA});
    return r.ok?parsePage(await r.text(),today):null;
   }catch{return null;}
  });
  const events=listed.map((item,i)=>({item,page:pages[i]}))
   .filter(x=>x.page&&x.page.to>=today&&x.page.from<=windowTo);
  const skipped=listed.length-events.length;
  await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({expected_count:events.length})});

  let source=(await q("sources?domain=eq.sigulda.lv&select=id"))[0];
  if(!source)source=(await q("sources",{method:"POST",headers:{"Prefer":"return=representation"},
   body:JSON.stringify({domain:"sigulda.lv",calendar_url:SITE+"/pasakumi/",municipality_id:43})}))[0];
  let created=0,updated=0;
  await inBatches(events,4,async({item,page}:any)=>{
   const key="sigulda.lv:"+item.id;
   const old=await q("events?import_key=eq."+encodeURIComponent(key)+"&select=id");
   const category=(item["pasakumu-kategorija"]||[]).map((id:number)=>categories.get(id)).find(Boolean)||null;
   const base={
    title:text(item.title?.rendered),description:text(item.content?.rendered).slice(0,4000),
    date_from:page.from,date_to:page.to,time_from:page.timeFrom?page.timeFrom+":00":null,time_to:page.timeTo?page.timeTo+":00":null,
    schedule_type:page.from===page.to?"single_day":"continuous",
    time_type:page.timeFrom?(page.timeTo?"fixed_interval":"start_only"):"unspecified",
    attendance_mode:"in_person",record_type:"event",primary_category:category,
    price_status:"unknown",review_status:"needs_review",quality_flags:["location_unverified"],import_run_id:rid
   };
   let eid:string;
   if(old.length){eid=old[0].id;await q("events?id=eq."+eid,{method:"PATCH",body:JSON.stringify(base)});updated++;}
   else{eid=(await q("events",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({...base,import_key:key,status:"pending_review"})}))[0].id;created++;}
   await q("event_occurrences?on_conflict=event_id,occurrence_key",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates"},
    body:JSON.stringify({event_id:eid,occurrence_key:"source",occurrence_kind:"confirmed_date",date_from:page.from,date_to:page.to,
     time_from:base.time_from,time_to:base.time_to,time_type:base.time_type,timezone:"Europe/Riga"})});
   const loc={venue_name:page.venue||page.address||"Siguldas novads",address_raw:page.address||page.venue,municipality_id:43,
    source_municipality_id:43,country_code:"LV",location_basis:"sigulda.lv event page",location_source:item.link};
   const existingLoc=await q("event_locations?event_id=eq."+eid+"&select=event_id");
   if(existingLoc.length)await q("event_locations?event_id=eq."+eid,{method:"PATCH",body:JSON.stringify(loc)});
   else await q("event_locations",{method:"POST",body:JSON.stringify({event_id:eid,...loc,location_precision:"unresolved",
    location_note:"Siguldas novada pasākums: kartes punkts jāapstiprina adminā."})});
   await q("rpc/meets_import_publish_if_ready",{method:"POST",body:JSON.stringify({p_event_id:eid})});
   const es=await q("event_sources?event_id=eq."+eid+"&source_id=eq."+source.id+"&select=event_id");
   if(!es.length)await q("event_sources",{method:"POST",body:JSON.stringify({event_id:eid,source_id:source.id,source_url:item.link,retrieved_on:today,details_checked:true})});
   else await q("event_sources?event_id=eq."+eid+"&source_id=eq."+source.id,{method:"PATCH",body:JSON.stringify({source_url:item.link,retrieved_on:today,details_checked:true})});
  });
  await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({status:"complete",imported_count:events.length,added_count:created,updated_count:updated,skipped_count:skipped,completed_at:new Date().toISOString(),error_text:null})});
  return Response.json({ok:true,run_id:rid,listed:listed.length,imported:events.length,created,updated,skipped,
   sample:events.slice(0,5).map(x=>({title:text(x.item.title?.rendered),...x.page}))});
 }catch(e){
  if(rid){try{await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({status:"failed",completed_at:new Date().toISOString(),error_text:String(e).slice(0,500)})});}catch{}}
  console.error("sync_sigulda_failed",e);
  return Response.json({ok:false,error:String(e)},{status:500});
 }
});
