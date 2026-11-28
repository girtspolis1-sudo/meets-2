'use client';
import Icon from './components/line-icon.jsx';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {useEvents} from '../lib/use-events.js';
import {eventPath} from '../lib/seo.js';
import {cardDate,cardImage,cardLocation} from '../lib/discovery-card.js';
import {rigaTodayIso} from '../lib/event-date.js';
import {homePicks} from '../lib/home-picks.js';
import DiscoveryEventCard from './components/discovery-event-card.jsx';

const FAVORITES='meets_favorites_v1';
function readFavorites(){
 try{const ids=JSON.parse(localStorage.getItem(FAVORITES)||'[]');return Array.isArray(ids)?ids.map(String):[];}
 catch{return [];}
}
// fallback = the same picks rendered on the server, shown until the catalogue loads here.
export default function HomeFeatured({fallback=null}){
 const {data,loading,error,refresh}=useEvents();
 const [favorites,setFavorites]=useState([]);
 useEffect(()=>{
  const update=()=>setFavorites(readFavorites());
  update();window.addEventListener('meets-favorites-changed',update);window.addEventListener('storage',update);
  return()=>{window.removeEventListener('meets-favorites-changed',update);window.removeEventListener('storage',update);};
 },[]);
 const all=data?.events||[];
 const picks=useMemo(()=>homePicks(all,rigaTodayIso()),[all]);
 const saved=useMemo(()=>{
  const ids=new Set(favorites);
  return all.filter(e=>ids.has(String(e.id))).sort((a,b)=>String(a.date_from||'').localeCompare(String(b.date_from||''))).slice(0,4);
 },[all,favorites]);
 return <section className="meets-home-discovery" aria-labelledby="featured-events-title">
  <div className="meets-home-featured-layout">
   <div className="meets-home-featured-main">
    <header className="meets-home-section-header"><div><p className="eyebrow">Ko piedzīvot</p><h2 id="featured-events-title">Tuvākajās dienās</h2></div><Link href="/pasakumi">Skatīt visus <span aria-hidden="true">→</span></Link></header>
    {error&&<p className="meets-discovery-error" role="alert">{error} <button type="button" onClick={refresh}>Mēģināt vēlreiz</button></p>}
    {loading&&!data?(fallback||<div className="meets-home-loading" role="status">Ielādējam aktuālos pasākumus…</div>):
     picks.length?<div className="meets-discovery-grid">{picks.map(event=><DiscoveryEventCard key={event.id} event={event} actions/>)}</div>:
     <div className="meets-home-empty"><strong>Tuvākajām dienām pasākumu pagaidām nav.</strong><p>Apskati kartē, kas notiek tev tuvumā.</p><Link className="button primary" href="/karte">Atvērt karti →</Link></div>}
   </div>
   <aside className="meets-home-side" aria-label="Personiskie pasākumu ieteikumi">
    <div className="meets-home-side-card meets-home-tip">
     <span className="meets-home-side-icon" aria-hidden="true"><Icon name="spark" size={20}/></span>
     <h3>Ceļo? meets.lv ceļo līdzi.</h3>
     <p>Jauna pilsēta, jauns saraksts. Atver karti un redzi, kas notiek turpat blakus.</p>
     <Link href="/karte">Izpētīt kartē <span aria-hidden="true">→</span></Link>
    </div>
    <div className="meets-home-side-card">
     <div className="meets-home-side-head"><h3>Saglabātie</h3><Link href="/mani-pasakumi">Skatīt visus →</Link></div>
     {saved.length?<div className="meets-home-saved-list">{saved.map(e=><Link href={eventPath(e)} key={e.id}>
      {cardImage(e)?<img src={cardImage(e)} alt="" loading="lazy"/>:<span className="meets-saved-fallback" aria-hidden="true"><Icon name="spark" size={18}/></span>}
      <span><strong>{e.title}</strong><small>{cardDate(e)} · {cardLocation(e)}</small></span>
     </Link>)}</div>:<p className="meets-muted">Saglabā pasākumu ar sirsniņu, un tas parādīsies šeit.</p>}
    </div>
    <div className="meets-home-side-card">
     <div className="meets-home-side-head"><h3>Seko rīkotājiem</h3><Link href="/sekosana">Atvērt →</Link></div>
     <p className="meets-muted">Seko norises vietām un rīkotājiem, un viņu jaunie pasākumi būs vienuviet.</p>
     <Link className="meets-side-inline-action" href="/sekosana">Mana sekošana →</Link>
    </div>
   </aside>
  </div>
 </section>;
}
