import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {ABROAD,addMonthsIso,failRun,fetchText,type Family,inBatches,type Match,rigaToday,startRun,text,wantsDry,writeMatches} from "../_shared/sports-import.ts";

// Volleyball matches from the Latvian Volleyball Federation season calendar
// (volejbols.lv/kalendars). The calendar lists every game with its competition,
// teams, date and time; the rink is only on each game page, which is read for
// the games inside the import window. Youth tournaments (many games a day at one
// hall) are left out for now; adult leagues and cups are imported. The server-side
// list covers the current month only.
const FAMILY:Family={
 keyPrefix:"volejbols.lv",runPrefix:"volleyball-",commit:"lvf-calendar-v1-3month",domain:"volejbols.lv",
 category:"Volejbols",sport_format:"volleyball",governing_body:"LVF",
 locationBasis:"volejbols.lv game page",
 locationNote:"Volejbola spēles vieta nolasīta no volejbols.lv; kartes punkts jāapstiprina adminā."
};
const CALENDAR="https://volejbols.lv/kalendars/";
const YOUTH=/\bU\s?\d{2}\b|jaunatn|skolēn|mini\s?volej/i;
const attr=(li:string,name:string)=>text(li.match(new RegExp('data-'+name+'="([^"]*)"'))?.[1]||"");
// "RTU/Robežsardze 26/27" → "RTU/Robežsardze": the season suffix is noise in a title.
export const cleanTeam=(s:string)=>s.replace(/\s+\d{2}\/\d{2}$/,"").trim();
export const competitionKey=(group:string)=>"lvf-"+group.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
 .replace(/\b20\d{2}\/20\d{2}\b/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);

export function parseCalendar(html:string){
 const out:{id:string,date:string,time:string|null,group:string,home:string,away:string,url:string}[]=[];
 for(const part of html.split(/<li\s+data-kind="game"/).slice(1)){
  const li=part.slice(0,part.indexOf("</li>")>0?part.indexOf("</li>"):3000);
  const url=li.match(/href="(https:\/\/volejbols\.lv\/(?:[a-z]+\/)?spele\/(\d+)\/)"/);
  const date=attr(li,"date"),group=attr(li,"group"),home=attr(li,"home"),away=attr(li,"away");
  if(!url||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!home||!away)continue;
  const time=li.match(/year-cal-item__time"\s*>\s*(\d{1,2}:\d{2})/)?.[1]||null;
  out.push({id:url[2],date,time:time?time.padStart(5,"0"):null,group,home:cleanTeam(home),away:cleanTeam(away),url:url[1]});
 }
 return out;
}
export function parseVenue(html:string){
 const v=text(html.match(/class="game-card__venue"\s*>([\s\S]*?)<\/div>/)?.[1]||"");
 if(!v)return null;
 const i=v.lastIndexOf(",");
 return {venue:i>0?v.slice(0,i).trim():v,locality:i>0?v.slice(i+1).trim():null,address:v};
}

Deno.serve(async(req)=>{
 let rid:string|null=null;
 const dry=wantsDry(req);
 try{
  const today=rigaToday(),windowTo=addMonthsIso(today,3);
  // The bare URL can serve a stale cached month; any query string gets the current
  // month's list (later months load in the browser, so weekly runs keep up).
  const games=parseCalendar(await fetchText(CALENDAR+"?meets="+Date.now()));
  const months=[...new Set(games.map(g=>g.date.slice(0,7)))].sort();
  const adult=[...new Map(games.filter(g=>g.date>=today&&g.date<=windowTo&&!YOUTH.test(g.group)).map(g=>[g.id,g])).values()];
  const matches:Match[]=[];let noVenue=0;
  await inBatches(adult,5,async g=>{
   let v=null;
   try{v=parseVenue(await fetchText(g.url));}catch{v=null}
   if(!v){noVenue++;return;}
   if(ABROAD.test(v.address))return;
   // A few games (friendlies, one-off cups) come without a competition name.
   const group=g.group.replace(/\s+20\d{2}\/20\d{2}\b/,"").trim()||"Volejbola spēle";
   matches.push({id:g.id,date:g.date,time:g.time,home:g.home,away:g.away,venue:v.venue,address:v.address,locality:v.locality,
    competition_key:competitionKey(group),competition:group,url:g.url});
  });
  matches.sort((a,b)=>a.date.localeCompare(b.date)||String(a.time).localeCompare(String(b.time)));
  const groups=[...new Set(matches.map(m=>m.competition))];
  const stats={calendar_games:games.length,months,adult_in_window:adult.length,no_venue:noVenue,kept:matches.length,groups};
  if(dry)return Response.json({ok:true,dry:true,stats,sample:matches.slice(0,10),
   youth_groups:[...new Set(games.filter(g=>YOUTH.test(g.group)).map(g=>g.group))].slice(0,40)});
  if(!matches.length)throw new Error("No volleyball matches found on "+CALENDAR);
  rid=await startRun(FAMILY,today);
  const comps=[...new Map(matches.map(m=>[m.competition_key,{key:m.competition_key,name:m.competition,url:CALENDAR}])).values()];
  const r=await writeMatches(FAMILY,rid,today,matches,comps);
  return Response.json({ok:true,run_id:rid,...stats,...r});
 }catch(e){
  await failRun(rid,e);
  console.error("sync_volleyball_failed",e);
  return Response.json({ok:false,error:String(e)},{status:500});
 }
});
