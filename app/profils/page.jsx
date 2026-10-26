'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import ProfileShell,{ProfileIcon} from '../components/profile-shell.jsx';
import PersonalAgenda from '../components/personal-agenda.jsx';
import {personalSelectionAfter} from '../../lib/personal-agenda.js';
import Authentication from '../components/account-auth-flow.jsx';
import {useEvents} from '../../lib/use-events.js';

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


export default function ProfilePage(){
 const {data:eventData,loading:eventsLoading,error:eventsError}=useEvents();
 const [account,setAccount]=useState(null),[state,setState]=useState(null),[loading,setLoading]=useState(true);
 const [secondaryOpen,setSecondaryOpen]=useState(false);
 useEffect(()=>{const sync=()=>{if(window.location.hash==='#iestatijumi')setSecondaryOpen(true);};sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
 const [profileName,setProfileName]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');

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
  setAccount(session);setState(data);setProfileName(data.registries?.profile?.display_name||'');
 },[]);
 useEffect(()=>{let active=true;const session=fromStorage();if(!session?.access_token){setLoading(false);return;}
  (async()=>{try{await load(session);}catch(e){if(active){setAccount(null);setError(e.message);}}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[load]);

 async function login(value){setLoading(true);setError('');try{await load(value);}catch(e){setError(e.message);}finally{setLoading(false);}}
 async function saveProfile(e){e.preventDefault();if(!account)return;setSaving(true);setNotice('');try{
  const data=await post('/api/registries','profile',account.access_token,{display_name:profileName});
  setState(v=>({...v,registries:{...v.registries,profile:data.profile}}));setNotice('Profila vārds saglabāts.');
 }catch(e){setNotice(e.message);}finally{setSaving(false);}}

 async function changeEvent(id,kind){
  if(saving)return;setSaving(true);setError('');
  const current=state.personal, saved=new Set([...(current.favorites||[]),...(current.plans||[])]);
  const action=kind==='plan'?(current.plans.includes(id)?'unplan':'plan'):(saved.has(id)?'remove':'add');
  try{
   await post('/api/account',action,account.access_token,{eventId:id});
   const next=personalSelectionAfter(current,id,kind);
   setState(v=>({...v,personal:{...v.personal,...next}}));
   localStorage.setItem('meets_favorites_owner_v1',account.user?.id||'');
   localStorage.setItem('meets_favorites_v1',JSON.stringify(next.favorites));
   window.dispatchEvent(new Event('meets-favorites-changed'));
  }catch(e){setError(e.message);try{const actual=await post('/api/account','list',account.access_token);setState(v=>({...v,personal:actual}));}catch{}}
  finally{setSaving(false);}
 }

 const events=useMemo(()=>[...new Map([...(state?.dashboard?.savedDetails||[]),...(eventData?.events||[])].map(e=>[e.id,e])).values()],[eventData,state?.dashboard?.savedDetails]);
 const personal=state?.personal||{},dashboard=state?.dashboard||{},lists=(state?.registries?.registries||[]).filter(x=>!x.organization_id),orgs=state?.organizer?.organizations||[];
 const follows=dashboard.follows||[],followOrg=follows.filter(x=>x.target_kind==='organization').length,followVenue=follows.filter(x=>x.target_kind==='venue').length+(dashboard.locationFollows||[]).length;
 const followedOrgIds=new Set(follows.filter(x=>x.target_kind==='organization').map(x=>x.target_id));
 const followedOrgs=(dashboard.directory?.organizations||[]).filter(x=>followedOrgIds.has(x.id)).slice(0,4);
 const display=(state?.registries?.profile?.display_name||'').trim(),email=account?.user?.email||'';

 if(loading)return <div className="meets-profile-skeleton" role="status">Ielādē tavu MEETS profilu…</div>;
 if(!account)return <section className="meets-profile-auth"><p className="eyebrow">Mans MEETS</p><h1>Mans profils</h1><p className="meets-muted">Pieslēdzies, lai saglabātu pasākumus, veidotu sarakstus un sekotu organizatoriem vai vietām.</p>{error&&<p className="meets-profile-error" role="alert">{error}</p>}<Authentication onSuccess={login}/></section>;

 return <ProfileShell session={account} displayName={display}><div className="meets-profile-overview">
  <div className="meets-profile-page-head"><div><p className="eyebrow">Mans MEETS</p><h1>Mans MEETS</h1><p>Tavi pasākumi un plāni vienuviet.</p></div><Link href="/karte" className="meets-profile-top-cta"><ProfileIcon name="map"/> Atrast pasākumu</Link></div>
  <PersonalAgenda events={events} favorites={personal.favorites||[]} plans={personal.plans||[]} onToggle={changeEvent} busy={saving} loading={eventsLoading} error={error||eventsError}/>
  <details className="meets-agenda-secondary" open={secondaryOpen} onToggle={e=>setSecondaryOpen(e.currentTarget.open)}><summary>Saraksti un konta iespējas</summary>
  <div className="meets-profile-columns"><div className="meets-profile-stack">
   <section className="meets-profile-panel"><div className="meets-profile-panel-header"><h2>Mani saraksti</h2><Link href="/mani-registri">Pārvaldīt →</Link></div>
    {lists.length?lists.slice(0,4).map(x=><div className="meets-profile-row" key={x.id}><span className="meets-profile-day"><ProfileIcon name="list"/></span><div className="meets-profile-row-meta"><strong>{x.title}</strong><small>{x.is_published?'Publisks':'Privāts'} · {(x.included_event_ids||[]).length} manuāli pievienoti</small></div><Link href={'/mani-registri?edit='+x.id}>Atvērt →</Link></div>):<div className="meets-profile-empty">Vēl nav sarakstu. Pasākuma kartītē izmanto “Pievienot sarakstam”.</div>}
   </section>
  </div>
  <div className="meets-profile-stack">
   <section className="meets-profile-panel"><div className="meets-profile-panel-header"><h2>Sekošana</h2><Link href="/sekosana">Atvērt →</Link></div><p className="meets-muted">Tu seko {followOrg} organizatoriem un {followVenue} norises vietām.</p>
    {followedOrgs.length?<div className="meets-profile-follow-mini">{followedOrgs.map(o=><Link key={o.id} href={'/organizatori/'+o.id}><span aria-hidden="true">✦</span><strong>{o.name}</strong><small>Atvērt →</small></Link>)}</div>:
      <p className="meets-profile-hint">Atver organizatora profilu un izvēlies “Sekot”, lai saņemtu vienotu viņa publisko pasākumu pārskatu.</p>}</section>
   <section className="meets-profile-panel organizer-activation-card"><div className="meets-profile-panel-header"><h2>Organizēšana</h2></div>{orgs.length?<><p>Tev ir pieeja {orgs.length} organizator{orgs.length===1?'am':'iem'}.</p><Link className="button primary" href="/organizators">Atvērt organizēšanu →</Link></>:<><p>Vai pats organizē pasākumus? Aktivizē organizēšanu tajā pašā MEETS kontā.</p><Link className="button primary" href="/organizators?new=1">Sākt organizēt →</Link></>}</section>
   <section className="meets-profile-panel" id="iestatijumi"><div className="meets-profile-panel-header"><h2>Konta iestatījumi</h2></div><form className="meets-profile-settings-fields" onSubmit={saveProfile}><label>Profila vārds<input value={profileName} maxLength={100} onChange={e=>setProfileName(e.target.value)} placeholder="Tavs vārds"/></label><label>E-pasts<input value={email} readOnly/></label><button className="button" disabled={saving}>{saving?'Saglabā…':'Saglabāt'}</button></form>{notice&&<p className="meets-profile-hint" role="status">{notice}</p>}</section>
  </div></div>
  </details>
 </div></ProfileShell>;
}
