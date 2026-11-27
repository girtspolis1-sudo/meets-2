// Latvian Handball Federation (handball.lv) calendar: pure helpers shared by
// supabase/functions/sync-handball-events and tests/handball.test.js.
// The adult calendar (handball.lv/calendar) and the youth calendar (same page with
// youth_league=1) have the same markup: day blocks, then one row per game with the
// league link, stage, "HH:MM · address" and both teams. Results are never read.

export const CALENDAR='https://handball.lv/calendar';
// The youth calendar for a season; the season id is read from the adult page's links.
export const youthUrl=season=>CALENDAR+'?season='+season+'&league=&youth_league=1&date=upcoming&order=asc';
export function seasonOf(html){
 return String(html||'').match(/[?&]season=(\d+)/)?.[1]||null;
}

// National team games abroad ("Opole, Polija") are not events in the Baltics.
export const ABROAD_COUNTRY=/,\s*(Polija|Vācija|Zviedrija|Somija|Norvēģija|Dānija|Spānija|Itālija|Francija|Čehija|Slovākija|Ungārija|Austrija|Šveice|Horvātija|Serbija|Slovēnija|Portugāle|Nīderlande|Beļģija|Grieķija|Turcija|Ukraina|Islande|Rumānija|Bulgārija|Gruzija|Izraēla|Kipra|Luksemburga|Melnkalne|Bosnija|Ziemeļmaķedonija|Albānija|Moldova|Kosova|Īrija|Lielbritānija|Anglija|Skotija|Fēru salas|Farēru salas|Igaunija|Lietuva)\s*$/i;

const MONTHS={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
const text=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&')
 .replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/\s+/g,' ').trim();

function addMonthsIso(iso,n){
 const d=new Date(iso+'T12:00:00Z'),day=d.getUTCDate();
 d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);
 const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(day,max));
 return d.toISOString().slice(0,10);
}
// The calendar shows day and month only: the year that puts the date nearest after today.
export function dateFor(day,month,today){
 const year=Number(today.slice(0,4));
 const iso=y=>y+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
 return iso(year)<addMonthsIso(today,-2)?iso(year+1):iso(year);
}

// League name → level and age group. Youth leagues are named "Zēni U14 (2013)",
// "Meitenes U19 (2008/2009)" or "… mini handbolā"; everything else is adult.
export function leagueInfo(name){
 const n=String(name||'');
 const u=n.match(/\bU\s?(\d{1,2})\b/i);
 const sex=/zēn/i.test(n)?'zēni':/meiten/i.test(n)?'meitenes':'';
 if(u&&Number(u[1])<=21)return {level:'youth',age_group:('U'+u[1]+(sex?' '+sex:''))};
 if(/mini\s*handbol|jaunatn|junior|bērn|skolēn|zēn|meiten/i.test(n))return {level:'youth',age_group:null};
 return {level:'senior',age_group:null};
}

export function parseCalendar(html,today){
 const out=[];
 for(const day of String(html||'').split('<div class="calendar-day">').slice(1)){
  const dm=day.match(/<div>\s*(\d{1,2})\.\s*([A-Za-z]+)\s*<\/div>/);
  const month=dm&&MONTHS[dm[2].toLowerCase()];
  if(!dm||!month)continue;
  const date=dateFor(Number(dm[1]),month,today);
  for(const row of day.split('class="row calendar-row"').slice(1)){
   const id=row.match(/handball\.lv\/calendar\/(\d+)/)?.[1];
   const league=row.match(/handball\.lv\/league\/(\d+)"[^>]*>([^<]+)</);
   const info=row.match(/<div>\s*(?:(\d{1,2}:\d{2})\s*)?·\s*([^<]+)<\/div>/);
   const teams=[...row.matchAll(/class="calendar-team">\s*<div>([^<]+)<\/div>/g)].map(m=>text(m[1]));
   if(!id||teams.length<2||!info)continue;
   const address=text(info[2]);
   const name=league?text(league[2]):'Handbols';
   const li=leagueInfo(name);
   out.push({id,date,time:info[1]?info[1].padStart(5,'0'):null,
    competition_key:'handball-'+(league?.[1]||'other'),competition:name,level:li.level,age_group:li.age_group,
    stage:text(row.match(/<span>([^<]*)<\/span>/)?.[1]||'')||null,home:teams[0],away:teams[1],
    venue:address.split(',')[0].trim(),address,url:'https://handball.lv/calendar/'+id});
  }
 }
 return out;
}

// Competitions seen in the games, for registering them with their level.
export function competitionsOf(games){
 const m=new Map();
 for(const g of games)if(!m.has(g.competition_key))m.set(g.competition_key,{key:g.competition_key,name:g.competition,
  url:'https://handball.lv/league/'+g.competition_key.replace(/^handball-/,''),level:g.level,age_group:g.age_group});
 return [...m.values()];
}
