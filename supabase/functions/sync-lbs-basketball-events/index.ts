import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const feeds=[
 {websiteId:"120",key:"lbs-nbl-2026-27",name:"Ramirent Nacionālā Basketbola līga",season:"2026/2027",domain:"nbl.basket.lv",url:"https://nbl.basket.lv/kalendars/"},
 {websiteId:"119",key:"lbs-rbl-2026-27",name:"Aizdevums.lv Reģionālā Basketbola līga",season:"2026/2027",domain:"rbl.basket.lv",url:"https://rbl.basket.lv/kalendars/"},
 {websiteId:"117",key:"lbs-lsbl-2026-27",name:"Latvijas Sieviešu Basketbola līga",season:"2026/2027",domain:"lsbl.basket.lv",url:"https://lsbl.basket.lv/kalendars/"},
 {websiteId:"259",key:"lbs-lsbl2-2026-27",name:"Latvijas Sieviešu Basketbola līga, 2.divīzija",season:"2026/2027",domain:"lsbl2.basket.lv",url:"https://lsbl2.basket.lv/kalendars/"},
 {websiteId:"309",key:"lbs-sbbl-b-2026-27",name:"Sieviešu Baltijas Basketbola līga, B divīzija",season:"2026/2027",domain:"sbblb.basket.lv",url:"https://sbblb.basket.lv/kalendars/"},
 {websiteId:"118",key:"lbs-uzavas-cup-2026-27",name:"Latvijas basketbola Užavas kauss",season:"2026/2027",domain:"lbk.basket.lv",url:"https://lbk.basket.lv/kalendars/"},
 {websiteId:"116",key:"lbs-lbl-2026-27",name:"Latvijas Basketbola līga",season:"2026/2027",domain:"lbl.basket.lv",url:"https://lbl.basket.lv/kalendars/"}
];

function rigaToday(){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Riga",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const o=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return `${o.year}-${o.month}-${o.day}`;
}
function addMonthsIso(iso:string,months:number){
 const [y,m,d]=iso.split("-").map(Number);
 const target=new Date(Date.UTC(y,m-1+months,1,12));
 const max=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0,12)).getUTCDate();
 target.setUTCDate(Math.min(d,max));
 return target.toISOString().slice(0,10);
}
function norm(v:string){
 return String(v||"").toLocaleLowerCase("lv").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();
}
type Place={country_code:string,locality_text:string,fallback_lat:number,fallback_lon:number};

const places:Array<[RegExp,Place]>=[
 [/druskin/i,{country_code:"LT",locality_text:"Druskininkai",fallback_lat:54.0151,fallback_lon:23.9870}],
 [/zalgir|kaunas/i,{country_code:"LT",locality_text:"Kaunas",fallback_lat:54.8985,fallback_lon:23.9036}],
 [/savanoiriu|mykolas romeris|vilniaus|vilnius/i,{country_code:"LT",locality_text:"Vilnius",fallback_lat:54.6872,fallback_lon:25.2797}],
 [/tartu/i,{country_code:"EE",locality_text:"Tartu",fallback_lat:58.3776,fallback_lon:26.7290}],
 [/tallin|audentes|kristiine/i,{country_code:"EE",locality_text:"Tallinn",fallback_lat:59.4370,fallback_lon:24.7536}],
 [/ventspil/i,{country_code:"LV",locality_text:"Ventspils",fallback_lat:57.390392,fallback_lon:21.563599}],
 [/liepaj/i,{country_code:"LV",locality_text:"Liepāja",fallback_lat:56.504740,fallback_lon:21.010850}],
 [/valmier/i,{country_code:"LV",locality_text:"Valmiera",fallback_lat:57.5387,fallback_lon:25.4261}],
 [/jelgav|lbtu/i,{country_code:"LV",locality_text:"Jelgava",fallback_lat:56.652206,fallback_lon:23.729200}],
 [/salaspil/i,{country_code:"LV",locality_text:"Salaspils",fallback_lat:56.8609,fallback_lon:24.3498}],
 [/kandav/i,{country_code:"LV",locality_text:"Kandava",fallback_lat:57.0400,fallback_lon:22.7747}],
 [/limbaz/i,{country_code:"LV",locality_text:"Limbaži",fallback_lat:57.5129,fallback_lon:24.7194}],
 [/saldus/i,{country_code:"LV",locality_text:"Saldus",fallback_lat:56.6636,fallback_lon:22.4881}],
 [/tukum/i,{country_code:"LV",locality_text:"Tukums",fallback_lat:56.966982,fallback_lon:23.152453}],
 [/bausk|memele/i,{country_code:"LV",locality_text:"Bauska",fallback_lat:56.4079,fallback_lon:24.1944}],
 [/grobin/i,{country_code:"LV",locality_text:"Grobiņa",fallback_lat:56.5350,fallback_lon:21.1670}],
 [/gulben/i,{country_code:"LV",locality_text:"Gulbene",fallback_lat:57.1770,fallback_lon:26.7520}],
 [/jekabpil/i,{country_code:"LV",locality_text:"Jēkabpils",fallback_lat:56.4990,fallback_lon:25.8780}],
 [/kekav/i,{country_code:"LV",locality_text:"Ķekava",fallback_lat:56.8266,fallback_lon:24.2300}],
 [/ogre/i,{country_code:"LV",locality_text:"Ogre",fallback_lat:56.819205,fallback_lon:24.607439}],
 [/tals/i,{country_code:"LV",locality_text:"Talsi",fallback_lat:57.2456,fallback_lon:22.5814}],
 [/marup/i,{country_code:"LV",locality_text:"Mārupe",fallback_lat:56.904882,fallback_lon:24.043818}],
 [/jurmal/i,{country_code:"LV",locality_text:"Jūrmala",fallback_lat:56.972716,fallback_lon:23.788698}],
 [/adaz/i,{country_code:"LV",locality_text:"Ādaži",fallback_lat:57.0750,fallback_lon:24.3210}],
 [/aizkrauk/i,{country_code:"LV",locality_text:"Aizkraukle",fallback_lat:56.6048,fallback_lon:25.2550}],
 [/aluksn/i,{country_code:"LV",locality_text:"Alūksne",fallback_lat:57.4216,fallback_lon:27.0466}],
 [/ces/i,{country_code:"LV",locality_text:"Cēsis",fallback_lat:57.3119,fallback_lon:25.2746}],
 [/daugavpil/i,{country_code:"LV",locality_text:"Daugavpils",fallback_lat:55.871227,fallback_lon:26.515934}],
 [/jaunpil/i,{country_code:"LV",locality_text:"Jaunpils",fallback_lat:56.7310,fallback_lon:23.0120}],
 [/livan/i,{country_code:"LV",locality_text:"Līvāni",fallback_lat:56.3532,fallback_lon:26.1768}],
 [/madon/i,{country_code:"LV",locality_text:"Madona",fallback_lat:56.8530,fallback_lon:26.2160}],
 [/nica/i,{country_code:"LV",locality_text:"Nīca",fallback_lat:56.3460,fallback_lon:21.0640}],
 [/ozolniek/i,{country_code:"LV",locality_text:"Ozolnieki",fallback_lat:56.6890,fallback_lon:23.7870}],
 [/rezekn/i,{country_code:"LV",locality_text:"Rēzekne",fallback_lat:56.5099,fallback_lon:27.3331}],
 [/rujien/i,{country_code:"LV",locality_text:"Rūjiena",fallback_lat:57.8970,fallback_lon:25.3310}],
 [/salacgriv/i,{country_code:"LV",locality_text:"Salacgrīva",fallback_lat:57.7530,fallback_lon:24.3590}],
 [/saulkrast/i,{country_code:"LV",locality_text:"Saulkrasti",fallback_lat:57.2630,fallback_lon:24.4180}],
 [/siguld/i,{country_code:"LV",locality_text:"Sigulda",fallback_lat:57.1530,fallback_lon:24.8520}],
 [/kraslav/i,{country_code:"LV",locality_text:"Krāslava",fallback_lat:55.8950,fallback_lon:27.1670}],
 [/valka/i,{country_code:"LV",locality_text:"Valka",fallback_lat:57.7760,fallback_lon:26.0110}],
 [/priekul/i,{country_code:"LV",locality_text:"Priekule",fallback_lat:56.4450,fallback_lon:21.5890}],
 [/rigas|riga |kssh|dsn|rsu|hanzas|ridzene|kalpaka|komandas sporta/i,{country_code:"LV",locality_text:"Rīga",fallback_lat:56.949398,fallback_lon:24.105185}]
];

function inferPlace(venue:string,home:string,timezone:string):Place|null{
 const hay=norm(venue+" "+home);
 for(const [re,place] of places) if(re.test(hay)) return place;
 if(timezone==="Europe/Tallinn") return {country_code:"EE",locality_text:"Tallinn",fallback_lat:59.4370,fallback_lon:24.7536};
 if(timezone==="Europe/Vilnius") return {country_code:"LT",locality_text:"Vilnius",fallback_lat:54.6872,fallback_lon:25.2797};
 return null;
}
function sourceUrl(base:string,link:string|null){
 if(!link)return base;
 const q=String(link).replace(/^&/,"");
 return base+(base.includes("?")?"&":"?")+q;
}
async function fetchFeed(feed:any){
 const url=`https://embed-api.eui.connect.sportradar.com/v1/embed/${feed.websiteId}/fixtures`;
 const r=await fetch(url,{headers:{"User-Agent":"MEETS-2/1.0 (+https://meets-2.vercel.app/)"}});
 if(!r.ok)throw new Error(`Sportradar ${feed.websiteId} HTTP ${r.status}`);
 const body=await r.json();
 return {feed,data:body?.data||{}};
}
// The calendar of a regional tournament gives only a venue id; the game page
// (fixture_detail) names the hall, e.g. "OC Ventspils".
async function fixtureVenue(websiteId:string,fixtureId:string){
 try{
  const url=`https://embed-api.eui.connect.sportradar.com/v1/embed/${websiteId}/fixture_detail?fixtureId=${encodeURIComponent(fixtureId)}`;
  const r=await fetch(url,{headers:{"User-Agent":"MEETS-2/1.0 (+https://meets-2.vercel.app/)"},signal:AbortSignal.timeout(15000)});
  if(!r.ok)return "";
  const text=await r.text();
  const m=text.match(/"venue":"((?:[^"\\]|\\.)*)"/);
  return m?JSON.parse('"'+m[1]+'"').trim():"";
 }catch{return "";}
}
async function rest(path:string,init:RequestInit={}){
 const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{...init,headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json",...(init.headers||{})}});
 const t=await r.text();
 if(!r.ok)throw new Error("REST "+r.status+" "+t.slice(0,200));
 return t?JSON.parse(t):null;
}
// Regional tournaments (regionalie.basket.lv) were found by the discovery run and
// live in basketball_sources; each is its own Sportradar website id.
async function regionalFeeds(){
 const rows=await rest("basketball_sources?section=eq."+encodeURIComponent("Reģionālie turnīri")+"&parser_type=eq.sportradar&active=is.true&website_id=not.is.null&select=website_id,calendar_url");
 return rows.map((r:any)=>({websiteId:String(r.website_id),key:"lbs-regional-"+r.website_id,name:"",season:"",
  domain:"regionalie.basket.lv",url:r.calendar_url,regional:true}));
}
// Latvian Youth Basketball League (LJBL): one Sportradar website id per age group and
// division, listed in basketball_sources (section LJBL). Its games are youth
// competitions: the competition rows carry level='youth' and the age group, so the map
// shows them only under "Sacensību līmenis: Jaunieši" (lib/sport-level.js).
// "U12 Puiši," → "U12 Puiši"; "U16, nacionālais līgas kauss -" → "U16, nacionālais līgas kauss".
export const ljblName=(s:string)=>String(s||"").replace(/[\s,–-]+$/,"").trim();
async function ljblFeeds(){
 const rows=await rest("basketball_sources?section=eq.LJBL&parser_type=eq.sportradar&active=is.true&website_id=not.is.null&select=website_id,calendar_url,competition,age_group");
 return rows.map((r:any)=>({websiteId:String(r.website_id),key:"ljbl:"+r.website_id,name:ljblName(r.competition),season:"",
  domain:"ljbl.basket.lv",url:r.calendar_url,ljbl:true,age_group:r.age_group||null}));
}
// New LJBL groups are added as youth competitions; existing rows (and whether they are
// switched on) are left as they are.
async function registerLjblCompetitions(list:any[],season:string){
 if(!list.length)return;
 await rest("sports_competitions?on_conflict=competition_key",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates"},
  body:JSON.stringify(list.map(f=>({governing_body:"LBS / LJBL",competition_key:f.key,name:f.name,season,competition_type:"league",
   sport_format:"basketball",default_age_group:f.age_group,level:"youth",source_url:f.url,active:true})))});
}
const LJBL_NOTE="LJBL: spēle vairs nav oficiālajā kalendārā";
const LJBL_CANCELLED="LJBL: spēle oficiālajā kalendārā atcelta";
// Coming LJBL games that left the official calendar (moved to another id, withdrawn) or
// were cancelled there are taken off the map; one that comes back is published again.
// A feed that suddenly lists far fewer games is reported, not trusted.
async function reconcileLjbl(feeds:{feed:any,data:any}[],today:string){
 const out={archived:0,cancelled:0,restored:0,skipped:[] as string[]};
 for(const {feed,data} of feeds){
  const fixtures=Array.isArray(data.fixtures)?data.fixtures:[];
  if(!fixtures.length){out.skipped.push(feed.websiteId+": tukšs kalendārs");continue;}
  const listed=new Map<string,string>();
  for(const f of fixtures)if(f.fixtureId)listed.set("sportradar:"+feed.websiteId+":"+f.fixtureId,String(f?.status?.value||"").toUpperCase());
  const stored=await rest("events?import_key=like."+encodeURIComponent("sportradar:"+feed.websiteId+":*")+"&date_from=gte."+today+"&select=id,import_key,status,last_change_summary");
  const gone=stored.filter((e:any)=>e.status!=="archived"&&e.status!=="cancelled"&&!listed.has(e.import_key));
  const cancelled=stored.filter((e:any)=>e.status!=="cancelled"&&["CANCELLED","ABANDONED"].includes(listed.get(e.import_key)||""));
  const back=stored.filter((e:any)=>["archived","cancelled"].includes(e.status)&&[LJBL_NOTE,LJBL_CANCELLED].includes(e.last_change_summary)
   &&listed.has(e.import_key)&&!["CANCELLED","ABANDONED"].includes(listed.get(e.import_key)||""));
  const live=stored.filter((e:any)=>e.status!=="archived"&&e.status!=="cancelled").length;
  if(gone.length+cancelled.length>Math.max(5,live/2)){out.skipped.push(feed.websiteId+": pazustu "+(gone.length+cancelled.length)+" no "+live);continue;}
  const patch=async(ids:string[],body:any)=>{if(ids.length)await rest("events?id=in.("+ids.join(",")+")",{method:"PATCH",body:JSON.stringify({...body,updated_at:new Date().toISOString()})});};
  await patch(gone.map((e:any)=>e.id),{status:"archived",last_change_summary:LJBL_NOTE});
  await patch(cancelled.map((e:any)=>e.id),{status:"cancelled",last_change_summary:LJBL_CANCELLED});
  // Back to review; the import below publishes it again when it is ready.
  await patch(back.map((e:any)=>e.id),{status:"pending_review",last_change_summary:"LJBL: spēle atkal oficiālajā kalendārā"});
  out.archived+=gone.length;out.cancelled+=cancelled.length;out.restored+=back.length;
 }
 return out;
}

// "Tukuma čempionāts 2026/2027" → "Tukuma čempionāts".
const seasonless=(s:string)=>String(s||"").replace(/[,\s-]*\d{4}\.?\/\s?\d{2,4}\.?\s*$/,"").replace(/[,\s-]*\d{4}\s*$/,"").trim();
async function registerCompetitions(list:{key:string,name:string,season:string,url:string}[]){
 if(!list.length)return;
 await rest("sports_competitions?on_conflict=competition_key",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},
  body:JSON.stringify(list.map(c=>({governing_body:"LBS",competition_key:c.key,name:c.name,season:c.season||null,
   competition_type:"regional",sport_format:"basketball",source_url:c.url,active:true})))});
}

async function rpc(items:any[],commit="lbs-sportradar-v1-3month"){
 const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/meets_import_sportradar_basketball",{
  method:"POST",
  headers:{
   apikey:SERVICE_KEY,
   Authorization:"Bearer "+SERVICE_KEY,
   "Content-Type":"application/json"
  },
  body:JSON.stringify({p_items:items,p_source_commit:commit}),
  signal:AbortSignal.timeout(120000)
 });
 const text=await r.text();
 if(!r.ok)throw new Error("Import RPC "+r.status+" "+text);
 return text?JSON.parse(text):null;
}

Deno.serve(async(req)=>{
 try{
  const today=rigaToday();
  const windowTo=addMonthsIso(today,3);
  // ?dry=1 reads and reports without writing; {"only":"ljbl"} (the daily run) reads the
  // youth league alone, the weekly run reads everything.
  const url=new URL(req.url);
  let body:any={};try{body=await req.json();}catch{body={};}
  const dry=url.searchParams.get("dry")==="1"||body?.dry===true;
  const onlyLjbl=(url.searchParams.get("only")||body?.only)==="ljbl";
  const fetched:any[]=onlyLjbl?[]:await Promise.all(feeds.map(fetchFeed));
  // Regional and LJBL feeds are many and small: read them a few at a time; one that
  // fails is reported and skipped rather than failing the national leagues.
  const regional=onlyLjbl?[]:await regionalFeeds();
  const ljbl=await ljblFeeds();
  const regionalFailed:string[]=[],ljblFailed:string[]=[];
  for(const [list,failed] of [[regional,regionalFailed],[ljbl,ljblFailed]] as [any[],string[]][]){
   for(let i=0;i<list.length;i+=8){
    const batch=await Promise.all(list.slice(i,i+8).map((f:any)=>fetchFeed(f).catch(()=>{failed.push(f.websiteId);return null;})));
    for(const r of batch)if(r)fetched.push(r);
   }
  }
  const regionalCompetitions:any[]=[];
  const items:any[]=[];
  const stats:any[]=[];

  for(const {feed,data} of fetched){
   const fixtures=Array.isArray(data.fixtures)?data.fixtures:[];
   const selectedSeason=data?.seasons?.seasons?.find((s:any)=>s.seasonId===data.seasonId)?.nameLocal||null;
   if(feed.regional){
    feed.name=seasonless(selectedSeason||"")||"Reģionālais basketbola turnīrs";
    feed.season=String(selectedSeason||"").match(/\d{4}\.?\/\s?\d{2,4}/)?.[0]||"";
   }
   let accepted=0;

   for(const f of fixtures){
    const start=String(f.startTimeLocal||"");
    const date=start.slice(0,10);
    const time=start.slice(11,19)||"00:00:00";
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<today||date>windowTo)continue;
    const status=String(f?.status?.value||"").toUpperCase();
    if(["CANCELLED","ABANDONED"].includes(status))continue;

    const competitors=Array.isArray(f.competitors)?f.competitors:[];
    const home=competitors.find((x:any)=>x.isHome===true)?.name||competitors[0]?.name||"";
    const away=competitors.find((x:any)=>x.isHome===false)?.name||competitors[1]?.name||"";
    if(!f.fixtureId||!home||!away)continue;

    const venue=String(f.venue||"").trim();
    const timezone=String(f.timezone||"Europe/Riga");
    const place=inferPlace(venue,home,timezone);
    const series=f.series||null;
    const stage=series?.stage||series?.name||null;
    const group=String(f.pool||series?.pool||"").trim()||null;

    items.push({
     ljbl:feed.ljbl===true,
     import_key:`sportradar:${feed.websiteId}:${f.fixtureId}`,
     title:`${home} – ${away}`,
     description:[feed.name,feed.season].filter(Boolean).join(" · "),
     date_from:date,
     time_from:time,
     timezone,
     venue_name:venue||null,
     country_code:place?.country_code||null,
     locality_text:place?.locality_text||null,
     fallback_lat:place?.fallback_lat??null,
     fallback_lon:place?.fallback_lon??null,
     source_domain:feed.domain,
     source_url:sourceUrl(feed.url,f.link||null),
     competition_key:feed.key,
     source_match_id:String(f.fixtureId),
     source_venue_id:f.venueId?String(f.venueId):null,
     stage,
     group_name:group,
     home_team:String(home),
     away_team:String(away)
    });
    accepted++;
   }

   stats.push({
    competition:feed.name,
    website_id:feed.websiteId,
    selected_season:selectedSeason,
    feed_fixtures:fixtures.length,
    imported_window:accepted
   });
   if(feed.regional&&accepted)regionalCompetitions.push({key:feed.key,name:feed.name,season:feed.season,url:feed.url});
  }

  // The import RPC needs a competition row per key; regional ones are named from the feed.
  const season=Number(today.slice(5,7))>=7?today.slice(0,4)+"/"+(Number(today.slice(0,4))+1):(Number(today.slice(0,4))-1)+"/"+today.slice(0,4);
  const ljblFetched=fetched.filter(x=>x.feed.ljbl);
  if(!dry){
   await registerCompetitions(regionalCompetitions);
   await registerLjblCompetitions(ljblFetched.map(x=>x.feed),season);
  }
  // Regional feeds carry a venue id without a name; the national feeds name the same halls.
  const unnamed=[...new Set(items.filter(i=>!i.venue_name&&i.source_venue_id).map(i=>i.source_venue_id))];
  if(unnamed.length){
   const known=await rest("rpc/meets_sportradar_venue_names",{method:"POST",body:JSON.stringify({p_venue_ids:unnamed})});
   const names=new Map((known||[]).map((k:any)=>[k.source_venue_id,k.venue_name]));
   for(const i of items)if(!i.venue_name&&names.has(i.source_venue_id)){
    i.venue_name=names.get(i.source_venue_id);
    const place=inferPlace(i.venue_name,i.home_team,i.timezone);
    if(place&&!i.locality_text)Object.assign(i,{country_code:place.country_code,locality_text:place.locality_text,fallback_lat:place.fallback_lat,fallback_lon:place.fallback_lon});
   }
  }
  // Still unnamed: read one game page per hall (or per game without a hall id).
  const pending=new Map<string,any>();
  for(const i of items)if(!i.venue_name){
   const key=i.source_venue_id||"fixture:"+i.import_key;
   if(!pending.has(key))pending.set(key,i);
  }
  const lookups=[...pending.entries()].slice(0,120);
  const found=new Map<string,string>();
  for(let k=0;k<lookups.length;k+=6){
   await Promise.all(lookups.slice(k,k+6).map(async([key,item])=>{
    const websiteId=String(item.import_key).split(":")[1];
    const name=await fixtureVenue(websiteId,item.source_match_id);
    if(name)found.set(key,name);
   }));
  }
  let fromGamePages=0;
  for(const i of items)if(!i.venue_name){
   const name=found.get(i.source_venue_id||"fixture:"+i.import_key);
   if(!name)continue;
   i.venue_name=name;fromGamePages++;
   const place=inferPlace(name,i.home_team,i.timezone);
   if(place&&!i.locality_text)Object.assign(i,{country_code:place.country_code,locality_text:place.locality_text,fallback_lat:place.fallback_lat,fallback_lon:place.fallback_lon});
  }
  const dedup=[...new Map(items.map(i=>[i.import_key,i])).values()];
  const youth=dedup.filter(i=>i.ljbl).map(({ljbl,...i})=>i);
  const adult=dedup.filter(i=>!i.ljbl).map(({ljbl,...i})=>i);
  const ljblStats={feeds:ljbl.length,read:ljblFetched.length,failed:ljblFailed,games:youth.length,
   no_venue:youth.filter(i=>!i.venue_name).length,no_place:youth.filter(i=>!i.locality_text).length};
  if(dry)return Response.json({ok:true,dry:true,window_from:today,window_to:windowTo,found:dedup.length,ljbl:ljblStats,stats,
   sample:youth.slice(0,5)});
  // LJBL is its own import run ("Basketbols (LJBL)" in the import health list).
  const reconcile=ljblFetched.length?await reconcileLjbl(ljblFetched,today):null;
  const result=adult.length?await rpc(adult):null;
  const youthResult=youth.length?await rpc(youth,"ljbl-sportradar-v1-3month"):null;
  return Response.json({ok:true,window_from:today,window_to:windowTo,found:dedup.length,
   ljbl:{...ljblStats,reconcile,result:youthResult},
   regional:{feeds:regional.length,with_games:regionalCompetitions.length,failed:regionalFailed},
   venues:{looked_up:lookups.length,named:found.size,events_named:fromGamePages,still_unnamed:dedup.filter(i=>!i.venue_name).length},stats,...(result||{})});
 }catch(error){
  console.error("sync_lbs_basketball_failed",{message:error?.message||String(error)});
  return Response.json({ok:false,error:error?.message||String(error)},{status:500});
 }
});
