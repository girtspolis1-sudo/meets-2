'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {useEvents} from '../lib/use-events.js';
import {cardDate,cardImage,cardLocation} from '../lib/discovery-card.js';
import {eventGroup} from '../lib/home-category-filters.js';
import {rigaTodayIso} from '../lib/event-date.js';
import DiscoveryEventCard from './components/discovery-event-card.jsx';

const FAVORITES='meets_favorites_v1';
function readFavorites(){
 try{const ids=JSON.parse(localStorage.getItem(FAVORITES)||'[]');return Array.isArray(ids)?ids.map(String):[];}
 catch{return [];}
}
export default function HomeFeatured(){
 const {data,loading,error,refresh}=useEvents();
 const [favorites,setFavorites]=useState([]);
 useEffect(()=>{
  const update=()=>setFavorites(readFavorites());
  update();window.addEventListener('meets-favorites-changed',update);window.addEventListener('storage',update);
  return()=>{window.removeEventListener('meets-favorites-changed',update);window.removeEventListener('storage',update);};
 },[]);
 const all=data?.events||[];
 const picks=useMemo(()=>{
  const today=rigaTodayIso();
  return all.filter(e=>e.id&&e.title&&eventGroup(e)!=='civic'&&String(e.date_to||e.date_from||'')>=today)
   .sort((a,b)=>{
    const date=String(a.date_from||'9999').localeCompare(String(b.date_from||'9999'));
    if(date)return date;
    return Number(Boolean(cardImage(b)))-Number(Boolean(cardImage(a)));
   }).slice(0,6);
 },[all]);
 const saved=useMemo(()=>{
  const ids=new Set(favorites);
  return all.filter(e=>ids.has(String(e.id))).sort((a,b)=>String(a.date_from||'').localeCompare(String(b.date_from||''))).slice(0,4);
 },[all,favorites]);
 return <section className="meets-home-discovery" aria-labelledby="featured-events-title">
  <div className="meets-home-featured-layout">
   <div className="meets-home-featured-main">
    <header className="meets-home-section-header"><div><p className="eyebrow">Atrodi ko piedzīvot</p><h2 id="featured-events-title">Tuvākie pasākumi</h2></div><Link href="/pasakumi">Skatīt visus <span aria-hidden="true">→</span></Link></header>
    {error&&<p className="meets-discovery-error" role="alert">{error} <button type="button" onClick={refresh}>Mēģināt vēlreiz</button></p>}
    {loading&&!data?<div className="meets-home-loading" role="status">Ielādējam aktuālos pasākumus…</div>:
     picks.length?<div className="meets-discovery-grid">{picks.map(event=><DiscoveryEventCard key={event.id} event={event}/>)}</div>:
     <div className="meets-home-empty"><strong>Šobrīd nav atlasītu tuvāko pasākumu.</strong><p>Pamēģini plašāku periodu vai apskati visus notikumus kartē.</p><Link className="button primary" href="/karte">Atvērt karti →</Link></div>}
   </div>
   <aside className="meets-home-side" aria-label="Personiskie pasākumu ieteikumi">
    <div className="meets-home-side-card meets-home-tip">
     <span className="meets-home-side-icon" aria-hidden="true">✦</span>
     <h3>Atrodi sev piemērotāko</h3>
     <p>Meklē pēc intereses, datuma vai vietas. Pasākuma kartītē redzēsi svarīgāko, bet pilnu informāciju atvērs viena darbība.</p>
     <Link href="/karte">Izpētīt kartē <span aria-hidden="true">→</span></Link>
    </div>
    <div className="meets-home-side-card">
     <div className="meets-home-side-head"><h3>Mani saglabātie</h3><Link href="/mani-pasakumi">Skatīt visus →</Link></div>
     {saved.length?<div className="meets-home-saved-list">{saved.map(e=><Link href={'/pasakumi/'+encodeURIComponent(e.id)} key={e.id}>
      {cardImage(e)?<img src={cardImage(e)} alt="" loading="lazy"/>:<span className="meets-saved-fallback" aria-hidden="true">✦</span>}
      <span><strong>{e.title}</strong><small>{cardDate(e)} · {cardLocation(e)}</small></span>
     </Link>)}</div>:<p className="meets-muted">Saglabā iepatikušos pasākumus ar <span aria-label="sirds">♡</span> ikonu, lai tos ātri atrastu šeit.</p>}
    </div>
    <div className="meets-home-side-card">
     <div className="meets-home-side-head"><h3>Seko organizatoriem</h3><Link href="/sekosana">Atvērt →</Link></div>
     <p className="meets-muted">Seko iemīļotām norises vietām un rīkotājiem — visi viņu aktuālie publicētie pasākumi vienuviet.</p>
     <Link className="meets-side-inline-action" href="/sekosana">Mana sekošana →</Link>
    </div>
   </aside>
  </div>
 </section>;
}
