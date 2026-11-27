import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {ABROAD,failRun,fetchText,type Family,inBatches,type Match,q,rigaToday,startRun,wantsDry,writeMatches} from "../_shared/sports-import.ts";
import {CALENDAR,ageGroupOf,competitionKey,isYouthGroup,monthBlockUrl,monthsFrom,parseCalendar,parseVenue,seasonlessGroup,staleGames} from "../_shared/volleyball.js";

// Volleyball matches from the Latvian Volleyball Federation calendar (volejbols.lv):
// adult leagues and cups, and the youth competitions (U-groups, youth championship,
// youth cups). The calendar page renders the current month only, so this month and the
// next two are read from the site's own month route. The hall is only on each game
// page, read once per game (games already stored keep their hall).
// Youth games are added to the calendar a few days ahead, so this runs every night.
// Youth competitions get level='youth': the public map shows them only under
// "Sacensību līmenis: Jaunieši" (lib/sport-level.js). Beach tournaments are not imported.
const FAMILY:Family={
 keyPrefix:"volejbols.lv",runPrefix:"volleyball-",commit:"lvf-calendar-v2-months-youth",domain:"volejbols.lv",
 category:"Volejbols",sport_format:"volleyball",governing_body:"LVF",
 locationBasis:"volejbols.lv game page",
 locationNote:"Volejbola spēles vieta nolasīta no volejbols.lv; kartes punkts jāapstiprina adminā."
};
const NOTE_GONE="LVF: spēle vairs nav oficiālajā kalendārā";
const lastDayOf=(y:number,m:number)=>new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);

async function readMonths(today:string){
 const months=monthsFrom(today,3);
 const games=new Map<string,any>();const read:string[]=[];const failed:string[]=[];
 for(const [y,m] of months){
  const label=y+"-"+String(m).padStart(2,"0");
  try{
   const body=JSON.parse(await fetchText(monthBlockUrl(y,m)));
   for(const g of parseCalendar(body?.html||""))games.set(g.id,g);
   read.push(label);
  }catch(e){failed.push(label+": "+String(e).slice(0,80));}
 }
 // The month route failing entirely: fall back to the page (current month only).
 if(!read.length){
  for(const g of parseCalendar(await fetchText(CALENDAR+"?meets="+Date.now())))games.set(g.id,g);
  read.push(months[0][0]+"-"+String(months[0][1]).padStart(2,"0")+" (lapa)");
 }
 // Games are taken off the map only when every month was read.
 const [ly,lm]=months[months.length-1];
 return {games:[...games.values()],read,failed,to:lastDayOf(ly,lm),complete:!failed.length};
}

Deno.serve(async(req)=>{
 let rid:string|null=null;
 const dry=wantsDry(req);
 try{
  const today=rigaToday();
  const {games,read,failed,to,complete}=await readMonths(today);
  const coming=games.filter(g=>g.date>=today&&g.date<=to);
  // Games already stored keep their hall; only new ones need their page.
  const stored=coming.length?await q("events?import_key=in.("+coming.map(g=>'"volejbols.lv:'+g.id+'"').join(",")+")&select=import_key,status,last_change_summary,event_locations(venue_name,address_raw,locality_text)"):[];
  const known=new Map<string,any>(stored.map((e:any)=>[e.import_key,e]));
  const matches:Match[]=[];let noVenue=0,pages=0,abroad=0;
  await inBatches(coming,5,async g=>{
   const old=known.get("volejbols.lv:"+g.id);
   const loc=Array.isArray(old?.event_locations)?old.event_locations[0]:old?.event_locations;
   let v=loc?.venue_name?{venue:loc.venue_name,address:loc.address_raw||loc.venue_name,locality:loc.locality_text||null}:null;
   if(!v){try{pages++;v=parseVenue(await fetchText(g.url));}catch{v=null}}
   if(!v){noVenue++;return;}
   if(ABROAD.test(v.address)){abroad++;return;}
   // A few games (friendlies, one-off cups) come without a competition name.
   const group=seasonlessGroup(g.group)||"Volejbola spēle";
   const youth=isYouthGroup(group);
   matches.push({id:g.id,date:g.date,time:g.time,home:g.home,away:g.away,venue:v.venue,address:v.address,locality:v.locality,
    competition_key:competitionKey(group),competition:group,age_group:youth?ageGroupOf(group):null,url:g.url});
  });
  matches.sort((a,b)=>a.date.localeCompare(b.date)||String(a.time).localeCompare(String(b.time)));
  const youthCount=matches.filter(m=>isYouthGroup(m.competition)).length;
  const stale=staleGames(
   dry||!complete?[]:await q("events?import_key=like."+encodeURIComponent("volejbols.lv:*")+"&date_from=gte."+today+"&date_from=lte."+to+"&select=id,import_key,status,date_from"),
   games.map(g=>g.id),{from:today,to});
  const stats={months:read,failed,window_to:to,calendar_games:games.length,coming:coming.length,pages_read:pages,no_venue:noVenue,abroad,
   kept:matches.length,youth:youthCount,adult:matches.length-youthCount,groups:[...new Set(matches.map(m=>m.competition))]};
  if(dry)return Response.json({ok:true,dry:true,stats,sample:matches.slice(0,10)});
  if(!matches.length)throw new Error("No volleyball matches found on volejbols.lv");
  // Games that left the calendar go off the map; one that came back is restored first,
  // so writeMatches publishes it again.
  const back=stored.filter((e:any)=>e.status==="archived"&&e.last_change_summary===NOTE_GONE).map((e:any)=>e.import_key);
  if(back.length)await q("events?import_key=in.("+back.map((k:string)=>'"'+k+'"').join(",")+")",{method:"PATCH",
   body:JSON.stringify({status:"pending_review",last_change_summary:"LVF: spēle atkal oficiālajā kalendārā",updated_at:new Date().toISOString()})});
  if(stale.trusted&&stale.gone.length)await q("events?id=in.("+stale.gone.map((e:any)=>e.id).join(",")+")",{method:"PATCH",
   body:JSON.stringify({status:"archived",last_change_summary:NOTE_GONE,updated_at:new Date().toISOString()})});
  rid=await startRun(FAMILY,today);
  const comps=[...new Map(matches.map(m=>[m.competition_key,{key:m.competition_key,name:m.competition,url:CALENDAR,
   age_group:m.age_group||null,level:isYouthGroup(m.competition)?"youth" as const:"senior" as const}])).values()];
  const r=await writeMatches(FAMILY,rid,today,matches,comps);
  return Response.json({ok:true,run_id:rid,...stats,restored:back.length,archived:stale.trusted?stale.gone.length:0,
   archive_skipped:stale.trusted?null:stale.gone.length,...r});
 }catch(e){
  await failRun(rid,e);
  console.error("sync_volleyball_failed",e);
  return Response.json({ok:false,error:String(e)},{status:500});
 }
});
