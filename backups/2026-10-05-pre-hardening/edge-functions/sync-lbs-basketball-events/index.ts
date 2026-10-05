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
 return String(v||"").toLocaleLowerCase("lv").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
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
async function rpc(items:any[]){
 const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/meets_import_sportradar_basketball",{
  method:"POST",
  headers:{
   apikey:SERVICE_KEY,
   Authorization:"Bearer "+SERVICE_KEY,
   "Content-Type":"application/json"
  },
  body:JSON.stringify({p_items:items,p_source_commit:"lbs-sportradar-v1-3month"}),
  signal:AbortSignal.timeout(120000)
 });
 const text=await r.text();
 if(!r.ok)throw new Error("Import RPC "+r.status+" "+text);
 return text?JSON.parse(text):null;
}

Deno.serve(async()=>{
 try{
  const today=rigaToday();
  const windowTo=addMonthsIso(today,3);
  const fetched=await Promise.all(feeds.map(fetchFeed));
  const items:any[]=[];
  const stats:any[]=[];

  for(const {feed,data} of fetched){
   const fixtures=Array.isArray(data.fixtures)?data.fixtures:[];
   const selectedSeason=data?.seasons?.seasons?.find((s:any)=>s.seasonId===data.seasonId)?.nameLocal||null;
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
     import_key:`sportradar:${feed.websiteId}:${f.fixtureId}`,
     title:`${home} – ${away}`,
     description:`${feed.name} · ${feed.season}`,
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
  }

  const dedup=[...new Map(items.map(i=>[i.import_key,i])).values()];
  const result=await rpc(dedup);
  return Response.json({ok:true,window_from:today,window_to:windowTo,found:dedup.length,stats,...result});
 }catch(error){
  console.error("sync_lbs_basketball_failed",{message:error?.message||String(error)});
  return Response.json({ok:false,error:error?.message||String(error)},{status:500});
 }
});