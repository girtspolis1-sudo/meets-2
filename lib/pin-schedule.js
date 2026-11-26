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

// ---- Week calendar of one map place: seven days from today, never before it, and never past
// the last day that has an event there. ----
const DOW=['Sv','P','O','T','C','Pk','S'];
function addDays(iso,n){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function lastDay(e){return String(e?.date_to||e?.date_from||'');}
export function occursOn(e,date){
 const from=String(e?.date_from||'');
 return /^\d{4}-\d{2}-\d{2}$/.test(from)&&from<=date&&lastDay(e)>=date;
}
// The last day with an event at this place (today if they are all running or none is left).
export function lastEventDay(events,today){
 let last=today;
 for(const e of events||[]){const start=String(e?.date_from||'');if(start>last)last=start;}
 return last;
}
// Seven days from `start` (today or later): weekday, date, how many events and their colour.
export function weekDays(events,today,start=today){
 const from=start<today?today:start;
 return Array.from({length:7},(_,i)=>{
  const date=addDays(from,i);
  const count=(events||[]).filter(e=>occursOn(e,date)).length;
  const days=Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/864e5);
  return {date,dow:DOW[new Date(date+'T12:00:00Z').getUTCDay()],day:String(Number(date.slice(8,10))),month:MONTHS[Number(date.slice(5,7))-1],count,tone:dayTone(days)};
 });
}
// Where the next and previous week buttons may go.
export function weekNav(events,today,start=today){
 const from=start<today?today:start;
 return {prev:from>today?(addDays(from,-7)<today?today:addDays(from,-7)):null,next:addDays(from,7)<=lastEventDay(events,today)?addDays(from,7):null};
}
const MONTHS_LONG=['janv.','febr.','marts','apr.','maijs','jūn.','jūl.','aug.','sept.','okt.','nov.','dec.'];
export function weekTitle(days){
 const a=days[0]?.date,b=days.at(-1)?.date;if(!a||!b)return '';
 const f=d=>Number(d.slice(8,10))+'. '+MONTHS_LONG[Number(d.slice(5,7))-1];
 return f(a)+' – '+f(b);
}
