'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import Icon from '../components/line-icon.jsx';
import {PersonalEventRow} from '../components/personal-event-row.jsx';
import {useEvents} from '../../lib/use-events.js';
import {rigaTodayIso} from '../../lib/event-date.js';

const FAVORITES='meets_favorites_v1';
function readFavorites(){
 try{const ids=JSON.parse(localStorage.getItem(FAVORITES)||'[]');return Array.isArray(ids)?ids.map(String):[];}
 catch{return [];}
}

// Events saved with the heart in this browser, for visitors without an account.
// Signing in adds them to the account (mani-pasakumi/page.jsx, `merged`).
export function useSavedHere(){
 const [ids,setIds]=useState(null);
 useEffect(()=>{
  const update=()=>setIds(readFavorites());
  update();window.addEventListener('meets-favorites-changed',update);window.addEventListener('storage',update);
  return()=>{window.removeEventListener('meets-favorites-changed',update);window.removeEventListener('storage',update);};
 },[]);
 const {data,loading}=useEvents();
 const today=rigaTodayIso();
 const events=useMemo(()=>{
  const chosen=new Set(ids||[]);
  return (data?.events||[]).filter(e=>chosen.has(String(e.id))&&String(e.date_to||e.date_from||'')>=today)
   .sort((a,b)=>String(a.date_from||'9999').localeCompare(String(b.date_from||'9999'))||String(a.time_from||'99').localeCompare(String(b.time_from||'99')));
 },[data,ids,today]);
 return {ids:ids||[],events,ready:ids!==null&&!(loading&&!data)};
}

// The saved list without an account: on /mani-pasakumi (the page's own heading)
// and at the top of /profils ("Saglabātie (N)", the sign-in under it).
export default function GuestSaved({title='Saglabātie pasākumi',heading='h1',withCount=false,signInHref='#pieslegties'}){
 const {ids,events,ready}=useSavedHere();
 const Heading=heading;
 return <section className="meets-guest-saved" aria-labelledby="guest-saved-title">
  <Heading id="guest-saved-title">{title}{withCount&&ready?' ('+events.length+')':''}</Heading>
  {!ready?<p className="meets-muted" role="status">Ielādē saglabātos pasākumus…</p>
   :ids.length===0?<div className="meets-guest-empty">
    <p>Saglabā pasākumu ar sirsniņu, un tas parādīsies šeit.</p>
    <Link className="button primary" href="/pasakumi">Atrast pasākumus</Link>
   </div>
   :<>
    <div className="meets-guest-note">
     <p><Icon name="heart" size={16}/>Saglabāti šajā pārlūkā. Pieslēdzies, lai tie būtu visās ierīcēs.</p>
     <Link className="button" href={signInHref}>Pieslēgties</Link>
    </div>
    {events.length?<ul className="event-link-list elist">{events.map(e=><PersonalEventRow key={e.id} event={e} badges={['Saglabāts']}/>)}</ul>
     :<p className="meets-muted">Saglabātie pasākumi jau ir beigušies. <Link href="/pasakumi">Atrast jaunus</Link></p>}
   </>}
 </section>;
}
