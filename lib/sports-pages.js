import {addDays} from './map-nearby.js';
import {isSportEvent,sportLevel} from './sport-level.js';
import {sportIcon} from './event-map-icons.js';
import {ageLabel} from './sport-line.js';
import {listingPath} from './event-listings.js';
import {MIN_INDEXABLE_EVENTS,slugify} from './seo.js';

// The sports pages: /pasakumi/sports (adults) and /pasakumi/sports/jauniesi (youth).
// Pure; tests in tests/sports-pages.test.js. The default views of the map, the
// catalogue and the home page do not use these: there youth games stay hidden
// unless chosen.
export const YOUTH_DAYS=14;

const byStart=(a,b)=>String(a.date_from).localeCompare(String(b.date_from))
 ||String(a.time_from||'99').localeCompare(String(b.time_from||'99'))||String(a.title).localeCompare(String(b.title),'lv');
const coming=(e,today,to)=>String(e.date_to||e.date_from||'')>=today&&(!to||String(e.date_from||'')<=to);

// Coming sports events of one level ('senior' | 'youth'), soonest first.
// days: only the next N days (0 = all that the catalogue has).
export function sportGames(events,today,{level='senior',days=0}={}){
 const to=days?addDays(today,days-1):'';
 return (Array.isArray(events)?events:[])
  .filter(e=>e&&e.id&&e.title&&isSportEvent(e)&&sportLevel(e)===level&&coming(e,today,to))
  .sort(byStart);
}

// Leagues of one level with their coming games: [{slug, name, path, count, next, sport}],
// most games first. Every league with a game is listed, also those whose own page is
// too thin to be indexed (it is still a page with the schedule).
export function sportLeagues(events,today,{level='senior',days=0}={}){
 const map=new Map();
 for(const e of sportGames(events,today,{level,days})){
  if(!e.competition_name)continue;
  const slug=slugify(e.competition_name,70);
  if(!slug)continue;
  const item=map.get(slug)||{slug,name:e.competition_name,path:listingPath({league:slug}),count:0,next:e,sport:sportIcon(e)?.label||''};
  item.count++;map.set(slug,item);
 }
 return [...map.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'lv'));
}

// Youth leagues and championships: games in the next two weeks.
export function youthLeagues(events,today,days=YOUTH_DAYS){
 return sportLeagues(events,today,{level:'youth',days});
}

// The sports among games, for chips: [{label, count}], most games first.
export function sportsOf(games){
 const counts=new Map();
 for(const e of games){const label=sportIcon(e)?.label;if(label)counts.set(label,(counts.get(label)||0)+1);}
 return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'lv')).map(([label,count])=>({label,count}));
}

// The age group of a youth game, without the gender ("U14"), or ''.
export function gameAge(event){
 const label=ageLabel(event?.age_group)||ageLabel((/u\s?-?\s?\d{1,2}/i.exec(String(event?.competition_name||''))||[''])[0]);
 return label.split(' ')[0];
}
// Age groups among games, youngest first: ['U8', 'U10', …].
export function agesOf(games){
 return [...new Set(games.map(gameAge).filter(Boolean))].sort((a,b)=>Number(a.slice(1))-Number(b.slice(1)));
}

// The two sports pages for the sitemap, when they have enough games to be indexed.
// (Every league's own page, adult or youth, comes from indexableListings.)
export function sportPages(events,today){
 return [['/pasakumi/sports',sportGames(events,today).length],['/pasakumi/sports/jauniesi',sportGames(events,today,{level:'youth',days:YOUTH_DAYS}).length]]
  .filter(([,count])=>count>=MIN_INDEXABLE_EVENTS).map(([path,count])=>({path,count}));
}
