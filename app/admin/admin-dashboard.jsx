'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import AdminEventMap from './admin-event-map.jsx';
import {formatRecoveryCode,isValidAdminOtp,isValidRecoveryCode,normalizeAdminOtp,normalizeRecoveryCode} from '../../lib/admin-otp.js';

const SESSION_KEY='meets_admin_access_token';
function notifyAdminSession(){window.dispatchEvent(new Event('meets-admin-session-change'));}

const QUALITY={
 verified_exact:{label:'Precīzi verificēta',tone:'ok',priority:6},
 source_exact:{label:'Precīza pēc avota, jāpārbauda',tone:'warn',priority:5},
 venue_unverified:{label:'Punkts nav verificēts',tone:'warn',priority:4},
 venue_area:{label:'Aptuvena norises vieta',tone:'warn',priority:3},
 fallback_center:{label:'Pilsētas/pašvaldības centrs',tone:'bad',priority:2},
 missing_point:{label:'Nav koordinātu',tone:'bad',priority:1}
};

function qualityMeta(value){return QUALITY[value]||{label:value||'Nav novērtēts',tone:'bad',priority:0};}
async function loadLeaflet(){
 const leafletModule=await import('leaflet');
 return leafletModule.default||leafletModule;
}
function dateText(v){
 if(!v)return '—';
 const d=new Date(v+'T12:00:00');
 return new Intl.DateTimeFormat('lv-LV',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
}
function sourceText(event){return (event.sources||[]).map(s=>s.source).filter(Boolean).join(', ')||'—';}
function sourceLinks(event){return (event.sources||[]).filter(s=>s?.url);}
function groupMissingLff(events){
 const groups=new Map();
 for(const event of events){
  if(String(event.governing_body||'').toUpperCase()!=='LFF')continue;
  if(event.latitude!=null&&event.longitude!=null)continue;
  const venue=String(event.venue_name||event.address_raw||'').trim();
  if(!venue)continue;
  const current=groups.get(venue)||{
   venueName:venue,
   settlement:event.settlement||'',
   municipality:event.municipality||'',
   events:[],
   competitions:new Set(),
   candidates:Array.isArray(event.geocode_candidates)?event.geocode_candidates:[],
   suggestedAt:event.geocode_suggested_at||null,
   query:event.geocode_query||''
  };
  current.events.push(event);
  if(event.competition_name)current.competitions.add(event.competition_name);
  if((!current.candidates||!current.candidates.length)&&Array.isArray(event.geocode_candidates)&&event.geocode_candidates.length){
   current.candidates=event.geocode_candidates;
  }
  if(!current.suggestedAt&&event.geocode_suggested_at)current.suggestedAt=event.geocode_suggested_at;
  groups.set(venue,current);
 }
 return [...groups.values()]
  .map(g=>({...g,competitions:[...g.competitions].sort((a,b)=>a.localeCompare(b,'lv'))}))
  .sort((a,b)=>b.events.length-a.events.length||a.venueName.localeCompare(b.venueName,'lv'));
}
async function apiFetch(url,key,path,body,authorization=''){
 const headers={apikey:key,'Content-Type':'application/json'};
 if(authorization)headers.Authorization='Bearer '+authorization;
 const response=await fetch(url+'/rest/v1/rpc/'+path,{method:'POST',headers,body:JSON.stringify(body||{}),cache:'no-store'});
 const text=await response.text();
 if(!response.ok)throw new Error(text||('HTTP '+response.status));
 return text?JSON.parse(text):null;
}

export default function AdminDashboard({supabaseUrl,publishableKey}){
 const [token,setToken]=useState('');
 const [email,setEmail]=useState('');
 const [otp,setOtp]=useState('');
 const [recoveryCode,setRecoveryCode]=useState('');
 const [googleReady,setGoogleReady]=useState(null);
 const [challengeId,setChallengeId]=useState('');
 const [recipientHint,setRecipientHint]=useState('');
 const [otpSent,setOtpSent]=useState(false);
 const [authChecked,setAuthChecked]=useState(false);
 const [isAdmin,setIsAdmin]=useState(false);
 const [message,setMessage]=useState('');
 const [events,setEvents]=useState([]);
 const [loading,setLoading]=useState(false);
 const [search,setSearch]=useState('');
 const [status,setStatus]=useState('');
 const [quality,setQuality]=useState('');
 const [editing,setEditing]=useState(null);
 const [geocodeRunning,setGeocodeRunning]=useState(false);
 const [geocodeProgress,setGeocodeProgress]=useState('');
 const [autoGeocodeStarted,setAutoGeocodeStarted]=useState(false);
 const [applyingVenue,setApplyingVenue]=useState('');
 const [otpCooldown,setOtpCooldown]=useState(0);

 async function checkAdmin(activeToken){
  if(!activeToken){setAuthChecked(true);return;}
  try{
   const ok=await apiFetch(supabaseUrl,publishableKey,'meets_admin_session_valid',{p_session_token:activeToken});
   setIsAdmin(ok===true);
   if(ok===true)await loadEvents(activeToken);
   else{sessionStorage.removeItem(SESSION_KEY);notifyAdminSession();setToken('');setIsAdmin(false);}
  }catch{sessionStorage.removeItem(SESSION_KEY);notifyAdminSession();setToken('');setIsAdmin(false);}
  finally{setAuthChecked(true);}
 }
 async function loadEvents(activeToken=token){
  if(!activeToken)return;
  setLoading(true);
  try{
   const data=await apiFetch(supabaseUrl,publishableKey,'meets_admin_catalog',{p_session_token:activeToken});
   setEvents(Array.isArray(data?.events)?data.events:[]);setMessage('');
  }catch{setMessage('Admin datus neizdevās ielādēt.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{
  let cancelled=false;

  async function bootstrapAuth(){
   const active=sessionStorage.getItem(SESSION_KEY)||'';
   setEmail(localStorage.getItem('meets_admin_email')||'');

   try{
    const settingsResponse=await fetch(supabaseUrl+'/auth/v1/settings',{
     headers:{apikey:publishableKey},
     cache:'no-store'
    });
    const settings=settingsResponse.ok?await settingsResponse.json():null;
    if(!cancelled)setGoogleReady(settings?.external?.google===true);
   }catch{
    if(!cancelled)setGoogleReady(false);
   }

   if(active){
    setToken(active);
    await checkAdmin(active);
    return;
   }

   const hash=new URLSearchParams(window.location.hash.slice(1));
   const oauthError=hash.get('error_description')||hash.get('error');
   const accessToken=hash.get('access_token')||'';

   if(oauthError){
    window.history.replaceState(null,'',window.location.pathname+window.location.search);
    if(!cancelled){
     setMessage('Google pieslēgšanās neizdevās. Pārbaudi Google kontu vai izmanto rezerves piekļuvi.');
     setAuthChecked(true);
    }
    return;
   }

   if(accessToken){
    setLoading(true);
    try{
     const sessionToken=await apiFetch(
      supabaseUrl,
      publishableKey,
      'meets_admin_google_exchange',
      {},
      accessToken
     );
     if(!sessionToken||typeof sessionToken!=='string')throw new Error('Missing admin session');

     window.history.replaceState(null,'',window.location.pathname+window.location.search);
     sessionStorage.setItem(SESSION_KEY,sessionToken);
     notifyAdminSession();

     if(cancelled)return;
     setToken(sessionToken);
     setIsAdmin(true);
     setAuthChecked(true);
     await loadEvents(sessionToken);
    }catch{
     window.history.replaceState(null,'',window.location.pathname+window.location.search);
     if(!cancelled){
      setMessage('Šis Google konts nav atļauts MEETS admin videi.');
      setAuthChecked(true);
     }
    }finally{
     if(!cancelled)setLoading(false);
    }
    return;
   }

   if(!cancelled)setAuthChecked(true);
  }

  bootstrapAuth();
  return()=>{cancelled=true;};
 },[]);
 function startGoogleLogin(){
  setMessage('');
  const redirectTo=window.location.origin+'/admin';
  const url=new URL(supabaseUrl+'/auth/v1/authorize');
  url.searchParams.set('provider','google');
  url.searchParams.set('redirect_to',redirectTo);
  window.location.assign(url.toString());
 }

 async function loginWithRecovery(event){
  event.preventDefault();
  const normalized=normalizeRecoveryCode(recoveryCode);
  if(!isValidRecoveryCode(normalized)){
   setMessage('Ievadi pilnu emergency recovery kodu.');
   return;
  }

  setLoading(true);setMessage('');
  try{
   const sessionToken=await apiFetch(
    supabaseUrl,
    publishableKey,
    'meets_admin_recovery_login',
    {p_code:normalized}
   );

   if(!sessionToken||typeof sessionToken!=='string'){
    throw new Error('Missing admin session');
   }

   sessionStorage.setItem(SESSION_KEY,sessionToken);
   notifyAdminSession();
   setToken(sessionToken);
   setRecoveryCode('');
   setIsAdmin(true);
   setAuthChecked(true);
   await loadEvents(sessionToken);
  }catch{
   setMessage('Recovery kods nav derīgs vai jau ir izmantots.');
  }finally{
   setLoading(false);
  }
 }

 async function sendOtp(){
  if(loading||otpCooldown>0)return;
  const normalizedEmail=String(email||'').trim().toLowerCase();
  if(!normalizedEmail||!normalizedEmail.includes('@')){
   setMessage('Ievadi admin Gmail adresi.');
   return;
  }

  setLoading(true);setMessage('');
  try{
   const result=await apiFetch(
    supabaseUrl,
    publishableKey,
    'meets_admin_request_otp',
    {p_email:normalizedEmail}
   );

   if(result?.ok===false&&result?.reason==='rate_limited'){
    const retry=Math.max(1,Number(result.retry_after)||60);
    setOtpCooldown(retry);
    setMessage('Kods jau nesen nosūtīts. Pagaidi un mēģini vēlreiz.');
    return;
   }

   const nextChallenge=String(result?.challenge_id||'');
   if(!nextChallenge)throw new Error('Missing challenge');

   setChallengeId(nextChallenge);
   setRecipientHint(String(result?.recipient_hint||'admin e-pastu'));
   setOtpSent(true);
   setOtp('');
   setOtpCooldown(60);
   setMessage('6 ciparu kods nosūtīts uz '+String(result?.recipient_hint||'admin e-pastu')+'.');

   const timer=window.setInterval(()=>setOtpCooldown(value=>{
    if(value<=1){window.clearInterval(timer);return 0;}
    return value-1;
   }),1000);
  }catch{
   setMessage('Kodu neizdevās nosūtīt. Mēģini vēlreiz pēc brīža.');
  }finally{
   setLoading(false);
  }
 }

 async function verifyOtp(event){
  event.preventDefault();
  const code=normalizeAdminOtp(otp);
  if(!isValidAdminOtp(code)||!challengeId){
   setMessage('Ievadi 6 ciparu kodu no e-pasta.');
   return;
  }

  setLoading(true);setMessage('');
  try{
   const sessionToken=await apiFetch(
    supabaseUrl,
    publishableKey,
    'meets_admin_verify_otp',
    {p_challenge_id:challengeId,p_code:code}
   );

   if(!sessionToken||typeof sessionToken!=='string'){
    throw new Error('Missing admin session');
   }

   sessionStorage.setItem(SESSION_KEY,sessionToken);
   localStorage.setItem('meets_admin_email',String(email||'').trim().toLowerCase());
   notifyAdminSession();

   setToken(sessionToken);
   setOtp('');
   setOtpSent(false);
   setChallengeId('');
   setRecipientHint('');
   setIsAdmin(true);
   await loadEvents(sessionToken);
  }catch{
   setMessage('Kods nav derīgs vai tam beidzies termiņš. Pieprasi jaunu kodu un mēģini vēlreiz.');
  }finally{
   setLoading(false);setAuthChecked(true);
  }
 }

 async function changeStatus(event,newStatus){
  if(newStatus==='published'&&event.location_quality!=='verified_exact'){
   setMessage('Publicēt drīkst tikai pasākumu ar precīzi verificētu lokāciju. Vispirms izlabo/verificē vietu.');
   return;
  }
  setLoading(true);
  try{
   await apiFetch(supabaseUrl,publishableKey,'meets_admin_update_event',{
    p_session_token:token,p_event_id:event.id,p_status:newStatus,p_venue_name:null,p_latitude:null,p_longitude:null
   });
   await loadEvents();setMessage(newStatus==='published'?'Pasākums publicēts.':'Pasākuma statuss atjaunots.');
  }catch{setMessage('Statusu neizdevās mainīt.');}
  finally{setLoading(false);}
 }
 async function saveLocation(event,values,publish){
  setLoading(true);
  try{
   await apiFetch(supabaseUrl,publishableKey,'meets_admin_update_event_v2',{
    p_session_token:token,p_event_id:event.id,p_status:publish?'published':null,p_venue_name:values.venueName,
    p_address_text:values.addressText||null,p_location_source:values.locationSource||null,
    p_latitude:Number(values.latitude),p_longitude:Number(values.longitude)
   });
   setEditing(null);await loadEvents();
   setMessage(publish?'Lokācija verificēta un pasākums publicēts.':'Lokācija verificēta. Pasākums paliek pārbaudē līdz publicēšanai.');
  }catch{setMessage('Lokāciju neizdevās saglabāt.');}
  finally{setLoading(false);}
 }
 const lffMissingGroups=useMemo(()=>groupMissingLff(events),[events]);
 const lffMissingEvents=useMemo(()=>lffMissingGroups.reduce((sum,g)=>sum+g.events.length,0),[lffMissingGroups]);

 async function findMissingLffSuggestions(groups=lffMissingGroups,force=false){
  const pending=force?groups:groups.filter(g=>!g.suggestedAt);
  if(!pending.length){setGeocodeProgress('Visiem LFF stadioniem kandidāti jau ir meklēti.');return;}
  setGeocodeRunning(true);
  let done=0;
  let found=0;
  for(const group of pending){
   const query=[group.venueName,group.settlement||group.municipality].filter(Boolean).join(', ');
   setGeocodeProgress(`Meklējam ${done+1}/${pending.length}: ${group.venueName}`);
   try{
    const response=await fetch('/api/admin/geocode',{
     method:'POST',
     headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
     body:JSON.stringify({
      query,
      venueName:group.venueName,
      settlement:group.settlement,
      municipality:group.municipality
     })
    });
    const data=await response.json();
    if(!response.ok)throw new Error(data?.error||'Meklēšana neizdevās.');
    const candidates=(Array.isArray(data.results)?data.results:[]).slice(0,5);
    if(candidates.length)found++;
    await apiFetch(supabaseUrl,publishableKey,'meets_admin_store_location_candidates',{
     p_session_token:token,
     p_venue_name:group.venueName,
     p_query:query,
     p_candidates:candidates
    });
   }catch(error){
    console.error('lff_geocode_candidate_failed',{venue:group.venueName,message:error?.message||'Error'});
   }
   done++;
   if(done<pending.length)await new Promise(resolve=>setTimeout(resolve,1200));
  }
  await loadEvents();
  setGeocodeProgress(`Pabeigts: apstrādāti ${done} stadioni, kandidāti atrasti ${found}.`);
  setGeocodeRunning(false);
 }

 async function applyLffCandidate(group,candidate){
  if(!candidate)return;
  setApplyingVenue(group.venueName);
  try{
   const result=await apiFetch(supabaseUrl,publishableKey,'meets_admin_apply_location_candidate',{
    p_session_token:token,
    p_venue_name:group.venueName,
    p_candidate:candidate
   });
   await loadEvents();
   setMessage(`${group.venueName}: lokācija apstiprināta ${result?.updated||group.events.length} spēlēm.`);
  }catch{
   setMessage(group.venueName+': kandidātu neizdevās apstiprināt.');
  }finally{
   setApplyingVenue('');
  }
 }

 const counts=useMemo(()=>{
  const byStatus={},byQuality={};
  for(const e of events){byStatus[e.status]=(byStatus[e.status]||0)+1;byQuality[e.location_quality]=(byQuality[e.location_quality]||0)+1;}
  return {byStatus,byQuality};
 },[events]);

 const filtered=useMemo(()=>{
  const q=search.trim().toLocaleLowerCase('lv');
  return events.filter(e=>
   (!status||e.status===status)&&
   (!quality||e.location_quality===quality)&&
   (!q||[e.title,e.venue_name,e.address_raw,e.municipality,e.settlement,e.location_review_reason,sourceText(e)].some(v=>String(v||'').toLocaleLowerCase('lv').includes(q)))
  ).sort((a,b)=>{
   const qa=qualityMeta(a.location_quality).priority,qb=qualityMeta(b.location_quality).priority;
   if(qa!==qb)return qa-qb;
   return String(a.date_from||'').localeCompare(String(b.date_from||''))||String(a.title).localeCompare(String(b.title),'lv');
  });
 },[events,search,status,quality]);

 useEffect(()=>{
  if(!isAdmin||!events.length||editing)return;
  const editId=new URLSearchParams(window.location.search).get('edit');
  if(!editId)return;
  const event=events.find(item=>item.id===editId);
  if(!event)return;
  setEditing(event);
  window.history.replaceState(null,'','/admin');
 },[isAdmin,events,editing]);

 useEffect(()=>{
  if(!isAdmin||!token||autoGeocodeStarted||geocodeRunning||!lffMissingGroups.length)return;
  const unprocessed=lffMissingGroups.filter(g=>!g.suggestedAt);
  if(!unprocessed.length)return;
  setAutoGeocodeStarted(true);
  findMissingLffSuggestions(unprocessed);
 },[isAdmin,token,lffMissingGroups,autoGeocodeStarted,geocodeRunning]);

 if(!authChecked)return <div className="admin-login"><p>Pārbaudām admin piekļuvi…</p></div>;
 if(!token||!isAdmin){
  return <div className="admin-login admin-auth-stack">
   <div className="admin-auth-primary">
    <p className="eyebrow">Primārā piekļuve</p>
    <h2>Admin pieslēgšanās</h2>
    <p>Ātrākais veids ir Google konts. MEETS piešķirs admin piekļuvi tikai iepriekš atļautajam Google kontam.</p>
    <button className="button primary google-login-button" type="button" onClick={startGoogleLogin} disabled={loading||googleReady!==true}>
     <span className="google-mark" aria-hidden="true">G</span>
     {googleReady===false?'Google login vēl jāaktivizē':'Ielogoties ar Google'}
    </button>
    {googleReady===false&&<p className="sync-text">MEETS Google login kods ir gatavs; Supabase projektā vēl jāieslēdz Google providers un production redirect.</p>}
   </div>

   <div className="admin-auth-divider"><span>rezerves piekļuve</span></div>

   <details className="admin-auth-option" open={otpSent||undefined}>
    <summary>Saņemt 6 ciparu kodu e-pastā</summary>
    <form className="admin-auth-option-body" onSubmit={verifyOtp}>
     {!otpSent?<>
      <label>Admin Gmail
       <input
        type="email"
        value={email}
        onChange={event=>setEmail(event.target.value)}
        autoComplete="email"
        placeholder="admin@gmail.com"
       />
      </label>
      <button className="button" type="button" onClick={sendOtp} disabled={loading||otpCooldown>0}>
       {loading?'Sūta kodu…':otpCooldown>0?`Sūtīt vēlreiz pēc ${otpCooldown}s`:'Nosūtīt kodu'}
      </button>
     </>:<>
      <p className="sync-text">Kods nosūtīts uz <strong>{recipientHint||'admin e-pastu'}</strong>.</p>
      <label>6 ciparu kods
       <input
        className="otp-code-input"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={6}
        value={otp}
        onChange={event=>setOtp(normalizeAdminOtp(event.target.value))}
        placeholder="000000"
       />
      </label>
      <div className="actions">
       <button className="button primary" type="submit" disabled={loading||!isValidAdminOtp(otp)}>{loading?'Pārbaudām…':'Ielogoties ar kodu'}</button>
       <button className="text-button" type="button" onClick={sendOtp} disabled={loading||otpCooldown>0}>
        {otpCooldown>0?`Jauns kods pēc ${otpCooldown}s`:'Nosūtīt jaunu kodu'}
       </button>
       <button className="text-button" type="button" onClick={()=>{setOtpSent(false);setOtp('');setChallengeId('');setRecipientHint('');setMessage('');}}>Mainīt e-pastu</button>
      </div>
     </>}
    </form>
   </details>

   <details className="admin-auth-option emergency">
    <summary>Emergency recovery kods</summary>
    <form className="admin-auth-option-body" onSubmit={loginWithRecovery}>
     <p className="sync-text">Izmanto tikai tad, ja Google un e-pasta OTP nav pieejami. Kods ir vienreizējs.</p>
     <label>Recovery kods
      <input
       type="text"
       value={formatRecoveryCode(recoveryCode)}
       onChange={event=>setRecoveryCode(normalizeRecoveryCode(event.target.value))}
       autoComplete="off"
       spellCheck={false}
       placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
      />
     </label>
     <button className="button" type="submit" disabled={loading||!isValidRecoveryCode(recoveryCode)}>Ielogoties ar recovery kodu</button>
    </form>
   </details>

   {message&&<p className="sync-text admin-auth-message" role="status">{message}</p>}
  </div>;
 }

 return <>
  <div className="admin-summary location-summary">
   <article><strong>{counts.byStatus.published||0}</strong><span>Publicēti kopā</span></article>
   <article><strong>{counts.byStatus.pending_review||0}</strong><span>Gaida pārbaudi</span></article>
   <article><strong>{counts.byQuality.fallback_center||0}</strong><span>Tikai centra fallback</span></article>
   <article><strong>{counts.byQuality.missing_point||0}</strong><span>Nav koordinātu</span></article>
   <article><strong>{counts.byQuality.source_exact||0}</strong><span>Precīzi pēc avota, jāverificē</span></article>
   <article className={lffMissingEvents?'attention-card':''}><strong>{lffMissingEvents}</strong><span>LFF spēles bez kartes punkta · {lffMissingGroups.length} stadioni</span></article>
  </div>

  <div className="admin-toolbar admin-toolbar-wide">
   <label>Meklēt<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pasākums, vieta, problēma, avots…"/></label>
   <label>Statuss<select value={status} onChange={e=>setStatus(e.target.value)}>
    <option value="">Visi</option><option value="pending_review">Pending review</option><option value="published">Published</option>
    <option value="cancelled">Cancelled</option><option value="archived">Archived</option><option value="draft">Draft</option>
   </select></label>
   <label>Lokācijas kvalitāte<select value={quality} onChange={e=>setQuality(e.target.value)}>
    <option value="">Visas</option>
    {Object.entries(QUALITY).map(([value,meta])=><option key={value} value={value}>{meta.label}</option>)}
   </select></label>
   <button className="button" onClick={()=>loadEvents()} disabled={loading}>{loading?'Ielādē…':'Pārlasīt'}</button>
  </div>

  <p className="admin-rule"><strong>Lokācijas kvalitāte:</strong> visi esošie ieraksti ir apstiprināti, bet kvalitātes atzīmes un problēmu iemesli paliek redzami. Jauniem <code>pending_review</code> ierakstiem pirms publicēšanas ieteicams vispirms verificēt lokāciju.</p>
  {message&&<p className="sync-text" role="status">{message}</p>}

  <AdminEventMap events={filtered} onEdit={setEditing}/>

  {lffMissingGroups.length>0&&<section className="lff-location-queue">
   <div className="queue-head">
    <div>
     <p className="eyebrow">LFF · lokācijas</p>
     <h2>LFF — nav kartes punkta</h2>
     <p>{lffMissingEvents} spēles · {lffMissingGroups.length} unikāli stadioni. Automātiskais meklētājs sagatavo kandidātus, bet kartes punkts mainās tikai pēc apstiprināšanas.</p>
    </div>
    <button className="button" disabled={geocodeRunning} onClick={()=>findMissingLffSuggestions(lffMissingGroups,true)}>
     {geocodeRunning?'Meklē kandidātus…':'Atkārtoti atrast kandidātus'}
    </button>
   </div>
   {geocodeProgress&&<p className="sync-text" role="status">{geocodeProgress}</p>}
   <div className="table-scroll" role="region" aria-label="LFF stadioni bez kartes punkta" tabIndex={0}>
    <table className="events-table lff-location-table">
     <thead><tr><th>Stadions</th><th>Spēles</th><th>Turnīri</th><th>Automātiski atrastā vieta</th><th>Darbības</th></tr></thead>
     <tbody>{lffMissingGroups.map(group=>{
      const best=group.candidates?.[0]||null;
      return <tr key={group.venueName}>
       <td><strong>{group.venueName}</strong><small className="table-subline">{[group.settlement,group.municipality].filter(Boolean).join(' · ')||'Pilsēta nav noteikta'}</small></td>
       <td><strong>{group.events.length}</strong></td>
       <td>{group.competitions.join(', ')||'LFF'}</td>
       <td>
        {best?<>
         <strong>{best.label||best.displayName}</strong>
         <small className="table-subline">{best.displayName}</small>
         <small className="table-subline">{Number(best.latitude).toFixed(5)}, {Number(best.longitude).toFixed(5)}{Number.isFinite(Number(best.score))?' · atbilstība '+Number(best.score).toFixed(1):''}</small>
         {best.sourceUrl&&<a className="queue-source-link" href={best.sourceUrl} target="_blank" rel="noreferrer">OpenStreetMap ↗</a>}
         {group.candidates.length>1&&<details className="candidate-alternatives">
          <summary>Citi varianti ({group.candidates.length-1})</summary>
          {group.candidates.slice(1).map(candidate=><div className="candidate-alt" key={candidate.id||candidate.sourceUrl||candidate.displayName}>
           <span><strong>{candidate.label||'Vieta'}</strong><small>{candidate.displayName}</small></span>
           <button className="text-button" disabled={applyingVenue===group.venueName} onClick={()=>applyLffCandidate(group,candidate)}>Apstiprināt šo</button>
          </div>)}
         </details>}
        </>:<span className="quality-badge bad">{group.suggestedAt?'Kandidāts nav atrasts':'Vēl nav meklēts'}</span>}
       </td>
       <td><div className="admin-actions">
        {best&&<button className="button primary compact" disabled={applyingVenue===group.venueName} onClick={()=>applyLffCandidate(group,best)}>
         {applyingVenue===group.venueName?'Saglabā…':'Apstiprināt'}
        </button>}
        <button className="button compact" onClick={()=>setEditing(group.events[0])}>Atvērt redaktoru</button>
       </div></td>
      </tr>;
     })}</tbody>
    </table>
   </div>
  </section>}

  <div className="table-scroll" role="region" aria-label="Admin pasākumu tabula" tabIndex={0}>
   <table className="events-table admin-events-table location-review-table">
    <thead><tr>
     <th>Datums</th><th>Pasākums</th><th>Lokācijas kvalitāte</th><th>Kāpēc jāpārbauda</th><th>Norises vieta</th><th>Avots</th><th>Darbības</th>
    </tr></thead>
    <tbody>
     {filtered.map(event=>{
      const meta=qualityMeta(event.location_quality);
      return <tr key={event.id} className={event.location_quality==='verified_exact'?'location-ok':'location-needs-review'}>
       <td>{dateText(event.date_from)}</td>
       <td><strong>{event.title}</strong><small className="table-subline">{event.status}</small></td>
       <td><span className={'quality-badge '+meta.tone}>{meta.label}</span></td>
       <td className="reason-cell">{event.location_review_reason||'Lokācija verificēta.'}</td>
       <td>
        <strong>{event.venue_name||event.address_raw||'—'}</strong>
        <small className="table-subline">{event.address_raw&&event.address_raw!==event.venue_name?event.address_raw+' · ':''}{event.municipality||event.settlement||''}</small>
        <small className="table-subline">{event.latitude!=null&&event.longitude!=null?Number(event.latitude).toFixed(5)+', '+Number(event.longitude).toFixed(5):'Nav koordinātu'}</small>
       </td>
       <td>{sourceLinks(event).length?sourceLinks(event).map((s,i)=><span key={(s.url||'')+i} className="source-link-row"><a href={s.url} target="_blank" rel="noreferrer">{s.source||'Avots'} ↗</a></span>):sourceText(event)}</td>
       <td><div className="admin-actions">
        {event.location_quality==='verified_exact'&&event.status!=='published'&&<button className="text-button strong-action" onClick={()=>changeStatus(event,'published')}>Publicēt</button>}
        {event.status==='published'&&<button className="text-button" onClick={()=>changeStatus(event,'pending_review')}>Atgriezt pārbaudei</button>}
        <button className="button compact" onClick={()=>setEditing(event)}>{event.location_quality==='verified_exact'?'Pārbaudīt lokāciju':'Labot lokāciju'}</button>
       </div></td>
      </tr>;
     })}
    </tbody>
   </table>
  </div>
  <p className="sync-text"><strong>{filtered.length}</strong> no {events.length} ierakstiem.</p>

  {editing&&<LocationEditor event={editing} token={token} close={()=>setEditing(null)} save={(values,publish)=>saveLocation(editing,values,publish)}/>} 
 </>;
}

function LocationEditor({event,token,close,save}){
 const dialog=useRef(null),mapEl=useRef(null),mapRef=useRef(null),markerRef=useRef(null);
 const [venueName,setVenueName]=useState(event.venue_name||event.address_raw||'');
 const initialSearch=[event.venue_name,event.address_raw,event.municipality||event.settlement].filter(Boolean).join(', ');
 const [searchQuery,setSearchQuery]=useState(initialSearch);
 const [addressText,setAddressText]=useState(event.address_raw||event.venue_name||'');
 const [latitude,setLatitude]=useState(event.latitude??56.95);
 const [longitude,setLongitude]=useState(event.longitude??24.1);
 const [searchResults,setSearchResults]=useState([]);
 const [searching,setSearching]=useState(false);
 const [searchError,setSearchError]=useState('');
 const [selectedPlace,setSelectedPlace]=useState(null);

 useEffect(()=>{
  dialog.current?.showModal();
  let cancelled=false;
  loadLeaflet().then(L=>{
   if(cancelled||!mapEl.current)return;
   const map=L.map(mapEl.current,{minZoom:5,maxBounds:[[53.5,16],[60.8,31.5]],maxBoundsViscosity:1}).setView([Number(latitude),Number(longitude)],event.latitude!=null?13:7);
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
   const marker=L.marker([Number(latitude),Number(longitude)],{draggable:true}).addTo(map);
   function apply(latlng){
    setLatitude(latlng.lat.toFixed(6));setLongitude(latlng.lng.toFixed(6));
    setSelectedPlace(null);
    marker.setLatLng(latlng);
   }
   map.on('click',e=>apply(e.latlng));marker.on('dragend',()=>apply(marker.getLatLng()));
   mapRef.current=map;markerRef.current=marker;
  });
  return()=>{cancelled=true;mapRef.current?.remove();};
 },[]);

 function syncMarker(){
  const lat=Number(latitude),lon=Number(longitude);
  setSelectedPlace(null);
  if(Number.isFinite(lat)&&Number.isFinite(lon)&&markerRef.current&&mapRef.current){
   markerRef.current.setLatLng([lat,lon]);mapRef.current.panTo([lat,lon]);
  }
 }

 async function searchLocation(eventSubmit){
  eventSubmit?.preventDefault();
  const query=searchQuery.trim();
  if(query.length<3){setSearchError('Ievadi vismaz 3 rakstzīmes.');return;}
  setSearching(true);setSearchError('');setSearchResults([]);
  try{
   const response=await fetch('/api/admin/geocode',{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({query})
   });
   const data=await response.json();
   if(!response.ok)throw new Error(data?.error||'Meklēšana neizdevās.');
   setSearchResults(Array.isArray(data.results)?data.results:[]);
   if(!data.results?.length)setSearchError('Latvijā netika atrasts neviens atbilstošs variants. Pamēģini saīsināt vai precizēt adresi.');
  }catch(error){
   setSearchError(error?.message||'Vietu meklēšana neizdevās.');
  }finally{setSearching(false);}
 }

 function choosePlace(place){
  setSelectedPlace(place);
  setAddressText(place.displayName||place.label||'');
  setLatitude(Number(place.latitude).toFixed(6));
  setLongitude(Number(place.longitude).toFixed(6));
  setSearchQuery(place.displayName||place.label||searchQuery);
  setSearchResults([]);
  if(markerRef.current&&mapRef.current){
   markerRef.current.setLatLng([place.latitude,place.longitude]);
   mapRef.current.setView([place.latitude,place.longitude],16);
  }
 }

 const meta=qualityMeta(event.location_quality);
 const canSave=Number.isFinite(Number(latitude))&&Number.isFinite(Number(longitude))&&Boolean(venueName.trim());
 const locationSource=selectedPlace?.sourceUrl||'admin map correction';

 return <dialog ref={dialog} className="event-dialog location-dialog" onCancel={close} onClose={close}>
  <div className="detail-header"><div><p className="eyebrow">Lokācijas pārbaude</p><h2>{event.title}</h2></div><button className="button" onClick={close}>Aizvērt ✕</button></div>

  <div className={'location-issue-panel '+meta.tone}>
   <strong>{meta.label}</strong>
   <p>{event.location_review_reason||'Lokācija pašlaik ir verificēta.'}</p>
   {event.address_raw&&<p><b>Nolasītā adrese:</b> {event.address_raw}</p>}
   {sourceLinks(event).map((s,i)=><a key={(s.url||'')+i} href={s.url} target="_blank" rel="noreferrer">Atvērt {s.source||'avotu'} ↗</a>)}
  </div>

  <div className="location-edit-fields">
   <label>Norises vietas nosaukums
    <input value={venueName} onChange={e=>setVenueName(e.target.value)} placeholder="Piem., Daugavas stadions"/>
   </label>

   <form className="geocode-search" onSubmit={searchLocation}>
    <label>Adrese vai vieta, ko atrast kartē
     <div className="geocode-search-row">
      <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Piem., Daugavas stadions, Liepāja"/>
      <button className="button primary" type="submit" disabled={searching}>{searching?'Meklē…':'Atrast vietu'}</button>
     </div>
    </label>
   </form>

   {searchError&&<p className="error-message compact-message">{searchError}</p>}

   {searchResults.length>0&&<div className="geocode-results" role="listbox" aria-label="Atrastas vietas">
    {searchResults.map(place=><button type="button" className="geocode-result" key={place.id} onClick={()=>choosePlace(place)}>
     <strong>{place.label}</strong>
     <span>{place.displayName}</span>
     <small>{place.type||place.category||'Vieta'} · {Number(place.latitude).toFixed(5)}, {Number(place.longitude).toFixed(5)}</small>
    </button>)}
   </div>}

   {selectedPlace&&<div className="selected-place">
    <span className="quality-badge ok">Izvēlēta vieta</span>
    <strong>{selectedPlace.label}</strong>
    <span>{selectedPlace.displayName}</span>
    {selectedPlace.sourceUrl&&<a href={selectedPlace.sourceUrl} target="_blank" rel="noreferrer">Atvērt OpenStreetMap ↗</a>}
   </div>}

   <label>Adrese, ko saglabāt
    <input value={addressText} onChange={e=>setAddressText(e.target.value)} placeholder="Izvēloties vietu, adrese aizpildīsies automātiski"/>
   </label>
  </div>

  <div ref={mapEl} className="admin-location-map"/>

  <details className="manual-coordinates">
   <summary>Koordinātas — manuāls rezerves variants</summary>
   <div className="location-form">
    <label>Latitude<input type="number" step="0.000001" value={latitude} onChange={e=>setLatitude(e.target.value)} onBlur={syncMarker}/></label>
    <label>Longitude<input type="number" step="0.000001" value={longitude} onChange={e=>setLongitude(e.target.value)} onBlur={syncMarker}/></label>
   </div>
  </details>

  <p className="sync-text">Ieteicamais variants: atrodi vietu pēc nosaukuma vai adreses, izvēlies konkrēto rezultātu un pārbaudi marķieri kartē. Vietu meklēšana: © OpenStreetMap contributors.</p>

  <div className="actions">
   <button className="button" disabled={!canSave} onClick={()=>save({venueName,addressText,latitude,longitude,locationSource},false)}>Saglabāt verificētu lokāciju</button>
   <button className="button primary" disabled={!canSave} onClick={()=>save({venueName,addressText,latitude,longitude,locationSource},true)}>Saglabāt un publicēt</button>
   <button className="button" onClick={close}>Atcelt</button>
  </div>
 </dialog>;
}
