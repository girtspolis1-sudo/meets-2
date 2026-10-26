import {rigaTodayIso,rigaClockMinutes,addIsoDays} from './event-date.js';

export function isPastEvent(event,now=new Date()){
 const today=rigaTodayIso(now),end=event.date_to||event.date_from;
 if(!end)return false;
 if(end!==today)return end<today;
 if(event.time_type==='all_day'||!/^\d{2}:\d{2}/.test(event.time_to||''))return false;
 const [h,m]=event.time_to.split(':').map(Number);
 return h*60+m<=rigaClockMinutes(now);
}
export function agendaDay(event,today=rigaTodayIso()){
 const start=event.date_from||'';
 return start&&start<today&&(event.date_to||start)>=today?today:start;
}
export function agendaEvents(events,{plans=[],status='all',period='upcoming',date='',query='',now=new Date()}={}){
 const planned=new Set(plans),today=rigaTodayIso(now),q=query.trim().toLocaleLowerCase('lv');
 return [...new Map(events.map(e=>[e.id,e])).values()].filter(e=>
  (status!=='planned'||planned.has(e.id))&&
  (period==='past'?isPastEvent(e,now):!isPastEvent(e,now))&&
  (!date||occursOn(e,date))&&
  (!q||[e.title,e.venue_name,e.municipality].filter(Boolean).join(' ').toLocaleLowerCase('lv').includes(q))
 ).sort((a,b)=>{
  const order=(agendaDay(a,today)||'9999').localeCompare(agendaDay(b,today)||'9999')||String(a.time_from||'99:99').localeCompare(String(b.time_from||'99:99'))||String(a.title).localeCompare(String(b.title),'lv');
  return period==='past'?-order:order;
 });
}
export function occursOn(event,date){
 if(!event.date_from||event.date_from>date||(event.date_to||event.date_from)<date)return false;
 // Generated recurring occurrences have their own date. Do not invent daily
 // occurrences for imported recurring/selected-date ranges without a schedule.
 if(['recurring','selected_dates'].includes(event.schedule_type)&&event.date_to&&event.date_to!==event.date_from)return date===event.date_from;
 return true;
}
export function monthDays(month){
 const [year,m]=month.split('-').map(Number),start=new Date(Date.UTC(year,m-1,1));
 const offset=(start.getUTCDay()+6)%7,days=new Date(Date.UTC(year,m,0)).getUTCDate();
 return Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>addIsoDays(month+'-01',i-offset));
}
export function personalSelectionAfter(state,id,kind){
 const favorites=new Set([...(state.favorites||[]),...(state.plans||[])]),plans=new Set(state.plans||[]);
 if(kind==='plan'){
  favorites.add(id);if(plans.has(id))plans.delete(id);else plans.add(id);
 }else if(favorites.has(id)){favorites.delete(id);plans.delete(id);}else favorites.add(id);
 return {favorites:[...favorites],plans:[...plans]};
}
