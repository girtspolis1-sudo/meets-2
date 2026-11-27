import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {addMonthsIso,failRun,fetchText,type Family,type Match,pendingMatches,q,rigaToday,startRun,wantsDry,writeMatches} from "../_shared/sports-import.ts";
import {SECTIONS,competitionOptions,currentOptions,parseGames} from "../_shared/lff-youth.js";
import {staleGames} from "../_shared/hockey.js";

// Youth football and futsal games from the Latvian Football Federation (lff.lv): the
// youth championship groups, the academies' championship, the girls' championships and
// the youth futsal championships (U-19 … U-8). Every competition is registered with
// level='youth', so the public map shows these games only under "Sacensību līmenis:
// Jaunieši" (lib/sport-level.js). Results and players are never read. Adult LFF leagues
// stay in sync-lff-events.
const BASE:Family={
 keyPrefix:"lff-youth",runPrefix:"lff-youth-",commit:"lff-youth-v1-3month",domain:"lff.lv",
 category:"Futbols",sport_format:"football",governing_body:"LFF",
 locationBasis:"lff.lv youth competition page",
 locationNote:"Jaunatnes futbola spēles vieta nolasīta no lff.lv; kartes punkts jāapstiprina adminā."
};
const FUTSAL:Family={...BASE,sport_format:"futsal"};
const NOTE_GONE="LFF: jaunatnes spēle vairs nav oficiālajā kalendārā";
// lff.lv answers 400 to some custom user agents; send a plain one.
const get=(url:string)=>fetchText(url,{headers:{"User-Agent":"Mozilla/5.0 (compatible; MEETS/1.0; +https://meets.lv)"}});

Deno.serve(async(req)=>{
 let rid:string|null=null;
 const dry=wantsDry(req);
 try{
  const today=rigaToday(),windowTo=addMonthsIso(today,3);
  const failed:string[]=[],listed:string[]=[],stats:any[]=[],all:any[]=[],competitions:any[]=[];
  for(const s of SECTIONS){
   let html:string;
   try{html=await get(s.url);}catch(e){failed.push(s.name+": "+String(e).slice(0,80));continue;}
   const options=currentOptions(competitionOptions(html,s),today);
   // A section without a select is one competition.
   if(!options.length)options.push({id:"main",label:s.name,url:s.url});
   for(const o of options){
    let page=html;
    if(o.id!=="main"){
     try{page=await get(o.url);}catch(e){failed.push(s.name+" / "+o.label+": "+String(e).slice(0,60));continue;}
    }
    const games=parseGames(page,s,o);
    for(const g of games)listed.push(g.id);
    const kept=games.filter((g:any)=>g.date>=today&&g.date<=windowTo);
    if(kept.length){
     competitions.push({key:kept[0].competition_key,name:kept[0].competition,url:o.url,level:"youth",age_group:kept[0].age_group});
     all.push(...kept);
    }
    stats.push({competition:s.name+": "+o.label,read:games.length,coming:kept.length,no_time:kept.filter((g:any)=>!g.time).length});
   }
  }
  const matches:Match[]=[...new Map(all.map(m=>[m.id,m])).values()];
  const pending=await pendingMatches(BASE,matches);
  const futsalKeys=new Set(matches.filter((m:any)=>m.sport_format==="futsal").map(m=>m.id));
  if(dry)return Response.json({ok:true,dry:true,found:matches.length,futsal:futsalKeys.size,failed,
   to_write:pending.todo.length,unchanged:pending.unchanged,deferred:pending.deferred,
   stats:stats.filter(x=>x.read),pages:stats.length,sample:matches.slice(0,12)});
  // Games the federation no longer lists go off the map (only when every page was read).
  const stored=await q("events?import_key=like."+encodeURIComponent("lff-youth:*")+"&date_from=gte."+today+"&select=id,import_key,status,date_from,last_change_summary");
  const stale=failed.length?{gone:[],trusted:false}:staleGames(stored,listed,{from:today,prefix:"lff-youth:"});
  const keys=new Set(matches.map(m=>"lff-youth:"+m.id));
  const back=stored.filter((e:any)=>e.status==="archived"&&e.last_change_summary===NOTE_GONE&&keys.has(e.import_key)).map((e:any)=>e.id);
  const now=new Date().toISOString();
  if(back.length)await q("events?id=in.("+back.join(",")+")",{method:"PATCH",body:JSON.stringify({status:"pending_review",last_change_summary:"LFF: jaunatnes spēle atkal oficiālajā kalendārā",updated_at:now})});
  if(stale.trusted&&stale.gone.length)await q("events?id=in.("+stale.gone.map((e:any)=>e.id).join(",")+")",{method:"PATCH",
   body:JSON.stringify({status:"archived",last_change_summary:NOTE_GONE,updated_at:now})});
  // Out of season (summer for futsal, winter for football) there may be nothing to write.
  rid=await startRun(BASE,today);
  const football=pending.todo.filter(m=>!futsalKeys.has(m.id)),futsal=pending.todo.filter(m=>futsalKeys.has(m.id));
  const r1=football.length?await writeMatches(BASE,rid,today,football,competitions):{created:0,updated:0};
  const r2=futsal.length?await writeMatches(FUTSAL,rid,today,futsal,competitions):{created:0,updated:0};
  await q("import_runs?id=eq."+rid,{method:"PATCH",body:JSON.stringify({status:"complete",expected_count:pending.todo.length,imported_count:pending.todo.length,
   added_count:r1.created+r2.created,updated_count:r1.updated+r2.updated,skipped_count:0,completed_at:new Date().toISOString(),error_text:null})});
  return Response.json({ok:true,run_id:rid,found:matches.length,futsal:futsalKeys.size,failed,
   written:pending.todo.length,unchanged:pending.unchanged,deferred:pending.deferred,
   restored:back.length,archived:stale.trusted?stale.gone.length:0,created:r1.created+r2.created,updated:r1.updated+r2.updated,
   stats:stats.filter(x=>x.read)});
 }catch(e){
  await failRun(rid,e);
  console.error("sync_lff_youth_failed",e);
  return Response.json({ok:false,error:String(e)},{status:500});
 }
});
