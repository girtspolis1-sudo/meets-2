'use client';
import {scheduleDays,DOT_LABELS} from '../../lib/pin-schedule.js';

// The days with events at one map place, as a strip of date chips coloured like the map legend.
// A chip scrolls to that day's first event in the list below it.
export default function ScheduleStrip({events,today,listRef,order=events,itemSelector='.event-detail-card'}){
 const days=scheduleDays(events,today);
 if(days.length<2)return null;
 function go(id){
  // The cards are rendered in `order`, so the chip finds its card by position.
  const index=order.findIndex(e=>String(e.id)===String(id));
  const item=index<0?null:listRef?.current?.querySelectorAll(itemSelector)[index];
  item?.scrollIntoView({behavior:'smooth',block:'nearest'});
  item?.querySelector('a,button')?.focus({preventScroll:true});
 }
 return <div className="mschedule" role="group" aria-label="Pasākumu dienas šajā vietā">
  {days.map(d=><button key={d.date} type="button" className={'mschedule-day tone-'+d.tone} onClick={()=>go(d.firstId)}
   aria-label={d.day+'. '+d.month.toLowerCase()+' ('+DOT_LABELS[d.tone]+'), '+d.count+(d.count===1?' pasākums':' pasākumi')}>
   <b>{d.day}</b><small>{d.month}</small><i className={'dot-'+d.tone}/>{d.count>1&&<span className="mschedule-n">{d.count}</span>}
  </button>)}
 </div>;
}
