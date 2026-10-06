import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H={apikey:K,Authorization:"Bearer "+K,"Content-Type":"application/json"};
const UA="MEETS-2 basketball dry-run/2.0";

function todayRiga(){
  const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Riga",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const o=Object.fromEntries(p.map(x=>[x.type,x.value]));
  return o.year+"-"+o.month+"-"+o.day;
}
function addMonths(iso:string,n:number){
  const [y,m,d]=iso.split("-").map(Number);
  const x=new Date(Date.UTC(y,m-1+n,1,12));
  const max=new Date(Date.UTC(x.getUTCFullYear(),x.getUTCMonth()+1,0,12)).getUTCDate();
  x.setUTCDate(Math.min(d,max));
  return x.toISOString().slice(0,10);
}
function norm(s:string){
  return String(s||"").toLocaleLowerCase("lv").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
}
async function q(path:string,o:RequestInit={}){
  const r=await fetch(U+"/rest/v1/"+path,{...o,headers:{...H,...(o.headers||{})}});
  const t=await r.text();
  if(!r.ok) throw new Error(r.status+" "+t);
  return t?JSON.parse(t):null;
}
async function fetchFixtures(id:string){
  const r=await fetch("https://embed-api.eui.connect.sportradar.com/v1/embed/"+id+"/fixtures",{headers:{"User-Agent":UA},signal:AbortSignal.timeout(25000)});
  const t=await r.text();
  if(!r.ok) throw new Error("Sportradar "+id+" HTTP "+r.status);
  const j=JSON.parse(t);
  return Array.isArray(j?.data?.fixtures)?j.data.fixtures:[];
}
async function fetchEstlat(today:string,to:string){
  const r=await fetch("https://www.estlatbl.com/en/game-center?setSid=2027",{headers:{"User-Agent":UA},signal:AbortSignal.timeout(25000)});
  const html=await r.text();
  if(!r.ok) throw new Error("EstLat HTTP "+r.status);
  const strip=(s:string)=>String(s||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  const out:any[]=[];
  for(const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){
    const row=m[1];
    const gid=row.match(/game-center\?gid=(\d+)/i)?.[1];
    const dt=strip(row.match(/<div class="dateAndTime">([\s\S]*?)<\/div>/i)?.[1]||"");
    const venue=strip(row.match(/<div class="arena">([\s\S]*?)<\/div>/i)?.[1]||"");
    const home=strip(row.match(/<span class="homeTeamNameDesktop">([\s\S]*?)<\/span>/i)?.[1]||"");
    const away=strip(row.match(/<span class="visitorTeamNameDesktop">([\s\S]*?)<\/span>/i)?.[1]||"");
    const d=dt.match(/(\d{2})\.(\d{2})\.(\d{4}),\s*(\d{2}:\d{2})/);
    if(!gid||!d||!home||!away) continue;
    const date=d[3]+"-"+d[2]+"-"+d[1];
    if(date<today||date>to) continue;
    out.push({source_key:"estlatbl",website_id:null,source_match_id:gid,import_key:"estlatbl.com:"+gid,date_from:date,time_from:d[4]+":00",home_team:home,away_team:away,venue_name:venue||null,source_url:"https://www.estlatbl.com/en/game-center?gid="+gid,raw_data:{gid,date,home,away,venue}});
  }
  return out;
}

Deno.serve(async()=>{
  const today=todayRiga(),to=addMonths(today,2);
  const run=(await q("basketball_discovery_runs",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({window_from:today,window_to:to,status:"running"})}))[0];
  try{
    const sources=await q("basketball_sources?active=eq.true&select=source_key,section,basketball_level,website_id,calendar_url,discovery_status");
    const resolvedAll=sources.filter((s:any)=>s.discovery_status==="resolved");\n    const resolved=sources.filter((s:any)=>s.website_id&&s.discovery_status==="resolved");
    const existing=await q("events?date_from=gte."+today+"&date_from=lte."+to+"&primary_category=eq.Basketbols&select=import_key,title,date_from");
    const existingKeys=new Set(existing.map((e:any)=>e.import_key));
    const existingSig=new Set(existing.map((e:any)=>norm(e.title)+"|"+e.date_from));

    const games:any[]=[]; const failures:any[]=[]; let raw=0;
    for(let i=0;i<resolved.length;i+=8){
      const part=await Promise.all(resolved.slice(i,i+8).map(async(s:any)=>{
        try{
          const fs=await fetchFixtures(s.website_id); raw+=fs.length;
          const out:any[]=[];
          for(const f of fs){
            const start=String(f.startTimeLocal||""),date=start.slice(0,10);
            if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<today||date>to) continue;
            const status=String(f?.status?.value||"").toUpperCase();
            if(["CANCELLED","ABANDONED"].includes(status)) continue;
            const c=Array.isArray(f.competitors)?f.competitors:[];
            const home=c.find((x:any)=>x.isHome===true)?.name||c[0]?.name||"";
            const away=c.find((x:any)=>x.isHome===false)?.name||c[1]?.name||"";
            if(!f.fixtureId||!home||!away) continue;
            out.push({source_key:s.source_key,website_id:s.website_id,source_match_id:String(f.fixtureId),import_key:"sportradar:"+s.website_id+":"+f.fixtureId,date_from:date,time_from:start.slice(11,19)||null,home_team:String(home),away_team:String(away),venue_name:String(f.venue||"")||null,source_url:s.calendar_url,raw_data:f});
          }
          return out;
        }catch(e){failures.push({source_key:s.source_key,error:String(e)});return [];}
      }));
      games.push(...part.flat());
    }
    try{games.push(...await fetchEstlat(today,to));}catch(e){failures.push({source_key:"estlatbl",error:String(e)});}

    const seen=new Set<string>(); let duplicates=0;
    const rows=games.map((g:any)=>{
      const sig=norm(g.home_team)+"|"+norm(g.away_team)+"|"+g.date_from;
      const rev=norm(g.away_team)+"|"+norm(g.home_team)+"|"+g.date_from;
      const dup=seen.has(sig)||seen.has(rev); if(dup)duplicates++; else seen.add(sig);
      const title=g.home_team+" – "+g.away_team;
      const exists=existingKeys.has(g.import_key)||existingSig.has(norm(title)+"|"+g.date_from);
      return {...g,run_id:run.id,already_in_meets:exists,duplicate_in_discovery:dup,dedupe_key:sig};
    });
    for(let i=0;i<rows.length;i+=300) await q("basketball_discovery_items",{method:"POST",body:JSON.stringify(rows.slice(i,i+300))});
    const unique=rows.filter((x:any)=>!x.duplicate_in_discovery);
    const existingCount=unique.filter((x:any)=>x.already_in_meets).length;
    const missing=unique.filter((x:any)=>!x.venue_name).length;
    const unresolved=sources.filter((s:any)=>s.discovery_status!=="resolved");
    const status=(failures.length||unresolved.length)?"partial":"complete";
    await q("basketball_discovery_runs?id=eq."+run.id,{method:"PATCH",body:JSON.stringify({
      status,sources_total:sources.length,sources_resolved:resolvedAll.length,sources_ok:resolvedAll.length-failures.length,sources_failed:failures.length,
      games_raw:raw,games_in_window:rows.length,games_unique:unique.length,games_existing:existingCount,games_new:unique.length-existingCount,
      games_duplicate:duplicates,missing_location:missing,summary:{unresolved:unresolved.map((x:any)=>x.source_key),failures},completed_at:new Date().toISOString()
    })});
    return Response.json({ok:true,run_id:run.id,window_from:today,window_to:to,status,games_unique:unique.length,games_existing:existingCount,games_new:unique.length-existingCount,games_duplicate:duplicates,missing_location:missing,sources_total:sources.length,sources_unresolved:unresolved.length,sources_failed:failures.length});
  }catch(e){
    await q("basketball_discovery_runs?id=eq."+run.id,{method:"PATCH",body:JSON.stringify({status:"failed",error_text:String(e),completed_at:new Date().toISOString()})});
    return Response.json({ok:false,error:String(e)},{status:500});
  }
});
