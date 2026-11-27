// Map search helpers shared by the /karte search bar. Pure functions, tested in tests/map-search.test.js.
import {DEFAULT_LEVEL,levelKey} from './sport-level.js';

// What choosing a search suggestion does. An event suggestion only searches for that event and
// moves the map to it: it never becomes the place that distances and the radius are counted from.
export function suggestionAction(choice){
 const lat=Number(choice?.latitude),lon=Number(choice?.longitude);
 const point=Number.isFinite(lat)&&Number.isFinite(lon)?[lat,lon]:null;
 if(choice?.eventTitle)return {kind:'event',search:String(choice.eventTitle),view:point};
 if(!point)return {kind:'none'};
 return {kind:'place',location:{lat,lon,label:String(choice.label||choice.displayName||'Izvēlētā vieta'),source:choice.local?'events':'search'}};
}

export function normText(value=''){
 return String(value).toLocaleLowerCase('lv').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}

// The "Ko" field finds an event by its title, organizer or venue.
export function matchesText(event,query){
 const q=normText(query);
 if(!q)return true;
 return [event?.title,event?.organizer_name,event?.venue_name].some(value=>normText(value).includes(q));
}

// Up to `limit` events for the suggestions under the "Ko" field: titles that start with the
// words first, then the soonest.
export function eventSuggestions(events,query,limit=5){
 const q=normText(query);
 if(q.length<2)return [];
 const scored=[];
 for(const e of events||[]){
  const title=normText(e?.title);
  if(!matchesText(e,query))continue;
  scored.push({e,rank:title.startsWith(q)?0:title.includes(q)?1:2});
 }
 return scored.sort((a,b)=>a.rank-b.rank||String(a.e.date_from||'').localeCompare(String(b.e.date_from||''))||String(a.e.title).localeCompare(String(b.e.title),'lv'))
  .slice(0,limit).map(x=>x.e);
}

// Places for the "Kur" field while typing (no Enter needed); the geocoder covers the rest.
export function placeSuggestions(choices,query,limit=6){
 const q=normText(query);
 if(q.length<2)return [];
 return (choices||[]).filter(c=>normText(c.label).includes(q))
  .sort((a,b)=>(normText(b.label).startsWith(q)-normText(a.label).startsWith(q))||a.label.localeCompare(b.label,'lv')).slice(0,limit);
}

// How many filters inside the "Ko" panel differ from the defaults (the badge on "Filtri").
export function whatFilterCount(f){
 return [f.category,f.audience,levelKey(f.level)!==DEFAULT_LEVEL,(f.eventTypes||[]).length>0,f.competition,f.subcategory,f.price,f.onlineOnly,f.showLong===false,f.country].filter(Boolean).length;
}

const MONTHS=['janv.','febr.','marts','apr.','maijs','jūn.','jūl.','aug.','sept.','okt.','nov.','dec.'];
// A short date for suggestions: "Šodien 17:30", "Rīt", "28. nov. 19:00".
export function shortWhen(event,today){
 const from=String(event?.date_from||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from))return '';
 const time=String(event?.time_from||'').slice(0,5);
 const end=String(event?.date_to||from);
 let day;
 if(today&&from<=today&&end>=today)day=from<today?'Notiek':'Šodien';
 else if(today&&from===addDays(today,1))day='Rīt';
 else day=Number(from.slice(8,10))+'. '+MONTHS[Number(from.slice(5,7))-1];
 return day+(time&&day!=='Notiek'?' '+time:'');
}
function addDays(iso,n){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}

// The radius slider: stops in km (0 = all of Latvia is a separate button).
export const RADIUS_STOPS=[5,10,20,30,50];
export function radiusStopIndex(km){
 const i=RADIUS_STOPS.indexOf(Number(km));
 if(i>=0)return i;
 let best=0;RADIUS_STOPS.forEach((s,j)=>{if(Math.abs(s-km)<Math.abs(RADIUS_STOPS[best]-km))best=j;});
 return best;
}
