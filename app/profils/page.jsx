'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import ProfileShell,{ProfileIcon} from '../components/profile-shell.jsx';
import Authentication from '../components/account-auth-flow.jsx';
import {useEvents} from '../../lib/use-events.js';
import {rigaDate} from '../../lib/meets-personal.js';

const KEY='meets_user_session_v1';
function fromStorage(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}}
function friendlyStatus(status){
 return ({draft:'Melnraksts',pending_review:'Pārbaudē',published:'Publicēts',rejected:'Jālabo',closed:'Slēgts',archived:'Arhivēts'})[status]||'Iesniegts';
}
async function post(endpoint,action,token,other={}){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
  body:JSON.stringify({action,token,...other})});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(payload.error||'Datus neizdevās ielādēt.');error.status=response.status;throw error;}
 return payload;
}
async function combined(account){
 const [personal,organizer,registries]=await Promise.allSettled([
  post('/api/account','list',account.access_token),
  post('/api/organizer','list',account.access_token),
  post('/api/registries','list',account.access_token)
 ]);
 const unauthorized=[personal,organizer,registries].some(x=>x.status==='rejected'&&x.reason?.status===401);
 return {
  unauthorized,
  personal:personal.status==='fulfilled'?personal.value:null,
  organizer:organizer.status==='fulfilled'?organizer.value:null,
  registries:registries.status==='fulfilled'?registries.value:null,
  failures:[personal,organizer,registries].filter(x=>x.status==='rejected').length
 };
}
function Metric({number,label,icon}){return <div className="meets-profile-stat">
 <ProfileIcon name={icon} size={19}/><strong className="meets-profile-stat-number">{number??'—'}</strong>
 <span className="meets-profile-stat-label">{label}</span></div>;}
function SubmissionList({submissions}){
 return submissions?.length?<div>{submissions.slice(0,4).map(item=><div className="meets-profile-row" key={item.id}>
  <span className="meets-profile-day"><ProfileIcon name="calendar"/></span>
  <div className="meets-profile-row-meta"><strong>{item.title}</strong>
   <small>{item.date_from||'Datums nav norādīts'} · {item.venue_name||'Norises vieta nav norādīta'}</small></div>
  <span className={'meets-profile-status '+(item.status==='pending_review'?'pending':item.status==='published'?'published':'')}>
   {friendlyStatus(item.status)}</span>
 </div>)}</div>:<div className="meets-profile-empty">Vēl neesi iesniedzis pasākumu. Izveido pirmo dažu soļu laikā.</div>;
}
function Overview({session,state,profileName,onNameChange,onSaveName,onLogout,saving,nameNotice}){
 const {data:eventData}=useEvents();
 const saved=state?.personal||null,org=state?.organizer||null,registry=state?.registries||null;
 const events=eventData?.events||[];
 const eventById=useMemo(()=>new Map(events.map(e=>[e.id,e])),[events]);
 const upcoming=useMemo(()=>saved?[...new Set([...(saved.plans||[]),...(saved.favorites||[])])]
  .map(id=>eventById.get(id)).filter(e=>e&&String(e.date_to||e.date_from)>=rigaDate())
  .sort((a,b)=>String(a.date_from).localeCompare(String(b.date_from))).slice(0,3):[],[saved,eventById]);
 const submissions=org?.submissions?.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))||[];
 const venues=org?.venues||[];
 const registries=registry?.registries||[];
 const email=session?.user?.email||'';
 const display=(registry?.profile?.display_name||'').trim();
 const nickname=display||email.split('@')[0]||'MEETS lietotājs';
 const first=(display||email).slice(0,1).toLocaleUpperCase('lv')||'M';
 return <ProfileShell session={session} displayName={display}>
  <div className="meets-profile-overview">
   <div className="meets-profile-page-head">
    <div><p className="eyebrow">Tavs MEETS</p><h1>Mans profils</h1><p>Viss, ko plāno, saglabā un organizē, vienuviet.</p></div>
    <Link href="/registre-pasakumu/vienkarsi" className="meets-profile-top-cta"><ProfileIcon name="plus"/> Jauns pasākums</Link>
   </div>
   <div className="meets-profile-hero">
    <div className="meets-profile-avatar" aria-hidden="true">{first}</div>
    <div className="meets-profile-hero-info"><strong>{nickname}</strong><small>{email}</small></div>
    <span className="meets-profile-pill">Mans MEETS konts</span>
   </div>
   {state?.failures>0&&<div role="status" className="meets-profile-alert">Daļu informācijas neizdevās ielādēt. Pārējās sadaļas joprojām ir pieejamas.</div>}
   <div className="meets-profile-stats" aria-label="Mana konta kopsavilkums">
    <Metric icon="heart" number={saved?.favorites?.length} label="Favorīti"/>
    <Metric icon="calendar" number={saved?.plans?.length} label="Plānotie"/>
    <Metric icon="list" number={org?.submissions?.length} label="Mani pasākumi"/>
    <Metric icon="pin" number={org?.venues?.length} label="Norises vietas"/>
    <Metric icon="map" number={registry?.registries?.length} label="Mani reģistri"/>
   </div>
   <div className="meets-profile-columns">
    <div className="meets-profile-stack">
     <section className="meets-profile-panel">
      <div className="meets-profile-panel-header"><h2>Mani tuvākie pasākumi</h2><Link href="/mani-pasakumi">Visi saglabātie →</Link></div>
      {!saved?<div className="meets-profile-empty">Saglabāto pasākumu dati nav pieejami.</div>:
       upcoming.length?upcoming.map(event=><div className="meets-profile-row" key={event.id}>
        <span className="meets-profile-day"><strong>{event.date_from?.slice(8,10)}</strong><small>{event.date_from?.slice(5,7)}.</small></span>
        <div className="meets-profile-row-meta"><strong>{event.title}</strong>
         <small>{[event.time_from?.slice(0,5),event.venue_name||event.municipality].filter(Boolean).join(' · ')}</small></div>
        <Link href={'/karte?event='+encodeURIComponent(event.id)}>Kartē ↗</Link>
       </div>):<div className="meets-profile-empty">Vēl nav gaidāmu saglabātu pasākumu. <Link href="/karte">Atrodi pasākumu kartē →</Link></div>}
     </section>
     <section className="meets-profile-panel">
      <div className="meets-profile-panel-header"><h2>Mani izveidotie pasākumi</h2><Link href="/organizators">Pārvaldīt →</Link></div>
      {!org?<div className="meets-profile-empty">Organizatora dati nav pieejami.</div>:<SubmissionList submissions={submissions}/>}
     </section>
     <section className="meets-profile-panel">
      <div className="meets-profile-panel-header"><h2>Mani pasākumu reģistri</h2><Link href="/mani-registri">Visi reģistri →</Link></div>
      {!registry?<div className="meets-profile-empty">Reģistru dati nav pieejami.</div>:
       registries.length?registries.slice(0,3).map(item=><div className="meets-profile-row" key={item.id}>
        <span className="meets-profile-day"><ProfileIcon name="list"/></span>
        <div className="meets-profile-row-meta"><strong>{item.title}</strong><small>{item.is_published?'Publisks reģistrs':'Privāts reģistrs'}</small></div>
        <Link href="/mani-registri">Atvērt →</Link>
       </div>):<div className="meets-profile-empty">Vēl nav reģistru. Saglabā atlasītus pasākumus un iegulsti tos savā mājaslapā.</div>}
     </section>
    </div>
    <div className="meets-profile-stack">
     <section className="meets-profile-panel">
      <div className="meets-profile-panel-header"><h2>Ātrās darbības</h2></div>
      <div className="meets-profile-quick-grid">
       <Link className="meets-profile-quick" href="/registre-pasakumu/vienkarsi"><ProfileIcon name="plus" size={22}/> Pievienot pasākumu</Link>
       <Link className="meets-profile-quick" href="/registre-vietu"><ProfileIcon name="pin" size={22}/> Pievienot vietu</Link>
       <Link className="meets-profile-quick" href="/mani-registri"><ProfileIcon name="list" size={22}/> Veidot reģistru</Link>
       <Link className="meets-profile-quick" href="/karte"><ProfileIcon name="map" size={22}/> Meklēt kartē</Link>
      </div>
     </section>
     <section className="meets-profile-panel">
      <div className="meets-profile-panel-header"><h2>Manas norises vietas</h2><Link href="/organizators?panel=venues">Pārvaldīt →</Link></div>
      {!org?<p className="meets-profile-empty">Vietu dati nav pieejami.</p>:
       venues.length?venues.slice(0,3).map(venue=><div key={venue.id} className="meets-profile-row">
        <span className="meets-profile-day"><ProfileIcon name="pin"/></span>
        <div className="meets-profile-row-meta"><strong>{venue.name}</strong><small>{venue.is_public?'Publiska vieta':'Privāta vieta'} · {venue.address||'Nav adreses'}</small></div>
        {venue.is_public&&<Link href={'/vietas/'+venue.id}>Kalendārs ↗</Link>}
       </div>):<div className="meets-profile-empty">Vēl nav reģistrētu vietu. <Link href="/registre-vietu">Pievieno pirmo →</Link></div>}
     </section>
     <section className="meets-profile-panel">
      <div className="meets-profile-panel-header"><h2>Profila iestatījumi</h2></div>
      <form className="meets-profile-settings-fields" onSubmit={onSaveName}>
       <label>Profila nosaukums<input value={profileName} maxLength={100} onChange={e=>onNameChange(e.target.value)} placeholder="Vārds vai organizatora nosaukums"/></label>
       <label>E-pasts<input value={email} readOnly/></label>
       <button className="button" type="submit" disabled={saving}>{saving?'Saglabā…':'Saglabāt profilu'}</button>
      </form>
      {nameNotice&&<p className="meets-profile-hint" role="status">{nameNotice}</p>}
      <div style={{marginTop:17,paddingTop:14,borderTop:'1px solid #ebe6f3'}}>
       <button className="button" type="button" onClick={onLogout}><ProfileIcon name="logout" size={16}/> Iziet no konta</button>
      </div>
     </section>
    </div>
   </div>
  </div>
 </ProfileShell>;
}
export default function ProfilePage(){
 const [account,setAccount]=useState(null),[state,setState]=useState(null),[loading,setLoading]=useState(true);
 const [profileName,setProfileName]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState(''),[nameNotice,setNameNotice]=useState('');
 const load=useCallback(async(initial)=>{
  let session=initial;
  let data=await combined(session);
  if(data.unauthorized&&session.refresh_token){
   const refreshed=await post('/api/account','refresh',session.refresh_token);
   session=refreshed;
   localStorage.setItem(KEY,JSON.stringify({...refreshed,expires_at:Date.now()+(refreshed.expires_in||3600)*1000}));
   window.dispatchEvent(new Event('meets-user-changed'));
   data=await combined(session);
  }
  if(data.unauthorized)throw Error('Sesija beigusies. Pieslēdzies atkārtoti.');
  setAccount(session);setState(data);setProfileName(data.registries?.profile?.display_name||'');
 },[]);
 useEffect(()=>{let active=true;
  const session=fromStorage();
  if(!session?.access_token){setLoading(false);return;}
  (async()=>{try{await load(session);}catch(e){if(active){setAccount(null);setError(e.message);}}finally{if(active)setLoading(false);}})();
  return()=>{active=false;};
 },[load]);
 async function onLogin(value){setError('');setLoading(true);
  try{await load(value);}catch(e){setError(e.message);}
  finally{setLoading(false);}
 }
 async function onSaveName(event){event.preventDefault();if(!account)return;
  setSaving(true);setError('');setNameNotice('');
  try{const data=await post('/api/registries','profile',account.access_token,{display_name:profileName});
   setState(prev=>({...prev,registries:{...prev.registries,profile:data.profile}}));
   setNameNotice('Profils saglabāts.');
  }catch(e){setNameNotice('Profila saglabāšana neizdevās. '+e.message);}
  finally{setSaving(false);}
 }
 function logout(){localStorage.removeItem(KEY);window.dispatchEvent(new Event('meets-user-changed'));setAccount(null);setState(null);setProfileName('');}
 if(loading)return <div className="meets-profile-skeleton" role="status">Ielādē tavu MEETS profilu…</div>;
 if(!account)return <section className="meets-profile-auth"><p className="eyebrow">Mans MEETS</p><h1 style={{fontSize:34}}>Mans profils</h1>
   <p className="meets-muted">Pieslēdzies, lai vienuviet redzētu savus pasākumus, organizācijas, norises vietas un reģistrus.</p>
   {error&&<p className="meets-profile-error" role="alert">{error}</p>}
   <Authentication onSuccess={onLogin}/></section>;
 return <><Overview session={account} state={state} profileName={profileName} onNameChange={setProfileName} onSaveName={onSaveName}
   onLogout={logout} saving={saving} nameNotice={nameNotice}/></>;
}
