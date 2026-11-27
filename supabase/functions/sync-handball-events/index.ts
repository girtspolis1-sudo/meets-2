import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {ABROAD,addMonthsIso,failRun,fetchText,type Family,type Match,pendingMatches,q,rigaToday,startRun,wantsDry,writeMatches} from "../_shared/sports-import.ts";
import {ABROAD_COUNTRY,CALENDAR,competitionsOf,parseCalendar,seasonOf,youthUrl} from "../_shared/handball.js";
import {staleGames} from "../_shared/hockey.js";

// Handball matches from the Latvian Handball Federation calendar: the adult calendar
// (handball.lv/calendar) and the youth calendar of the same season (U12–U19 boys and
// girls, mini handball). Youth leagues carry level='youth', so the public map shows
// them only under "Sacensību līmenis: Jaunieši" (lib/sport-level.js). Each match has
// the venue's full address; the place search finds it, an admin approves it once.
const FAMILY:Family={
 keyPrefix:"handball.lv",runPrefix:"handball-",commit:"handball-calendar-v2-youth",domain:"handball.lv",
 category:"Handbols",sport_format:"handball",governing_body:"LHF (handbols)",
 locationBasis:"handball.lv calendar",
 locationNote:"Handbola spēles vieta nolasīta no handball.lv; kartes punkts jāapstiprina adminā."
};
const NOTE_GONE="Handbols: spēle vairs nav oficiālajā kalendārā";

Deno.serve(async(req)=>{
 let rid:string|null=null;
 const dry=wantsDry(req);
 try{
  const today=rigaToday(),windowTo=addMonthsIso(today,3);
  const failed:string[]=[];
  // The adult calendar must be read; the youth calendar is reported and skipped on failure.
  const adultHtml=await fetchText(CALENDAR);
  const games=parseCalendar(adultHtml,today);
  const adultRead=games.length;
  const season=seasonOf(adultHtml);
  if(!season)failed.push("youth: season id not found on "+CALENDAR);
  else{
   try{games.push(...parseCalendar(await fetchText(youthUrl(season)),today));}
   catch(e){failed.push("youth: "+String(e).slice(0,80));}
  }
  const listed=games.map(g=>g.id);
  const all=[...new Map(games.map(g=>[g.id,g])).values()];
  const matches:Match[]=all.filter(g=>g.date>=today&&g.date<=windowTo&&!ABROAD_COUNTRY.test(g.address)&&!ABROAD.test(g.address));
  const competitions=competitionsOf(all);
  const youth=matches.filter((m:any)=>m.level==="youth").length;
  const pending=await pendingMatches(FAMILY,matches);
  const leagues=competitions.map(c=>({name:c.name,level:c.level,age_group:c.age_group,
   games:matches.filter(m=>m.competition_key===c.key).length,no_time:matches.filter(m=>m.competition_key===c.key&&!m.time).length}));
  if(dry)return Response.json({ok:true,dry:true,season,adult_read:adultRead,found:matches.length,youth,adult:matches.length-youth,failed,
   to_write:pending.todo.length,unchanged:pending.unchanged,deferred:pending.deferred,leagues,sample:matches.slice(0,12)});
  if(!matches.length)throw new Error("No matches found on "+CALENDAR);
  // Games the federation no longer lists go off the map (only when both calendars were
  // read); a game that comes back is published again.
  const stored=await q("events?import_key=like."+encodeURIComponent("handball.lv:*")+"&date_from=gte."+today+"&select=id,import_key,status,date_from,last_change_summary");
  const stale=failed.length?{gone:[],trusted:false}:staleGames(stored,listed,{from:today,prefix:"handball.lv:"});
  const keys=new Set(matches.map(m=>"handball.lv:"+m.id));
  const back=stored.filter((e:any)=>e.status==="archived"&&e.last_change_summary===NOTE_GONE&&keys.has(e.import_key)).map((e:any)=>e.id);
  const now=new Date().toISOString();
  if(back.length)await q("events?id=in.("+back.join(",")+")",{method:"PATCH",body:JSON.stringify({status:"pending_review",last_change_summary:"Handbols: spēle atkal oficiālajā kalendārā",updated_at:now})});
  if(stale.trusted&&stale.gone.length)await q("events?id=in.("+stale.gone.map((e:any)=>e.id).join(",")+")",{method:"PATCH",
   body:JSON.stringify({status:"archived",last_change_summary:NOTE_GONE,updated_at:now})});
  rid=await startRun(FAMILY,today);
  const r=await writeMatches(FAMILY,rid,today,pending.todo,competitions);
  return Response.json({ok:true,run_id:rid,season,found:matches.length,youth,adult:matches.length-youth,failed,
   written:pending.todo.length,unchanged:pending.unchanged,deferred:pending.deferred,
   restored:back.length,archived:stale.trusted?stale.gone.length:0,leagues,...r});
 }catch(e){
  await failRun(rid,e);
  console.error("sync_handball_failed",e);
  return Response.json({ok:false,error:String(e)},{status:500});
 }
});
