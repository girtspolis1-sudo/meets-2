'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import ProfileShell,{ProfileIcon} from '../components/profile-shell.jsx';
import Authentication from '../components/account-auth-flow.jsx';
import {useEvents} from '../../lib/use-events.js';
import {rigaDate} from '../../lib/meets-personal.js';
import {PersonalEventList} from '../components/personal-event-row.jsx';

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
 const personal=state?.personal||{},dashboard=state?.dashboard||{},lists=(state?.registries?.registries||[]).filter(x=>!x.organization_id),orgs=state?.organizer?.organizations||[];
 const favoriteIds=new Set(personal.favorites||[]),planIds=new Set(personal.plans||[]);
 const collectionIds=new Set(lists.flatMap(x=>x.included_event_ids||[]));
 const isUpcoming=e=>e?.date_from&&String(e.date_to||e.date_from)>=rigaDate();
 const byDate=(a,b)=>String(a.date_from||'9999').localeCompare(String(b.date_from||'9999'));
 const favorites=[...favoriteIds].map(id=>byId.get(id)).filter(isUpcoming).sort(byDate);
 const planned=[...planIds].map(id=>byId.get(id)).filter(isUpcoming).sort(byDate);
 const collectionEvents=[...collectionIds].map(id=>byId.get(id)).filter(isUpcoming).sort(byDate);
 const left=favorites.slice(0,5);
 const leftIds=new Set(left.map(e=>e.id));
 const right=[...new Map([...planned,...collectionEvents].filter(e=>!leftIds.has(e.id)).map(e=>[e.id,e])).values()].sort(byDate).slice(0,5);
 const badgesFor=e=>[favoriteIds.has(e.id)?'Favorīts':null,planIds.has(e.id)?'Plānoju':null,collectionIds.has(e.id)?'Sarakstā':null].filter(Boolean);
 const display=(state?.registries?.profile?.display_name||'').trim(),email=account?.user?.email||'';

 if(loading)return <div className="meets-profile-skeleton" role="status">Ielādē tavu MEETS profilu…</div>;
 if(!account)return <section className="meets-profile-auth" aria-labelledby="meets-auth-title"><p className="eyebrow">MANS MEETS</p><h1 id="meets-auth-title">Tavs MEETS vienuviet</h1><p className="meets-auth-intro">Saglabā pasākumus un veido savus plānus.</p>{error&&<p className="meets-profile-error" role="alert">{error}</p>}<Authentication variant="profile" onSuccess={login}/></section>;

 return <ProfileShell session={account} displayName={display}><div className="meets-profile-overview">
  <section className="meets-profile-summary" aria-labelledby="profile-overview-heading">
    <div className="meets-profile-summary-heading"><div><p className="eyebrow">MANS MEETS</p><h1 id="profile-overview-heading">Pārskats</h1></div><Link href="/karte" className="meets-profile-summary-action"><ProfileIcon name="map"/> Atrast pasākumu</Link></div>
    <div className="meets-profile-summary-stats" aria-label="Tavs MEETS pārskats">
      <Metric icon="heart" number={personal.favorites?.length} label="Saglabāti" href="/mani-pasakumi"/>
      <Metric icon="calendar" number={personal.plans?.length} label="Plānoti" href="/mani-pasakumi"/>
      <Metric icon="list" number={lists.length} label="Mani saraksti" href="/mani-registri?tab=lists"/>

    </div>
  </section>
  <div className="meets-profile-columns meets-unified-columns">
   <section className="meets-profile-panel">
    <div className="meets-profile-panel-header"><h2>Tuvākie favorīti</h2><Link href="/mani-pasakumi">Visi →</Link></div>
    <PersonalEventList events={left} badgesFor={badgesFor} empty="Pagaidām nav gaidāmu favorītu."/>
   </section>
   <section className="meets-profile-panel">
    <div className="meets-profile-panel-header"><h2>Plānotie un sarakstos</h2><Link href="/mani-registri?tab=lists">Saraksti →</Link></div>
    <PersonalEventList events={right} badgesFor={badgesFor} empty="Nav gaidāmu plānotu pasākumu vai pasākumu sarakstos."/>
   </section>
  </div>
  <div className="meets-unified-secondary">
   <section className="meets-profile-panel"><div className="meets-profile-panel-header"><h2>Manas kolekcijas</h2><Link href="/mani-registri?tab=lists">Pārvaldīt →</Link></div>
    {lists.length?lists.slice(0,3).map(x=><Link className="meets-unified-collection" href={'/mani-registri?tab=lists&edit='+encodeURIComponent(x.id)} key={x.id}><span>{x.title}</span><small>{(x.included_event_ids||[]).length} pasākumi · {x.is_published?'Publisks':'Privāts'}</small></Link>):<p className="meets-profile-empty">Vēl nav kolekciju.</p>}
   </section>

  </div>

 </div></ProfileShell>;
}
