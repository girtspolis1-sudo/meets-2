'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
const names=['Janvāris','Februāris','Marts','Aprīlis','Maijs','Jūnijs','Jūlijs','Augusts','Septembris','Oktobris','Novembris','Decembris'];
const days=['P','O','T','C','P','S','Sv'];
const format=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
function nice(d){return d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(0,4);}
function label(e){if(e.price_status==='free')return 'Bezmaksas';if(e.price_min!=null&&e.price_max!=null)return e.price_min===e.price_max?e.price_min+' €':e.price_min+'–'+e.price_max+' €';return e.price_status==='paid'?'Maksas':'Cena nav norādīta';}
export default function VenueCalendar({events=[],embedded=false}){
 const now=new Date();
 const [month,setMonth]=useState(()=>format(now));
 const current=new Date(month+'-01T12:00:00');
 const offset=(current.getDay()+6)%7,total=new Date(current.getFullYear(),current.getMonth()+1,0).getDate();
 const entries=useMemo(()=>events.filter(e=>String(e.date_from).slice(0,7)===month),[events,month]);
 const byDay=new Map();entries.forEach(e=>{const day=Number(String(e.date_from).slice(8,10));byDay.set(day,(byDay.get(day)||0)+1);});
 function move(delta){const d=new Date(current.getFullYear(),current.getMonth()+delta,1,12);setMonth(format(d));}
 return <div className={'venue-calendar'+(embedded?' venue-calendar-embedded':'')}>
  <style>{`
   .venue-calendar{display:grid;gap:18px;color:#29243a}
   .venue-calendar-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
   .venue-calendar-head h2{font-size:19px;margin:0}
   .venue-calendar-head>div{display:flex;gap:8px}
   .venue-calendar-head button{border:1px solid #e2dbec;background:white;border-radius:9px;padding:8px 12px;cursor:pointer}
   .venue-month{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}
   .venue-day-name{text-align:center;font-size:12px;color:#697185;font-weight:700}
   .venue-month-day{min-width:0;min-height:55px;padding:5px;border:1px solid #e6e2ee;border-radius:9px;background:white;position:relative;font-size:13px}
   .venue-month-day.has-events{background:#f4edff;border-color:#c7b4e6}
   .venue-month-day small{display:block;margin-top:4px;color:#6137a4;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
   .venue-event-list{display:grid;gap:10px}
   .venue-event{display:flex;gap:14px;border:1px solid #e3dfeb;background:#fff;border-radius:13px;padding:13px;min-width:0}
   .venue-event>img{width:90px;height:90px;object-fit:cover;border-radius:10px}
   .venue-event h3{font-size:16px;line-height:1.3;margin:4px 0}
   .venue-event p{color:#647084;font-size:13px;margin:4px 0}
   .venue-event a{color:#5a2db5;font-weight:700;font-size:13px;text-decoration:none}
   @media(max-width:420px){.venue-month-day{min-height:43px;font-size:11px}.venue-month-day small{font-size:9px}.venue-event>img{width:64px;height:64px}}
  `}</style>
  <div className="venue-calendar-head"><h2>{names[current.getMonth()]} {current.getFullYear()}</h2>
   <div><button type="button" aria-label="Iepriekšējais mēnesis" onClick={()=>move(-1)}>←</button><button type="button" aria-label="Nākamais mēnesis" onClick={()=>move(1)}>→</button></div></div>
  <div className="venue-month">
   {days.map((d,i)=><span key={i} className="venue-day-name">{d}</span>)}
   {Array.from({length:offset},(_,i)=><span key={'x'+i}/>)}
   {Array.from({length:total},(_,i)=><div key={i} className={'venue-month-day'+(byDay.has(i+1)?' has-events':'')}>
    <strong>{i+1}</strong>{byDay.has(i+1)&&<small>{byDay.get(i+1)} pas.</small>}</div>)}
  </div>
  <section className="venue-event-list" aria-label="Mēneša pasākumi">
   {entries.map(e=><article className="venue-event" key={e.id}>
    {e.image_url&&<img src={e.image_url} alt="" loading="lazy"/>}
    <div><small>{nice(e.date_from)}{e.time_from?' · '+String(e.time_from).slice(0,5):''}</small><h3>{e.title}</h3>
     <p>{label(e)} · {e.category||'Pasākums'}</p>
     <Link href={'/karte?event='+e.id} target={embedded?'_blank':undefined} rel={embedded?'noopener noreferrer':undefined}>Skatīt kartē ↗</Link>
    </div></article>)}
   {!entries.length&&<p>Šajā mēnesī nav publicētu pasākumu.</p>}
  </section>
 </div>;
}
