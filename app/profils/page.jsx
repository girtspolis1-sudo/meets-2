'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import ProfileShell,{ProfileIcon} from '../components/profile-shell.jsx';
import Authentication from '../components/account-auth-flow.jsx';
import {useEvents} from '../../lib/use-events.js';
import {rigaDate} from '../../lib/meets-personal.js';
import {PersonalEventList} from '../components/personal-event-row.jsx';
import {eventsAtPlace} from '../../lib/location-follow.js';

const KEY='meets_user_session_v1';
function fromStorage(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}}
async function post(endpoint,action,token,other={}){
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action,token,...other})});
 const b=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(b.error||'Datus neizdevās ielādēt.');e.status=r.status;throw e;}return b;
}
async function loadAll(account){
 const [personal,dashboard,registries,organizer]=await Promise.all([
  post('/api/account','list',account.access_token),
  post('/api/account','dashboard',account.access_token),
  post('/api/registries','list',account.access_token),
  post('/api/organizer','list',account.access_token)
 ]);
 return {personal,dashboard,registries,organizer};
}
function Metric({number,label,icon,href}){return <Link href={href} className="meets-profile-stat"><ProfileIcon name={icon} size={19}/><strong className="meets-profile-stat-number">{number??0}</strong><span className="meets-profile-stat-label">{label}</span></Link>;}

export default function ProfilePage(){
 const {data:eventData}=useEvents();
 const [account,setAccount]=useState(null),[state,setState]=useState(null),[loading,setLoading]=useState(true);
 const [error,setError]=useState('');

 const load=useCallback(async(initial)=>{
  let session=initial,data;
  try{data=await loadAll(session);}
  catch(e){
   if(e.status!==401||!session.refresh_token)throw e;
   const refreshed=await post('/api/account','refresh',session.refresh_token);
   session={...refreshed,expires_at:Date.now()+(refreshed.expires_in||3600)*1000};
   localStorage.setItem(KEY,JSON.stringify(session));window.dispatchEvent(new Event('meets-user-changed'));
   data=await loadAll(session);
  }
  setAccount(session);setState(data);
 },[]);
 useEffect(()=>{let active=true;const session=fromStorage();if(!session?.access_token){setLoading(false);return;}
  (async()=>{try{await load(session);}catch(e){if(active){setAccount(null);setError(e.message);}}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[load]);

 async function login(value){setLoading(true);setError('');try{await load(value);}catch(e){setError(e.message);}finally{setLoading(false);}}
 const events=eventData?.events||[],byId=useMemo(()=>new Map([...(state?.dashboard?.savedDetails||[]).map(e=>[e.id,e]),...events.map(e=>[e.id,e])]),[events,state]);
 const personal=state?.personal||{},dashboard=state?.dashboard||{};
 const favoriteIds=new Set(personal.favorites||[]),planIds=new Set(personal.plans||[]);
 const followedIds=new Set([...(dashboard.followedEvents||[]),...(dashboard.locationFollows||[]).flatMap(place=>eventsAtPlace(events,place.location_key).map(e=>e.id))]);
 const isUpcoming=e=>e?.date_from&&String(e.date_to||e.date_from)>=rigaDate();
 const byDate=(a,b)=>String(a.date_from||'9999').localeCompare(String(b.date_from||'9999'));
 const visibleIds=[...new Set([...favoriteIds,...planIds,...followedIds])];
 const allUpcoming=visibleIds.map(id=>byId.get(id)).filter(isUpcoming).sort(byDate).slice(0,12);
 const badgesFor=e=>[favoriteIds.has(e.id)?'Favorīts':null,planIds.has(e.id)?'Plānoju':null,followedIds.has(e.id)?'No sekošanas':null].filter(Boolean);
 const followedPlaces=(dashboard.locationFollows||[]).length;
 const followedTargets=(dashboard.follows||[]).filter(x=>['organization','venue'].includes(x.target_kind)).length;
 const display=(state?.registries?.profile?.display_name||'').trim(),email=account?.user?.email||'';

 if(loading)return <div className="meets-profile-skeleton" role="status">Ielādē tavu MEETS profilu…</div>;
 if(!account)return <section className="meets-profile-auth" aria-labelledby="meets-auth-title"><p className="eyebrow">MANS MEETS</p><h1 id="meets-auth-title">Tavs MEETS vienuviet</h1><p className="meets-auth-intro">Saglabā pasākumus un veido savus plānus.</p>{error&&<p className="meets-profile-error" role="alert">{error}</p>}<Authentication variant="profile" onSuccess={login}/></section>;

 return <ProfileShell session={account} displayName={display}><div className="meets-profile-overview">
  <section className="meets-profile-summary" aria-labelledby="profile-overview-heading">
    <div className="meets-profile-summary-heading"><div><p className="eyebrow">MANS MEETS</p><h1 id="profile-overview-heading">Pārskats</h1></div><Link href="/karte" className="meets-profile-summary-action"><ProfileIcon name="map"/> Atrast pasākumu</Link></div>
    <div className="meets-profile-summary-stats" aria-label="Tavs MEETS pārskats">
      <Metric icon="heart" number={personal.favorites?.length} label="Saglabāti" href="/mani-pasakumi"/>
      <Metric icon="calendar" number={personal.plans?.length} label="Plānoti" href="/mani-pasakumi"/>
      <Metric icon="pin" number={followedPlaces+followedTargets} label="Sekoju" href="/sekosana"/>

    </div>
  </section>
  <section className="meets-profile-panel">
   <div className="meets-profile-panel-header"><h2>Mani tuvākie pasākumi</h2><Link href="/mani-pasakumi">Visi →</Link></div>
   <PersonalEventList events={allUpcoming} badgesFor={badgesFor} empty="Pagaidām nav gaidāmu saglabātu vai sekotu pasākumu."/>
  </section>

 </div></ProfileShell>;
}
