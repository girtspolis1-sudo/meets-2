'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import AdminEventMap from './admin-event-map.jsx';
import AdminReviewOverview from './admin-review-overview.jsx';
import AdminMappingList from './admin-mapping-list.jsx';
import AdminImportHealth from './admin-import-health.jsx';
import AdminSourceChannels from './admin-source-channels.jsx';
import AdminUserSubmissions from './admin-user-submissions.jsx';
import AdminEventRegister from './admin-event-register.jsx';
import {rigaTodayIso} from '../../lib/event-date.js';

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
function canPublishEvent(event){
 return event?.attendance_mode==='online'||event?.location_quality==='verified_exact';
}
function eventIsCurrent(event,today=rigaTodayIso()){
 const end=String(event?.date_to||event?.date_from||'');
 return /^\d{4}-\d{2}-\d{2}$/.test(end)&&end>=today;
}
function publicationMeta(event){
 if(event?.status==='published'){
  return canPublishEvent(event)
   ?{key:'published-ok',label:'Publicēts · korekts',tone:'ok'}
   :{key:'published-review',label:'Publicēts · jāpārbauda',tone:'bad'};
 }
 if(event?.status==='pending_review'){
  return canPublishEvent(event)
   ?{key:'ready',label:'Gatavs publicēšanai',tone:'warn'}
   :{key:'needs-location',label:'Jāsakārto lokācija',tone:'bad'};
 }
 return {key:'other',label:event?.status||'Nav statusa',tone:'warn'};
}
function dateRangeText(event){
 const from=dateText(event?.date_from);
 const to=event?.date_to&&event.date_to!==event.date_from?dateText(event.date_to):'';
 return to?from+'–'+to:from;
}
function isLocationIssue(event){
 const quality=String(event?.location_quality||'');
 const hasPoint=event?.latitude!=null&&event?.longitude!=null&&Number.isFinite(Number(event.latitude))&&Number.isFinite(Number(event.longitude));
 const hasPlace=Boolean(String(event?.venue_name||event?.address_raw||'').trim());
 return !hasPoint||!hasPlace||quality!=='verified_exact';
}
function locationIssueReason(event){
 if(event?.latitude==null||event?.longitude==null)return 'Nav precīza kartes punkta';
 if(!String(event?.venue_name||event?.address_raw||'').trim())return 'Nav norises vietas vai adreses';
 if(event?.location_quality==='fallback_center')return 'Izmantots pilsētas/pašvaldības centra punkts';
 if(event?.location_quality==='venue_area')return 'Norises vieta noteikta tikai aptuveni';
 if(event?.location_quality==='venue_unverified')return 'Kartes punkts nav verificēts';
 if(event?.location_quality==='source_exact')return 'Avotā ir precīza vieta, nepieciešama admin pārbaude';
 return event?.location_review_reason||'Adrese vai kartes punkts jāpārbauda';
}

function normalizeMappingAlias(value){
 return String(value||'')
  .toLocaleLowerCase('lv')
  .replace(/[.,;:/\\()"'’“”_\-]+/g,' ')
  .replace(/\s+/g,' ')
  .trim();
}
function groupLocationIssues(events){
 const groups=new Map();
 for(const event of events){
  if(!isLocationIssue(event))continue;
  const alias=String(event.venue_name||event.address_raw||'').trim();
  const municipality=String(event.municipality||'').trim();
  const countryCode=String(event.country_code||'').trim();
  const key=[normalizeMappingAlias(alias)||'__missing__',municipality.toLocaleLowerCase('lv'),countryCode].join('|');
  const current=groups.get(key)||{
   key,
   alias,
   municipality,
   countryCode,
   sampleAddress:String(event.address_raw||'').trim(),
   events:[],
   sources:new Set(),
   qualities:new Set(),
   firstDate:event.date_from||'',
   lastDate:event.date_from||''
  };
  current.events.push(event);
  for(const source of event.sources||[])if(source?.source)current.sources.add(source.source);
  current.qualities.add(qualityMeta(event.location_quality).label);
  if(event.date_from&&(!current.firstDate||event.date_from<current.firstDate))current.firstDate=event.date_from;
  if(event.date_from&&(!current.lastDate||event.date_from>current.lastDate))current.lastDate=event.date_from;
  groups.set(key,current);
 }
 return [...groups.values()]
  .map(group=>({...group,sources:[...group.sources].sort(),qualities:[...group.qualities]}))
  .sort((a,b)=>b.events.length-a.events.length||String(a.alias).localeCompare(String(b.alias),'lv'));
}
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
 const [password,setPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [recoveryCode,setRecoveryCode]=useState('');
 const [passwordReady,setPasswordReady]=useState(null);
 const [authChecked,setAuthChecked]=useState(false);
 const [isAdmin,setIsAdmin]=useState(false);
 const [message,setMessage]=useState('');
 const [events,setEvents]=useState([]);
 const [mappings,setMappings]=useState([]);
 const [importHealth,setImportHealth]=useState({sports:[],municipalities:[]});
 const [sources,setSources]=useState([]);
 const [userSubmissions,setUserSubmissions]=useState([]);
 const [reviewingSubmission,setReviewingSubmission]=useState(false);
 const [busySourceId,setBusySourceId]=useState('');
 const [catalogLoaded,setCatalogLoaded]=useState(false);
 const [loading,setLoading]=useState(false);
 const [search,setSearch]=useState('');
 const [status,setStatus]=useState('');
 const [quality,setQuality]=useState('');
 const [workspaceView,setWorkspaceView]=useState('overview');
 const [focusedSubmissionId,setFocusedSubmissionId]=useState('');
 const [editing,setEditing]=useState(null);
 const [mappingEditing,setMappingEditing]=useState(null);
 const [mappingRuleEditing,setMappingRuleEditing]=useState(null);
 const [busyMappingId,setBusyMappingId]=useState('');
 const [selectedIds,setSelectedIds]=useState(()=>new Set());
 const [page,setPage]=useState(1);
 const [bulkLoading,setBulkLoading]=useState(false);
 const [bulkResult,setBulkResult]=useState(null);
 const [geocodeRunning,setGeocodeRunning]=useState(false);
 const [geocodeProgress,setGeocodeProgress]=useState('');
 const [autoGeocodeStarted,setAutoGeocodeStarted]=useState(false);
 const [applyingVenue,setApplyingVenue]=useState('');

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
   const [data,mappingData,healthData,sourceData,submissionData]=await Promise.all([
    apiFetch(supabaseUrl,publishableKey,'meets_admin_catalog',{p_session_token:activeToken}),
    apiFetch(supabaseUrl,publishableKey,'meets_admin_location_mapping_catalog',{p_session_token:activeToken}),
    apiFetch(supabaseUrl,publishableKey,'meets_admin_import_health',{p_session_token:activeToken}),
    apiFetch(supabaseUrl,publishableKey,'meets_admin_source_visibility_catalog',{p_session_token:activeToken}),
    apiFetch(supabaseUrl,publishableKey,'meets_admin_user_submissions',{p_session_token:activeToken})
   ]);
   setEvents(Array.isArray(data?.events)?data.events:[]);
   setMappings(Array.isArray(mappingData?.mappings)?mappingData.mappings:[]);
   setImportHealth(healthData&&typeof healthData==='object'?healthData:{sports:[],municipalities:[]});
   setSources(Array.isArray(sourceData?.sources)?sourceData.sources:[]);
   setUserSubmissions(Array.isArray(submissionData)?submissionData:[]);
   setSelectedIds(new Set());
   setBulkResult(null);
   setCatalogLoaded(true);
   setMessage('');
  }catch{
   setCatalogLoaded(false);
   setMessage('Admin datus neizdevās ielādēt.');
  }finally{setLoading(false);}
 }
 useEffect(()=>{
  let cancelled=false;

  async function bootstrap(){
   const active=sessionStorage.getItem(SESSION_KEY)||'';
   setEmail(localStorage.getItem('meets_admin_email')||'');

   try{
    const ready=await apiFetch(supabaseUrl,publishableKey,'meets_admin_password_ready',{});
    if(!cancelled)setPasswordReady(ready===true);
   }catch{
    if(!cancelled){
     setPasswordReady(false);
     setMessage('Admin paroles statusu neizdevās pārbaudīt.');
    }
   }

   if(cancelled)return;
   setToken(active);
   await checkAdmin(active);
  }

  bootstrap();
  return()=>{cancelled=true;};
 },[]);

 async function authenticatePassword(normalizedEmail,secret){
  return apiFetch(
   supabaseUrl,
   publishableKey,
   'meets_admin_password_login',
   {p_email:normalizedEmail,p_password:secret}
  );
 }

 async function setupPassword(event){
  event.preventDefault();
  const normalizedEmail=String(email||'').trim().toLowerCase();

  if(!normalizedEmail||!normalizedEmail.includes('@')){
   setMessage('Ievadi admin e-pastu.');
   return;
  }
  if(String(recoveryCode||'').replace(/[^A-Za-z0-9]/g,'').length<20){
   setMessage('Ievadi emergency recovery kodu.');
   return;
  }
  if(password.length<12||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)){
   setMessage('Parolei jābūt vismaz 12 rakstzīmēm ar lielo burtu, mazo burtu un ciparu.');
   return;
  }
  if(password!==confirmPassword){
   setMessage('Abas paroles nesakrīt.');
   return;
  }

  setLoading(true);setMessage('');
  try{
   const ok=await apiFetch(
    supabaseUrl,
    publishableKey,
    'meets_admin_setup_password',
    {p_email:normalizedEmail,p_recovery_code:recoveryCode,p_password:password}
   );
   if(ok!==true)throw new Error('Setup failed');

   const sessionToken=await authenticatePassword(normalizedEmail,password);
   if(!sessionToken||typeof sessionToken!=='string')throw new Error('Missing admin session');

   localStorage.setItem('meets_admin_email',normalizedEmail);
   sessionStorage.setItem(SESSION_KEY,sessionToken);
   notifyAdminSession();

   setPasswordReady(true);
   setToken(sessionToken);
   setRecoveryCode('');
   setConfirmPassword('');
   setPassword('');
   setIsAdmin(true);
   setAuthChecked(true);
   await loadEvents(sessionToken);
  }catch{
   setMessage('Paroli neizdevās aktivizēt. Pārbaudi e-pastu, recovery kodu un paroles prasības.');
  }finally{
   setLoading(false);
  }
 }

 async function login(event){
  event.preventDefault();
  const normalizedEmail=String(email||'').trim().toLowerCase();

  if(!normalizedEmail||!normalizedEmail.includes('@')){
   setMessage('Ievadi admin e-pastu.');
   return;
  }
  if(password.length<8){
   setMessage('Ievadi admin paroli.');
   return;
  }

  setLoading(true);setMessage('');
  try{
   const sessionToken=await authenticatePassword(normalizedEmail,password);

   if(!sessionToken||typeof sessionToken!=='string'){
    throw new Error('Missing admin session');
   }

   sessionStorage.setItem(SESSION_KEY,sessionToken);
   localStorage.setItem('meets_admin_email',normalizedEmail);
   notifyAdminSession();

   setToken(sessionToken);
   setPassword('');
   setIsAdmin(true);
   setAuthChecked(true);
   await loadEvents(sessionToken);
  }catch{
   setMessage('Nepareizs e-pasts vai parole.');
  }finally{
   setLoading(false);
   setAuthChecked(true);
  }
 }

 async function saveUserSubmission(values){
  if(!values?.id)throw new Error('Nav ieraksta identifikatora.');
  try{
   await apiFetch(supabaseUrl,publishableKey,'meets_admin_edit_user_submission',{
    p_session_token:token,
    p_id:values.id,
    p_values:{
     title:values.title,category:values.category,description:values.description,
     date_from:values.date_from,date_to:values.date_to,time_from:values.time_from,time_to:values.time_to,
     venue_name:values.venue_name,address:values.address,
     latitude:values.latitude,longitude:values.longitude
    }
   });
   await loadEvents();
   setMessage('Pasākuma labojumi saglabāti.');
  }catch(error){
   throw new Error('Pasākuma labojumus neizdevās saglabāt. Pārbaudi datumus, adresi un koordinātas.');
  }
 }

 async function reviewUserSubmission(item,approve,note,latitude=null,longitude=null){
  setReviewingSubmission(true);setMessage('');
  try{
   await apiFetch(supabaseUrl,publishableKey,'meets_admin_review_submission_v2',{
    p_session_token:token,p_id:item.id,p_approve:approve,p_note:note,
    p_latitude:latitude,p_longitude:longitude
   });
   await loadEvents();
   setMessage(approve?'Pasākums publicēts kartē.':'Pasākums atgriezts labošanai.');
  }catch(error){setMessage('Iesnieguma apstrāde neizdevās. Pārbaudi koordinātas un obligātos laukus.');}
  finally{setReviewingSubmission(false);}
 }

 async function changeStatus(event,newStatus){
  if(newStatus==='published'&&!canPublishEvent(event)){
   setMessage('Publicēt drīkst tikai pasākumu ar precīzi verificētu lokāciju. Tiešsaistes pasākums ir izņēmums.');
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

 async function saveMapping(group,values){
  setLoading(true);
  try{
   const result=await apiFetch(supabaseUrl,publishableKey,'meets_admin_save_location_mapping',{
    p_session_token:token,
    p_sample_event_id:group.events[0].id,
    p_venue_name:values.venueName,
    p_address_text:values.addressText||null,
    p_latitude:Number(values.latitude),
    p_longitude:Number(values.longitude)
   });
   setMappingEditing(null);
   await loadEvents();
   setMessage(`Mapping saglabāts: “${result?.alias_text||group.alias}”. Izlaboti ${result?.updated_events||group.events.length} esošie pasākumi; nākamajos importos korekcija tiks piemērota automātiski.`);
  }catch{
   setMessage('Mappingu neizdevās saglabāt. Pārbaudi vietu, adresi un koordinātas.');
  }finally{setLoading(false);}
 }

 async function updateMapping(mapping,values){
  setBusyMappingId(mapping.id);
  try{
   const result=await apiFetch(supabaseUrl,publishableKey,'meets_admin_update_location_mapping',{
    p_session_token:token,
    p_mapping_id:mapping.id,
    p_venue_name:values.venueName,
    p_address_text:values.addressText||null,
    p_latitude:Number(values.latitude),
    p_longitude:Number(values.longitude),
    p_active:true
   });
   setMappingRuleEditing(null);
   await loadEvents();
   setMessage(`Mapping atjaunots. Saistītie ieraksti atjaunoti: ${result?.updated_events||0}.`);
  }catch{
   setMessage('Mappinga labojumu neizdevās saglabāt.');
  }finally{setBusyMappingId('');}
 }

 async function toggleMapping(mapping){
  setBusyMappingId(mapping.id);
  try{
   const nextActive=!mapping.active;
   const result=await apiFetch(supabaseUrl,publishableKey,'meets_admin_update_location_mapping',{
    p_session_token:token,
    p_mapping_id:mapping.id,
    p_venue_name:mapping.canonical_venue_name,
    p_address_text:mapping.canonical_address_text||null,
    p_latitude:Number(mapping.latitude),
    p_longitude:Number(mapping.longitude),
    p_active:nextActive
   });
   await loadEvents();
   setMessage(nextActive
    ?`Mapping aktivizēts. Atjaunoti ${result?.updated_events||0} saistītie ieraksti.`
    :'Mapping deaktivizēts. Esošie izlabotie ieraksti netika atgriezti iepriekšējā stāvoklī.');
  }catch{
   setMessage('Mappinga statusu neizdevās mainīt.');
  }finally{setBusyMappingId('');}
 }

 async function toggleSourceVisibility(source){
  if(!source?.id||busySourceId)return;
  const nextVisible=source.map_visible===false;
  setBusySourceId(source.id);
  setSources(current=>current.map(item=>item.id===source.id?{...item,map_visible:nextVisible}:item));
  setMessage('');
  try{
   await apiFetch(supabaseUrl,publishableKey,'meets_admin_update_source_visibility',{
    p_session_token:token,
    p_source_id:source.id,
    p_map_visible:nextVisible
   });
   setMessage(nextVisible
    ?`${source.label||source.domain} ieslēgts publiskajā kartē.`
    :`${source.label||source.domain} paslēpts no publiskās kartes. Importētie dati netika dzēsti.`);
  }catch{
   setSources(current=>current.map(item=>item.id===source.id?{...item,map_visible:source.map_visible!==false}:item));
   setMessage('Datu avota kartes statusu neizdevās saglabāt.');
  }finally{
   setBusySourceId('');
  }
 }

 async function bulkPublish(){
  const ids=[...selectedIds];
  if(!ids.length||bulkLoading)return;
  setBulkLoading(true);setBulkResult(null);
  try{
   const result=await apiFetch(supabaseUrl,publishableKey,'meets_admin_bulk_publish',{
    p_session_token:token,
    p_event_ids:ids
   });
   setBulkResult(result);
   await loadEvents();
   const published=Array.isArray(result?.published)?result.published.length:0;
   const skipped=Array.isArray(result?.skipped)?result.skipped.length:0;
   const errors=Array.isArray(result?.errors)?result.errors.length:0;
   setMessage(`Masveida publicēšana pabeigta: publicēti ${published}, izlaisti ${skipped}, kļūdas ${errors}.`);
  }catch{
   setMessage('Masveida publicēšanu neizdevās pabeigt.');
  }finally{setBulkLoading(false);}
 }
 const today=rigaTodayIso();
 const activeEvents=useMemo(()=>events.filter(event=>eventIsCurrent(event,today)),[events,today]);
 const lffMissingGroups=useMemo(()=>groupMissingLff(activeEvents),[activeEvents]);
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
  for(const e of activeEvents){byStatus[e.status]=(byStatus[e.status]||0)+1;byQuality[e.location_quality]=(byQuality[e.location_quality]||0)+1;}
  return {byStatus,byQuality};
 },[activeEvents]);

 const readyToPublish=useMemo(()=>activeEvents.filter(event=>event.status==='pending_review'&&canPublishEvent(event)),[activeEvents]);
 const publishedNeedsReview=useMemo(()=>activeEvents.filter(event=>event.status==='published'&&!canPublishEvent(event)),[activeEvents]);
 const publishedOk=useMemo(()=>activeEvents.filter(event=>event.status==='published'&&canPublishEvent(event)),[activeEvents]);
 const locationIssues=useMemo(()=>activeEvents.filter(isLocationIssue),[activeEvents]);
 const mappingGroups=useMemo(()=>groupLocationIssues(activeEvents),[activeEvents]);

 const filtered=useMemo(()=>{
  const q=search.trim().toLocaleLowerCase('lv');
  const source=activeEvents;
  return source.filter(e=>
   (!status||e.status===status)&&
   (!quality||e.location_quality===quality)&&
   (!q||[e.title,e.venue_name,e.address_raw,e.municipality,e.settlement,e.location_review_reason,sourceText(e)].some(v=>String(v||'').toLocaleLowerCase('lv').includes(q)))
  ).sort((a,b)=>{
   const qa=qualityMeta(a.location_quality).priority,qb=qualityMeta(b.location_quality).priority;
   if(qa!==qb)return qa-qb;
   return String(a.date_from||'').localeCompare(String(b.date_from||''))||String(a.title).localeCompare(String(b.title),'lv');
  });
 },[activeEvents,search,status,quality]);

 const PAGE_SIZE=50;
 const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const safePage=Math.min(page,pageCount);
 const pageRows=useMemo(()=>filtered.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE),[filtered,safePage]);
 const pageIds=useMemo(()=>pageRows.map(event=>event.id),[pageRows]);
 const allPageSelected=pageIds.length>0&&pageIds.every(id=>selectedIds.has(id));
 const allFilteredSelected=filtered.length>0&&filtered.every(event=>selectedIds.has(event.id));

 useEffect(()=>{if(page>pageCount)setPage(pageCount);},[page,pageCount]);
 useEffect(()=>{setPage(1);setSelectedIds(new Set());},[search,status,quality]);

 function toggleSelected(id){
  setSelectedIds(previous=>{
   const next=new Set(previous);
   if(next.has(id))next.delete(id);else next.add(id);
   return next;
  });
 }
 function selectPage(){
  setSelectedIds(previous=>{
   const next=new Set(previous);
   if(allPageSelected)pageIds.forEach(id=>next.delete(id));
   else pageIds.forEach(id=>next.add(id));
   return next;
  });
 }
 function selectAllFiltered(){
  setSelectedIds(allFilteredSelected?new Set():new Set(filtered.map(event=>event.id)));
 }

 useEffect(()=>{
  if(!isAdmin||!events.length||editing)return;
  const editId=new URLSearchParams(window.location.search).get('edit');
  if(!editId)return;
  const event=events.find(item=>item.id===editId);
  if(!event)return;
  setEditing(event);
  window.history.replaceState(null,'','/admin');
 },[isAdmin,events,editing]);

 if(!authChecked||passwordReady===null)return <div className="admin-login"><p>Pārbaudām admin piekļuvi…</p></div>;

 if(!token||!isAdmin){
  if(passwordReady===false){
   return <form className="admin-login admin-simple-login" onSubmit={setupPassword}>
    <p className="eyebrow">MEETS · admin</p>
    <h2>Aktivizēt admin paroli</h2>
    <p>Vienreizēja aktivizācija. Pēc tās turpmāk izmantosi tikai e-pastu un paroli.</p>

    <label>E-pasts
     <input
      type="email"
      value={email}
      onChange={event=>setEmail(event.target.value)}
      autoComplete="username"
      placeholder="admin@gmail.com"
      autoFocus
     />
    </label>

    <label>Emergency recovery kods
     <input
      type="text"
      value={recoveryCode}
      onChange={event=>setRecoveryCode(event.target.value)}
      autoComplete="off"
      spellCheck={false}
      placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
     />
    </label>

    <label>Jaunā parole
     <input
      type="password"
      value={password}
      onChange={event=>setPassword(event.target.value)}
      autoComplete="new-password"
      placeholder="Vismaz 12 rakstzīmes"
     />
    </label>

    <label>Atkārto paroli
     <input
      type="password"
      value={confirmPassword}
      onChange={event=>setConfirmPassword(event.target.value)}
      autoComplete="new-password"
      placeholder="Atkārto paroli"
     />
    </label>

    <div className="actions">
     <button className="button primary" type="submit" disabled={loading}>
      {loading?'Aktivizē…':'Aktivizēt un ielogoties'}
     </button>
    </div>

    {message&&<p className="sync-text admin-auth-message" role="status">{message}</p>}
   </form>;
  }

  return <form className="admin-login admin-simple-login" onSubmit={login}>
   <p className="eyebrow">MEETS · admin</p>
   <h2>Admin pieslēgšanās</h2>
   <p>Pieslēdzies ar savu admin e-pastu un paroli.</p>

   <label>E-pasts
    <input
     type="email"
     value={email}
     onChange={event=>setEmail(event.target.value)}
     autoComplete="username"
     placeholder="admin@gmail.com"
     autoFocus
    />
   </label>

   <label>Parole
    <input
     type="password"
     value={password}
     onChange={event=>setPassword(event.target.value)}
     autoComplete="current-password"
     placeholder="••••••••••••"
    />
   </label>

   <div className="actions">
    <button className="button primary" type="submit" disabled={loading}>
     {loading?'Pārbaudām…':'Ielogoties'}
    </button>
   </div>

   {message&&<p className="sync-text admin-auth-message" role="status">{message}</p>}
  </form>;
 }

 if(!catalogLoaded){
  return <div className="admin-catalog-error" role="alert">
   <strong>Admin katalogu neizdevās ielādēt.</strong>
   <p>Pasākumu karte un labošanas darbības netiek rādītas, kamēr dati nav veiksmīgi ielādēti.</p>
   <button className="button primary" type="button" onClick={()=>loadEvents()} disabled={loading}>
    {loading?'Ielādē…':'Mēģināt vēlreiz'}
   </button>
  </div>;
 }

 return <>
  <div className="admin-workspace-tabs" role="group" aria-label="Admin darba skati">
   <button
    type="button"
    type="button"
    aria-pressed={workspaceView==='register'}
    className={workspaceView==='register'?'active':''}
    onClick={()=>setWorkspaceView('register')}
   >Ierakstu reģistrs <span>{events.length+userSubmissions.filter(item=>item.status!=='published'||!item.event_id).length}</span></button>
   <button
    type="button"
    role="tab"
    aria-selected={workspaceView==='overview'}
    className={workspaceView==='overview'?'active':''}
    onClick={()=>setWorkspaceView('overview')}
   >Pārskats <span>{readyToPublish.length+publishedNeedsReview.length}</span></button>
   <button type="button" role="tab" aria-selected={workspaceView==='userSubmissions'}
    className={workspaceView==='userSubmissions'?'active':''} onClick={()=>setWorkspaceView('userSubmissions')}>
    Lietotāju pasākumi <span>{userSubmissions.filter(x=>x.status==='pending_review').length}</span>
   </button>
   <button
    type="button"
    role="tab"
    aria-selected={workspaceView==='sources'}
    className={workspaceView==='sources'?'active':''}
    onClick={()=>setWorkspaceView('sources')}
   >Datu avoti <span>{sources.filter(source=>source.map_visible!==false).length}/{sources.length}</span></button>
   <button
    type="button"
    role="tab"
    aria-selected={workspaceView==='mapping'}
    className={workspaceView==='mapping'?'active attention':''}
    onClick={()=>setWorkspaceView('mapping')}
   >Mapping <span>{mappingGroups.length}</span></button>
   <button
    type="button"
    role="tab"
    aria-selected={workspaceView==='all'}
    className={workspaceView==='all'?'active':''}
    onClick={()=>{setWorkspaceView('all');setQuality('');}}
   >Karte / masveida darbības <span>{activeEvents.length}</span></button>
  </div>

  {message&&<p className="sync-text admin-workspace-message" role="status">{message}</p>}

  {workspaceView==='register'&&<AdminEventRegister
   events={events}
   submissions={userSubmissions}
   sources={sources}
   today={today}
   onEditEvent={setEditing}
   onOpenSubmission={item=>{setFocusedSubmissionId(item.id);setWorkspaceView('userSubmissions');}}
   onSaveSubmission={saveUserSubmission}
   onPublish={event=>changeStatus(event,'published')}
   onRefresh={()=>loadEvents()}
   busy={loading}
  />}

  {workspaceView==='overview'&&<>
   <AdminReviewOverview
    events={activeEvents}
    readyToPublish={readyToPublish}
    publishedNeedsReview={publishedNeedsReview}
    publishedOk={publishedOk}
    mappingGroups={mappingGroups}
    mappingsCount={mappings.length}
    onOpenMapping={group=>{
     setWorkspaceView('mapping');
     if(group?.events?.length)setMappingEditing(group);
    }}
    onOpenAll={()=>setWorkspaceView('all')}
    onEditEvent={setEditing}
    onPublish={event=>changeStatus(event,'published')}
   />
   <AdminImportHealth health={importHealth}/>
  </>}

  {workspaceView==='userSubmissions'&&<AdminUserSubmissions items={userSubmissions} focusedId={focusedSubmissionId} onReview={reviewUserSubmission} busy={reviewingSubmission}/>}

  {workspaceView==='sources'&&<AdminSourceChannels
   sources={sources}
   events={activeEvents}
   onToggle={toggleSourceVisibility}
   onEdit={setEditing}
   onPublish={event=>changeStatus(event,'published')}
   busy={loading}
   busySourceId={busySourceId}
  />}

  {workspaceView==='mapping'&&<AdminMappingList
   groups={mappingGroups}
   mappings={mappings}
   onMap={setMappingEditing}
   onEditEvent={setEditing}
   onEditMapping={setMappingRuleEditing}
   onToggleMapping={toggleMapping}
   busyMappingId={busyMappingId}
  />}

  {workspaceView==='all'&&<>
   <div className="admin-sheet-intro">
    <div>
     <p className="eyebrow">Admin darba lapa</p>
     <h2>Aktuālie pasākumi</h2>
     <p>Darba katalogā nerādām beigušos pasākumus. Vairāku dienu pasākums paliek redzams līdz <strong>date_to</strong> datumam. Publicētie ieraksti tiek atsevišķi pārbaudīti pret lokācijas kvalitāti.</p>
    </div>
   </div>

   <div className="admin-summary location-summary">
    <article><strong>{activeEvents.length}</strong><span>Aktuāli</span></article>
    <article className="summary-ok"><strong>{publishedOk.length}</strong><span>Publicēti korekti</span></article>
    <article className="summary-warn"><strong>{readyToPublish.length}</strong><span>Gatavi publicēšanai</span></article>
    <article className="summary-bad"><strong>{publishedNeedsReview.length}</strong><span>Publicēti · jāpārbauda</span></article>
    <article><strong>{locationIssues.length}</strong><span>Lokācijas jālabo</span></article>
    <article><strong>{mappingGroups.length}</strong><span>Neatpazīti aliasi</span></article>
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

   <p className="admin-rule"><strong>Darba princips:</strong> zaļš = publicēts un lokācija korekta; dzeltens = gatavs publicēšanai; sarkans = publicēts, bet lokācija vairs neatbilst publicēšanas noteikumam vai vēl jāsakārto. Atkārtotām vietām izmanto Mapping, lai labojums darbotos arī nākamajos importos.</p>

   <AdminEventMap events={filtered} onEdit={setEditing}/>

   <div className="admin-sheet-head admin-bulk-head">
    <div><strong>Pasākumu saraksts</strong><span>{filtered.length} ieraksti pēc filtriem · lapa {safePage}/{pageCount}</span></div>
    <div className="admin-bulk-actions">
     <span>Atlasīti: <strong>{selectedIds.size}</strong></span>
     <button type="button" className="button compact" onClick={selectPage} disabled={!pageRows.length||bulkLoading}>{allPageSelected?'Noņemt šīs lapas atlasi':'Atlasīt šīs lapas ierakstus'}</button>
     <button type="button" className="button compact" onClick={selectAllFiltered} disabled={!filtered.length||bulkLoading}>{allFilteredSelected?'Noņemt visu filtrēto atlasi':'Atlasīt visus filtrētos ierakstus'}</button>
     <button type="button" className="button primary compact" onClick={bulkPublish} disabled={!selectedIds.size||bulkLoading}>{bulkLoading?'Publicē…':'Publicēt atlasītos'}</button>
    </div>
   </div>
   {bulkResult&&<div className="bulk-result" role="status">
    <strong>Masveida darbības rezultāts</strong>
    <span>Publicēti: {bulkResult.published?.length||0} · Izlaisti: {bulkResult.skipped?.length||0} · Kļūdas: {bulkResult.errors?.length||0}</span>
    {(bulkResult.skipped?.length>0||bulkResult.errors?.length>0)&&<details>
     <summary>Rādīt iemeslus</summary>
     {[...(bulkResult.skipped||[]),...(bulkResult.errors||[])].map((item,index)=>{
      const event=events.find(row=>row.id===item.id);
      return <div key={(item.id||'error')+index}><strong>{event?.title||item.id}</strong> — {item.reason||'Nezināma kļūda'}</div>;
     })}
    </details>}
   </div>}
   <div className="table-scroll" role="region" aria-label="Admin pasākumu tabula" tabIndex={0}>
    <table className="events-table admin-events-table location-review-table">
     <thead><tr>
      <th className="select-column"><input type="checkbox" checked={allPageSelected} onChange={selectPage} aria-label="Atlasīt vai noņemt šīs lapas ierakstus"/></th>
      <th>Datums</th><th>Pasākums</th><th>Publicēšanas pārbaude</th><th>Lokācijas kvalitāte</th><th>Kāpēc jāpārbauda</th><th>Norises vieta</th><th>Avots</th><th>Darbības</th>
     </tr></thead>
     <tbody>
      {pageRows.map(event=>{
       const meta=qualityMeta(event.location_quality);
       const publication=publicationMeta(event);
       return <tr key={event.id} className={publication.key==='published-ok'?'location-ok':publication.key==='ready'?'location-ready':'location-needs-review'}>
        <td className="select-column"><input type="checkbox" checked={selectedIds.has(event.id)} onChange={()=>toggleSelected(event.id)} aria-label={'Atlasīt '+event.title}/></td>
        <td>{dateRangeText(event)}</td>
        <td><strong>{event.title}</strong><small className="table-subline">{event.status}</small></td>
        <td><span className={'quality-badge '+publication.tone}>{publication.label}</span></td>
        <td><span className={'quality-badge '+meta.tone}>{meta.label}</span></td>
        <td className="reason-cell">{isLocationIssue(event)?locationIssueReason(event):(event.location_review_reason||'Lokācija verificēta.')}</td>
        <td>
         <strong>{event.venue_name||event.address_raw||'—'}</strong>
         <small className="table-subline">{event.address_raw&&event.address_raw!==event.venue_name?event.address_raw+' · ':''}{event.municipality||event.settlement||''}</small>
         <small className="table-subline">{event.latitude!=null&&event.longitude!=null?Number(event.latitude).toFixed(5)+', '+Number(event.longitude).toFixed(5):'Nav koordinātu'}</small>
        </td>
        <td>{sourceLinks(event).length?sourceLinks(event).map((s,i)=><span key={(s.url||'')+i} className="source-link-row"><a href={s.url} target="_blank" rel="noreferrer">{s.source||'Avots'} ↗</a></span>):sourceText(event)}</td>
        <td><div className="admin-actions">
         {canPublishEvent(event)&&event.status!=='published'&&<button className="text-button strong-action" onClick={()=>changeStatus(event,'published')}>Publicēt</button>}
         {event.status==='published'&&<button className="text-button" onClick={()=>changeStatus(event,'pending_review')}>Atgriezt pārbaudei</button>}
         <button className="button compact" onClick={()=>setEditing(event)}>{isLocationIssue(event)?'Labot adresi / karti':'Pārbaudīt adresi / karti'}</button>
        </div></td>
       </tr>;
      })}
     </tbody>
    </table>
   </div>
   <div className="admin-pagination">
    <button type="button" className="button compact" onClick={()=>setPage(value=>Math.max(1,value-1))} disabled={safePage<=1}>← Iepriekšējā</button>
    <span>{safePage}. lapa no {pageCount}</span>
    <button type="button" className="button compact" onClick={()=>setPage(value=>Math.min(pageCount,value+1))} disabled={safePage>=pageCount}>Nākamā →</button>
   </div>
   <p className="sync-text"><strong>{filtered.length}</strong> no {activeEvents.length} aktuālajiem ierakstiem. Beigušies pasākumi šajā darba skatā netiek rādīti.</p>
  </>}

  {mappingEditing&&<LocationEditor
   event={mappingEditing.events[0]}
   token={token}
   mode="mapping"
   mappingAlias={mappingEditing.alias}
   mappingCount={mappingEditing.events.length}
   close={()=>setMappingEditing(null)}
   save={values=>saveMapping(mappingEditing,values)}
  />}

  {mappingRuleEditing&&<LocationEditor
   event={{
    venue_name:mappingRuleEditing.canonical_venue_name,
    address_raw:mappingRuleEditing.canonical_address_text,
    latitude:mappingRuleEditing.latitude,
    longitude:mappingRuleEditing.longitude,
    municipality:mappingRuleEditing.municipality,
    country_code:mappingRuleEditing.country_code,
    location_quality:'verified_exact',
    sources:[]
   }}
   token={token}
   mode="saved-mapping"
   mappingAlias={mappingRuleEditing.alias_text}
   mappingCount={mappingRuleEditing.current_events||0}
   close={()=>setMappingRuleEditing(null)}
   save={values=>updateMapping(mappingRuleEditing,values)}
  />}

  {editing&&<LocationEditor event={editing} token={token} close={()=>setEditing(null)} save={(values,publish)=>saveLocation(editing,values,publish)}/>} 
 </>;
}

function LocationEditor({event,token,close,save,mode='event',mappingAlias='',mappingCount=1}){
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
   if(!data.results?.length)setSearchError('Baltijā netika atrasts neviens atbilstošs variants. Pamēģini saīsināt vai precizēt adresi.');
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
 const isMapping=mode==='mapping'||mode==='saved-mapping';
 const isSavedMapping=mode==='saved-mapping';

 return <dialog ref={dialog} className="event-dialog location-dialog" onCancel={close} onClose={close}>
  <div className="detail-header"><div><p className="eyebrow">{isMapping?'Atkārtoti izmantojams mapping':'Lokācijas pārbaude'}</p><h2>{isMapping?(mappingAlias||event.venue_name||event.address_raw):event.title}</h2></div><button className="button" onClick={close}>Aizvērt ✕</button></div>

  <div className={'location-issue-panel '+meta.tone}>
   <strong>{isMapping?`${mappingCount} esoši pasākumi ar šo aliasu`:meta.label}</strong>
   <p>{isSavedMapping
    ?'Labojot mappingu, ar šo mapping ID jau saistītie ieraksti tiks atjaunoti; nākamie importi izmantos jauno korekciju.'
    :isMapping
     ?'Saglabājot mappingu, esošie ieraksti tiks salaboti uzreiz un nākamajos importos šis pats nosaukums automātiski saņems apstiprināto vietu.'
     :(event.location_review_reason||'Lokācija pašlaik ir verificēta.')}</p>
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
   {isMapping
    ?<button className="button primary" disabled={!canSave} onClick={()=>save({venueName,addressText,latitude,longitude,locationSource})}>{isSavedMapping?'Saglabāt mappinga labojumu':'Saglabāt mappingu un labot '+mappingCount}</button>
    :<>
      <button className="button" disabled={!canSave} onClick={()=>save({venueName,addressText,latitude,longitude,locationSource},false)}>Saglabāt verificētu lokāciju</button>
      <button className="button primary" disabled={!canSave} onClick={()=>save({venueName,addressText,latitude,longitude,locationSource},true)}>Saglabāt un publicēt</button>
     </>}
   <button className="button" onClick={close}>Atcelt</button>
  </div>
 </dialog>;
}
