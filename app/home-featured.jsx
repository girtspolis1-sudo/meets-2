'use client';
import Icon from './components/line-icon.jsx';
import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useEvents} from '../lib/use-events.js';
import {eventPath} from '../lib/seo.js';
import {cardDate,cardImage,cardLocation} from '../lib/discovery-card.js';
import {rigaTodayIso} from '../lib/event-date.js';
import {HOME_PERIODS,gameSports,homeGames,homeSelection} from '../lib/home-picks.js';
import {QUICK_PLACES,NEAR_PLACES,distanceKm} from '../lib/event-calendar.js';
import {sportIcon} from '../lib/event-map-icons.js';
import {SPORTS_PATH,YOUTH_SPORTS_PATH} from '../lib/nav-sections.js';
import DiscoveryEventCard from './components/discovery-event-card.jsx';

const FAVORITES='meets_favorites_v1';
const SESSION='meets_user_session_v1';
// The place is shared with the map and the catalogue.
const LOCATION_CHOICE='meets_location_choice_v1';
// "Visa Latvija" is stored the way the map stores it: Rīga as the fallback centre.
const WHOLE_COUNTRY={lat:56.9496,lon:24.1052,label:'Rīgas centrs',source:'fallback'};

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function readFavorites(){const ids=readJson(FAVORITES,[]);return Array.isArray(ids)?ids.map(String):[];}
function readPlace(){
 const raw=readJson(LOCATION_CHOICE,null);
 return raw&&raw.source!=='fallback'&&Number.isFinite(raw.lat)&&Number.isFinite(raw.lon)?raw:null;
}
// The chip of a stored place: 'me', a town's key, or 'custom' (a place chosen on the map).
function placeKey(place){
 if(!place)return '';
 if(place.source==='browser')return 'me';
 return NEAR_PLACES.find(p=>distanceKm(p,place)<1)?.key||'custom';
}

// The home page under the hero: the "Kur un kad" bar, "Tuvākajās dienās" with the
// saved and followed cards beside it, and "Spēles šonedēļ". initial* are the same
// lists rendered on the server (no place, no period), shown until the catalogue
// loads here, so the page does not jump and works without JavaScript.
export default function HomeFeatured({initialPicks=[],initialGames=[],initialSports=[]}){
 const {data,loading,error,refresh}=useEvents();
 const [place,setPlace]=useState(null),[period,setPeriod]=useState(''),[sport,setSport]=useState('');
 const [note,setNote]=useState(''),[locating,setLocating]=useState(false);
 const [favorites,setFavorites]=useState([]),[follows,setFollows]=useState(0);
 const placesRef=useRef(null);
 useEffect(()=>{
  setPlace(readPlace());
  const update=()=>setFavorites(readFavorites());
  update();window.addEventListener('meets-favorites-changed',update);window.addEventListener('storage',update);
  return()=>{window.removeEventListener('meets-favorites-changed',update);window.removeEventListener('storage',update);};
 },[]);
 // Following is kept in the account: the card shows only when something is followed.
 useEffect(()=>{
  const token=readJson(SESSION,null)?.access_token;if(!token)return;
  let alive=true;
  fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'dashboard',token})})
   .then(r=>r.ok?r.json():null).then(b=>{if(alive&&b)setFollows((b.follows||[]).length);}).catch(()=>{});
  return()=>{alive=false;};
 },[]);

 // The chosen place's chip is scrolled into the row's view (the row scrolls sideways on phones).
 useEffect(()=>{
  const row=placesRef.current,active=row?.querySelector('.meets-home-chip.active');
  if(row&&active&&row.scrollWidth>row.clientWidth)row.scrollLeft+=active.getBoundingClientRect().left-row.getBoundingClientRect().left-48;
 },[place]);
 function choose(next){
  setPlace(next);setNote('');
  try{localStorage.setItem(LOCATION_CHOICE,JSON.stringify(next||WHOLE_COUNTRY));}catch{}
 }
 function chooseMe(){
  if(!navigator.geolocation){setNote('Pārlūks nevar noteikt atrašanās vietu. Izvēlies pilsētu.');return;}
  setLocating(true);setNote('Nosaka atrašanās vietu…');
  navigator.geolocation.getCurrentPosition(
   position=>{setLocating(false);choose({lat:position.coords.latitude,lon:position.coords.longitude,label:'Mana atrašanās vieta',source:'browser'});},
   ()=>{setLocating(false);setNote('Atrašanās vietu neizdevās noteikt. Izvēlies pilsētu.');},
   {enableHighAccuracy:false,timeout:10000,maximumAge:600000});
 }

 const all=data?.events,today=rigaTodayIso();
 const selection=useMemo(()=>all?homeSelection(all,today,{origin:place,period}):{events:initialPicks,radius:0},[all,today,place,period,initialPicks]);
 const games=useMemo(()=>all?homeGames(all,today,{origin:place,sport})
  :initialGames.filter(e=>!sport||sportIcon(e)?.label===sport),[all,today,place,sport,initialGames]);
 const sports=useMemo(()=>all?gameSports(all,today):initialSports,[all,today,initialSports]);
 const saved=useMemo(()=>{
  const ids=new Set(favorites);
  return (all||[]).filter(e=>ids.has(String(e.id))).sort((a,b)=>String(a.date_from||'').localeCompare(String(b.date_from||''))).slice(0,4);
 },[all,favorites]);

 const key=placeKey(place);
 const periodLabel=HOME_PERIODS.find(([k])=>k===period)?.[1]||'';
 const heading=!place?'Tuvākajās dienās':place.source==='browser'?'Tev tuvumā':'Tuvumā: '+place.label;
 const allHref='/pasakumi'+(period?'?period='+period:'');
 const side=saved.length>0||follows>0;
 const chip=(active,label,onClick,extra={})=><button type="button" className={'meets-home-chip'+(active?' active':'')} aria-pressed={active} onClick={onClick} {...extra}>{label}</button>;

 return <>
  <section className="meets-home-where" aria-label="Kur un kad">
   <div ref={placesRef} className="meets-home-chip-row" role="group" aria-label="Kur">
    {chip(key==='me',<><Icon name="locate" size={16}/>{locating?'Nosaka…':'Mana atrašanās vieta'}</>,chooseMe,{disabled:locating})}
    {chip(!place,'Visa Latvija',()=>choose(null))}
    {key==='custom'&&chip(true,place.label,()=>{})}
    {QUICK_PLACES.map(p=><span key={p.key} className="meets-home-chip-slot">{chip(key===p.key,p.label,()=>choose({lat:p.lat,lon:p.lon,label:p.label,source:'place'}))}</span>)}
   </div>
   <div className="meets-home-chip-row" role="group" aria-label="Kad">
    {chip(!period,'Tuvākās dienas',()=>setPeriod(''))}
    {HOME_PERIODS.map(([k,label])=><span key={k} className="meets-home-chip-slot">{chip(period===k,label,()=>setPeriod(period===k?'':k))}</span>)}
   </div>
   {note&&<p className="meets-home-where-note" role="status">{note}</p>}
  </section>

  <section className="meets-home-discovery" aria-labelledby="featured-events-title">
   <div className={'meets-home-featured-layout'+(side?'':' no-side')}>
    <div className="meets-home-featured-main">
     <header className="meets-home-section-header"><div><p className="eyebrow">{periodLabel||'Ko piedzīvot'}</p><h2 id="featured-events-title">{heading}</h2>
      {place&&selection.radius>50&&<p className="meets-home-radius">Tuvākie pasākumi līdz {selection.radius} km</p>}</div>
      <Link href={allHref}>Skatīt visus <span aria-hidden="true">→</span></Link></header>
     {error&&<p className="meets-discovery-error" role="alert">{error} <button type="button" onClick={refresh}>Mēģināt vēlreiz</button></p>}
     {loading&&!data&&!initialPicks.length?<div className="meets-home-loading" role="status">Ielādējam aktuālos pasākumus…</div>:
      selection.events.length?<div className="meets-discovery-grid">{selection.events.map(event=><DiscoveryEventCard key={event.id} event={event} actions/>)}</div>:
      <div className="meets-home-empty"><strong>{periodLabel?periodLabel+' pasākumu šeit pagaidām nav.':'Tuvākajām dienām pasākumu pagaidām nav.'}</strong>
       <p>{periodLabel?'Apskati tuvākās dienas vai visu Latviju.':'Apskati kartē, kas notiek tev tuvumā.'}</p>
       {periodLabel?<button type="button" className="button" onClick={()=>setPeriod('')}>Rādīt tuvākās dienas</button>:<Link className="button primary" href="/karte">Atvērt karti →</Link>}</div>}
    </div>
    {side&&<aside className="meets-home-side" aria-label="Tavi pasākumi">
     {saved.length>0&&<div className="meets-home-side-card">
      <div className="meets-home-side-head"><h3>Saglabātie</h3><Link href="/mani-pasakumi">Skatīt visus →</Link></div>
      <div className="meets-home-saved-list">{saved.map(e=><Link href={eventPath(e)} key={e.id}>
       {cardImage(e)?<img src={cardImage(e)} alt="" loading="lazy"/>:<span className="meets-saved-fallback" aria-hidden="true"><Icon name="heart" size={18}/></span>}
       <span><strong>{e.title}</strong><small>{cardDate(e)} · {cardLocation(e)}</small></span>
      </Link>)}</div>
     </div>}
     {follows>0&&<div className="meets-home-side-card">
      <div className="meets-home-side-head"><h3>Seko</h3><Link href="/sekosana">Atvērt →</Link></div>
      <p className="meets-muted">Tu seko {follows} {follows%10===1&&follows%100!==11?'vietai vai rīkotājam':'vietām un rīkotājiem'}. Viņu jaunie pasākumi ir vienuviet.</p>
     </div>}
    </aside>}
   </div>
  </section>

  {(games.length>0||sport)&&<section className="meets-home-games" aria-labelledby="home-games-title">
   <header className="meets-home-section-header"><div><p className="eyebrow">Sports</p><h2 id="home-games-title">Spēles šonedēļ</h2></div>
    <Link href={SPORTS_PATH}>Visas spēles <span aria-hidden="true">→</span></Link></header>
   {sports.length>1&&<div className="meets-home-chip-row" role="group" aria-label="Sporta veids">
    {chip(!sport,'Visi',()=>setSport(''))}
    {sports.map(s=><span key={s.label} className="meets-home-chip-slot">{chip(sport===s.label,<>{s.label} <small>{s.count}</small></>,()=>setSport(sport===s.label?'':s.label))}</span>)}
   </div>}
   {games.length?<div className="meets-discovery-grid">{games.map(event=><DiscoveryEventCard key={event.id} event={event} actions/>)}</div>
    :<p className="meets-muted">Šonedēļ šim sporta veidam spēļu nav.</p>}
   <p className="meets-home-games-links"><Link href={SPORTS_PATH}>Visas spēles →</Link><Link href={YOUTH_SPORTS_PATH}>Jauniešu sports →</Link></p>
  </section>}
 </>;
}
