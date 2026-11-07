'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import AdminEventMap from './admin-event-map.jsx';
import AdminReviewOverview from './admin-review-overview.jsx';
import AdminMappingList from './admin-mapping-list.jsx';
import AdminImportHealth,{importProblemCount} from './admin-import-health.jsx';
import AdminSourceChannels from './admin-source-channels.jsx';
import AdminCalendarFeeds from './admin-calendar-feeds.jsx';
import AdminUserSubmissions from './admin-user-submissions.jsx';
import AdminEventRegister from './admin-event-register.jsx';
import AdminOrganizers from './admin-organizers.jsx';
import {rigaTodayIso} from '../../lib/event-date.js';
import {pendingSubmissions} from '../../lib/admin-submissions.js';
import {groupCandidates,groupSuggestedAt} from '../../lib/admin-location.js';
import {adminAuthorization,adminRpc} from '../../lib/admin-auth.js';
import {useAccountSession} from '../../lib/account-store.js';
import {useAdminSession} from '../use-admin-session.js';
import {adminPriorities,upcomingWithoutPlace} from '../../lib/admin-priorities.js';
import {auditEvents,BUCKETS,BUCKET_ORDER,CHECKS,issueLabels,nextInQueue,toCsv} from '../../lib/admin-checks.js';

// Views and filters live in the address, so a reload or a shared link opens the same list.
const VIEWS=['overview','userSubmissions','organizers','mapping','all','register','sources'];
const STATUS_OPTIONS=[['pending_review','Gaida pārbaudi'],['published','Publicēts'],['draft','Melnraksts'],['cancelled','Atcelts'],['archived','Arhivēts']];
function readUrlState(){
 if(typeof window==='undefined')return {};
 const p=new URLSearchParams(window.location.search);
 return {view:VIEWS.includes(p.get('view'))?p.get('view'):'',bucket:BUCKETS[p.get('bucket')]?p.get('bucket'):'',issue:CHECKS[p.get('issue')]?p.get('issue'):'',
  q:p.get('q')||'',status:p.get('status')||'',quality:p.get('quality')||''};
}
function dropUrlParam(name){
 const url=new URL(window.location.href);url.searchParams.delete(name);
 window.history.replaceState(null,'',url.pathname+(url.search||''));
}
function isTyping(target){
 const tag=String(target?.tagName||'').toLowerCase();
 return tag==='input'||tag==='textarea'||tag==='select'||target?.isContentEditable;
}

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
function publishedText(count){
 const n=Number(count)||0;
 if(!n)return 'Pasākumi paliek pārbaudē (nav importēti vai avots ir paslēpts).';
 return (n%10===1&&n%100!==11?n+' pasākums publicēts':n+' pasākumi publicēti')+' kartē un sarakstā.';
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
  .map(group=>({...group,sources:[...group.sources].sort(),qualities:[...group.qualities],
   candidates:groupCandidates(group.events),suggestedAt:groupSuggestedAt(group.events)}))
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
export default function AdminDashboard({supabaseUrl,publishableKey}){
 const {session}=useAccountSession();
 const {isAdmin,checked:authChecked}=useAdminSession();
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
 const [bucket,setBucket]=useState('');
 const [issue,setIssue]=useState('');
 const [urlReady,setUrlReady]=useState(false);
 const [editQueue,setEditQueue]=useState([]);
 const [actions,setActions]=useState([]);
 const [toastUndo,setToastUndo]=useState(null);
 const [loadedAt,setLoadedAt]=useState(null);
 const [loadSeconds,setLoadSeconds]=useState(0);
 const [focusRow,setFocusRow]=useState(-1);
 const [compact,setCompact]=useState(false);
 const [showShortcuts,setShowShortcuts]=useState(false);
 const searchRef=useRef(null);
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
 const [placeSearch,setPlaceSearch]=useState(null);
 const [submissionMatches,setSubmissionMatches]=useState({}),[emailStatus,setEmailStatus]=useState(null);
 const [organizations,setOrganizations]=useState([]),[bulkProgress,setBulkProgress]=useState('');

 // A busy database can time out once (e.g. right after approving many places): try again shortly.
 async function rpcWithRetry(path,body={}){
  try{return await adminRpc(supabaseUrl,publishableKey,path,body);}
  catch(error){
   if(error?.status===401||error?.status===403)throw error;
   await new Promise(resolve=>setTimeout(resolve,1500));
   return adminRpc(supabaseUrl,publishableKey,path,body);
  }
 }
 // The catalogue arrives as one header and rows of values (3x smaller than objects).
 function decodeRows(data){
  if(Array.isArray(data?.events))return data.events;
  const fields=Array.isArray(data?.fields)?data.fields:[];
  return (Array.isArray(data?.rows)?data.rows:[]).map(row=>{
   const event={};
   fields.forEach((field,i)=>{if(row[i]!==null&&row[i]!==undefined)event[field]=row[i];});
   return event;
  });
 }
 // Events that ended in the last 14 days are only for the register: loaded after the rest.
 const pastLoadedRef=useRef(false);
 const [pastEvents,setPastEvents]=useState([]);
 async function loadPastEvents(){
  if(pastLoadedRef.current)return;
  pastLoadedRef.current=true;
  try{setPastEvents(decodeRows(await rpcWithRetry('meets_admin_catalog_rows',{p_past:true})));}
  catch{pastLoadedRef.current=false;}
 }
 async function loadEvents({quiet=false}={}){
  if(!quiet)setLoading(true);
  try{
   const [data,mappingData,healthData,sourceData,submissionData]=await Promise.all([
    rpcWithRetry('meets_admin_catalog_rows',{p_past:false}),
    rpcWithRetry('meets_admin_location_mapping_catalog'),
    rpcWithRetry('meets_admin_import_health'),
    rpcWithRetry('meets_admin_source_visibility_catalog'),
    rpcWithRetry('meets_admin_user_submissions')
   ]);
   setEvents(decodeRows(data));
   setTimeout(loadPastEvents,0);
   setMappings(Array.isArray(mappingData?.mappings)?mappingData.mappings:[]);
   setImportHealth(healthData&&typeof healthData==='object'?healthData:{sports:[],municipalities:[]});
   setSources(Array.isArray(sourceData?.sources)?sourceData.sources:[]);
   setUserSubmissions(Array.isArray(submissionData)?submissionData:[]);
   // A background reload after an action keeps its result and the selection.
   if(!quiet){setSelectedIds(new Set());setBulkResult(null);}
   setCatalogLoaded(true);setLoadedAt(Date.now());
   if(!quiet)setMessage('');
   adminRpc(supabaseUrl,publishableKey,'meets_admin_email_status',{}).then(setEmailStatus).catch(()=>setEmailStatus(null));
   loadPlaceSearch();
   adminRpc(supabaseUrl,publishableKey,'meets_admin_organizations',{}).then(list=>setOrganizations(Array.isArray(list)?list:[])).catch(()=>{});
  }catch{
   // Data already on screen stays usable; only a first load without data shows the error panel.
   if(catalogLoadedRef.current)setMessage('Datus neizdevās atjaunot — rāda pēdējos ielādētos. Nospied “Pārlasīt”, lai mēģinātu vēlreiz.');
   else{setCatalogLoaded(false);setMessage('Admin datus neizdevās ielādēt.');}
  }finally{setLoading(false);}
 }
 const catalogLoadedRef=useRef(false);
 useEffect(()=>{catalogLoadedRef.current=catalogLoaded;},[catalogLoaded]);
 // Loads the workspace once the signed-in account is confirmed as admin.
 const adminUserId=isAdmin?session?.user?.id:'';
 useEffect(()=>{if(adminUserId)loadEvents();},[adminUserId]);
 // Messages stay long enough to read, then clear themselves.
 useEffect(()=>{if(!message){setToastUndo(null);return;}const t=setTimeout(()=>setMessage(''),12000);return()=>clearTimeout(t);},[message]);
 // Every change is logged for this session; most can be undone from the toast or the overview.
 function logAction(text,undo=null){
  const id=Date.now()+'-'+Math.random().toString(36).slice(2,7);
  setActions(list=>[{id,at:Date.now(),text,undo},...list].slice(0,40));
  setMessage(text);setToastUndo(undo?{id,run:undo}:null);
 }
 async function undoAction(action){
  const target=action.run?action:actions.find(a=>a.id===action.id);
  const run=action.run||action.undo;
  if(!run)return;
  setActions(list=>list.map(a=>a.id===(target?.id||action.id)?{...a,undone:true}:a));
  setToastUndo(null);
  try{await run();}catch{setMessage('Atsaukt neizdevās. Pārbaudi ierakstu sarakstā.');}
 }
 // Reads the view and filters from the address once, then keeps the address in sync.
 useEffect(()=>{
  const state=readUrlState();
  if(state.view)setWorkspaceView(state.view);
  if(state.bucket)setBucket(state.bucket);
  if(state.issue)setIssue(state.issue);
  if(state.q)setSearch(state.q);
  if(state.status)setStatus(state.status);
  if(state.quality)setQuality(state.quality);
  setUrlReady(true);
 },[]);
 useEffect(()=>{
  if(!urlReady)return;
  const url=new URL(window.location.href);
  const keep=['submission','edit'].map(k=>[k,url.searchParams.get(k)]).filter(([,v])=>v);
  const p=new URLSearchParams();
  if(workspaceView!=='overview')p.set('view',workspaceView);
  if(workspaceView==='all'){
   if(bucket)p.set('bucket',bucket);if(issue)p.set('issue',issue);
   if(search.trim())p.set('q',search.trim());if(status)p.set('status',status);if(quality)p.set('quality',quality);
  }
  for(const [k,v] of keep)p.set(k,v);
  const next='/admin'+(p.toString()?'?'+p.toString():'');
  if(next!==url.pathname+url.search)window.history.replaceState(null,'',next);
 },[urlReady,workspaceView,bucket,issue,search,status,quality]);
 // First load can take a few seconds: show how long it has been.
 useEffect(()=>{
  if(catalogLoaded||!adminUserId)return;
  const started=Date.now();setLoadSeconds(0);
  const t=setInterval(()=>setLoadSeconds(Math.round((Date.now()-started)/1000)),1000);
  return()=>clearInterval(t);
 },[catalogLoaded,adminUserId]);

 async function saveUserSubmission(values){
  if(!values?.id)throw new Error('Nav ieraksta identifikatora.');
  try{
   await adminRpc(supabaseUrl,publishableKey,'meets_admin_edit_user_submission',{
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

 // action: publish | request_changes | decline. The organizer is e-mailed by the database.
 async function reviewUserSubmission(item,action,reason,note,latitude=null,longitude=null){
  setReviewingSubmission(true);setMessage('');
  try{
   await adminRpc(supabaseUrl,publishableKey,'meets_admin_review_submission_v3',{p_id:item.id,p_action:action,p_reason:reason,p_note:note,
    p_latitude:latitude,p_longitude:longitude});
   // The next waiting submission comes into view, so the review continues without searching.
   const queue=submissionQueue.items.map(x=>x.id);
   const nextId=nextInQueue(queue,item.id);
   await loadEvents();
   if(nextId){setFocusedSubmissionId(nextId);setTimeout(()=>document.getElementById('submission-'+nextId)?.scrollIntoView({behavior:'smooth',block:'start'}),150);}
   setActions(list=>[{id:Date.now()+'-s',at:Date.now(),text:`Iesniegums “${item.title||'bez nosaukuma'}”: ${({publish:'publicēts',request_changes:'lūgts precizēt',decline:'noraidīts'})[action]}.`},...list].slice(0,40));
   setMessage({publish:'Pasākums publicēts kartē.',request_changes:'Rīkotājam nosūtīts lūgums precizēt.',decline:'Pasākums noraidīts.'}[action]+' Rīkotājs saņems e-pastu.');
  }catch(error){
   let detail='';try{detail=JSON.parse(error.message).message||'';}catch{}
   throw new Error(detail&&!/unauthorized/i.test(detail)?detail:'Iesnieguma apstrāde neizdevās. Pārbaudi vietu un obligātos laukus.');
  }
  finally{setReviewingSubmission(false);}
 }
 async function searchSubmissionPlace(item){
  const query=[item.venue_name,item.address].map(x=>String(x||'').trim()).filter(Boolean).join(', ');
  if(query.length<3)throw new Error('Nav nosaukuma vai adreses, ko meklēt.');
  const response=await fetch('/api/admin/geocode',{method:'POST',headers:{Authorization:await adminAuthorization(),'Content-Type':'application/json'},
   body:JSON.stringify({query,venueName:item.venue_name||query})});
  const data=await response.json();
  if(!response.ok)throw new Error(data?.error||'Meklēšana neizdevās.');
  return (Array.isArray(data.results)?data.results:[]).slice(0,5);
 }

 async function setStatusOnly(id,newStatus){
  await adminRpc(supabaseUrl,publishableKey,'meets_admin_update_event',{p_event_id:id,p_status:newStatus,p_venue_name:null,p_latitude:null,p_longitude:null});
  setEvents(list=>list.map(item=>item.id===id?{...item,status:newStatus}:item));
 }
 const STATUS_TEXT={published:'publicēts kartē un sarakstā',pending_review:'atgriezts pārbaudei',archived:'arhivēts (paslēpts)',cancelled:'atzīmēts kā atcelts',draft:'pārvērsts par melnrakstu'};
 async function changeStatus(event,newStatus,{undoing=false}={}){
  if(newStatus==='published'&&!canPublishEvent(event)){
   setMessage('Publicēt drīkst tikai pasākumu ar precīzi verificētu lokāciju. Tiešsaistes pasākums ir izņēmums.');
   return;
  }
  const previous=event.status;
  setLoading(true);
  try{
   await setStatusOnly(event.id,newStatus);
   const text=`“${event.title}” ${STATUS_TEXT[newStatus]||'atjaunots'}.`;
   if(undoing)setMessage('Atsaukts: '+text);
   else logAction(text,previous&&previous!==newStatus?()=>changeStatus({...event,status:newStatus},previous,{undoing:true}):null);
   loadEvents({quiet:true});
  }catch{setMessage('Statusu neizdevās mainīt.');}
  finally{setLoading(false);}
 }
 // Opens the location editor; `queue` is the work list it walks with "Saglabāt un nākamais".
 function openEditor(event,queue=[]){
  setEditQueue(Array.isArray(queue)&&queue.includes(event.id)?queue:[]);
  setEditing(event);
 }
 const doneIdsRef=useRef(new Set());
 function nextEditable(currentId){
  const byId=new Map(events.map(e=>[e.id,e]));
  const id=nextInQueue(editQueue,currentId,id=>doneIdsRef.current.has(id)||!byId.get(id)||!isLocationIssue(byId.get(id)));
  return id?byId.get(id):null;
 }
 async function saveLocation(event,values,publish,goNext=false){
  setLoading(true);
  try{
   await adminRpc(supabaseUrl,publishableKey,'meets_admin_update_event_v2',{p_event_id:event.id,p_status:publish?'published':null,p_venue_name:values.venueName,
    p_address_text:values.addressText||null,p_location_source:values.locationSource||null,
    p_latitude:Number(values.latitude),p_longitude:Number(values.longitude)
   });
   doneIdsRef.current.add(event.id);
   const next=goNext?nextEditable(event.id):null;
   setEditing(next);
   setEvents(list=>list.map(item=>item.id===event.id?{...item,status:publish?'published':item.status,location_quality:'verified_exact',
    venue_name:values.venueName,latitude:Number(values.latitude),longitude:Number(values.longitude)}:item));
   const previous=event.status;
   logAction(publish?`Vieta verificēta un “${event.title}” publicēts.`:`Vieta verificēta: “${event.title}”. Paliek pārbaudē līdz publicēšanai.`,
    publish&&previous!=='published'?()=>changeStatus({...event,status:'published'},previous,{undoing:true}):null);
   loadEvents({quiet:true});
  }catch{setMessage('Lokāciju neizdevās saglabāt.');}
  finally{setLoading(false);}
 }

 // The place's events count as verified at once, so the Mapping list updates without waiting for a reload.
 function markPlaceVerified(group,values){
  const ids=new Set(group.events.map(event=>event.id));
  setEvents(list=>list.map(event=>ids.has(event.id)?{...event,location_quality:'verified_exact',venue_name:values.venueName,
   latitude:Number(values.latitude),longitude:Number(values.longitude)}:event));
 }
 function nextMappingGroup(group){
  const list=mappingGroups.filter(g=>g.alias);
  const index=list.findIndex(g=>g.key===group.key);
  return list.slice(index+1).find(g=>g.key!==group.key)||list.slice(0,Math.max(0,index)).find(g=>g.key!==group.key)||null;
 }
 async function saveMapping(group,values,goNext=false){
  const next=goNext?nextMappingGroup(group):null;
  setLoading(true);
  try{
   const result=await adminRpc(supabaseUrl,publishableKey,'meets_admin_save_location_mapping',{
    p_sample_event_id:group.events[0].id,
    p_venue_name:values.venueName,
    p_address_text:values.addressText||null,
    p_latitude:Number(values.latitude),
    p_longitude:Number(values.longitude)
   });
   setMappingEditing(next);
   markPlaceVerified(group,values);
   doneIdsRef.current=new Set([...doneIdsRef.current,...group.events.map(e=>e.id)]);
   logAction(`Vieta apstiprināta: “${result?.alias_text||group.alias}”. ${publishedText(result?.published_events)} Nākamie importi šo vietu piemēros automātiski.`);
   loadEvents({quiet:true});
  }catch{
   setMessage('Vietas sasaisti neizdevās saglabāt. Pārbaudi vietu, adresi un koordinātas.');
  }finally{setLoading(false);}
 }

 // Address suggestions are searched in the background by the database; this shows how far it is.
 async function loadPlaceSearch(){
  try{
   const [search,register]=await Promise.all([
    adminRpc(supabaseUrl,publishableKey,'meets_admin_place_search_status',{}),
    adminRpc(supabaseUrl,publishableKey,'meets_admin_address_register_status',{}).catch(()=>null)
   ]);
   setPlaceSearch(search?{...search,register}:null);
  }catch{setPlaceSearch(null);}
 }
 async function retryPlaceSearch(){
  try{
   const result=await adminRpc(supabaseUrl,publishableKey,'meets_admin_place_search_retry',{});
   setMessage(`Adreses tiks meklētas vēlreiz ${result?.retried||0} vietām; jaunas vietas pievienotas meklēšanai.`);
   await loadPlaceSearch();
  }catch{setMessage('Atkārtotu meklēšanu neizdevās sākt.');}
 }
 // Saves every confident suggestion as a mapping, then reloads once.
 async function acceptManySuggestions(items){
  const total=items.reduce((sum,x)=>sum+x.group.events.length,0);
  if(!window.confirm(`Apstiprināt ${items.length} vietas (${total} pasākumi)? Gatavie pasākumi uzreiz tiks publicēti. Vietu sasaisti var vēlāk labot vai izslēgt sadaļā “Vietas → Sakārtoti”.`))return;
  let saved=0,failed=0,published=0;
  for(const [index,{group,candidate}] of items.entries()){
   setBulkProgress(`Saglabā ${index+1}/${items.length}: ${group.alias}`);
   try{
    const result=await adminRpc(supabaseUrl,publishableKey,'meets_admin_save_location_mapping',{p_sample_event_id:group.events[0].id,p_venue_name:group.alias,
     p_address_text:candidate.displayName||candidate.label||group.alias,p_latitude:Number(candidate.latitude),p_longitude:Number(candidate.longitude)});
    markPlaceVerified(group,{venueName:group.alias,latitude:candidate.latitude,longitude:candidate.longitude});
    published+=Number(result?.published_events)||0;
    saved++;
   }catch{failed++;}
  }
  setBulkProgress('');
  logAction(`${saved===1?'Apstiprināta 1 vieta':'Apstiprinātas '+saved+' vietas'}${failed?', '+failed+' neizdevās — tās paliek sarakstā':''}. ${publishedText(published)} Nākamie importi tās piemēros automātiski.`);
  loadEvents({quiet:true});
 }
 async function setOrganizationTrust(organization,trusted){
  try{
   await adminRpc(supabaseUrl,publishableKey,'meets_admin_set_organization_trust',{p_organization_id:organization.id,p_trusted:trusted});
   setOrganizations(list=>list.map(o=>o.id===organization.id?{...o,trusted,suggested:false}:o));
   setMessage(trusted?`“${organization.name}” pasākumi turpmāk tiks publicēti automātiski, ja pārbaudes būs kārtībā.`:`“${organization.name}” pasākumi atkal tiks pārbaudīti manuāli.`);
  }catch{setMessage('Rīkotāja statusu neizdevās mainīt.');}
 }
 async function acceptSuggestion(group,candidate){
  await saveMapping(group,{venueName:group.alias,addressText:candidate.displayName||candidate.label||group.alias,
   latitude:candidate.latitude,longitude:candidate.longitude});
 }

 async function updateMapping(mapping,values){
  setBusyMappingId(mapping.id);
  try{
   const result=await adminRpc(supabaseUrl,publishableKey,'meets_admin_update_location_mapping',{
    p_mapping_id:mapping.id,
    p_venue_name:values.venueName,
    p_address_text:values.addressText||null,
    p_latitude:Number(values.latitude),
    p_longitude:Number(values.longitude),
    p_active:true
   });
   setMappingRuleEditing(null);
   await loadEvents();
   setMessage(`Vietas sasaiste atjaunota. Saistītie ieraksti atjaunoti: ${result?.updated_events||0}.`);
  }catch{
   setMessage('Vietas sasaistes labojumu neizdevās saglabāt.');
  }finally{setBusyMappingId('');}
 }

 async function toggleMapping(mapping){
  setBusyMappingId(mapping.id);
  try{
   const nextActive=!mapping.active;
   const result=await adminRpc(supabaseUrl,publishableKey,'meets_admin_update_location_mapping',{
    p_mapping_id:mapping.id,
    p_venue_name:mapping.canonical_venue_name,
    p_address_text:mapping.canonical_address_text||null,
    p_latitude:Number(mapping.latitude),
    p_longitude:Number(mapping.longitude),
    p_active:nextActive
   });
   await loadEvents();
   setMessage(nextActive
    ?`Vietas sasaiste ieslēgta. Atjaunoti ${result?.updated_events||0} saistītie ieraksti.`
    :'Vietas sasaiste izslēgta. Esošie izlabotie ieraksti netika atgriezti iepriekšējā stāvoklī.');
  }catch{
   setMessage('Vietas sasaistes statusu neizdevās mainīt.');
  }finally{setBusyMappingId('');}
 }

 async function toggleSourceVisibility(source){
  if(!source?.id||busySourceId)return;
  const nextVisible=source.map_visible===false;
  setBusySourceId(source.id);
  setSources(current=>current.map(item=>item.id===source.id?{...item,map_visible:nextVisible}:item));
  setMessage('');
  try{
   await adminRpc(supabaseUrl,publishableKey,'meets_admin_update_source_visibility',{
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

 async function bulkPublish(idsArg=null){
  const ids=idsArg||[...selectedIds];
  if(!ids.length||bulkLoading)return;
  if(!window.confirm(`Publicēt ${ids.length} ${ids.length%10===1&&ids.length%100!==11?'pasākumu':'pasākumus'}? Tie uzreiz parādīsies kartē un sarakstā. Pasākumi bez verificētas vietas tiks izlaisti.`))return;
  setBulkLoading(true);setBulkResult(null);
  try{
   const result=await adminRpc(supabaseUrl,publishableKey,'meets_admin_bulk_publish',{
    p_event_ids:ids
   });
   setBulkResult(result);
   const publishedIds=new Set((Array.isArray(result?.published)?result.published:[]).map(item=>String(item?.id??item)));
   setEvents(list=>list.map(item=>publishedIds.has(String(item.id))?{...item,status:'published'}:item));
   setSelectedIds(new Set());
   loadEvents({quiet:true});
   const published=publishedIds.size;
   const skipped=Array.isArray(result?.skipped)?result.skipped.length:0;
   const errors=Array.isArray(result?.errors)?result.errors.length:0;
   const undoIds=[...publishedIds];
   logAction(`Masveida publicēšana: publicēti ${published}, izlaisti ${skipped}, kļūdas ${errors}.`,published?async()=>{
    let back=0;for(const id of undoIds){try{await setStatusOnly(id,'pending_review');back++;}catch{}}
    setMessage(`Atsaukts: ${back} pasākumi atgriezti pārbaudei.`);loadEvents({quiet:true});
   }:null);
  }catch{
   setMessage('Masveida publicēšanu neizdevās pabeigt.');
  }finally{setBulkLoading(false);}
 }
 const today=rigaTodayIso();
 const submissionQueue=useMemo(()=>pendingSubmissions(userSubmissions,today),[userSubmissions,today]);
 const activeEvents=useMemo(()=>events.filter(event=>eventIsCurrent(event,today)),[events,today]);
 const registerEvents=useMemo(()=>{const ids=new Set(events.map(e=>e.id));return [...events,...pastEvents.filter(e=>!ids.has(e.id))];},[events,pastEvents]);
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
     headers:{Authorization:await adminAuthorization(),'Content-Type':'application/json'},
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
    await adminRpc(supabaseUrl,publishableKey,'meets_admin_store_location_candidates',{
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
   const result=await adminRpc(supabaseUrl,publishableKey,'meets_admin_apply_location_candidate',{
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
 const audit=useMemo(()=>auditEvents(activeEvents),[activeEvents]);
 const auditById=useMemo(()=>new Map(audit.rows.map(row=>[row.event.id,row])),[audit]);
 const reviewRows=useMemo(()=>audit.rows.filter(row=>row.bucket==='review').map(row=>row.event),[audit]);
 const duplicateCount=useMemo(()=>audit.rows.filter(row=>row.issues.includes('duplicate')&&row.bucket!=='other').length,[audit]);
 const importProblems=useMemo(()=>importProblemCount(importHealth),[importHealth]);
 const priorities=useMemo(()=>adminPriorities({submissionQueue,publishedNeedsReview:reviewRows,readyToPublish,mappingGroups,
  upcoming:upcomingWithoutPlace(activeEvents,isLocationIssue,today),duplicates:duplicateCount,importProblems}),[submissionQueue,reviewRows,readyToPublish,mappingGroups,activeEvents,today,duplicateCount,importProblems]);
 const doneToday=useMemo(()=>actions.filter(a=>!a.undone).length,[actions]);

 const filtered=useMemo(()=>{
  const q=search.trim().toLocaleLowerCase('lv');
  const source=activeEvents;
  return source.filter(e=>
   (!bucket||auditById.get(e.id)?.bucket===bucket)&&
   (!issue||auditById.get(e.id)?.issues.includes(issue))&&
   (!status||e.status===status)&&
   (!quality||e.location_quality===quality)&&
   (!q||[e.title,e.venue_name,e.address_raw,e.municipality,e.settlement,e.location_review_reason,sourceText(e)].some(v=>String(v||'').toLocaleLowerCase('lv').includes(q)))
  ).sort((a,b)=>{
   const qa=qualityMeta(a.location_quality).priority,qb=qualityMeta(b.location_quality).priority;
   if(qa!==qb)return qa-qb;
   return String(a.date_from||'').localeCompare(String(b.date_from||''))||String(a.title).localeCompare(String(b.title),'lv');
  });
 },[activeEvents,search,status,quality,bucket,issue,auditById]);

 const PAGE_SIZE=50;
 const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const safePage=Math.min(page,pageCount);
 const pageRows=useMemo(()=>filtered.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE),[filtered,safePage]);
 const pageIds=useMemo(()=>pageRows.map(event=>event.id),[pageRows]);
 const allPageSelected=pageIds.length>0&&pageIds.every(id=>selectedIds.has(id));
 const allFilteredSelected=filtered.length>0&&filtered.every(event=>selectedIds.has(event.id));

 useEffect(()=>{if(page>pageCount)setPage(pageCount);},[page,pageCount]);
 useEffect(()=>{setPage(1);setSelectedIds(new Set());setFocusRow(-1);},[search,status,quality,bucket,issue]);
 // Opens the full list with one block and, optionally, one reason.
 function openBucket(nextBucket,nextIssue=''){
  setBucket(nextBucket||'');setIssue(nextIssue||'');setStatus('');setQuality('');setSearch('');
  setWorkspaceView('all');
  window.scrollTo({top:0,behavior:'smooth'});
 }
 function openView(view,filter){
  if(view==='overview-ready'){document.getElementById('admin-ready-list')?.scrollIntoView({behavior:'smooth'});return;}
  if(view==='overview-imports'){document.getElementById('admin-import-health')?.scrollIntoView({behavior:'smooth'});return;}
  if(view==='all'){openBucket(filter?.bucket||'',filter?.issue||'');return;}
  setWorkspaceView(view);
 }
 function publishMany(list){bulkPublish(list.filter(canPublishEvent).map(e=>e.id));}
 function archiveDuplicate(event){changeStatus(event,'archived');}
 function exportCsv(){
  const header=['Datums','Beigas','Laiks','Nosaukums','Statuss','Bloks','Iemesli','Vieta','Adrese','Pašvaldība','Platums','Garums','Avots'];
  const rows=filtered.map(e=>{const row=auditById.get(e.id);return [e.date_from,e.date_to||'',String(e.time_from||'').slice(0,5),e.title,e.status,
   BUCKETS[row?.bucket]?.short||'',issueLabels(row?.issues).join(', '),e.venue_name||'',e.address_raw||'',e.municipality||'',e.latitude??'',e.longitude??'',
   (e.sources||[]).map(s=>s.url).filter(Boolean).join(' ')];});
  const blob=new Blob(['\ufeff'+toCsv(header,rows)],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='meets-admin-'+today+(bucket?'-'+bucket:'')+'.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 }
 async function copyViewLink(){
  try{await navigator.clipboard.writeText(window.location.href);setMessage('Saite uz šo skatu nokopēta.');}
  catch{setMessage('Saiti neizdevās nokopēt — izmanto adreses joslu.');}
 }
 // Keyboard work in the list: j/k move, e edit, p publish, x select, / search, ? help.
 useEffect(()=>{
  if(workspaceView!=='all')return;
  function onKey(e){
   if(e.metaKey||e.ctrlKey||e.altKey||editing||mappingEditing||isTyping(e.target))return;
   const row=pageRows[focusRow];
   if(e.key==='j'||e.key==='ArrowDown'&&e.shiftKey){e.preventDefault();setFocusRow(i=>Math.min(pageRows.length-1,i+1));}
   else if(e.key==='k'||e.key==='ArrowUp'&&e.shiftKey){e.preventDefault();setFocusRow(i=>Math.max(0,i-1));}
   else if((e.key==='e'||e.key==='Enter')&&row){e.preventDefault();openEditor(row,filtered.filter(isLocationIssue).map(x=>x.id));}
   else if(e.key==='p'&&row&&row.status!=='published'&&canPublishEvent(row)){e.preventDefault();changeStatus(row,'published');}
   else if(e.key==='x'&&row){e.preventDefault();toggleSelected(row.id);}
   else if(e.key==='/'){e.preventDefault();searchRef.current?.focus();}
   else if(e.key==='?'){e.preventDefault();setShowShortcuts(v=>!v);}
   else if(e.key==='n'){e.preventDefault();setPage(v=>Math.min(pageCount,v+1));setFocusRow(0);}
   else if(e.key==='b'){e.preventDefault();setPage(v=>Math.max(1,v-1));setFocusRow(0);}
  }
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[workspaceView,pageRows,focusRow,editing,mappingEditing,filtered,pageCount]);
 useEffect(()=>{if(focusRow>=0)document.getElementById('admin-row-'+pageRows[focusRow]?.id)?.scrollIntoView({block:'nearest'});},[focusRow,pageRows]);

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

 // Known places for the submissions waiting for review.
 useEffect(()=>{
  const pending=submissionQueue.items.filter(x=>String(x.venue_name||x.address||'').trim().length>=3);
  if(!isAdmin||!pending.length)return;
  let cancelled=false;
  adminRpc(supabaseUrl,publishableKey,'meets_admin_match_places',{p_places:pending.slice(0,60).map(x=>({key:x.id,name:x.venue_name||x.address}))})
   .then(result=>{if(!cancelled)setSubmissionMatches(Object.fromEntries((result||[]).map(r=>[r.key,r.matches])));})
   .catch(()=>{});
  return()=>{cancelled=true;};
 },[isAdmin,submissionQueue]);
 // E-mail links open /admin?submission=<id>.
 useEffect(()=>{
  if(!isAdmin||!userSubmissions.length)return;
  const id=new URLSearchParams(window.location.search).get('submission');
  if(!id)return;
  setFocusedSubmissionId(id);setWorkspaceView('userSubmissions');
  dropUrlParam('submission');
  window.setTimeout(()=>document.getElementById('submission-'+id)?.scrollIntoView({behavior:'smooth',block:'start'}),100);
 },[isAdmin,userSubmissions]);

 useEffect(()=>{
  if(!isAdmin||!events.length||editing)return;
  const editId=new URLSearchParams(window.location.search).get('edit');
  if(!editId)return;
  const event=events.find(item=>item.id===editId);
  if(!event)return;
  setEditing(event);
  dropUrlParam('edit');
 },[isAdmin,events,editing]);

 if(session===undefined||(session&&!authChecked))return <div className="admin-login"><p role="status">Pārbaudām admin piekļuvi…</p></div>;

 // No public admin sign-in: visitors and accounts without admin rights see the
 // same neutral page. Admins sign in through Mans profils and switch from there.
 if(!session||!isAdmin)return <section className="admin-login admin-simple-login" aria-labelledby="admin-closed-title">
  <h2 id="admin-closed-title">Šī lapa nav pieejama</h2>
  <p>Atgriezies uz sākumlapu vai atver pasākumu karti.</p>
  <div className="actions">
   <a className="button primary" href="/">Uz sākumlapu</a>
   <a className="button" href="/karte">Atvērt karti</a>
  </div>
 </section>;

 if(!catalogLoaded&&!message)return <div className="admin-login admin-loading"><p role="status">Ielādē admin datus… {loadSeconds>0?`(${loadSeconds} s)`:''}</p>
  <small>{loadSeconds<8?'Pasākumi, vietas, avoti un iesniegumi.':'Datu ir daudz — ielāde var ilgt līdz 20 sekundēm. Ja neizdodas, mēģinām vēlreiz automātiski.'}</small>
  <div className="admin-loading-bar" aria-hidden="true"><i style={{width:Math.min(95,loadSeconds*6)+'%'}}/></div></div>;
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
  {submissionQueue.count>0&&workspaceView!=='userSubmissions'&&<div className="admin-submission-alert" role="status">
   <div><strong>{submissionQueue.count===1?'1 rīkotāja pasākums gaida':submissionQueue.count+' rīkotāju pasākumi gaida'} tavu pārbaudi</strong>
    <span>Vecākais iesniegts pirms {submissionQueue.oldestDays} {submissionQueue.oldestDays===1?'dienas':'dienām'}{submissionQueue.expired>0?' · '+(submissionQueue.expired===1?'1 jau noticis':submissionQueue.expired+' jau notikuši')+', jāatgriež rīkotājam':''}</span></div>
   <button type="button" className="button primary" onClick={()=>setWorkspaceView('userSubmissions')}>Izskatīt →</button>
  </div>}
  <div className="admin-workspace-tabs" role="group" aria-label="Admin darba skati">
   {[
    ['overview','Pārskats',audit.counts.critical+audit.counts.review,audit.counts.critical?'attention':''],
    ['userSubmissions','Iesniegumi',submissionQueue.count,submissionQueue.count?'attention':''],
    ['organizers','Rīkotāji',organizations.length,organizations.some(o=>o.suggested&&!o.trusted)?'attention':''],
    ['mapping','Vietas',mappingGroups.length,mappingGroups.length?'attention':''],
    ['all','Visi aktuālie',activeEvents.length,''],
    ['register','Reģistrs',registerEvents.length+userSubmissions.filter(item=>item.status!=='published'||!item.event_id).length,''],
    ['sources','Datu avoti',sources.filter(source=>source.map_visible!==false).length+'/'+sources.length,importProblems?'attention':'']
   ].map(([key,label,count,tone])=><button key={key} type="button" aria-pressed={workspaceView===key}
    className={[workspaceView===key?'active':'',tone].filter(Boolean).join(' ')}
    onClick={()=>{if(key==='all'){setBucket('');setIssue('');}setWorkspaceView(key);}}>{label} <span>{count}</span></button>)}
  </div>

  {message&&<div className="admin-toast" role="status">
   <p>{message}</p>
   {toastUndo&&<button type="button" className="button compact" onClick={()=>undoAction(toastUndo)}>Atsaukt</button>}
   <button type="button" className="text-button" onClick={()=>setMessage('')} aria-label="Aizvērt paziņojumu">✕</button>
  </div>}

  {workspaceView==='register'&&<AdminEventRegister
   events={registerEvents}
   submissions={userSubmissions}
   sources={sources}
   today={today}
   onEditEvent={event=>openEditor(event)}
   onOpenSubmission={item=>{setFocusedSubmissionId(item.id);setWorkspaceView('userSubmissions');}}
   onSaveSubmission={saveUserSubmission}
   onPublish={event=>changeStatus(event,'published')}
   onRefresh={()=>loadEvents()}
   busy={loading}
  />}

  {workspaceView==='overview'&&<>
   <AdminReviewOverview
    audit={audit}
    priorities={priorities}
    emailStatus={emailStatus}
    onOpenView={openView}
    onOpenBucket={openBucket}
    mappingGroups={mappingGroups}
    mappingsCount={mappings.length}
    onOpenMapping={group=>{setWorkspaceView('mapping');if(group?.events?.length)setMappingEditing(group);}}
    onEditEvent={openEditor}
    onPublish={event=>changeStatus(event,'published')}
    onPublishMany={publishMany}
    onArchive={archiveDuplicate}
    actions={actions}
    onUndo={undoAction}
    doneToday={doneToday}
    loadedAt={loadedAt}
    onReload={()=>loadEvents()}
    busy={loading}
    today={today}
   />
   <AdminImportHealth health={importHealth}/>
  </>}

  {workspaceView==='userSubmissions'&&<AdminUserSubmissions items={userSubmissions} focusedId={focusedSubmissionId} onReview={reviewUserSubmission}
   busy={reviewingSubmission} supabaseUrl={supabaseUrl} matches={submissionMatches} onSearchPlace={searchSubmissionPlace}
   organizations={organizations} onSetTrust={setOrganizationTrust}/>}

  {workspaceView==='organizers'&&<AdminOrganizers organizations={organizations} onSetTrust={setOrganizationTrust} busy={loading}/>}

  {workspaceView==='sources'&&<AdminCalendarFeeds supabaseUrl={supabaseUrl} publishableKey={publishableKey}/>}
  {workspaceView==='sources'&&<AdminSourceChannels
   sources={sources}
   events={activeEvents}
   onToggle={toggleSourceVisibility}
   onEdit={event=>openEditor(event)}
   onPublish={event=>changeStatus(event,'published')}
   busy={loading}
   busySourceId={busySourceId}
  />}

  {workspaceView==='mapping'&&<AdminMappingList
   groups={mappingGroups}
   placeSearch={placeSearch}
   onRefreshPlaceSearch={loadEvents}
   onRetryPlaceSearch={retryPlaceSearch}
   onAcceptSuggestion={acceptSuggestion}
   onAcceptMany={acceptManySuggestions}
   bulkProgress={bulkProgress}
   mappings={mappings}
   onMap={setMappingEditing}
   onEditEvent={event=>openEditor(event)}
   onEditMapping={setMappingRuleEditing}
   onToggleMapping={toggleMapping}
   busyMappingId={busyMappingId}
  />}

  {workspaceView==='all'&&<>
   <div className="admin-sheet-intro">
    <div>
     <p className="eyebrow">Visi aktuālie pasākumi</p>
     <h2>{bucket?BUCKETS[bucket].label:'Visi aktuālie pasākumi'}{issue?' · '+CHECKS[issue].label:''}</h2>
     <p>{bucket?BUCKETS[bucket].hint:'Beigušies pasākumi šeit netiek rādīti; vairāku dienu pasākums paliek līdz beigu datumam.'} Īsceļi: <kbd>j</kbd>/<kbd>k</kbd> pārvietoties, <kbd>e</kbd> labot, <kbd>p</kbd> publicēt, <kbd>?</kbd> visi.</p>
    </div>
   </div>

   <div className="admin-bucket-tabs" role="group" aria-label="Bloki">
    <button type="button" aria-pressed={!bucket} className={!bucket?'active':''} onClick={()=>{setBucket('');setIssue('');}}>Visi <span>{activeEvents.length}</span></button>
    {BUCKET_ORDER.map(key=><button key={key} type="button" aria-pressed={bucket===key} className={'bucket-'+key+(bucket===key?' active':'')}
     onClick={()=>{setBucket(bucket===key?'':key);setIssue('');}}>{BUCKETS[key].short} <span>{audit.counts[key]}</span></button>)}
   </div>

   <div className="admin-toolbar admin-toolbar-wide">
    <label>Meklēt<input ref={searchRef} type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pasākums, vieta, problēma, avots… ( / )"/></label>
    <label>Iemesls<select value={issue} onChange={e=>setIssue(e.target.value)}>
     <option value="">Visi</option>
     {Object.entries(CHECKS).map(([value,meta])=><option key={value} value={value}>{meta.label}</option>)}
    </select></label>
    <label>Statuss<select value={status} onChange={e=>setStatus(e.target.value)}>
     <option value="">Visi</option>
     {STATUS_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select></label>
    <label>Vietas kvalitāte<select value={quality} onChange={e=>setQuality(e.target.value)}>
     <option value="">Visas</option>
     {Object.entries(QUALITY).map(([value,meta])=><option key={value} value={value}>{meta.label}</option>)}
    </select></label>
    <button className="button" onClick={()=>loadEvents()} disabled={loading}>{loading?'Ielādē…':'Pārlasīt'}</button>
   </div>
   <div className="admin-view-tools">
    <button type="button" className="text-button" onClick={copyViewLink}>Kopēt saiti uz šo skatu</button>
    <button type="button" className="text-button" onClick={exportCsv} disabled={!filtered.length}>Eksportēt CSV ({filtered.length})</button>
    <button type="button" className="text-button" aria-pressed={compact} onClick={()=>setCompact(v=>!v)}>{compact?'Parasts skats':'Kompakts skats'}</button>
    <button type="button" className="text-button" aria-expanded={showShortcuts} onClick={()=>setShowShortcuts(v=>!v)}>Īsceļi (?)</button>
   </div>
   {showShortcuts&&<dl className="admin-shortcuts">
    <dt><kbd>j</kbd> / <kbd>k</kbd></dt><dd>Nākamā / iepriekšējā rinda</dd>
    <dt><kbd>e</kbd> vai <kbd>Enter</kbd></dt><dd>Labot vietu (ar “Saglabāt un nākamais”)</dd>
    <dt><kbd>p</kbd></dt><dd>Publicēt rindu, ja vieta verificēta</dd>
    <dt><kbd>x</kbd></dt><dd>Atlasīt rindu masveida darbībai</dd>
    <dt><kbd>n</kbd> / <kbd>b</kbd></dt><dd>Nākamā / iepriekšējā lapa</dd>
    <dt><kbd>/</kbd></dt><dd>Meklēt</dd>
    <dt><kbd>?</kbd></dt><dd>Rādīt vai paslēpt šo sarakstu</dd>
   </dl>}

   <AdminEventMap events={filtered} onEdit={event=>openEditor(event,filtered.filter(isLocationIssue).map(x=>x.id))}/>

   <div className="admin-sheet-head admin-bulk-head">
    <div><strong>Pasākumu saraksts</strong><span>{filtered.length} ieraksti pēc filtriem · lapa {safePage}/{pageCount}</span></div>
    <div className="admin-bulk-actions">
     <span>Atlasīti: <strong>{selectedIds.size}</strong></span>
     <button type="button" className="button compact" onClick={selectPage} disabled={!pageRows.length||bulkLoading}>{allPageSelected?'Noņemt šīs lapas atlasi':'Atlasīt šīs lapas ierakstus'}</button>
     <button type="button" className="button compact" onClick={selectAllFiltered} disabled={!filtered.length||bulkLoading}>{allFilteredSelected?'Noņemt visu filtrēto atlasi':'Atlasīt visus filtrētos ierakstus'}</button>
     <button type="button" className="button primary compact" onClick={()=>bulkPublish()} disabled={!selectedIds.size||bulkLoading}>{bulkLoading?'Publicē…':'Publicēt atlasītos'}</button>
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
    <table className={'events-table admin-events-table location-review-table'+(compact?' compact-table':'')}>
     <thead><tr>
      <th className="select-column"><input type="checkbox" checked={allPageSelected} onChange={selectPage} aria-label="Atlasīt vai noņemt šīs lapas ierakstus"/></th>
      <th>Datums</th><th>Pasākums</th><th>Bloks</th><th>Kas jādara</th><th>Norises vieta</th><th>Avots</th><th>Darbības</th>
     </tr></thead>
     <tbody>
      {pageRows.length?pageRows.map((event,index)=>{
       const row=auditById.get(event.id);
       const meta=qualityMeta(event.location_quality);
       const rowBucket=row?.bucket||'other';
       return <tr key={event.id} id={'admin-row-'+event.id} className={'bucket-row-'+rowBucket+(index===focusRow?' row-focused':'')} onClick={()=>setFocusRow(index)}>
        <td className="select-column"><input type="checkbox" checked={selectedIds.has(event.id)} onChange={()=>toggleSelected(event.id)} aria-label={'Atlasīt '+event.title}/></td>
        <td>{dateRangeText(event)}</td>
        <td><strong>{event.title}</strong><small className="table-subline">{STATUS_OPTIONS.find(([v])=>v===event.status)?.[1]||event.status}</small></td>
        <td><span className={'bucket-badge bucket-'+rowBucket}>{BUCKETS[rowBucket]?.short||'Cits'}</span></td>
        <td className="reason-cell">{row?.issues.length
         ?<span className="admin-issue-tags">{row.issues.map(code=><em key={code} className={'issue-'+(CHECKS[code]?.level||'warn')}>{CHECKS[code]?.label||code}</em>)}</span>
         :'Viss kārtībā.'}
         {isLocationIssue(event)&&<small className="table-subline">{meta.label}</small>}</td>
        <td>
         <strong>{event.venue_name||event.address_raw||'—'}</strong>
         <small className="table-subline">{event.address_raw&&event.address_raw!==event.venue_name?event.address_raw+' · ':''}{event.municipality||event.settlement||''}</small>
         {!compact&&<small className="table-subline">{event.latitude!=null&&event.longitude!=null?Number(event.latitude).toFixed(5)+', '+Number(event.longitude).toFixed(5):'Nav koordinātu'}</small>}
        </td>
        <td>{sourceLinks(event).length?sourceLinks(event).map((s,i)=><span key={(s.url||'')+i} className="source-link-row"><a href={s.url} target="_blank" rel="noreferrer">{s.source||'Avots'} ↗</a></span>):sourceText(event)}</td>
        <td><div className="admin-actions">
         {canPublishEvent(event)&&event.status!=='published'&&<button className="text-button strong-action" onClick={()=>changeStatus(event,'published')}>Publicēt</button>}
         {event.status==='published'&&<button className="text-button" onClick={()=>changeStatus(event,'pending_review')}>Atgriezt pārbaudei</button>}
         {row?.issues.includes('duplicate')&&<button className="text-button" onClick={()=>archiveDuplicate(event)}>Arhivēt dublikātu</button>}
         <button className="button compact" onClick={()=>openEditor(event,filtered.filter(isLocationIssue).map(x=>x.id))}>{isLocationIssue(event)?'Labot vietu':'Pārbaudīt vietu'}</button>
        </div></td>
       </tr>;
      }):<tr><td colSpan={8}><p className="admin-empty-inline">{bucket==='critical'?'Nav kritisku pasākumu — viss, kas nav publicēts, ir gatavs.':bucket==='review'?'Visi publicētie pasākumi atbilst prasībām.':'Pēc šiem filtriem nav neviena pasākuma.'} {(bucket||issue||search||status||quality)&&<button type="button" className="text-button" onClick={()=>{setBucket('');setIssue('');setSearch('');setStatus('');setQuality('');}}>Notīrīt filtrus</button>}</p></td></tr>}
     </tbody>
    </table>
   </div>
   <div className="admin-pagination">
    <button type="button" className="button compact" onClick={()=>setPage(value=>Math.max(1,value-1))} disabled={safePage<=1}>← Iepriekšējā</button>
    <span>{safePage}. lapa no {pageCount}</span>
    <button type="button" className="button compact" onClick={()=>setPage(value=>Math.min(pageCount,value+1))} disabled={safePage>=pageCount}>Nākamā →</button>
   </div>
   <p className="sync-text"><strong>{filtered.length}</strong> no {activeEvents.length} aktuālajiem ierakstiem.</p>
  </>}

  {mappingEditing&&<LocationEditor
   key={'m-'+mappingEditing.key}
   event={mappingEditing.events[0]}
   position={(()=>{const list=mappingGroups.filter(g=>g.alias);const i=list.findIndex(g=>g.key===mappingEditing.key);return i>=0?(i+1)+' no '+list.length:'';})()}
   hasNext={Boolean(nextMappingGroup(mappingEditing))}
   onSkip={()=>setMappingEditing(nextMappingGroup(mappingEditing))}
   mode="mapping"
   mappingAlias={mappingEditing.alias}
   mappingCount={mappingEditing.events.length}
   close={()=>setMappingEditing(null)}
   save={(values,publish,goNext)=>saveMapping(mappingEditing,values,goNext)}
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
   mode="saved-mapping"
   mappingAlias={mappingRuleEditing.alias_text}
   mappingCount={mappingRuleEditing.current_events||0}
   close={()=>setMappingRuleEditing(null)}
   save={values=>updateMapping(mappingRuleEditing,values)}
  />}

  {editing&&<LocationEditor key={'e-'+editing.id} event={editing} close={()=>setEditing(null)}
   position={editQueue.includes(editing.id)?(editQueue.indexOf(editing.id)+1)+' no '+editQueue.length:''}
   hasNext={Boolean(nextEditable(editing.id))}
   onSkip={()=>setEditing(nextEditable(editing.id))}
   save={(values,publish,goNext)=>saveLocation(editing,values,publish,goNext)}/>} 
 </>;
}

function LocationEditor({event,close,save,mode='event',mappingAlias='',mappingCount=1,position='',hasNext=false,onSkip=null}){
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
    headers:{Authorization:await adminAuthorization(),'Content-Type':'application/json'},
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
  <div className="detail-header"><div><p className="eyebrow">{isMapping?'Vietu sasaiste — derēs arī nākamajiem importiem':'Vietas pārbaude'}{position?' · '+position:''}</p><h2>{isMapping?(mappingAlias||event.venue_name||event.address_raw):event.title}</h2></div><button className="button" onClick={close}>Aizvērt ✕</button></div>

  <div className={'location-issue-panel '+meta.tone}>
   <strong>{isMapping?`${mappingCount} esoši pasākumi ar šo aliasu`:meta.label}</strong>
   <p>{isSavedMapping
    ?'Labojot vietas sasaisti, jau saistītie ieraksti tiks atjaunoti, un nākamie importi izmantos jauno vietu.'
    :isMapping
     ?'Saglabājot vietu, esošie ieraksti tiks salaboti uzreiz, un nākamajos importos šis pats nosaukums automātiski saņems apstiprināto vietu.'
     :(event.location_review_reason||(isLocationIssue(event)?locationIssueReason(event)+'. Atrodi vietu, pārbaudi punktu kartē un saglabā.':'Vieta ir verificēta.'))}</p>
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
    ?<>
      <button className="button primary" disabled={!canSave} onClick={()=>save({venueName,addressText,latitude,longitude,locationSource},false,false)}>{isSavedMapping?'Saglabāt labojumu':'Saglabāt vietu ('+mappingCount+' pasākumi)'}</button>
      {!isSavedMapping&&hasNext&&<button className="button primary" disabled={!canSave} onClick={()=>save({venueName,addressText,latitude,longitude,locationSource},false,true)}>Saglabāt un nākamā →</button>}
     </>
    :<>
      <button className="button" disabled={!canSave} onClick={()=>save({venueName,addressText,latitude,longitude,locationSource},false,false)}>Saglabāt verificētu vietu</button>
      <button className="button primary" disabled={!canSave} onClick={()=>save({venueName,addressText,latitude,longitude,locationSource},event.status!=='published',false)}>{event.status==='published'?'Saglabāt':'Saglabāt un publicēt'}</button>
      {hasNext&&<button className="button primary" disabled={!canSave} onClick={()=>save({venueName,addressText,latitude,longitude,locationSource},event.status!=='published',true)}>{event.status==='published'?'Saglabāt un nākamais →':'Publicēt un nākamais →'}</button>}
     </>}
   {hasNext&&onSkip&&<button className="button" onClick={onSkip}>Izlaist →</button>}
   <button className="button" onClick={close}>Aizvērt</button>
  </div>
 </dialog>;
}
