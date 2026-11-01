import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {ABROAD,addMonthsIso,failRun,fetchText,type Family,type Match,rigaToday,startRun,text,wantsDry,writeMatches} from "../_shared/sports-import.ts";

// Hockey matches from the Latvian Ice Hockey Federation (lhf.lv). Each tournament has
// a full-season games page: date boxes followed by game boxes with the rink, both
// teams (full names in the logo alt text), start time and a link carrying date and id.
const FAMILY:Family={
 keyPrefix:"lhf.lv",runPrefix:"hockey-",commit:"lhf-games-v1-3month",domain:"lhf.lv",
 category:"Hokejs",sport_format:"ice_hockey",governing_body:"LHF",
 locationBasis:"lhf.lv games page",
 locationNote:"Hokeja spēles vieta nolasīta no lhf.lv; kartes punkts jāapstiprina adminā."
};
export const TOURNAMENTS=[
 {key:"lhf-optibet-hokeja-liga",name:"Optibet hokeja līga",slug:"optibet-hokeja-liga"},
 {key:"lhf-1-liga",name:"Hokeja 1. līga",slug:"1-liga"},
 {key:"lhf-sievietes",name:"Baltijas un Latvijas čempionāts sievietēm",slug:"baltijas-un-latvijas-cempionats-sievietem"}
].map(t=>({...t,url:"https://www.lhf.lv/lv/turniri/"+t.slug+"/speles"}));

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
async function tournamentGames(t:typeof TOURNAMENTS[number]){
 const html=await fetchText(t.url);
 const seen=new Map<string,Match>();
 for(const g of parseGames(html,t))seen.set(g.id,g);
 for(const g of parseTable(html,t))seen.set(g.id,g);
 return {games:[...seen.values()],pages:1};
}

Deno.serve(async(req)=>{
 let rid:string|null=null;
 const dry=wantsDry(req);
 try{
  const today=rigaToday(),windowTo=addMonthsIso(today,3);
  const all:Match[]=[],stats:any[]=[];
  for(const t of TOURNAMENTS){
   const {games,pages}=await tournamentGames(t);
   const kept=games.filter(g=>g.date>=today&&g.date<=windowTo&&!ABROAD.test(g.venue));
   stats.push({tournament:t.name,pages,read:games.length,in_window_lv:kept.length,last:games.map(g=>g.date).sort().at(-1)||null});
   all.push(...kept);
  }
  const matches=[...new Map(all.map(m=>[m.id,m])).values()];
  if(dry)return Response.json({ok:true,dry:true,found:matches.length,stats,sample:matches.slice(0,12)});
  if(!matches.length)throw new Error("No hockey matches found on lhf.lv");
  rid=await startRun(FAMILY,today);
  const r=await writeMatches(FAMILY,rid,today,matches,TOURNAMENTS);
  return Response.json({ok:true,run_id:rid,found:matches.length,stats,...r});
 }catch(e){
  await failRun(rid,e);
  console.error("sync_hockey_failed",e);
  return Response.json({ok:false,error:String(e)},{status:500});
 }
});
