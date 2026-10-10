import {eventGroup} from './home-category-filters.js';

export function coordinates(event){
 const lat=event?.latitude,lon=event?.longitude;
 if(lat==null||lon==null||lat===''||lon==='')return null;
 const latitude=Number(lat),longitude=Number(lon);
 return Number.isFinite(latitude)&&Number.isFinite(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180
  ?{latitude,longitude}:null;
}
export function navigationLinks(event){
 const point=coordinates(event);
 const address=String(event?.address_raw||event?.venue_name||'').trim();
 const query=point?point.latitude+','+point.longitude:address;
 return {
  google:query?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query):null,
  waze:point?'https://waze.com/ul?ll='+encodeURIComponent(point.latitude+','+point.longitude)+'&navigate=yes':null
 };
}
export function rigaDate(offset=0){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Riga',year:'numeric',month:'2-digit',day:'2-digit'})
  .formatToParts(new Date());
 const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 const dt=new Date(Date.UTC(Number(v.year),Number(v.month)-1,Number(v.day)+offset));
 return dt.toISOString().slice(0,10);
}
export function eventOverlapsDate(event,date){
 if(!date)return false;
 return String(event?.date_from||'')<=date&&String(event?.date_to||event?.date_from||'')>=date;
}
export function recommendEvents(events,interests,favorites,plans,limit=9){
 const chosen=new Set((interests||[]).map(x=>typeof x==='string'?x:x.category));
 const exclude=new Set([...favorites,...plans]);
 if(!chosen.size)return [];
 const today=rigaDate();
 return (events||[])
  .filter(event=>String(event.date_to||event.date_from||'')>=today&&chosen.has(eventGroup(event))&&!exclude.has(event.id))
  .sort((a,b)=>String(a.date_from).localeCompare(String(b.date_from)))
  .slice(0,limit);
}
export function icsContent(event){
 const datestr=String(event?.date_from||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(datestr))return '';
 const day=datestr.replaceAll('-','');
 const endDay=String(event.date_to||datestr).replaceAll('-','');
 const escape=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,m=>'\\'+m);
 const time=String(event.time_from||'').slice(0,5);
 const timeTo=String(event.time_to||'').slice(0,5);
 const tz='Europe/Riga';
 let dtstart='',dtend='';
 if(/^\d{2}:\d{2}$/.test(time)){
  const t=time.replace(':','')+'00';
  dtstart='DTSTART;TZID='+tz+':'+day+'T'+t;
  const fallback=new Date(Date.UTC(Number(endDay.slice(0,4)),Number(endDay.slice(4,6))-1,Number(endDay.slice(6,8)),Number(time.slice(0,2)),Number(time.slice(3,5))+60));
  const finish=/^\d{2}:\d{2}$/.test(timeTo)
   ?endDay+'T'+timeTo.replace(':','')+'00'
   :fallback.toISOString().slice(0,10).replaceAll('-','')+'T'+fallback.toISOString().slice(11,16).replace(':','')+'00';
  dtend='DTEND;TZID='+tz+':'+finish;
 }else{
  const next=new Date(Date.UTC(Number(endDay.slice(0,4)),Number(endDay.slice(4,6))-1,Number(endDay.slice(6,8))+1));
  dtstart='DTSTART;VALUE=DATE:'+day;
  dtend='DTEND;VALUE=DATE:'+next.toISOString().slice(0,10).replaceAll('-','');
 }
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MEETS 2//LV','BEGIN:VEVENT',
  'UID:'+String(event.id)+'@meets-2.vercel.app','SUMMARY:'+escape(event.title),dtstart,dtend,
  'LOCATION:'+escape(event.address_raw||event.venue_name||''),'DESCRIPTION:'+escape(event.description||''),
  'END:VEVENT','END:VCALENDAR'].join('\r\n');
}
