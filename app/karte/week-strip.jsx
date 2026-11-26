'use client';
import {weekDays,weekNav,weekTitle,occursOn,DOT_LABELS} from '../../lib/pin-schedule.js';

const DAY_NAMES=['svētdiena','pirmdiena','otrdiena','trešdiena','ceturtdiena','piektdiena','sestdiena'];
const MONTH_NAMES=['janvāris','februāris','marts','aprīlis','maijs','jūnijs','jūlijs','augusts','septembris','oktobris','novembris','decembris'];
export function dayHeading(date){
 const d=new Date(date+'T12:00:00Z');
 const name=DAY_NAMES[d.getUTCDay()];
 return name.charAt(0).toUpperCase()+name.slice(1)+', '+d.getUTCDate()+'. '+MONTH_NAMES[d.getUTCMonth()];
}
export function eventsOnDay(events,day){return day?events.filter(e=>occursOn(e,day)):events;}

// Seven days from today at one map place. A day with events shows them alone below; the same day
// again shows all. The arrows move a week, never before today and never past the last event here.
export default function WeekStrip({events,today,day,onDay,start,onStart}){
 const days=weekDays(events,today,start);
 const nav=weekNav(events,today,start);
 const shown=eventsOnDay(events,day).length;
 return <div className="mweek">
  <div className="mweek-head">
   {nav.prev?<button type="button" className="mweek-arrow" onClick={()=>onStart(nav.prev)} aria-label="Iepriekšējās 7 dienas">‹</button>:<span className="mweek-arrow-gap"/>}
   <strong>{weekTitle(days)}</strong>
   {nav.next?<button type="button" className="mweek-arrow" onClick={()=>onStart(nav.next)} aria-label="Nākamās 7 dienas">›</button>:<span className="mweek-arrow-gap"/>}
  </div>
  <div className="mweek-days" role="group" aria-label="Dienas ar pasākumiem šajā vietā">
   {days.map(d=><button key={d.date} type="button" disabled={!d.count} aria-pressed={day===d.date}
    className={'mweek-day'+(day===d.date?' on':'')+(d.date===today?' today':'')} onClick={()=>onDay(day===d.date?'':d.date)}
    aria-label={dayHeading(d.date)+': '+(d.count?d.count+(d.count===1?' pasākums':' pasākumi'):'nav pasākumu')}>
    <small>{d.dow}</small><b>{d.day}</b>{d.count?<span><i className={'dot-'+d.tone} title={DOT_LABELS[d.tone]}/>{d.count}</span>:<span className="mweek-empty"/>}
   </button>)}
  </div>
  {day&&<div className="mweek-chosen"><span>{dayHeading(day)} · {shown} {shown===1?'pasākums':'pasākumi'}</span>
   <button type="button" className="text-button" onClick={()=>onDay('')}>Visas dienas</button></div>}
 </div>;
}
