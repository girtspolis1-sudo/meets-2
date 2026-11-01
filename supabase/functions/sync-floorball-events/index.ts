import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {ABROAD,addMonthsIso,failRun,fetchText,type Family,type Match,rigaToday,startRun,text,wantsDry,writeMatches} from "../_shared/sports-import.ts";

// Floorball matches from the Latvian Floorball Union (floorball.lv). Each league's
// calendar page loads its table from a DataTables endpoint; the page carries the
// season id the endpoint needs. Rows: date, time, home, result, away, venue, referees.
const FAMILY:Family={
 keyPrefix:"floorball.lv",runPrefix:"floorball-",commit:"lfs-calendar-v1-3month",domain:"floorball.lv",
 category:"Florbols",sport_format:"floorball",governing_body:"LFS",
 locationBasis:"floorball.lv calendar",
 locationNote:"Florbola spēles vieta nolasīta no floorball.lv; kartes punkts jāapstiprina adminā."
};
const AJAX="https://www.floorball.lv/ajax/ajax_chempionats_kalendars.php";
export const LEAGUES=[
 {group:"vv",key:"lfs-elvi-viriesi",name:"ELVI florbola līga vīriešiem"},
 {group:"sv",key:"lfs-elvi-sievietes",name:"ELVI florbola līga sievietēm"},
 {group:"LE",key:"lfs-lat-est",name:"LAT-EST florbola līga"},
 {group:"v1",key:"lfs-1-liga-viriesi",name:"Florbola 1. līga vīriešiem"},
 {group:"s1",key:"lfs-1-liga-sievietes",name:"Florbola 1. līga sievietēm"}
];
const yearPath=(today:string)=>Number(today.slice(5,7))>=7?today.slice(0,4):String(Number(today.slice(0,4))-1);
const pageUrl=(today:string,group:string)=>"https://www.floorball.lv/lv/"+yearPath(today)+"/chempionats/"+group+"/kalendars";

// Dates come as "dd.mm" without a year: autumn months belong to the season's first
// year, spring months to the next one.
export function parseDate(s:string,startYear:number){
 const m=text(s).match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/);
 if(!m)return null;
 const month=Number(m[2]),year=m[3]?Number(m[3]):(month>=7?startYear:startYear+1);
 return year+"-"+String(month).padStart(2,"0")+"-"+m[1].padStart(2,"0");
}
// Team cells are links whose visible text may be shortened ("FK Talsi/TNSS/Krauze.."),
// the title attribute has the full name.
const teamOf=(cell:string)=>text(cell.match(/title="([^"]*)"/)?.[1]||cell);
const slugify=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
export function rowToMatch(row:string[],l:{key:string,name:string},startYear:number,base:string):Match|null{
 const [d,t,h,_res,a,place]=row;
 const date=parseDate(d||"",startYear),home=teamOf(h||""),away=teamOf(a||""),venue=text(place||"");
 const time=text(t||"").match(/\d{1,2}:\d{2}/)?.[0]||null;
 if(!date||!home||!away||!venue)return null;
 // Rows carry no game id; date and both teams identify a league game.
 return {id:l.key+"-"+date+"-"+slugify(home)+"-"+slugify(away),date,time:time?time.padStart(5,"0"):null,home,away,venue,
  competition_key:l.key,competition:l.name,url:base};
}

// The endpoint answers only inside the page's PHP session, so the calendar page is
// read first and its session cookie sent along. "all" months, "0" = no team filter.
async function leagueRows(today:string,l:{group:string}){
 const page=await fetch(pageUrl(today,l.group),{headers:{"User-Agent":"MEETS/1.0 (+https://meets.lv)"},signal:AbortSignal.timeout(30000)});
 if(!page.ok)throw new Error("HTTP "+page.status+" "+pageUrl(today,l.group));
 const cookie=(page.headers.getSetCookie?.()||[]).map(c=>c.split(";")[0]).join("; ");
 const html=await page.text();
 const season=html.match(/filtrs_sezona"[^}]*?"value":\s*"(\d+)"/)?.[1]||html.match(/'sezona':\s*'(\d+)'/)?.[1];
 if(!season)throw new Error("floorball season id missing for "+l.group);
 const form=new URLSearchParams({sEcho:"1",iColumns:"7",sColumns:"",iDisplayStart:"0",iDisplayLength:"1000",
  url:"https://www.floorball.lv/lv",menu:"chempionats",filtrs_grupa:l.group,filtrs_sezona:season,
  filtrs_spelu_veids:"0",filtrs_menesis:"all",filtrs_komanda:"0",filtrs_majas_viesi:"0"});
 const body=await fetchText(AJAX,{method:"POST",body:form,headers:{"Content-Type":"application/x-www-form-urlencoded",
  "X-Requested-With":"XMLHttpRequest","Referer":pageUrl(today,l.group),...(cookie?{Cookie:cookie}:{})}});
 let json:any;try{json=JSON.parse(body)}catch{throw new Error("floorball "+l.group+" non-JSON: "+body.slice(0,120))}
 return {season,rows:(json.aaData||json.data||[]) as string[][],total:json.iTotalRecords??null};
}

Deno.serve(async(req)=>{
 let rid:string|null=null;
 const dry=wantsDry(req);
 try{
  const today=rigaToday(),windowTo=addMonthsIso(today,3);
  const all:Match[]=[],stats:any[]=[],raw:any={};
  for(const l of LEAGUES){
   const {season,rows,total}=await leagueRows(today,l);
   if(dry)raw[l.group]=rows.slice(0,2);
   const parsed=rows.map(r=>rowToMatch(r,l,Number(yearPath(today)),pageUrl(today,l.group))).filter(Boolean) as Match[];
   const kept=parsed.filter(m=>m.date>=today&&m.date<=windowTo&&!ABROAD.test(m.venue));
   stats.push({league:l.name,season,rows:rows.length,total,parsed:parsed.length,in_window_lv:kept.length});
   all.push(...kept);
  }
  const matches=[...new Map(all.map(m=>[m.id,m])).values()];
  if(dry)return Response.json({ok:true,dry:true,found:matches.length,stats,raw,sample:matches.slice(0,10)});
  if(!matches.length)throw new Error("No floorball matches found on floorball.lv");
  rid=await startRun(FAMILY,today);
  const r=await writeMatches(FAMILY,rid,today,matches,LEAGUES.map(l=>({key:l.key,name:l.name,url:pageUrl(today,l.group)})));
  return Response.json({ok:true,run_id:rid,found:matches.length,stats,...r});
 }catch(e){
  await failRun(rid,e);
  console.error("sync_floorball_failed",e);
  return Response.json({ok:false,error:String(e)},{status:500});
 }
});
