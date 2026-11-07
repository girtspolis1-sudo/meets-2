// Calendar view of the event list: topics down, days across, a count in each
// cell. Choosing a day, a topic or one cell filters the list under it.
import {HOME_CATEGORY_FILTERS,HOME_GROUP_KEYS,eventGroup} from './home-category-filters.js';
import {MEDIUM_MAX_DAYS,spanDays} from './event-duration.js';

// One word that fits a phone; the full title is shown on wider screens.
const SHORT={music:'Mūzika',stage:'Teātris',culture:'Izstādes',sport:'Sports',active:'Aktīvi',
 markets:'Svētki',learning:'Darbnīcas',community:'Kopiena'};
// Rows in a fixed order; events without a clear topic (and council sittings) are "Citi".
export const CALENDAR_ROWS=[
 ...HOME_GROUP_KEYS.map(key=>({key,label:HOME_CATEGORY_FILTERS[key].title,short:SHORT[key]||HOME_CATEGORY_FILTERS[key].title})),
 {key:'other',label:'Citi pasākumi',short:'Citi'}
];
export function calendarRow(event){
 const group=eventGroup(event);
 return HOME_GROUP_KEYS.includes(group)?group:'other';
}

const valid=iso=>/^\d{4}-\d{2}-\d{2}$/.test(String(iso||''));
export function addDays(iso,n){
 const d=new Date(Date.parse(iso+'T12:00:00Z')+n*864e5);
 return d.toISOString().slice(0,10);
}
export function dayRange(from,count){return Array.from({length:count},(_,i)=>addDays(from,i));}

// The days of [from,to] an event takes place on. Events longer than two weeks
// (exhibitions, seasons) would fill every cell, so they are not counted by day.
export function eventDaysWithin(event,from,to){
 const start=String(event?.date_from||'');
 if(!valid(start)||spanDays(event)>MEDIUM_MAX_DAYS)return [];
 const end=valid(event?.date_to)&&event.date_to>=start?event.date_to:start;
 const days=[];
 for(let day=start<from?from:start;day<=end&&day<=to;day=addDays(day,1))days.push(day);
 return days;
}

// counts[day][row] and totals[day] for the given days.
export function calendarCounts(events,days){
 const counts={},totals={};
 for(const day of days){counts[day]={};totals[day]=0;}
 if(!days.length)return {counts,totals};
 const from=days[0],to=days[days.length-1];
 for(const event of Array.isArray(events)?events:[]){
  const row=calendarRow(event);
  for(const day of eventDaysWithin(event,from,to)){
   counts[day][row]=(counts[day][row]||0)+1;
   totals[day]+=1;
  }
 }
 return {counts,totals};
}

// Shade step 0–4 for a count, the same steps in every row so cells compare.
export function heatStep(n){return !n?0:n<=2?1:n<=5?2:n<=12?3:4;}

// Events for a chosen day and/or row.
export function matchesCalendarChoice(event,{day='',row=''}={},range=null){
 if(row&&calendarRow(event)!==row)return false;
 if(day)return eventDaysWithin(event,day,day).length>0;
 if(range)return eventDaysWithin(event,range.from,range.to).length>0;
 return true;
}

// Distance in km between two {lat,lon} points.
export function distanceKm(a,b){
 const deg=Math.PI/180,dLat=(b.lat-a.lat)*deg,dLon=(b.lon-a.lon)*deg;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*deg)*Math.cos(b.lat*deg)*Math.sin(dLon/2)**2;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function withinRadius(event,center,radiusKm){
 if(!center||!(radiusKm>0))return true;
 const lat=Number(event?.latitude),lon=Number(event?.longitude);
 if(!Number.isFinite(lat)||!Number.isFinite(lon))return false;
 return distanceKm(center,{lat,lon})<=radiusKm;
}

// Towns for the "Kur" choice: the cities and county centres of Latvia.
export const NEAR_PLACES=[
 ['riga','Rīga',56.9496,24.1052],['daugavpils','Daugavpils',55.8747,26.5362],['liepaja','Liepāja',56.5047,21.0108],
 ['jelgava','Jelgava',56.6511,23.7214],['jurmala','Jūrmala',56.968,23.77],['ventspils','Ventspils',57.3894,21.5606],
 ['rezekne','Rēzekne',56.5099,27.3332],['valmiera','Valmiera',57.5385,25.4264],['jekabpils','Jēkabpils',56.4994,25.8574],
 ['ogre','Ogre',56.8162,24.614],['tukums','Tukums',56.9671,23.1554],['cesis','Cēsis',57.3119,25.2706],
 ['sigulda','Sigulda',57.1537,24.8531],['salaspils','Salaspils',56.8614,24.3497],['kuldiga','Kuldīga',56.9677,21.9686],
 ['talsi','Talsi',57.2447,22.5889],['saldus','Saldus',56.6636,22.4881],['dobele','Dobele',56.6252,23.2788],
 ['bauska','Bauska',56.4079,24.1932],['aizkraukle','Aizkraukle',56.6047,25.2552],['madona','Madona',56.8538,26.2171],
 ['gulbene','Gulbene',57.1775,26.7527],['aluksne','Alūksne',57.4224,27.0465],['balvi','Balvi',57.1313,27.2654],
 ['smiltene','Smiltene',57.4242,25.9016],['limbazi','Limbaži',57.5147,24.7132],['kraslava','Krāslava',55.8951,27.1681],
 ['preili','Preiļi',56.2943,26.7246],['ludza','Ludza',56.5462,27.7192],['livani','Līvāni',56.354,26.1759],
 ['marupe','Mārupe',56.9071,24.0441],['adazi','Ādaži',57.0757,24.3236],['olaine','Olaine',56.785,23.9381],
 ['kekava','Ķekava',56.8282,24.2324],['saulkrasti','Saulkrasti',57.2639,24.4153],['ropazi','Ropaži',56.9724,24.6333]
].map(([key,label,lat,lon])=>({key,label,lat,lon}));
export const RADIUS_CHOICES=[5,10,25,50,100];
export function nearPlace(key){return NEAR_PLACES.find(place=>place.key===key)||null;}
