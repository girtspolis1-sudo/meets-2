'use client';
import Link from 'next/link';
import {useMemo} from 'react';
import {useEvents} from '../lib/use-events.js';
import {eventGroup} from '../lib/home-category-filters.js';
import {rigaTodayIso} from '../lib/event-date.js';

function weekEnd(today){
 const date=new Date(today+'T12:00:00Z');
 date.setUTCDate(date.getUTCDate()+((7-date.getUTCDay())%7));
 return date.toISOString().slice(0,10);
}

export default function HomeNearby(){
 const {data,loading}=useEvents();
 const events=useMemo(()=>{
  const today=rigaTodayIso(),end=weekEnd(today);
  return (data?.events||[])
   .filter(e=>eventGroup(e)&&eventGroup(e)!=='civic'&&
    String(e.date_to||e.date_from||'')>=today&&String(e.date_from||'')<=end)
   .sort((a,b)=>String(a.date_from).localeCompare(String(b.date_from))||
    String(a.time_from||'').localeCompare(String(b.time_from||'')))
   .slice(0,3);
 },[data]);
 if(!loading&&!events.length)return null;
 return <section className="home-nearby" aria-labelledby="home-nearby-title">
  <div className="home-nearby-header">
   <h2 id="home-nearby-title">Kas notiek šonedēļ?</h2>
   <Link className="button compact" href="/karte?period=week">Visi šīs nedēļas pasākumi ↗</Link>
  </div>
  {loading?<p role="status" className="meets-muted">Ielādējam aktuālos pasākumus…</p>:
  <div className="home-nearby-grid">{events.map(e=><Link
    key={e.id} className="home-nearby-card" href={'/karte?period=week&q='+encodeURIComponent(e.title)}>
    <span className="home-nearby-date">{new Date(e.date_from+'T12:00:00Z').toLocaleDateString('lv-LV',{day:'numeric',month:'long',timeZone:'UTC'})}{e.time_from?' · '+e.time_from.slice(0,5):''}</span>
    <strong>{e.title}</strong>
    <small>⌖ {e.venue_name||e.settlement||e.municipality||'Norises vieta nav norādīta'}</small>
    <span className="card-link">Atrast kartē ↗</span>
   </Link>)}</div>}
 </section>;
}
