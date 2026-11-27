import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {ABROAD,addMonthsIso,failRun,fetchText,type Family,type Match,pendingMatches,q,rigaToday,startRun,text,wantsDry,writeMatches} from "../_shared/sports-import.ts";
import {TOURNAMENTS,staleGames} from "../_shared/hockey.js";

// Hockey matches from the Latvian Ice Hockey Federation (lhf.lv). Each tournament has
// a full-season games page: date boxes followed by game boxes with the rink, both
// teams (full names in the logo alt text), start time and a link carrying date and id.
const FAMILY:Family={
 keyPrefix:"lhf.lv",runPrefix:"hockey-",commit:"lhf-games-v2-youth",domain:"lhf.lv",
 category:"Hokejs",sport_format:"ice_hockey",governing_body:"LHF",
 locationBasis:"lhf.lv games page",
 locationNote:"Hokeja spēles vieta nolasīta no lhf.lv; kartes punkts jāapstiprina adminā."
};
// Adult leagues and the children's and youth championship (U8–U18): _shared/hockey.js.
// Youth tournaments carry level='youth', so the public map shows them only under
// "Sacensību līmenis: Jaunieši" (lib/sport-level.js). Results are never imported.

const teamName=(box:string,i:number)=>{
 const alts=[...box.matchAll(/<img[^>]*alt="([^"]*)"/g)].map(m=>text(m[1]).replace(/\s*logo$/i,"").trim());
 const shorts=[...box.matchAll(/class="team_name">([^<]*)</g)].map(m=>text(m[1]));
 return alts[i]||shorts[i]||"";
};

// The page also carries the whole season as a table: one row per game with both
// full team names, the rink (data-order), "YYYYMMDDHHMMSS" start and the game link.
export function parseTable(html:string,t:{key:string,name:string}){
 const out:Match[]=[];
 for(const row of html.split(/<tr[\s>]/).slice(1)){
  const link=row.match(/href="(\/lv\/turniri\/[^"]*\/speles\/[^"/]+\/(\d{8})\/(\d+))"/);
  const dt=row.match(/data-order="(\d{8})(\d{4})\d*"/);
  if(!link||!dt)continue;
  const venue=text(row.match(/<td class="ta-l desktop" data-order="([^"]*)"/)?.[1]||"");
  const teams=[...row.matchAll(/<td class="desktop" data-order="([^"]*)">([\s\S]*?)<\/td>/g)]
   .filter(m=>!/^\d+$/.test(m[1])).map(m=>text(m[2]));
  if(teams.length<2||!teams[0]||!teams[1]||!venue)continue;
  const d=dt[1],hm=dt[2];
  out.push({id:link[3],date:d.slice(0,4)+"-"+d.slice(4,6)+"-"+d.slice(6,8),time:hm==="0000"?null:hm.slice(0,2)+":"+hm.slice(2),
   home:teams[0],away:teams[1],venue,competition_key:t.key,competition:t.name,url:"https://www.lhf.lv"+link[1]});
 }
 return out;
}

export function parseGames(html:string,t:{key:string,name:string,slug:string,url:string}){
 const out:Match[]=[];
 for(const box of html.split('class="game_box"').slice(1)){
  const link=box.match(/href="(\/lv\/turniri\/[^"]*\/speles\/[^"/]+\/(\d{4})(\d{2})(\d{2})\/(\d+))"/);
  if(!link)continue;
  const place=text(box.match(/class="place">([\s\S]*?)<\/span>/)?.[1]||"");
  // The time span starts with a clock icon (svg), so read its text.
  const time=text(box.match(/class="time">([\s\S]*?)<\/span>/)?.[1]||"").match(/\d{1,2}:\d{2}/)?.[0]||null;
  const home=teamName(box,0),away=teamName(box,1);
  if(!home||!away||!place)continue;
  out.push({id:link[5],date:link[2]+"-"+link[3]+"-"+link[4],time:time?time.padStart(5,"0"):null,home,away,
   venue:place,competition_key:t.key,competition:t.name,url:"https://www.lhf.lv"+link[1]});
 }
 return out;
}

// The season table has every game; the game boxes (about 30 around today) fill in
// any row the table lacks.
async function tournamentGames(t:any){
 const html=await fetchText(t.url);
 const seen=new Map<string,Match>();
 for(const g of parseGames(html,t))seen.set(g.id,g);
 for(const g of parseTable(html,t))seen.set(g.id,g);
 return {games:[...seen.values()],pages:1};
}

const NOTE_GONE="LHF: spēle vairs nav oficiālajā kalendārā";

Deno.serve(async(req)=>{
 let rid:string|null=null;
 const dry=wantsDry(req);
 try{
  const today=rigaToday(),windowTo=addMonthsIso(today,3);
  const all:Match[]=[],stats:any[]=[],failed:string[]=[],listed:string[]=[];
  // A youth group page that cannot be read is reported and skipped; the adult leagues
  // must be read, as before.
  for(const t of TOURNAMENTS){
   let games:Match[];
   try{games=(await tournamentGames(t)).games;}
   catch(e){if(t.level==="senior")throw e;failed.push(t.name+": "+String(e).slice(0,80));continue;}
   for(const g of games)listed.push(g.id);
   const kept=games.filter(g=>g.date>=today&&g.date<=windowTo&&!ABROAD.test(g.venue)).map(g=>({...g,age_group:t.age_group||null}));
   stats.push({tournament:t.name,read:games.length,in_window_lv:kept.length,no_time:kept.filter(g=>!g.time).length,
    last:games.map(g=>g.date).sort().at(-1)||null});
   all.push(...kept);
  }
  const matches=[...new Map(all.map(m=>[m.id,m])).values()];
  const youth=matches.filter(m=>m.competition_key.startsWith("lhf-ljc-")).length;
  const pending=await pendingMatches(FAMILY,matches);
  if(dry)return Response.json({ok:true,dry:true,found:matches.length,youth,adult:matches.length-youth,failed,
   to_write:pending.todo.length,unchanged:pending.unchanged,deferred:pending.deferred,stats,sample:matches.slice(0,12)});
  if(!matches.length)throw new Error("No hockey matches found on lhf.lv");
  // Games the federation no longer lists go off the map (only when every page was read);
  // a game that comes back is published again by writeMatches below.
  const stored=await q("events?import_key=like."+encodeURIComponent("lhf.lv:*")+"&date_from=gte."+today+"&select=id,import_key,status,date_from,last_change_summary");
  const stale=failed.length?{gone:[],trusted:false}:staleGames(stored,listed,{from:today});
  const keys=new Set(matches.map(m=>"lhf.lv:"+m.id));
  const back=stored.filter((e:any)=>e.status==="archived"&&e.last_change_summary===NOTE_GONE&&keys.has(e.import_key)).map((e:any)=>e.id);
  const now=new Date().toISOString();
  if(back.length)await q("events?id=in.("+back.join(",")+")",{method:"PATCH",body:JSON.stringify({status:"pending_review",last_change_summary:"LHF: spēle atkal oficiālajā kalendārā",updated_at:now})});
  if(stale.trusted&&stale.gone.length)await q("events?id=in.("+stale.gone.map((e:any)=>e.id).join(",")+")",{method:"PATCH",
   body:JSON.stringify({status:"archived",last_change_summary:NOTE_GONE,updated_at:now})});
  rid=await startRun(FAMILY,today);
  const r=await writeMatches(FAMILY,rid,today,pending.todo,TOURNAMENTS);
  return Response.json({ok:true,run_id:rid,found:matches.length,youth,adult:matches.length-youth,failed,
   written:pending.todo.length,unchanged:pending.unchanged,deferred:pending.deferred,
   restored:back.length,archived:stale.trusted?stale.gone.length:0,stats,...r});
 }catch(e){
  await failRun(rid,e);
  console.error("sync_hockey_failed",e);
  return Response.json({ok:false,error:String(e)},{status:500});
 }
});
