import {eventGroup} from './home-category-filters.js';
import {matchesLevel,sportLevel} from './sport-level.js';
import {isBackgroundLong} from './event-duration.js';
import {cardImage} from './discovery-card.js';
import {addDays,distanceKm,periodRange,startDay} from './map-nearby.js';
import {sportIcon} from './event-map-icons.js';

// What the home page lists. The server renders the lists without a place before
// the catalogue loads in the browser, and the browser renders the same lists
// afterwards (with the visitor's place and period, when chosen), so the page does
// not jump. Pure; tests in tests/home-picks.test.js.
export const HOME_PICK_COUNT=6;
export const HOME_GAME_COUNT=6;
// "Tuvumā": 50 km, widened step by step while fewer than the wanted count are found.
export const NEAR_RADII=[50,100,200];
// The bar's periods, the same keys as the map and the catalogue (?period=).
export const HOME_PERIODS=[['today','Šodien'],['tomorrow','Rīt'],['weekend','Brīvdienās']];

const hasPlace=origin=>Number.isFinite(origin?.lat)&&Number.isFinite(origin?.lon);
const kmFrom=(origin,e)=>{
 const lat=Number(e.latitude),lon=Number(e.longitude);
 if(e.latitude==null||e.longitude==null||!Number.isFinite(lat)||!Number.isFinite(lon))return Infinity;
 return distanceKm(origin.lat,origin.lon,lat,lon);
};
const inWindow=(e,{from,to})=>String(e.date_from||'')<=to&&String(e.date_to||e.date_from||'')>=from;

// Date order; on the same day an event with its own picture first.
function byDate(today){
 return (a,b)=>startDay(a,today).localeCompare(startDay(b,today))
  ||String(a.time_from||'99').localeCompare(String(b.time_from||'99'))
  ||Number(Boolean(cardImage(b)))-Number(Boolean(cardImage(a)));
}

// Near a place: the smallest radius that gives `limit` events (else everything
// with a place), then by day and distance.
function nearest(list,origin,today,limit){
 const measured=list.map(e=>({e,km:kmFrom(origin,e)})).filter(x=>x.km<Infinity);
 let radius=NEAR_RADII.find(r=>measured.filter(x=>x.km<=r).length>=limit)??0;
 const chosen=radius?measured.filter(x=>x.km<=radius):measured;
 const date=byDate(today);
 chosen.sort((a,b)=>startDay(a.e,today).localeCompare(startDay(b.e,today))||a.km-b.km||date(a.e,b.e));
 return {events:chosen.slice(0,limit).map(x=>x.e),radius};
}

// Coming events for "Tuvākajās dienās". Council meetings, youth competitions
// (unless chosen) and exhibitions that are simply running are left out: they
// come back on their opening day and in their last week.
// options: {origin:{lat,lon}|null, period:''|'today'|'tomorrow'|'weekend', limit}
// → {events, radius}: radius 0 means no place, or every distance.
export function homeSelection(events,today,{origin=null,period='',limit=HOME_PICK_COUNT}={}){
 let list=(Array.isArray(events)?events:[])
  .filter(e=>e&&e.id&&e.title&&eventGroup(e)!=='civic'&&matchesLevel(e)&&!isBackgroundLong(e,today)&&String(e.date_to||e.date_from||'')>=today);
 if(period&&HOME_PERIODS.some(([key])=>key===period))list=list.filter(e=>inWindow(e,periodRange(period,today)));
 if(hasPlace(origin))return nearest(list,origin,today,limit);
 return {events:list.sort(byDate(today)).slice(0,limit),radius:0};
}

// homePicks(events, today[, limit | options]) → the events only.
export function homePicks(events,today,options={}){
 return homeSelection(events,today,typeof options==='number'?{limit:options}:options).events;
}

// "Spēles šonedēļ": adult games of the next seven days. A youth game never
// shows here, whatever level the visitor chose elsewhere.
export function homeGames(events,today,{origin=null,limit=HOME_GAME_COUNT,sport=''}={}){
 const week={from:today,to:addDays(today,6)};
 let list=(Array.isArray(events)?events:[])
  .filter(e=>e&&e.id&&e.title&&e.event_type==='sports_match'&&sportLevel(e)==='senior'&&inWindow(e,week));
 if(sport)list=list.filter(e=>sportIcon(e)?.label===sport);
 if(hasPlace(origin))return nearest(list,origin,today,limit).events;
 return list.sort(byDate(today)).slice(0,limit);
}

// Sport chips for the games block: only sports that have games this week, most games first.
export function gameSports(events,today){
 const counts=new Map();
 for(const e of homeGames(events,today,{limit:Infinity})){
  const label=sportIcon(e)?.label;
  if(label)counts.set(label,(counts.get(label)||0)+1);
 }
 return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'lv')).map(([label,count])=>({label,count}));
}
