import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H={"apikey":K,"Authorization":"Bearer "+K,"Content-Type":"application/json"};

async function q(p:string,o:RequestInit={}){
  const r=await fetch(U+"/rest/v1/"+p,{...o,headers:{...H,...(o.headers||{})}});
  const t=await r.text();
  if(!r.ok)throw new Error(r.status+" "+t);
  return t?JSON.parse(t):null;
}
const txt=(s:string)=>s
  .replace(/<script[\s\S]*?<\/script>/gi," ")
  .replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ")
  .replace(/&nbsp;/g," ")
  .replace(/&amp;/g,"&")
  .replace(/&quot;/g,'"')
  .replace(/&#39;/g,"'")
  .replace(/&ndash;|&mdash;/g,"–")
  .replace(/\s+/g," ")
  .trim();

const months:any={jan:"01",feb:"02",mar:"03",apr:"04",mai:"05",jūn:"06",jun:"06",jūl:"07",jul:"07",aug:"08",sep:"09",okt:"10",nov:"11",dec:"12"};

function addMonthsIso(iso:string,n:number){
  const d=new Date(iso+"T12:00:00Z"),day=d.getUTCDate();
  d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);
  const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  d.setUTCDate(Math.min(day,max));
  return d.toISOString().slice(0,10);
}
function slug(v:string){
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);
}
function titleOf(h:string){
  return txt(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||"");
}
function pageGroup(baseName:string,pageTitle:string){
  const cleaned=pageTitle.replace(baseName,"").replace(/\b2026\b/g,"").replace(/^\s*[-–:]\s*/,"").trim();
  return cleaned||null;
}
function stageBefore(h:string,pos:number){
  const s=txt(h.slice(Math.max(0,pos-700),pos));
  const re=/(\d+\.\s*kārta|\d+\s+kārta|1\/\d+\s*fināls|astotdaļfināls|ceturtdaļfināls|pusfināli|pusfināls|fināls)/gi;
  const all=[...s.matchAll(re)];
  return all.length?all[all.length-1][1].replace(/^(\d+)\s+kārta$/,"$1. kārta"):null;
}

type Comp={key:string,name:string,url:string,format:string,expand?:boolean};
const comps:Comp[]=[
 {key:"lff-virsliga",name:"Tonybet Virslīga",url:"https://lff.lv/sacensibas/viriesi/virsliga/?p=2026",format:"football"},
 {key:"lff-lvbet-liga",name:"LVBET līga",url:"https://lff.lv/sacensibas/viriesi/lvbet-liga/",format:"football"},
 {key:"lff-altero-liiga",name:"Altero.lv LIIGA",url:"https://lff.lv/sacensibas/viriesi/otra-liga/",format:"football",expand:true},
 {key:"lff-dali-dali-3",name:"Dali Dali 3. līga",url:"https://lff.lv/sacensibas/viriesi/tresa-liga/",format:"football",expand:true},
 {key:"lff-latvijas-kauss",name:"LVBET Latvijas kauss",url:"https://lff.lv/sacensibas/viriesi/latvijas-kauss/",format:"football"},
 {key:"lff-superkauss",name:"Superkauss",url:"https://lff.lv/sacensibas/viriesi/superkauss/",format:"football"},
 {key:"lff-parspeles",name:"Pārspēles",url:"https://lff.lv/sacensibas/viriesi/parspeles/",format:"football"},
 {key:"lff-livonia-cup",name:"Livonia Cup",url:"https://lff.lv/sacensibas/viriesi/livonia-cup/",format:"football"},
 {key:"lff-baltic-futsal",name:"Baltic Futsal Club League",url:"https://lff.lv/sacensibas/viriesi/baltic-futsal-club-league/",format:"futsal"}
];

const settlementHints:any[]=[
 [/Jāņa Skredeļa|LNK Sporta|Skonto|Mežaparks|RTU stadions|49\. vidusskol|Hanzas vidusskol|Ostvalda|Rūpnīca|Šeibeļa|Arkādija/i,{settlement:"Rīga",settlement_id:20,municipality_id:19,lat:56.949398,lon:24.105185}],
 [/Daugava.*Liepāja|Olimpija.*Liepāja|Liepājas/i,{settlement:"Liepāja",settlement_id:53,municipality_id:30,lat:56.504740,lon:21.010850}],
 [/Esplanāde|Daugavpils/i,{settlement:"Daugavpils",settlement_id:4,municipality_id:29,lat:55.871227,lon:26.515934}],
 [/Tukuma/i,{settlement:"Tukums",settlement_id:24,municipality_id:23,lat:56.966982,lon:23.152453}],
 [/Ogres/i,{settlement:"Ogre",settlement_id:18,municipality_id:17,lat:56.819205,lon:24.607439}],
 [/Salaspils/i,{settlement:"Salaspils",settlement_id:61,municipality_id:40}],
 [/Jāņa Daliņa|Valmieras/i,{settlement:"Valmiera",settlement_id:65,municipality_id:44}],
 [/Rēzekn/i,{settlement:"Rēzekne",settlement_id:54,municipality_id:31}],
 [/Cēsu/i,{settlement:"Cēsis",settlement_id:56,municipality_id:34}],
 [/Piņķu/i,{settlement:"Piņķi",settlement_id:43,municipality_id:16,lat:56.946734,lon:23.913276}],
 [/Jaunmārupes|Mārupes/i,{settlement:"Mārupe",settlement_id:17,municipality_id:16,lat:56.904882,lon:24.043818}],
 [/Jūrmalas|Sloka/i,{settlement:"Jūrmala",settlement_id:12,municipality_id:11,lat:56.972716,lon:23.788698}],
 [/Līvānu/i,{settlement:"Līvāni",settlement_id:15,municipality_id:14,lat:56.353186,lon:26.177657}],
 [/Ilūkstes/i,{settlement:"Ilūkste",settlement_id:32,municipality_id:3,lat:55.976695,lon:26.297333}],
 [/Preiļu/i,{settlement:"Preiļi",settlement_id:19,municipality_id:18,lat:56.293737,lon:26.726673}],
 [/Saldus/i,{settlement:"Saldus",settlement_id:62,municipality_id:41}],
 [/Valkas/i,{settlement:"Valka",settlement_id:25,municipality_id:24,lat:57.772911,lon:26.016034}],
 [/Zemgales OC|Jelgava/i,{settlement:"Jelgava",settlement_id:10,municipality_id:26,lat:56.652206,lon:23.729200}]
];
function inferLocation(venue:string){
  for(const [re,v] of settlementHints)if(re.test(venue))return v;
  return null;
}

async function fetchHtml(url:string){
  const r=await fetch(url,{headers:{"user-agent":"MEETS 2 LFF schedule sync (+https://meets-2.vercel.app/)"}});
  if(!r.ok)throw new Error("LFF HTTP "+r.status+" "+url);
  return r.text();
}
function extraPages(base:string,h:string){
  const root=new URL(base);
  const ids=[...h.matchAll(/\?p=(\d+)/g)].map(m=>m[1]);
  const out:string[]=[];
  for(const id of [...new Set(ids)]){
    if(/^\d{4}$/.test(id)&&id!=="2026")continue;
    const u=root.origin+root.pathname+"?p="+id;
    if(u!==base&&!out.includes(u))out.push(u);
    if(out.length>=12)break;
  }
  return out;
}

function parseStructured(h:string,comp:Comp,url:string,today:string,windowTo:string){
  const pageTitle=titleOf(h);
  const group=pageGroup(comp.name,pageTitle);
  const dateHeaders=[...h.matchAll(/(?:Pirmdiena|Otrdiena|Trešdiena|Ceturtdiena|Piektdiena|Sestdiena|Svētdiena),?\s*(\d{1,2})\.(\d{2})\.(2026)\./gi)]
    .map(m=>({pos:m.index||0,date:m[3]+"-"+m[2]+"-"+m[1].padStart(2,"0")}));
  const rows=[...h.matchAll(/<div class="tr match[^"]*"[^>]*data-id="([^"]+)"[^>]*>([\s\S]*?)(?=<div class="tr match|<div class="tr th1|<\/section>|$)/g)];
  const out:any[]=[];
  for(const r of rows){
    const id=r[1],block=r[2],t=txt(block),link=block.match(/href="(\/speles\/[^"]+)"/)?.[1]||null;
    let date:string|null=null,time:string|null=null,home:string|null=null,away:string|null=null,venue:string|null=null,stage:string|null=null;
    const upcoming=t.match(/^(\d{2}:\d{2})\s+(\d+)\s+kārta\s+(.+?)\s+-\s+(.+?)\s+-\s+(.+)$/);
    if(upcoming){
      time=upcoming[1];stage=upcoming[2]+". kārta";home=upcoming[3].trim();away=upcoming[4].trim();venue=upcoming[5].trim();
      const pos=r.index||0;for(let i=dateHeaders.length-1;i>=0;i--){if(dateHeaders[i].pos<pos){date=dateHeaders[i].date;break}}
    }else{
      const full=t.match(/^(?:pirmdiena|otrdiena|trešdiena|ceturtdiena|piektdiena|sestdiena|svētdiena)\s+(\d{1,2})\s+([a-zāčēģīķļņšūž]+)\s+(\d{2}:\d{2})\s+(2026)\s+(.+?)\s+-\s+(.+?)\s+-\s+(.+)$/i);
      if(full&&months[full[2].toLowerCase()]){
        date=full[4]+"-"+months[full[2].toLowerCase()]+"-"+full[1].padStart(2,"0");
        time=full[3];home=full[5].trim();away=full[6].trim();venue=full[7].trim();stage=stageBefore(h,r.index||0);
      }
    }
    if(!date||!time||!home||!away||!venue||date<today||date>windowTo)continue;
    out.push({id,date,time,home,away,venue,stage,group,competition_key:comp.key,competition_name:comp.name,sport_format:comp.format,url:link?"https://lff.lv"+link:url});
  }
  return out;
}

function parseVeterans(h:string,today:string,windowTo:string){
  const out:any[]=[];
  const currentStart=h.search(/40\+\s*ČEMPIONĀTS/i);
  if(currentStart<0)return out;
  const first50=h.slice(currentStart).search(/50\+\s*ČEMPIONĀTS/i);
  const end40=first50>=0?currentStart+first50:h.length;
  const next40=h.slice(end40+1).search(/40\+\s*ČEMPIONĀTS/i);
  const end50=next40>=0?end40+1+next40:h.length;
  const groups=[
    {html:h.slice(currentStart,end40),age:"40+",key:"lff-veterans-40",name:"Veterānu čempionāts 40+"},
    {html:h.slice(end40,end50),age:"50+",key:"lff-veterans-50",name:"Veterānu čempionāts 50+"}
  ];
  for(const g of groups){
    const lis=[...g.html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
    for(const li of lis){
      const raw=txt(li[1]);
      const m=raw.match(/^(\d{2})\.(\d{2})\.\s*(?:[–-]\s*(\d{2}:\d{2}))?\s*\|\s*(.+?)\s*\|\s*(.+)$/);
      if(!m)continue;
      const date="2026-"+m[2]+"-"+m[1],time=m[3]||"10:00",name=m[4].trim(),venue=m[5].trim();
      if(date<today||date>windowTo)continue;
      const href=li[1].match(/href="([^"]+)"/i)?.[1]||null;
      out.push({
        id:"veterans-"+g.age.replace("+","plus")+"-"+date+"-"+slug(name),date,time,
        home:name,away:g.name,venue,stage:name,group:null,age_group:g.age,
        competition_key:g.key,competition_name:g.name,sport_format:"football",
        url:href?(href.startsWith("http")?href:"https://lff.lv"+href):"https://lff.lv/sacensibas/viriesi/veteranu-cempionats/",
        veteran_event:true
      });
    }
  }
  return out;
}

Deno.serve(async()=>{
 let rid:string|null=null;
 try{
  const today=new Date().toISOString().slice(0,10),windowTo=addMonthsIso(today,3);
  const run=await q("import_runs",{
    method:"POST",headers:{"Prefer":"return=representation"},
    body:JSON.stringify({
      source_key:"lff-all-"+new Date().toISOString().replace(/[:.]/g,"-"),
      source_commit:"lff-men-v6-multi-competition-3month",
      snapshot_date:today,status:"loading",expected_count:0,imported_count:0
    })
  });
  rid=run[0].id;

  const competitionRows=await q("sports_competitions?governing_body=eq.LFF&select=id,competition_key,name,season,sport_format,default_age_group");
  const compMap=new Map(competitionRows.map((x:any)=>[x.competition_key,x]));
  const all:any[]=[];
  const stats:any[]=[];

  for(const comp of comps){
    const root=await fetchHtml(comp.url);
    const urls=[comp.url,...(comp.expand?extraPages(comp.url,root):[])];
    const pageItems:any[]=[];
    for(let i=0;i<urls.length;i++){
      const h=i===0?root:await fetchHtml(urls[i]);
      pageItems.push(...parseStructured(h,comp,urls[i],today,windowTo));
    }
    const dedup=[...new Map(pageItems.map(x=>[x.id,x])).values()];
    all.push(...dedup);
    stats.push({competition:comp.name,pages:urls.length,found:dedup.length});
  }

  const veteransUrl="https://lff.lv/sacensibas/viriesi/veteranu-cempionats/";
  const veteransHtml=await fetchHtml(veteransUrl);
  const veterans=parseVeterans(veteransHtml,today,windowTo);
  all.push(...veterans);
  stats.push({competition:"Veterānu čempionāts",pages:1,found:veterans.length});

  const items=[...new Map(all.map(x=>[x.competition_key+":"+x.id,x])).values()]
    .sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.id.localeCompare(b.id));

  const src=(await q("sources?domain=eq.lff.lv&select=id"))[0];
  const cat=(await q("categories?name=eq.Futbols&select=id"))[0];
  await q("import_runs?id=eq."+rid,{
    method:"PATCH",
    body:JSON.stringify({expected_count:items.length})
  });
  let created=0,updated=0,unresolved=0;

  for(const x of items){
    const key="lff.lv:"+x.id;
    const old=await q("events?import_key=eq."+encodeURIComponent(key)+"&select=id,status");
    const comp=compMap.get(x.competition_key);
    if(!comp)throw new Error("Missing competition "+x.competition_key);

    const metaBits=[x.competition_name,"2026",x.group,x.stage,x.age_group].filter(Boolean);
    const base={
      title:x.veteran_event?x.home:(x.home+" – "+x.away),
      description:metaBits.join(" · "),
      date_from:x.date,date_to:x.date,time_from:x.time+":00",
      schedule_type:"single_day",time_type:"start_only",attendance_mode:"in_person",
      record_type:"event",event_type:"sports_match",primary_category:"Futbols",
      price_status:"unknown",review_status:"approved",quality_flags:[],import_run_id:rid
    };
    let eid:string;
    if(old.length){
      eid=old[0].id;
      await q("events?id=eq."+eid,{method:"PATCH",body:JSON.stringify(base)});
      updated++;
    }else{
      const e=await q("events",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({...base,import_key:key,status:"pending_review"})});
      eid=e[0].id;created++;
    }

    await q("event_occurrences?on_conflict=event_id,occurrence_key",{
      method:"POST",headers:{"Prefer":"resolution=merge-duplicates"},
      body:JSON.stringify({event_id:eid,occurrence_key:"source",occurrence_kind:"confirmed_date",date_from:x.date,date_to:x.date,time_from:x.time+":00",time_type:"start_only",timezone:"Europe/Riga"})
    });

    const loc=inferLocation(x.venue);
    const existingLoc=await q("event_locations?event_id=eq."+eid+"&select=event_id,venue_point,fallback_point,verified_at");
    const locBase:any={
      venue_name:x.venue,address_raw:x.venue,
      location_basis:loc?"LFF venue name + settlement inference":"LFF venue name unresolved",
      municipality_basis:loc?"venue/settlement inference":"unresolved",
      location_source:x.url
    };
    if(loc){locBase.municipality_id=loc.municipality_id;locBase.settlement_id=loc.settlement_id}
    if(existingLoc.length){
      await q("event_locations?event_id=eq."+eid,{method:"PATCH",body:JSON.stringify(locBase)});
    }else{
      if(loc?.lat&&loc?.lon){
        locBase.fallback_point="POINT("+loc.lon+" "+loc.lat+")";
        locBase.location_precision="settlement_center";
        locBase.location_note="LFF norises vieta importēta; kartē pagaidām izmantots apdzīvotās vietas centra punkts.";
      }else{
        locBase.location_precision="unresolved";
        locBase.location_note="LFF norises vieta nolasīta, bet kartes punkts vēl jāverificē admin sadaļā.";
        unresolved++;
      }
      await q("event_locations",{method:"POST",body:JSON.stringify({event_id:eid,...locBase})});
    }
    await q("rpc/meets_import_publish_if_ready",{method:"POST",body:JSON.stringify({p_event_id:eid})});

    await q("event_sports_metadata?on_conflict=event_id",{
      method:"POST",headers:{"Prefer":"resolution=merge-duplicates"},
      body:JSON.stringify({
        event_id:eid,competition_id:comp.id,source_match_id:x.id,
        stage:x.stage||null,group_name:x.group||null,age_group:x.age_group||comp.default_age_group||null,
        sport_format:x.sport_format,home_team:x.veteran_event?null:x.home,away_team:x.veteran_event?null:x.away,
        metadata_note:"Imported from LFF competition schedule"
      })
    });

    const es=await q("event_sources?event_id=eq."+eid+"&source_id=eq."+src.id+"&select=id");
    if(!es.length){
      await q("event_sources",{method:"POST",body:JSON.stringify({event_id:eid,source_id:src.id,source_url:x.url,retrieved_on:today,details_checked:true})});
    }else{
      await q("event_sources?event_id=eq."+eid+"&source_id=eq."+src.id,{method:"PATCH",body:JSON.stringify({source_url:x.url,retrieved_on:today,details_checked:true})});
    }

    await q("event_categories?on_conflict=event_id,category_id",{
      method:"POST",headers:{"Prefer":"resolution=ignore-duplicates"},
      body:JSON.stringify({event_id:eid,category_id:cat.id})
    });
  }

  await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({status:"complete",imported_count:items.length,added_count:created,updated_count:updated,skipped_count:0,completed_at:new Date().toISOString(),error_text:null})});
  return Response.json({
    ok:true,run_id:rid,window_from:today,window_to:windowTo,
    found:items.length,created,updated,unresolved,competitions:stats,
    items:items.map(x=>({id:x.id,date:x.date,time:x.time,competition:x.competition_name,group:x.group||null,stage:x.stage||null,title:x.veteran_event?x.home:x.home+" – "+x.away,venue:x.venue,url:x.url}))
  });
 }catch(e){
  if(rid){
   try{
    await q("import_runs?id=eq."+rid,{
     method:"PATCH",
     body:JSON.stringify({
      status:"failed",
      completed_at:new Date().toISOString(),
      error_text:String(e).slice(0,500)
     })
    });
   }catch{}
  }
  console.error("sync_lff_failed",e);
  return Response.json({ok:false,error:String(e)},{status:500});
 }
});