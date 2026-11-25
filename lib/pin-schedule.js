// What a map place holds over time: the dots under a pin and the date strip in its panel.
// Colours follow the map legend: today, tomorrow, 2–15 days, after 15 days.
import {daysUntil} from './event-term.js';

export const DOT_TONES=['today','tomorrow','soon','far'];
export const DOT_LABELS={today:'šodien',tomorrow:'rīt',soon:'2–15 d',far:'pēc 15 d'};
const MONTHS=['JAN','FEB','MAR','APR','MAI','JŪN','JŪL','AUG','SEP','OKT','NOV','DEC'];

export function dayTone(days){
 if(days==null)return 'far';
 return days<=0?'today':days===1?'tomorrow':days<=15?'soon':'far';
}

function byStart(today){
 return (a,b)=>(daysUntil(a,today)??9999)-(daysUntil(b,today)??9999)||String(a.time_from||'').localeCompare(String(b.time_from||''))||String(a.title||'').localeCompare(String(b.title||''),'lv');
}

// Up to `max` dots, one per event from the soonest, and how many more there are.
export function scheduleDots(events,today,max=5){
 const list=[...(events||[])].sort(byStart(today));
 return {dots:list.slice(0,max).map(e=>dayTone(daysUntil(e,today))),more:Math.max(0,list.length-max)};
}

// One chip per day: date, colour, how many events and the first event of that day.
// A running event counts on today.
export function scheduleDays(events,today){
 const days=new Map();
 for(const e of [...(events||[])].sort(byStart(today))){
  const d=daysUntil(e,today);
  const date=d!=null&&d<=0?today:String(e.date_from||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
  const item=days.get(date)||{date,day:String(Number(date.slice(8,10))),month:MONTHS[Number(date.slice(5,7))-1],tone:dayTone(d),count:0,firstId:e.id};
  item.count++;days.set(date,item);
 }
 return [...days.values()];
}

// "Vēl 9 šajā vietā: 2 pēc 2–15 d, 7 pēc 15 d" style summary for screen readers.
export function scheduleText(events,today){
 const counts={};
 for(const e of events||[]){const t=dayTone(daysUntil(e,today));counts[t]=(counts[t]||0)+1;}
 return DOT_TONES.filter(t=>counts[t]).map(t=>counts[t]+' '+DOT_LABELS[t]).join(', ');
}
