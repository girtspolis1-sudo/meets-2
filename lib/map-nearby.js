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

// "Šodien 18:00", "Rīt", "S 2.11. 14:00"
export function whenLabel(event,today){
 const day=startDay(event,today);
 const time=String(event?.time_from||'').slice(0,5);
 const ongoing=String(event?.date_from||'')<today;
 let label;
 if(day===today)label=ongoing?'Notiek šodien':'Šodien';
 else if(day===addDays(today,1))label='Rīt';
 else label=WEEKDAYS_SHORT[weekday(day)]+' '+shortDate(day);
 return time&&!ongoing?label+' '+time:label;
}
export function weekdayPhrase(iso){return WEEKDAYS[weekday(iso)];}

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
 if(event?.price_text)return String(event.price_text);
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
