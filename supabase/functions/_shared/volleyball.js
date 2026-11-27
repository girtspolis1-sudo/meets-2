// Latvian Volleyball Federation calendar (volejbols.lv) — pure parsing helpers shared by
// supabase/functions/sync-volleyball-events and tests/volleyball.test.js.
//
// The calendar page renders the current month only; other months come from the site's
// own REST route /wp-json/forget/v1/calendar/year-block/<year>?month=<m>, which answers
// {html} with the same <li data-kind="game"> items the page shows.

export const CALENDAR='https://volejbols.lv/kalendars/';
export const monthBlockUrl=(year,month)=>'https://volejbols.lv/wp-json/forget/v1/calendar/year-block/'+year+'?month='+month;

// The current month and the next ones, as [year, month] pairs.
export function monthsFrom(today,count=3){
 let y=Number(today.slice(0,4)),m=Number(today.slice(5,7));
 const out=[];
 for(let i=0;i<count;i++){out.push([y,m]);m++;if(m>12){m=1;y++;}}
 return out;
}

const decode=s=>String(s||'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'")
 .replace(/&ndash;|&#8211;/g,'–').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
export const text=s=>decode(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
const attr=(li,name)=>text(li.match(new RegExp('data-'+name+'="([^"]*)"'))?.[1]||'');

// "RTU/Robežsardze 26/27" → "RTU/Robežsardze": the season suffix is noise in a title.
export const cleanTeam=s=>String(s||'').replace(/\s+\d{2}\/\d{2}$/,'').trim();
export const competitionKey=group=>'lvf-'+String(group||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
 .replace(/\b20\d{2}\/20\d{2}\b/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);
export const seasonlessGroup=group=>String(group||'').replace(/\s+20\d{2}\/20\d{2}\b/,'').trim();

// Children's and youth competitions: U-groups, the youth championship, school and
// mini-volleyball. Team names are not read (adult leagues have "juniori" teams).
export const YOUTH=/\bU\s?\d{2}\b|jaunatn|skolēn|mini\s?volej/i;
export const isYouthGroup=group=>YOUTH.test(String(group||''));

// "Kausa izcīņa U14 Z 2026/2027" → "U14 meitenes"; "Latvijas Jaunatnes čempionāts U16 M" → "U16 zēni".
export function ageGroupOf(group){
 const g=String(group||'');
 const u=g.match(/\bU\s?(\d{2})\b/i);
 if(!u)return isYouthGroup(g)?'jaunatne':null;
 const after=g.slice(u.index+u[0].length);
 const sex=after.match(/^\s*(M|Z|Ž|zēni|meitenes|puiši)(?=[\s,/]|$)/i)?.[1]?.toLocaleLowerCase('lv');
 const label=sex==='m'||sex==='zēni'||sex==='puiši'?' zēni':sex==='z'||sex==='ž'||sex==='meitenes'?' meitenes':'';
 return 'U'+u[1]+label;
}

// Indoor games of a calendar (page or REST block). Beach tournaments link to
// /pludmale/turniri/ instead of a game page and are not games here.
export function parseCalendar(html){
 const out=[];
 for(const part of String(html||'').split(/<li\s+data-kind="game"/).slice(1)){
  const end=part.indexOf('</li>');
  const li=part.slice(0,end>0?end:3000);
  const url=li.match(/href="(https:\/\/volejbols\.lv\/(?:[a-z]+\/)?spele\/(\d+)\/)"/);
  const date=attr(li,'date'),group=attr(li,'group'),home=attr(li,'home'),away=attr(li,'away');
  if(!url||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!home||!away)continue;
  const time=li.match(/year-cal-item__time"\s*>\s*(\d{1,2}:\d{2})/)?.[1]||null;
  out.push({id:url[2],date,time:time?time.padStart(5,'0'):null,group,home:cleanTeam(home),away:cleanTeam(away),url:url[1]});
 }
 return out;
}

// The hall from a game page: "Cēsu sporta nams, Cēsis" (a played game adds " · 39 min.").
export function parseVenue(html){
 const raw=String(html||'').match(/class="game-card__venue"\s*>([^<]*)/)?.[1];
 const v=text(raw||'').replace(/\s*·\s*\d+\s*min\.?.*$/i,'').trim();
 if(!v)return null;
 const i=v.lastIndexOf(',');
 return {venue:i>0?v.slice(0,i).trim():v,locality:i>0?v.slice(i+1).trim():null,address:v};
}

// Games the calendar no longer lists (or no longer lists in the read months) are taken
// off the map; a calendar that suddenly lists far fewer games is not trusted.
export function staleGames(stored,listedIds,{from,to}){
 const listed=new Set(listedIds.map(String));
 const live=stored.filter(e=>e.status!=='archived'&&e.status!=='cancelled'&&e.date_from>=from&&e.date_from<=to);
 const gone=live.filter(e=>!listed.has(String(e.import_key).replace(/^volejbols\.lv:/,'')));
 return {gone,trusted:gone.length<=Math.max(5,live.length/2)};
}
