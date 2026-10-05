import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H={"apikey":K,"Authorization":"Bearer "+K,"Content-Type":"application/json"};
const SCHEDULE_URL="https://www.estlatbl.com/en/game-center?setSid=2027";
const BASKET_INFO_URL="https://lbl.basket.lv/lbl-un-latvijas-igaunijas-basketbola-liga-starts-22-septembri-riga-ligas-debitanti-pret-aizvaditas-sezonas-cempioniem/";

async function q(path:string,o:RequestInit={}){
 const r=await fetch(U+"/rest/v1/"+path,{...o,headers:{...H,...(o.headers||{})}});
 const t=await r.text();
 if(!r.ok)throw new Error(r.status+" "+t);
 return t?JSON.parse(t):null;
}
function decode(s:string){
 return String(s||"")
  .replace(/&nbsp;/g," ")
  .replace(/&amp;/g,"&")
  .replace(/&quot;/g,'"')
  .replace(/&#39;|&#x27;/g,"'")
  .replace(/&ndash;|&mdash;/g,"–")
  .replace(/&#(d+);/g,(_,n)=>String.fromCharCode(Number(n)))
  .replace(/\s+/g," ")
  .trim();
}
function text(s:string){return decode(String(s||"").replace(/<[^>]+>/g," "));}
function addMonthsIso(iso:string,n:number){
 const d=new Date(iso+"T12:00:00Z"),day=d.getUTCDate();
 d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);
 const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(day,max));
 return d.toISOString().slice(0,10);
}
function point(lon:number,lat:number){return "POINT("+lon+" "+lat+")";}

type Loc={
 country:"LV"|"EE",
 locality:string,
 settlement_id?:number,
 municipality_id?:number,
 lat:number,
 lon:number
};

const TEAM_CITY:Record<string,Loc>={
 "Valmiera Glass VIA":{country:"LV",locality:"Valmiera",settlement_id:65,municipality_id:44,lat:57.5387,lon:25.4261},
 "BK Ventspils":{country:"LV",locality:"Ventspils",settlement_id:26,municipality_id:32,lat:57.390392,lon:21.563599},
 "Rīgas Zeļļi":{country:"LV",locality:"Rīga",settlement_id:20,municipality_id:19,lat:56.949398,lon:24.105185},
 "Rigas Ekselences Juniori":{country:"LV",locality:"Rīga",settlement_id:20,municipality_id:19,lat:56.949398,lon:24.105185},
 "VEF Rīga":{country:"LV",locality:"Rīga",settlement_id:20,municipality_id:19,lat:56.949398,lon:24.105185},
 "BK Ogre":{country:"LV",locality:"Ogre",settlement_id:18,municipality_id:17,lat:56.819205,lon:24.607439},
 "BK Liepaja":{country:"LV",locality:"Liepāja",settlement_id:53,municipality_id:30,lat:56.50474,lon:21.01085},
 "Latvijas Universitāte":{country:"LV",locality:"Rīga",settlement_id:20,municipality_id:19,lat:56.949398,lon:24.105185},
 "Tartu Ülikool Maks & Moorits":{country:"EE",locality:"Tartu",lat:58.3776,lon:26.7290},
 "Bigbank/Kalev":{country:"EE",locality:"Tallinn",lat:59.4370,lon:24.7536},
 "TalTech/ALEXELA":{country:"EE",locality:"Tallinn",lat:59.4370,lon:24.7536},
 "BC Pärnu":{country:"EE",locality:"Pärnu",lat:58.3859,lon:24.4971},
 "Viimsi":{country:"EE",locality:"Viimsi",lat:59.4960,lon:24.8420},
 "Keila KK":{country:"EE",locality:"Keila",lat:59.3033,lon:24.4136},
 "Keila Basket":{country:"EE",locality:"Keila",lat:59.3033,lon:24.4136}
};

function inferVenue(venue:string,home:string):Loc{
 const v=venue.toLocaleLowerCase("en");
 if(v.includes("valmieras"))return TEAM_CITY["Valmiera Glass VIA"];
 if(v.includes("rimi olimpiskais")||v.includes("komandas sporta")||v.includes("komandas sporta")||v.includes("daugavas sporta")||v.includes("o. kalpaka"))return TEAM_CITY["VEF Rīga"];
 if(v.includes("liepajas olimpiskais"))return TEAM_CITY["BK Liepaja"];
 if(v.includes("sporta arena ogre"))return TEAM_CITY["BK Ogre"];
 if(v.includes("ventspils"))return TEAM_CITY["BK Ventspils"];
 if(v.includes("marupe"))return {country:"LV",locality:"Mārupe",settlement_id:17,municipality_id:16,lat:56.904882,lon:24.043818};
 if(v.includes("cesis"))return {country:"LV",locality:"Cēsis",settlement_id:56,municipality_id:34,lat:57.3119,lon:25.2746};
 if(v.includes("saldus"))return {country:"LV",locality:"Saldus",settlement_id:62,municipality_id:41,lat:56.6636,lon:22.4881};
 if(v.includes("rezekne"))return {country:"LV",locality:"Rēzekne",settlement_id:54,municipality_id:31,lat:56.5099,lon:27.3331};
 if(v.includes("keila tervise"))return TEAM_CITY["Keila KK"];
 if(v.includes("taltech"))return TEAM_CITY["TalTech/ALEXELA"];
 if(v.includes("nord spordihoone"))return TEAM_CITY["Bigbank/Kalev"];
 if(v.includes("pärnu")||v.includes("parnu"))return TEAM_CITY["BC Pärnu"];
 if(v.includes("viimsi"))return TEAM_CITY["Viimsi"];
 if(v.includes("tartu")||v.includes("tü sph"))return TEAM_CITY["Tartu Ülikool Maks & Moorits"];
 return TEAM_CITY[home]||{country:"LV",locality:"Rīga",settlement_id:20,municipality_id:19,lat:56.949398,lon:24.105185};
}

function parse(html:string,today:string,windowTo:string){
 const out:any[]=[];
 for(const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){
  const row=m[1];
  const gid=row.match(/game-center\?gid=(\d+)/i)?.[1];
  const dt=text(row.match(/<div class="dateAndTime">([\s\S]*?)<\/div>/i)?.[1]||"");
  const arena=text(row.match(/<div class="arena">([\s\S]*?)<\/div>/i)?.[1]||"");
  const home=text(row.match(/<span class="homeTeamNameDesktop">([\s\S]*?)<\/span>/i)?.[1]||"");
  const away=text(row.match(/<span class="visitorTeamNameDesktop">([\s\S]*?)<\/span>/i)?.[1]||"");
  const d=dt.match(/(\d{2})\.(\d{2})\.(\d{4}),\s*(\d{2}:\d{2})/);
  if(!gid||!d||!arena||!home||!away)continue;
  const date=d[3]+"-"+d[2]+"-"+d[1];
  if(date<today||date>windowTo)continue;
  out.push({
   gid,date,time:d[4],arena,home,away,
   gameUrl:"https://www.estlatbl.com/en/game-center?gid="+gid
  });
 }
 return [...new Map(out.map(x=>[x.gid,x])).values()]
  .sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.gid.localeCompare(b.gid));
}

Deno.serve(async()=>{
 try{
  const today=new Date().toISOString().slice(0,10);
  const windowTo=addMonthsIso(today,3);
  const htmlRes=await fetch(SCHEDULE_URL,{headers:{"User-Agent":"MEETS-2/1.0 (+https://meets-2.vercel.app/)"}});
  if(!htmlRes.ok)throw new Error("Schedule HTTP "+htmlRes.status);
  const html=await htmlRes.text();
  const games=parse(html,today,windowTo);

  const sourceRows=await q("sources?domain=in.(basket.lv,estlatbl.com)&select=id,domain");
  const sourceMap=new Map(sourceRows.map((x:any)=>[x.domain,x.id]));
  const category=(await q("categories?name=eq.Basketbols&select=id"))[0];
  const competition=(await q("sports_competitions?competition_key=eq.lbs-estlat-2026-27&select=id"))[0];
  if(!sourceMap.get("estlatbl.com")||!sourceMap.get("basket.lv")||!category||!competition)throw new Error("Basketball metadata missing");

  const run=await q("import_runs",{
   method:"POST",headers:{"Prefer":"return=representation"},
   body:JSON.stringify({
    source_key:"estlatbl-"+new Date().toISOString().replace(/[:.]/g,"-"),
    source_commit:"estlatbl-2026-27-v1-3month",
    snapshot_date:today,status:"loading",expected_count:games.length,imported_count:0
   })
  });
  const rid=run[0].id;
  let created=0,updated=0,latvia=0,estonia=0;

  for(const g of games){
   const key="estlatbl.com:"+g.gid;
   const loc=inferVenue(g.arena,g.home);
   if(loc.country==="EE")estonia++;else latvia++;
   const old=await q("events?import_key=eq."+encodeURIComponent(key)+"&select=id,status");
   const base={
    title:g.home+" – "+g.away,
    description:"Optibet Latvijas–Igaunijas Basketbola līga · 2026/2027",
    date_from:g.date,date_to:g.date,time_from:g.time+":00",
    timezone:loc.country==="EE"?"Europe/Tallinn":"Europe/Riga",
    schedule_type:"single_day",time_type:"start_only",attendance_mode:"in_person",
    record_type:"event",event_type:"sports_match",primary_category:"Basketbols",
    price_status:"unknown",review_status:"approved",quality_flags:[],import_run_id:rid
   };
   let eid:string;
   if(old.length){
    eid=old[0].id;
    await q("events?id=eq."+eid,{method:"PATCH",body:JSON.stringify(base)});
    updated++;
   }else{
    const e=await q("events",{
     method:"POST",headers:{"Prefer":"return=representation"},
     body:JSON.stringify({...base,import_key:key,status:"pending_review"})
    });
    eid=e[0].id;created++;
   }

   await q("event_occurrences?on_conflict=event_id,occurrence_key",{
    method:"POST",headers:{"Prefer":"resolution=merge-duplicates"},
    body:JSON.stringify({
     event_id:eid,occurrence_key:"source",occurrence_kind:"confirmed_date",
     date_from:g.date,date_to:g.date,time_from:g.time+":00",time_type:"start_only",
     timezone:loc.country==="EE"?"Europe/Tallinn":"Europe/Riga"
    })
   });

   const existingLoc=await q("event_locations?event_id=eq."+eid+"&select=event_id,venue_point,fallback_point");
   const locBase:any={
    venue_name:g.arena,address_raw:g.arena,country_code:loc.country,
    locality_text:loc.locality,
    location_basis:"estlatbl arena + city inference",
    municipality_basis:loc.country==="LV"?"arena/city inference":"country + city inference",
    location_source:g.gameUrl
   };
   if(loc.settlement_id)locBase.settlement_id=loc.settlement_id;
   if(loc.municipality_id)locBase.municipality_id=loc.municipality_id;

   if(existingLoc.length){
    if(!existingLoc[0].venue_point){
     locBase.fallback_point=point(loc.lon,loc.lat);
     locBase.location_precision="settlement_center";
     locBase.location_note="Arēna nolasīta no oficiālā līgas kalendāra; kartē pagaidām izmantots pilsētas centra aptuvenais punkts.";
    }
    await q("event_locations?event_id=eq."+eid,{method:"PATCH",body:JSON.stringify(locBase)});
   }else{
    await q("event_locations",{
     method:"POST",
     body:JSON.stringify({
      event_id:eid,...locBase,
      fallback_point:point(loc.lon,loc.lat),
      location_precision:"settlement_center",
      location_note:"Arēna nolasīta no oficiālā līgas kalendāra; kartē pagaidām izmantots pilsētas centra aptuvenais punkts."
     })
    });
   }
   await q("rpc/meets_import_publish_if_ready",{method:"POST",body:JSON.stringify({p_event_id:eid})});

   await q("event_sports_metadata?on_conflict=event_id",{
    method:"POST",headers:{"Prefer":"resolution=merge-duplicates"},
    body:JSON.stringify({
     event_id:eid,competition_id:competition.id,source_match_id:g.gid,
     sport_format:"basketball",home_team:g.home,away_team:g.away,
     metadata_note:"Imported from official Latvian-Estonian Basketball League game center"
    })
   });

   for(const source of [
    {id:sourceMap.get("estlatbl.com"),url:g.gameUrl},
    {id:sourceMap.get("basket.lv"),url:BASKET_INFO_URL}
   ]){
    const es=await q("event_sources?event_id=eq."+eid+"&source_id=eq."+source.id+"&select=id");
    if(!es.length){
     await q("event_sources",{method:"POST",body:JSON.stringify({
      event_id:eid,source_id:source.id,source_url:source.url,retrieved_on:today,details_checked:true
     })});
    }else{
     await q("event_sources?event_id=eq."+eid+"&source_id=eq."+source.id,{
      method:"PATCH",body:JSON.stringify({source_url:source.url,retrieved_on:today,details_checked:true})
     });
    }
   }

   await q("event_categories?on_conflict=event_id,category_id",{
    method:"POST",headers:{"Prefer":"resolution=ignore-duplicates"},
    body:JSON.stringify({event_id:eid,category_id:category.id})
   });
  }

  await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({status:"complete",imported_count:games.length})});

  return Response.json({
   ok:true,run_id:rid,window_from:today,window_to:windowTo,
   found:games.length,created,updated,latvia,estonia,
   games:games.map(g=>({gid:g.gid,date:g.date,time:g.time,title:g.home+" – "+g.away,arena:g.arena,url:g.gameUrl}))
  });
 }catch(e){
  console.error("sync_estlat_failed",e);
  return Response.json({ok:false,error:String(e)},{status:500});
 }
});