'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import EventRow from '../../components/event-row.jsx';
const names=['Janvāris','Februāris','Marts','Aprīlis','Maijs','Jūnijs','Jūlijs','Augusts','Septembris','Oktobris','Novembris','Decembris'];
const days=['P','O','T','C','P','S','Sv'];
const format=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
function nice(d){return d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(0,4);}
function label(e){if(e.price_status==='free')return 'Bezmaksas';if(e.price_min!=null&&e.price_max!=null)return e.price_min===e.price_max?e.price_min+' €':e.price_min+'–'+e.price_max+' €';return e.price_status==='paid'?'Maksas':'Cena nav norādīta';}
const todayIso=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
// Two views: the coming events as a list (first, it is what a visitor wants on a
// phone) and the month grid.
export default function VenueCalendar({events=[],embedded=false}){
 const now=new Date();
 const [view,setView]=useState('list');
 const [month,setMonth]=useState(()=>format(now));
 const current=new Date(month+'-01T12:00:00');
 const offset=(current.getDay()+6)%7,total=new Date(current.getFullYear(),current.getMonth()+1,0).getDate();
 const entries=useMemo(()=>events.filter(e=>String(e.date_from).slice(0,7)===month),[events,month]);
 const byDay=new Map();entries.forEach(e=>{const day=Number(String(e.date_from).slice(8,10));byDay.set(day,(byDay.get(day)||0)+1);});
 const coming=useMemo(()=>{const today=todayIso();return events.filter(e=>String(e.date_to||e.date_from)>=today).sort((a,b)=>String(a.date_from).localeCompare(String(b.date_from)));},[events]);
 function move(delta){const d=new Date(current.getFullYear(),current.getMonth()+delta,1,12);setMonth(format(d));}
 const row=e=><EventRow key={e.id} event={{...e,primary_category:e.primary_category||e.category}} href={false}
  title={<span className="erow-title">{e.title}</span>} place={label(e)}
  actions={<div className="erow-actions"><Link className="button" href={'/karte?event='+e.id} target={embedded?'_blank':undefined} rel={embedded?'noopener noreferrer':undefined}>Kartē ↗</Link></div>}/>;
 return <div className={'venue-calendar'+(embedded?' venue-calendar-embedded':'')}>
  <style>{`
   .venue-calendar{display:grid;gap:18px;color:#29243a}
   .venue-calendar-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
   .venue-calendar-head h2{font-size:19px;margin:0}
   .venue-calendar-head>div{display:flex;gap:8px}
   .venue-calendar-head button{border:1px solid #dbe3ec;background:white;border-radius:9px;padding:8px 12px;cursor:pointer}
   .venue-month{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}
   .venue-day-name{text-align:center;font-size:12px;color:#697185;font-weight:700}
   .venue-month-day{min-width:0;min-height:55px;padding:5px;border:1px solid #e2e7ee;border-radius:9px;background:white;position:relative;font-size:13px}
   .venue-month-day.has-events{background:#f3f6f9;border-color:#e0babe}
   .venue-month-day small{display:block;margin-top:4px;color:#96454d;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
   .venue-view-switch{justify-self:start;margin:0}
   @media(max-width:420px){.venue-month-day{min-height:43px;font-size:11px}.venue-month-day small{font-size:9px}}
  `}</style>
  <div className="catalog-view-switch venue-view-switch" role="group" aria-label="Skats">
   <button type="button" aria-pressed={view==='list'} onClick={()=>setView('list')}>Saraksts</button>
   <button type="button" aria-pressed={view==='month'} onClick={()=>setView('month')}>Mēnesis</button>
  </div>
  {view==='list'?<section className="venue-event-list" aria-label="Tuvākie pasākumi">
   <ul className="event-link-list elist">{coming.map(row)}</ul>
   {!coming.length&&<p>Tuvākajā laikā šeit nav publicētu pasākumu.</p>}
  </section>:<>
  <div className="venue-calendar-head"><h2>{names[current.getMonth()]} {current.getFullYear()}</h2>
   <div><button type="button" aria-label="Iepriekšējais mēnesis" onClick={()=>move(-1)}>←</button><button type="button" aria-label="Nākamais mēnesis" onClick={()=>move(1)}>→</button></div></div>
  <div className="venue-month">
   {days.map((d,i)=><span key={i} className="venue-day-name">{d}</span>)}
   {Array.from({length:offset},(_,i)=><span key={'x'+i}/>)}
   {Array.from({length:total},(_,i)=><div key={i} className={'venue-month-day'+(byDay.has(i+1)?' has-events':'')}>
    <strong>{i+1}</strong>{byDay.has(i+1)&&<small>{byDay.get(i+1)} pas.</small>}</div>)}
  </div>
  <section className="venue-event-list" aria-label="Mēneša pasākumi">
   <ul className="event-link-list elist">{entries.map(row)}</ul>
   {!entries.length&&<p>Šajā mēnesī nav publicētu pasākumu.</p>}
  </section></>}
 </div>;
}
