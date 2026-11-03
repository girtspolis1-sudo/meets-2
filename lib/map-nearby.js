import {isOpeningDay,runningLabel} from './event-duration.js';
// "What is on near me": time windows, day groups, distances and the summary
// line for the map page. Dates are Riga calendar days as YYYY-MM-DD strings.

export const PERIODS=[
 {key:'today',label:'Šodien'},
 {key:'tomorrow',label:'Rīt'},
 {key:'weekend',label:'Nedēļas nogalē'},
 {key:'7days',label:'7 dienas'},
 {key:'30days',label:'30 dienas'},
 {key:'manual',label:'Datumi…'}
];
export const DEFAULT_PERIOD='7days';
// Older shared links used other names.
const LEGACY_PERIODS={week:'7days','3days':'7days',month:'30days'};
export function periodKey(value){
 const key=LEGACY_PERIODS[value]||value;
 return PERIODS.some(p=>p.key===key)?key:DEFAULT_PERIOD;
}

export const RADII=[5,10,30,50,0];
export const DEFAULT_RADIUS=30;
export function radiusLabel(km){return km?km+' km':'Visa Latvija';}

export function addDays(iso,days){
 const d=new Date(iso+'T12:00:00Z');
 d.setUTCDate(d.getUTCDate()+days);
 return d.toISOString().slice(0,10);
}
function weekday(iso){return new Date(iso+'T12:00:00Z').getUTCDay();} // 0 = Sunday
function earlier(a,b){return !a?b:!b?a:a<b?a:b;}

// Friday to Sunday; from Friday on it starts today.
export function weekendRange(today){
 const day=weekday(today);
 if(day===0)return {from:today,to:today};
 const friday=day>=5?today:addDays(today,5-day);
 return {from:friday,to:addDays(today,7-day)};
}

export function periodRange(mode,today,windowTo='',current={}){
 let range;
 if(mode==='today')range={from:today,to:today};
 else if(mode==='tomorrow')range={from:addDays(today,1),to:addDays(today,1)};
 else if(mode==='weekend')range=weekendRange(today);
 else if(mode==='30days')range={from:today,to:addDays(today,29)};
 else if(mode==='manual'){
  const from=current.from&&current.from>=today?current.from:today;
  range={from,to:current.to&&current.to>=from?current.to:addDays(from,6)};
 }else range={from:today,to:addDays(today,6)};
 return {from:range.from,to:earlier(range.to,windowTo)};
}

export function periodPhrase(mode,from,to){
 if(mode==='today')return 'šodien';
 if(mode==='tomorrow')return 'rīt';
 if(mode==='weekend')return 'šajā nedēļas nogalē';
 if(mode==='30days')return 'nākamajās 30 dienās';
 if(mode==='manual')return from===to?shortDate(from):shortDate(from)+'–'+shortDate(to);
 return 'nākamajās 7 dienās';
}

const WEEKDAYS=['svētdien','pirmdien','otrdien','trešdien','ceturtdien','piektdien','sestdien'];
const WEEKDAYS_SHORT=['Sv','P','O','T','C','Pk','S'];
export function shortDate(iso){
 if(!iso)return '';
 const [,m,d]=iso.split('-');
 return Number(d)+'.'+m+'.';
}

// Ongoing multi-day events count as today.
export function startDay(event,today){
 const from=String(event?.date_from||''),to=String(event?.date_to||from);
 return from<today&&to>=today?today:from;
}

export function dayGroup(event,today){
 const day=startDay(event,today);
 if(day===today)return 'today';
 if(day===addDays(today,1))return 'tomorrow';
 const weekend=weekendRange(today);
 if(weekday(today)!==0&&day>=weekend.from&&day<=weekend.to)return 'weekend';
 return 'later';
}
export const DAY_GROUPS=[
 {key:'today',label:'Šodien'},
 {key:'tomorrow',label:'Rīt'},
 {key:'weekend',label:'Nedēļas nogalē'},
 {key:'later',label:'Vēlāk'}
];

// Days until an event that starts later: "Pēc 3 dienām", "Pēc 21 dienas".
export function daysUntilLabel(day,today){
 const n=Math.round((Date.parse(day+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/864e5);
 return 'Pēc '+n+' '+plural(n,'dienas','dienām');
}
// "Šodien 18:00", "Rīt", "Pēc 4 dienām 14:00"; withDate adds the date for planning
// ("Pēc 4 dienām 14:00 · S 2.11.").
export function whenLabel(event,today,{withDate=false}={}){
 const day=startDay(event,today);
 const time=String(event?.time_from||'').slice(0,5);
 const ongoing=String(event?.date_from||'')<today;
 let label;
 // Running events say how far along they are: "2. diena no 3", "Apskatāms līdz 7. janv."
 if(day===today&&ongoing)return runningLabel(event,today)||'Notiek šodien';
 if(day===today)label=isOpeningDay(event,today)?'Atklāšana šodien':'Šodien';
 else if(day===addDays(today,1))label='Rīt';
 else label=daysUntilLabel(day,today);
 if(time&&!ongoing)label+=' '+time;
 return withDate&&day>addDays(today,1)?label+' · '+WEEKDAYS_SHORT[weekday(day)]+' '+shortDate(day):label;
}
export function weekdayPhrase(iso){return WEEKDAYS[weekday(iso)];}

// Short label on a map marker: ŠODIEN, RĪT, then days to go (PĒC 3D).
export function markerLabel(event,today){
 const day=startDay(event,today);
 if(!day)return '—';
 if(day===today)return 'ŠODIEN';
 if(day===addDays(today,1))return 'RĪT';
 return 'PĒC '+Math.round((Date.parse(day+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/864e5)+'D';
}

export function distanceKm(aLat,aLon,bLat,bLon){
 const r=6371,rad=v=>v*Math.PI/180;
 const dLat=rad(bLat-aLat),dLon=rad(bLon-aLon);
 const x=Math.sin(dLat/2)**2+Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(dLon/2)**2;
 return 2*r*Math.asin(Math.sqrt(x));
}
export function distanceLabel(km){
 if(!Number.isFinite(km))return '';
 if(km<1)return '< 1 km';
 if(km<10)return km.toFixed(1).replace('.',',')+' km';
 return Math.round(km)+' km';
}

// Day groups in order; within a day the nearest first, then the earliest.
export function nearbyGroups(events,today,origin){
 const groups=new Map(DAY_GROUPS.map(g=>[g.key,{...g,items:[]}]));
 for(const event of events){
  const lat=Number(event.latitude),lon=Number(event.longitude);
  const km=origin&&Number.isFinite(lat)&&Number.isFinite(lon)?distanceKm(origin.lat,origin.lon,lat,lon):null;
  groups.get(dayGroup(event,today)).items.push({event,km,day:startDay(event,today)});
 }
 for(const group of groups.values()){
  group.items.sort((a,b)=>a.day.localeCompare(b.day)||
   (a.km??Infinity)-(b.km??Infinity)||
   String(a.event.time_from||'99').localeCompare(String(b.event.time_from||'99'))||
   String(a.event.title).localeCompare(String(b.event.title),'lv'));
 }
 return [...groups.values()].filter(g=>g.items.length);
}

// Latvian: 1, 21, 31 … take the singular, 11 does not.
export function plural(n,one,many){return n%10===1&&n%100!==11?one:many;}
export function countLabel(n){return n+' '+plural(n,'pasākums','pasākumi');}

export function priceLabel(event){
 if(event?.price_status==='free')return 'Bezmaksas';
 const min=Number(event?.price_min),max=Number(event?.price_max);
 if(Number.isFinite(min)&&min>0)return (Number.isFinite(max)&&max>min?'no ':'')+String(min).replace('.',',')+' €';
 // Source texts that say nothing about the price are left out.
 if(event?.price_text&&!/^(nav norādīt|nav zinām|nav pārbaudīt|dažādi nosacījumi|skatīt avot)/i.test(String(event.price_text).trim()))return String(event.price_text);
 return '';
}

// Wider searches to offer when nothing matches, cheapest change first.
export function widerOptions(radiusKm,period){
 const options=[];
 if(radiusKm&&radiusKm<50)options.push({radius:50,label:'Paplašināt līdz 50 km'});
 if(radiusKm)options.push({radius:0,label:'Visa Latvija'});
 if(period!=='30days')options.push({period:'30days',label:'Rādīt 30 dienas'});
 return options;
}

function minutes(time){const m=String(time||'').match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null;}
// "Notiek tagad" between today's start and end, "Drīz" within two hours of the start.
export function liveBadge(event,today,clockMinutes){
 if(startDay(event,today)!==today||String(event?.date_from||'')!==today)return '';
 const start=minutes(event.time_from),end=minutes(event.time_to);
 if(start===null)return '';
 if(clockMinutes>=start&&end!==null&&clockMinutes<end)return 'now';
 if(clockMinutes<start&&start-clockMinutes<=120)return 'soon';
 return '';
}

const APPROXIMATE=new Set(['settlement_center','municipality_center','unresolved','approximate']);
export function isApproximatePlace(event){return APPROXIMATE.has(String(event?.location_precision||''));}

const WEEKDAY_NAMES=['Svētdiena','Pirmdiena','Otrdiena','Trešdiena','Ceturtdiena','Piektdiena','Sestdiena'];
const MONTHS=['janvāris','februāris','marts','aprīlis','maijs','jūnijs','jūlijs','augusts','septembris','oktobris','novembris','decembris'];
// Heading for a day in a date-sorted list: "Šodien", "Rīt", "Sestdiena, 31. oktobris".
export function dayHeading(event,today){
 const day=startDay(event,today);
 if(!day)return 'Datums nav norādīts';
 if(day===today)return 'Šodien';
 if(day===addDays(today,1))return 'Rīt';
 const [,m,d]=day.split('-').map(Number);
 return WEEKDAY_NAMES[weekday(day)]+', '+d+'. '+MONTHS[m-1];
}
