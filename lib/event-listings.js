// Listing pages for search: by municipality, by time, by category and by league.
// Pure functions over catalogue events: tests/event-listings.test.js.
import {addIsoDays} from './event-date.js';
import {eventGroup,HOME_CATEGORY_FILTERS,HOME_GROUP_KEYS} from './home-category-filters.js';
import {CATEGORY_SLUGS,MIN_INDEXABLE_EVENTS,TIME_SLUGS,isMunicipalityName,municipalityLocative,municipalitySlug,slugify} from './seo.js';

const weekday=iso=>new Date(iso+'T12:00:00Z').getUTCDay(); // 0 = Sunday

// Date range of a time page, in Riga dates.
export function timeWindow(slug,today){
 const day=weekday(today);
 if(slug==='sodien')return {from:today,to:today};
 if(slug==='rit'){const d=addIsoDays(today,1);return {from:d,to:d};}
 if(slug==='sonedel')return {from:today,to:addIsoDays(today,day===0?0:7-day)};
 if(slug==='brivdienas'){
  if(day===6)return {from:today,to:addIsoDays(today,1)};
  if(day===0)return {from:today,to:today};
  const sat=addIsoDays(today,6-day);
  return {from:sat,to:addIsoDays(sat,1)};
 }
 return null;
}
export const overlaps=(event,{from,to})=>event.date_from<=to&&(event.date_to||event.date_from)>=from;

// Council sittings and the like are not "things to do".
const listable=event=>eventGroup(event)!=='civic';
const byStart=(a,b)=>String(a.date_from).localeCompare(String(b.date_from))||String(a.time_from||'99').localeCompare(String(b.time_from||'99'))||String(a.title).localeCompare(String(b.title),'lv');

// Municipalities present in the catalogue: [{name, slug, count}], largest first.
export function municipalities(events){
 const counts=new Map();
 for(const e of events)if(isMunicipalityName(e.municipality)&&listable(e))counts.set(e.municipality,(counts.get(e.municipality)||0)+1);
 return [...counts].map(([name,count])=>({name,slug:municipalitySlug(name),count}))
  .filter(m=>m.slug).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'lv'));
}
export function municipalityBySlug(events,slug){
 return municipalities(events).find(m=>m.slug===slug)||null;
}

// Leagues: one page per competition name.
export function leagues(events){
 const map=new Map();
 for(const e of events){
  if(!e.competition_name)continue;
  const slug=slugify(e.competition_name,70);
  if(!slug)continue;
  const item=map.get(slug)||{slug,name:e.competition_name,count:0};
  item.count++;map.set(slug,item);
 }
 return [...map.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'lv'));
}

// One listing: filtered events, its headline words and whether it is worth indexing.
export function listing(events,{municipality='',category='',time='',league=''}={},today){
 let list=events.filter(listable);
 if(municipality)list=list.filter(e=>e.municipality===municipality);
 if(category)list=list.filter(e=>eventGroup(e)===category);
 if(league)list=list.filter(e=>slugify(e.competition_name||'',70)===league);
 const window=time?timeWindow(time,today):null;
 if(window)list=list.filter(e=>overlaps(e,window));
 list=[...list].sort(byStart);
 return {events:list,window,indexable:list.length>=MIN_INDEXABLE_EVENTS};
}

// "Mūzika un dejas Rīgā šonedēļ" style headline parts.
export function listingHeading({municipalityName='',category='',time='',leagueName=''}){
 const what=leagueName?leagueName+' spēles':(category?HOME_CATEGORY_FILTERS[category]?.title:'Pasākumi');
 const where=municipalityName?municipalityLocative(municipalityName):(category&&!leagueName?'Latvijā':'');
 const when=time?TIME_SLUGS[time]:'';
 return [what,where,when].filter(Boolean).join(' ');
}
export function listingPath({municipalitySlug:m='',category='',time='',league=''}){
 if(league)return '/pasakumi/sports/'+league;
 if(category)return '/pasakumi/k/'+CATEGORY_SLUGS[category]+(m?'/'+m:'');
 if(m)return '/pasakumi/'+m+(time?'/'+time:'');
 return '/pasakumi';
}

// Every listing page that has enough events to be indexed (for sitemap.xml and links).
export function indexableListings(events,today){
 const out=[];
 const add=(params,result)=>{if(result.indexable)out.push({path:listingPath(params),count:result.events.length});};
 const towns=municipalities(events);
 for(const m of towns){
  add({municipalitySlug:m.slug},listing(events,{municipality:m.name},today));
  for(const t of Object.keys(TIME_SLUGS))add({municipalitySlug:m.slug,time:t},listing(events,{municipality:m.name,time:t},today));
 }
 for(const key of HOME_GROUP_KEYS){
  add({category:key},listing(events,{category:key},today));
  for(const m of towns)add({category:key,municipalitySlug:m.slug},listing(events,{category:key,municipality:m.name},today));
 }
 for(const l of leagues(events))add({league:l.slug},listing(events,{league:l.slug},today));
 return out;
}
// Events grouped by start day for the page: [{date, events}]
export function byDay(events,from){
 const groups=new Map();
 for(const e of events){
  const day=from&&e.date_from<from?from:e.date_from;
  if(!groups.has(day))groups.set(day,[]);
  groups.get(day).push(e);
 }
 return [...groups].map(([date,list])=>({date,events:list}));
}

// The closing sentence of a listing page's meta description.
const CATEGORY_TAILS={
 music:'Koncerti, balles, deju vakari un festivāli meets.lv.',
 stage:'Teātra izrādes, kino seansi un skatuves mākslas pasākumi meets.lv.',
 culture:'Izstādes, muzeju pasākumi, ekskursijas un kultūras notikumi meets.lv.',
 sport:'Spēles, sacensības un sporta pasākumi meets.lv.',
 active:'Pārgājieni, skrējieni, nodarbības un aktīvā atpūta meets.lv.',
 markets:'Tirdziņi, gadatirgi un svētku pasākumi meets.lv.',
 learning:'Darbnīcas, lekcijas un izziņas pasākumi meets.lv.',
 community:'Tikšanās, sanāksmes un kopienas pasākumi meets.lv.'
};
export function listingTail({category='',league=''}={}){
 if(league)return 'Spēļu datumi, laiki un vietas meets.lv.';
 return CATEGORY_TAILS[category]||'Koncerti, izrādes, izstādes, sports un citi pasākumi meets.lv.';
}

// Listing pages an event belongs to, for links from its page: its league, then its
// interest in its municipality (or across Latvia when that page is too thin). Indexable pages only.
export function eventMoreLinks(event,events,today){
 const out=[];
 if(event?.competition_name){
  const slug=slugify(event.competition_name,70);
  if(slug&&listing(events,{league:slug},today).indexable)
   out.push({path:listingPath({league:slug}),label:listingHeading({leagueName:event.competition_name})});
 }
 const category=eventGroup(event);
 if(HOME_GROUP_KEYS.includes(category)){
  const town=isMunicipalityName(event.municipality)?municipalitySlug(event.municipality):'';
  if(town&&listing(events,{category,municipality:event.municipality},today).indexable)
   out.push({path:listingPath({category,municipalitySlug:town}),label:listingHeading({category,municipalityName:event.municipality})});
  else if(listing(events,{category},today).indexable)
   out.push({path:listingPath({category}),label:listingHeading({category})});
 }
 return out;
}

// The coming games of either team of a match, nearest first.
export function teamGames(event,events,today,limit=5){
 const teams=new Set([event?.home_team,event?.away_team].filter(Boolean));
 if(!teams.size)return [];
 return events.filter(e=>e.id!==event.id&&(teams.has(e.home_team)||teams.has(e.away_team))&&(e.date_to||e.date_from)>=today)
  .sort(byStart).slice(0,limit);
}

// Leagues with an indexable page, most games first: [{slug, name, path, count}]
export function topLeagues(events,today,limit=6){
 const out=[];
 for(const l of leagues(events)){
  const result=listing(events,{league:l.slug},today);
  if(result.indexable)out.push({slug:l.slug,name:l.name,path:listingPath({league:l.slug}),count:result.events.length});
  if(out.length>=limit)break;
 }
 return out;
}
