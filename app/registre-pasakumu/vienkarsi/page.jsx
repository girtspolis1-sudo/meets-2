'use client';
import {Suspense,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import EventVenueDialog from '../../components/event-venue-dialog.jsx';
import Authentication from '../../components/account-auth-flow.jsx';
import ProfileShell from '../../components/profile-shell.jsx';
import WeeklySchedule from '../../components/weekly-schedule.jsx';
import {rigaDate} from '../../../lib/meets-personal.js';
import {countOccurrences,cleanPrice,cleanDatedSlots,datesBetween} from '../../../lib/event-schedule.js';
import {ATTENDANCE_LABELS,EVENT_CATEGORIES,QUICK_EVENT_EMPTY,EVENT_DRAFT_KEY,validateQuickEvent,normalizeEventTime,copyEventDraft,venueRequired} from '../../../lib/event-entry.js';
import {scopedDraftKey,resolveOrganizationId,canWriteOrganization,recurrenceEditScope} from '../../../lib/organizer-workspace.js';
import {refreshSession} from '../../../lib/auth-client.js';
import {VISIBILITY_HINTS,flyerPath,rigaOffsetLabel,scheduleLines,sharePath} from '../../../lib/shared-event.js';

const SESSION='meets_user_session_v1';
const DEFAULT={...QUICK_EVENT_EMPTY,recurrence_note:''};
const PRICE_LABELS={free:'Bezmaksas',paid:'Maksas',mixed:'Cenu diapazons',unknown:'Nav zināms'};

function sessionRead(){try{return JSON.parse(localStorage.getItem(SESSION)||'null');}catch{return null;}}
function safeRead(key){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v&&typeof v==='object'&&!Array.isArray(v)?v:null;}catch{return null;}}
function cleanDraft(value){const restored={...DEFAULT,...Object.fromEntries(Object.keys(DEFAULT).map(k=>[k,value?.[k]??DEFAULT[k]]))};return {...restored,visibility:restored.visibility==='private'?'private':'public',time_from:normalizeEventTime(restored.time_from),time_to:normalizeEventTime(restored.time_to)};}
async function refreshAccount(session){
 if(!session?.refresh_token)throw Error('Sesija beigusies.');
 const next=await refreshSession(session.refresh_token);
 localStorage.setItem(SESSION,JSON.stringify(next));window.dispatchEvent(new Event('meets-user-changed'));
 return next;
}

// Line icons in the stroke style of the site navigation.
function Icon({name}){
 const base={viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,focusable:'false'};
 if(name==='globe')return <svg {...base}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
 if(name==='lock')return <svg {...base}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>;
 if(name==='pin')return <svg {...base}><path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>;
 if(name==='text')return <svg {...base}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>;
 if(name==='tag')return <svg {...base}><path d="M3 12V4h8l9 9-8 8-9-9Z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>;
 if(name==='ticket')return <svg {...base}><path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Z"/><path d="M14 7v10" strokeDasharray="2 2"/></svg>;
 if(name==='repeat')return <svg {...base}><path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3"/></svg>;
 if(name==='image')return <svg {...base}><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 8"/></svg>;
 if(name==='flyer')return <svg {...base}><path d="M6 3h9l4 4v14H6Z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg>;
 return <svg {...base}><path d="m6 9 6 6 6-6"/></svg>;
}

function SimpleEventFlow(){
 const params=useSearchParams();
 const [form,setForm]=useState({...DEFAULT});
 const [account,setAccount]=useState(null);
 const [orgs,setOrgs]=useState([]);
 const [orgId,setOrgId]=useState('');
 const [venues,setVenues]=useState([]);
 const [publicVenues,setPublicVenues]=useState([]);
 const [venueLinks,setVenueLinks]=useState([]);
 const [addressOpen,setAddressOpen]=useState(false);
 const [addressBusy,setAddressBusy]=useState(false);
 const [stage,setStage]=useState('edit');
 const [saveVenue,setSaveVenue]=useState(false);
 const [busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [submitted,setSubmitted]=useState(null);
 const [imageFile,setImageFile]=useState(null);
 const [imagePreview,setImagePreview]=useState('');
 const [existingCover,setExistingCover]=useState(false);
 const [savedId,setSavedId]=useState('');
 const [lastSaved,setLastSaved]=useState('');
 // Editing an event that is already public: changes go to review, no draft.
 const [publishedEdit,setPublishedEdit]=useState(false);
 const [dragging,setDragging]=useState(false);
 const [whereOpen,setWhereOpen]=useState(false);
 const [descOpen,setDescOpen]=useState(false);
 const [copied,setCopied]=useState(false);
 const locationRef=useRef(null);
 const initialized=useRef(false);
 const activeOrg=orgs.find(o=>o.id===orgId)||null;
 const selectedVenue=[...venues,...publicVenues].find(v=>v.id===form.venue_id);
 const addressOptions=useMemo(()=>{
  const mine=venues.filter(v=>v.organization_id===orgId);
  const linked=new Set(venueLinks.filter(l=>l.organization_id===orgId).map(l=>l.venue_id));
  const shared=publicVenues.filter(v=>linked.has(v.id)&&!mine.some(m=>m.id===v.id));
  return {mine,shared};
 },[venues,publicVenues,venueLinks,orgId]);

 const canEdit=canWriteOrganization(activeOrg?.role);
 const viewer=activeOrg?.role==='viewer';
 const privateEvent=form.visibility==='private';
 // Trusted organizers are published without MEETS review.
 const trusted=activeOrg?.trusted===true;
 const recurring=form.schedule_kind==='recurring';
 const perDay=form.schedule_kind==='dated';
 const multiDay=Boolean(form.date_to&&form.date_to!==form.date_from);
 const needsVenue=venueRequired(form);

 async function call(action,payload={},token=account?.access_token){
  const response=await fetch('/api/organizer',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action,token,...payload})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const e=new Error(body.error||'Neizdevās saglabāt.');e.status=response.status;throw e;}
  return body;
 }

 function persistLocal(nextForm=form,nextOrg=orgId,nextAccount=account){
  try{
   const key=scopedDraftKey(nextAccount?.user?.id,nextOrg);
   localStorage.setItem(key,JSON.stringify({...nextForm,save_venue:saveVenue,saved_id:savedId||''}));
   setLastSaved(new Date().toLocaleTimeString('lv-LV',{hour:'2-digit',minute:'2-digit'}));
  }catch{}
 }
 function restoreLocal(userId,nextOrg){
  const scoped=safeRead(scopedDraftKey(userId,nextOrg));
  if(scoped)return scoped;
  if(!userId){
   const legacy=safeRead(EVENT_DRAFT_KEY);
   if(legacy)return legacy;
  }
  return null;
 }
 function clearLocal(userId=account?.user?.id,nextOrg=orgId){
  try{localStorage.removeItem(scopedDraftKey(userId,nextOrg));if(!userId)localStorage.removeItem(EVENT_DRAFT_KEY);}catch{}
 }

 async function load(session){
  let current=session;
  let result;
  try{result=await call('list',{},current.access_token);}
  catch(e){
   if(e.status!==401)throw e;
   current=await refreshAccount(current);
   result=await call('list',{},current.access_token);
  }
  setAccount(current);setOrgs(result.organizations||[]);setVenues(result.venues||[]);setPublicVenues(result.publicVenues||[]);setVenueLinks(result.venueLinks||[]);
  return {account:current,result};
 }

 useEffect(()=>{
  if(initialized.current)return;initialized.current=true;
  let alive=true;
  (async()=>{
   const requestedOrg=params.get('org')||'';
   const copyId=params.get('copy')||'';
   const editId=params.get('edit')||'';
   const venueId=params.get('venue')||'';
   let session=sessionRead(),result={organizations:[],venues:[],publicVenues:[],submissions:[]};
   try{
    if(session?.access_token){
     const loadedAccount=await load(session);session=loadedAccount.account;result=loadedAccount.result;
    }
   }catch(e){if(alive)setError(e.message);}
   if(!alive)return;
   const available=result.organizations||[];
   const chosen=resolveOrganizationId(available,requestedOrg);
   setOrgId(chosen||'');
   let next=null;
   if(editId&&chosen){
    const original=(result.submissions||[]).find(e=>e.id===editId&&e.organization_id===chosen);
    if(original){
     next=cleanDraft(original);setSavedId(original.id);setExistingCover(Boolean(original.cover_image_path));
     const live=Boolean(original.event_id);setPublishedEdit(live);
     setNotice(live?'Tu labo jau publicētu pasākumu. Izmaiņas parādīsies pēc MEETS apstiprināšanas; līdz tam apmeklētāji redz pašreizējo versiju.'
      :original.schedule_kind==='recurring'?'Tu labo visu atkārtotā pasākuma sēriju. Viena norise netiks mainīta atsevišķi.':'Atvērts esošais pasākums labošanai.');
    }
    else setError('Norādītais pasākums nav pieejams labošanai šajā organizācijā.');
   }else if(copyId&&chosen){
    const original=(result.submissions||[]).find(e=>e.id===copyId&&e.organization_id===chosen);
    if(original){
     next=copyEventDraft(original);
     // "Dublēt ar citu datumu": the new start date comes from the list, the length stays.
     const newDate=params.get('date')||'';
     if(/^\d{4}-\d{2}-\d{2}$/.test(newDate)&&original.date_from){
      const span=original.date_to?Math.round((Date.parse(original.date_to)-Date.parse(original.date_from))/864e5):0;
      const end=new Date(Date.parse(newDate+'T12:00:00Z')+span*864e5).toISOString().slice(0,10);
      next={...next,date_from:newDate,date_to:original.date_to?end:''};
     }
     setNotice(newDate?'Izveidota kopija ar jauno datumu. Pārbaudi un iesniedz — kopija netiks publicēta automātiski.':'Izveidota kopija. Pārbaudi jaunos datumus — kopija netiks publicēta automātiski.');
    }
    else setError('Norādītais pasākums nav pieejams kopēšanai šajā organizācijā.');
   }else if(venueId&&chosen){
    const all=[...(result.venues||[]),...(result.publicVenues||[])];
    const venue=all.find(v=>v.id===venueId);
    if(venue)next={...DEFAULT,venue_id:venue.id,venue_name:venue.name,address:venue.address||'',latitude:venue.latitude??'',longitude:venue.longitude??''};
   }
   if(!next){
    const stored=restoreLocal(session?.user?.id,chosen);
    if(stored){next=cleanDraft(stored);setSaveVenue(stored.save_venue===true);setSavedId(stored.saved_id||'');setNotice('Atjaunots iepriekš saglabātais melnraksts.');}
   }
   if(next){setForm(next);if(next.description)setDescOpen(true);}
   setLoaded(true);
  })();
  return()=>{alive=false;};
 },[]);

 useEffect(()=>{
  if(!loaded||stage==='done')return;
  const timer=setTimeout(()=>persistLocal(),600);
  return()=>clearTimeout(timer);
 },[form,saveVenue,savedId,loaded,stage,orgId,account?.user?.id]);

 function update(field,value){setForm(before=>({...before,[field]:value}));setError('');}
 function applyVenue(venue){
  if(!venue)return;
  setForm(prev=>({...prev,venue_id:venue.id,venue_name:venue.name,
   address:venue.address||'',latitude:venue.latitude??'',longitude:venue.longitude??''}));
  setSaveVenue(false);setError('');
 }
 async function addOrChooseVenue(next){
  if(!account?.access_token||!orgId||!canEdit)throw Error('Pieslēdzies organizatora kontam ar rediģēšanas tiesībām.');
  setAddressBusy(true);
  try{
   const known=[...venues,...publicVenues].find(v=>v.id===next.venue_id);
   let item=known;
   if(known&&known.organization_id!==orgId){
    const result=await call('useVenue',{organization_id:orgId,venue_id:known.id});
    item=result.item||known;
   }else if(!known){
    const result=await call('createVenue',{organization_id:orgId,name:next.name,
     address:next.address,latitude:next.latitude,longitude:next.longitude,
     description:'',directions:'',is_public:false});
    item=result.item;
   }
   if(!item?.id)throw Error('Adresi neizdevās izveidot.');
   const refreshed=await call('list');
   setVenues(refreshed.venues||[]);
   setPublicVenues(refreshed.publicVenues||[]);
   setVenueLinks(refreshed.venueLinks||[]);
   applyVenue(item);
   setNotice('Vieta saglabāta un piesaistīta pasākumam.');
  }finally{setAddressBusy(false);}
 }
 function selectAddress(id){
  if(!id){
   setForm(prev=>({...prev,venue_id:'',venue_name:'',address:'',latitude:'',longitude:''}));
   return;
  }
  const found=[...venues,...publicVenues].find(v=>v.id===id);
  if(found)applyVenue(found);
 }
 function switchOrg(value){
  persistLocal(form,orgId,account);
  const stored=restoreLocal(account?.user?.id,value);
  setOrgId(value);setSavedId(stored?.saved_id||'');setSaveVenue(stored?.save_venue===true);setForm(stored?cleanDraft(stored):{...DEFAULT});setNotice(stored?'Atjaunots šī organizatora melnraksts.':'');setError('');
  const u=new URL(window.location.href);u.searchParams.set('org',value);u.searchParams.delete('edit');u.searchParams.delete('copy');u.searchParams.delete('venue');window.history.replaceState(null,'',u.pathname+'?'+u.searchParams.toString());
 }

 // Dates: the end date shows the start date until a later day is chosen.
 function setStartDate(value){
  setForm(before=>{
   const next={...before,date_from:value};
   if(before.schedule_kind!=='recurring'&&before.date_to&&value&&before.date_to<=value){
    next.date_to='';
    if(before.schedule_kind==='dated'){next.schedule_kind='once';next.recurrence_slots=[];}
   }
   return next;
  });
  setError('');
 }
 function setEndDate(value){
  setForm(before=>{
   if(before.schedule_kind==='recurring')return {...before,date_to:value};
   if(!value||value<=before.date_from){
    return {...before,date_to:'',...(before.schedule_kind==='dated'?{schedule_kind:'once',recurrence_slots:[]}:{})};
   }
   return {...before,date_to:value};
  });
  setError('');
 }
 const dayList=perDay?datesBetween(form.date_from,form.date_to):[];
 const WD=['Sv','Pr','Ot','Tr','Ce','Pk','Se'];
 function dayLabel(day){const d=new Date(day+'T12:00:00Z');return WD[d.getUTCDay()]+' '+day.slice(8,10)+'.'+day.slice(5,7)+'.';}
 function daySlot(day){return (form.recurrence_slots||[]).find(x=>x.date===day)||{date:day,start:form.time_from||'09:00',end:form.time_to||'17:00'};}
 function setDayTime(day,key,value){
  const slots=datesBetween(form.date_from,form.date_to).map(d=>{const s=daySlot(d);return d===day?{...s,[key]:value}:s;});
  update('recurrence_slots',slots);
 }
 function chooseRepeat(weekly){
  setForm(before=>{
   if(weekly)return {...before,schedule_kind:'recurring',recurrence_slots:before.schedule_kind==='recurring'?before.recurrence_slots:[]};
   return {...before,schedule_kind:'once',recurrence_slots:[]};
  });
  setError('');
 }
 function chooseDayTimes(on){
  setForm(before=>{
   if(!on)return {...before,schedule_kind:'once',recurrence_slots:[]};
   const start=before.time_from||'09:00',end=before.time_to||'17:00';
   return {...before,schedule_kind:'dated',recurrence_slots:datesBetween(before.date_from,before.date_to).map(date=>({date,start,end}))};
  });
 }
 function openLocation(){setWhereOpen(true);locationRef.current?.scrollIntoView({behavior:'smooth',block:'center'});}
 function validateForSubmit(){
  if(needsVenue&&!form.venue_id){
   setError(account?'Izvēlies norises vietu no saraksta vai pievieno jaunu.':'Lai izvēlētos norises vietu, pieslēdzies — ievadītais saglabāsies.');
   openLocation();return false;
  }
  const message=validateQuickEvent(perDay||recurring?{...form,time_from:'',time_to:''}:form,{requireVenue:needsVenue});
  if(message){setError(message);return false;}
  try{
   cleanPrice(form.price_status,form.price_min,form.price_max);
   if(recurring)countOccurrences(form.date_from,form.date_to,form.recurrence_slots);
   if(perDay){
    if(!form.date_to||form.date_to<=form.date_from)throw Error('Vairāku dienu pasākumam norādi arī beigu datumu.');
    cleanDatedSlots(datesBetween(form.date_from,form.date_to).map(daySlot),form.date_from,form.date_to);
   }
  }catch(e){setError(e.message);return false;}
  return true;
 }
 function startAuth(){persistLocal();setStage('auth');window.scrollTo({top:0,behavior:'smooth'});}
 function organizerSetup(){
  persistLocal();
  const returnPath='/registre-pasakumu/vienkarsi';
  window.location.assign('/organizators?new=1&return='+encodeURIComponent(returnPath));
 }
 async function save(status='draft'){
  if(!account){persistLocal();if(status==='draft')setNotice('Melnraksts saglabāts šajā ierīcē. Pieslēdzies, lai saglabātu to kontā.');else startAuth();return;}
  if(!orgId){persistLocal();organizerSetup();return;}
  if(!canEdit){setError('Šim organizatoram tev ir tikai skatīšanas tiesības.');return;}
  if(status!=='draft'&&!validateForSubmit())return;
  if(status==='draft'&&publishedEdit){setError('Publicētam pasākumam izmaiņas iesniedz pārbaudei — melnraksts nav pieejams.');return;}
  setBusy(true);setError('');
  try{
   // A private online-only event keeps no place, even one picked earlier.
   const placeless=!needsVenue;
   const fields={...form,organization_id:orgId,
    visibility:publishedEdit?'public':form.visibility,
    venue_id:placeless?null:selectedVenue?.id||null,
    ...(placeless?{venue_name:'',address:'',latitude:'',longitude:''}:{}),
    save_venue:false,
    ...(perDay?{recurrence_slots:datesBetween(form.date_from,form.date_to).map(daySlot),time_from:'',time_to:''}:{}),
    schedule_kind:recurring?'recurring':perDay?'dated':multiDay?'ongoing':'once'};
   let id=savedId;
   if(imageFile){
    const draft=await call('saveEvent',{...fields,...(id?{id}:{}),status:'draft'});
    id=draft.item.id;setSavedId(id);
    const payload=new FormData();payload.append('token',account.access_token);payload.append('submission_id',id);payload.append('file',imageFile);
    const response=await fetch('/api/event-image',{method:'POST',body:payload});
    const body=await response.json().catch(()=>({}));if(!response.ok)throw Error(body.error||'Attēla augšupielāde neizdevās.');
   }
   const result=await call('saveEvent',{...fields,...(id?{id}:{}),status});
   setSavedId(result.item.id);
   setLastSaved(new Date().toLocaleTimeString('lv-LV',{hour:'2-digit',minute:'2-digit'}));
   if(status==='draft'){setNotice('Melnraksts saglabāts kontā.');persistLocal({...form},orgId,account);return;}
   setSubmitted(result.item);setStage('done');clearLocal();setNotice('');window.scrollTo({top:0,behavior:'smooth'});
  }catch(e){setError(e.message);if(e.status===401)startAuth();}
  finally{setBusy(false);}
 }
 function submit(event){
  event.preventDefault();
  if(!account){if(validateForSubmitGuest())startAuth();return;}
  save(publishedEdit||!privateEvent?'pending_review':'private');
 }
 // Before signing in only what needs no account is checked; the place comes after.
 function validateForSubmitGuest(){
  const message=validateQuickEvent(perDay||recurring?{...form,time_from:'',time_to:''}:form,{requireVenue:false});
  if(message){setError(message);return false;}
  return true;
 }
 function pickImage(file){
  if(!file){setImageFile(null);setImagePreview('');return;}
  if(file.size>4*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Atļauti JPG, PNG un WebP attēli līdz 4 MB.');return;}
  if(imagePreview)URL.revokeObjectURL(imagePreview);setImageFile(file);setImagePreview(URL.createObjectURL(file));setError('');
 }
 function removeImage(){if(imagePreview)URL.revokeObjectURL(imagePreview);setImageFile(null);setImagePreview('');}
 function restart(){clearLocal();setPublishedEdit(false);setForm({...DEFAULT});setSubmitted(null);setSaveVenue(false);removeImage();setExistingCover(false);setSavedId('');setStage('edit');setError('');setNotice('');setCopied(false);setWhereOpen(false);setDescOpen(false);}
 const shareToken=submitted?.share_token||'';
 const shareUrl=shareToken&&typeof window!=='undefined'?window.location.origin+sharePath(shareToken):'';
 async function copyLink(){
  try{await navigator.clipboard.writeText(shareUrl);setCopied(true);setTimeout(()=>setCopied(false),2500);}
  catch{window.prompt('Nokopē saiti:',shareUrl);}
 }

 if(!loaded)return <p className="meets-profile-skeleton" role="status">Ielādē pasākuma redaktoru…</p>;

 const modeLabel=ATTENDANCE_LABELS[form.attendance_mode||'in_person'];
 const whereTitle=selectedVenue?.name||(form.attendance_mode==='online'&&!needsVenue?'Tiešsaistē':'Pievienot norises vietu');
 const whereText=selectedVenue?[selectedVenue.address,form.attendance_mode!=='in_person'?modeLabel:''].filter(Boolean).join(' · ')
  :form.attendance_mode==='online'&&!needsVenue?(form.online_url?'Saite uz zvanu pievienota':'Pievieno saiti uz zvanu'):'Klātienes vieta vai tiešsaistes saite';
 const primaryLabel=publishedEdit?(trusted?'Publicēt izmaiņas':'Iesniegt izmaiņas pārbaudei')
  :privateEvent?'Izveidot privātu pasākumu':trusted?'Publicēt':'Iesniegt izvērtēšanai';
 const submitNote=publishedEdit?'Līdz apstiprināšanai apmeklētāji redz pašreizējo publicēto versiju.'
  :privateEvent?'Pasākums nebūs kartē un sarakstā. Pēc izveides saņemsi saiti un sludinājumu drukai.'
  :trusted?'Tavs organizators ir MEETS uzticamo sarakstā — pasākums kartē parādīsies uzreiz. Pārbaudi datumu, laiku un vietu.'
  :'MEETS pārbaudīs pasākumu (parasti 1–2 darba dienās). Saiti un sludinājumu saņemsi uzreiz.';
 const doneTitle=privateEvent&&!publishedEdit?'Privāts pasākums izveidots'
  :publishedEdit?(trusted?'Izmaiņas publicētas':'Izmaiņas iesniegtas izvērtēšanai')
  :trusted?'Pasākums publicēts':'Pasākums iesniegts izvērtēšanai';
 const doneText=privateEvent&&!publishedEdit?'Pasākums nav kartē un sarakstā — to redz tikai tie, kam nosūtīsi saiti.'
  :trusted?'Pasākums kartē parādīsies pēc dažām sekundēm. Ja automātiskā pārbaude atradīs neskaidrību, MEETS to izvērtēs un tu saņemsi e-pastu.'
  :'Kad pasākums būs publicēts vai būs jāprecizē, saņemsi e-pastu. Saite uz pasākumu darbojas jau tagad.';

 const orgChip=!account?<button type="button" className="ev-chip" onClick={startAuth}>Pieslēgties</button>
  :!orgs.length?<button type="button" className="ev-chip" onClick={organizerSetup}>+ Sākt organizēt</button>
  :orgs.length===1?<span className="ev-chip ev-chip-static"><span className="ev-avatar" aria-hidden="true">{(activeOrg?.name||'?').slice(0,1)}</span><span className="ev-chip-text">{activeOrg?.name}</span></span>
  :<label className="ev-chip"><span className="ev-avatar" aria-hidden="true">{(activeOrg?.name||'?').slice(0,1)}</span>
    <select aria-label="Organizators" value={orgId} onChange={e=>switchOrg(e.target.value)}><option value="">Izvēlies organizatoru</option>{orgs.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select><Icon name="chevron"/></label>;

 const editor=<section className="meets-organizer-page unified-event-editor ev-page">
  <header className="ev-head">
   <Link className="ev-back" href={orgId?'/organizators?org='+orgId+'&panel=events':'/organizators'}>← Pasākumi</Link>
   <h1>{stage==='done'?'Gatavs':savedId?'Labot pasākumu':'Jauns pasākums'}</h1>
   {stage==='edit'&&<span className="ev-save-state" role="status">{busy?'Saglabā…':lastSaved?'Saglabāts ierīcē '+lastSaved:''}</span>}
  </header>

  {account&&orgs.length===0&&stage==='edit'&&<div className="ev-banner"><strong>Lai izveidotu pasākumu, aktivizē organizēšanu.</strong><span>Ievadītais saglabāsies un atjaunosies pēc organizatora izveides.</span><button className="button primary" type="button" onClick={organizerSetup}>Sākt organizēt →</button></div>}
  {account&&orgId&&viewer&&<p className="meets-inline-error">Tev ir skatītāja loma. Pasākumu vari apskatīt, bet ne saglabāt.</p>}
  {notice&&<p className="meets-organizer-success" role="status">{notice}</p>}
  {error&&<>
   <p className="meets-inline-error event-inline-validation">{error}</p>
   <div className="event-editor-error-toast" role="alert" aria-atomic="true">
    <span className="event-editor-error-icon" aria-hidden="true">!</span>
    <div className="event-editor-error-content"><strong>Jāpārbauda pasākuma informācija</strong><p>{error}</p></div>
    <button type="button" className="event-editor-error-dismiss" aria-label="Aizvērt kļūdas paziņojumu" onClick={()=>setError('')}>×</button>
   </div>
  </>}

  {stage==='edit'&&<form className="ev-form" noValidate onSubmit={submit}>
   <label className={'ev-cover'+(imagePreview?' has-image':'')+(dragging?' dragging':'')}
    onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
    onDrop={e=>{e.preventDefault();setDragging(false);pickImage(e.dataTransfer.files?.[0]);}}>
    {imagePreview?<img src={imagePreview} alt="Pasākuma vāka attēls"/>:<span className="ev-cover-empty">
     <Icon name="image"/><strong>{existingCover?'Attēls pievienots':'Pievienot vāka attēlu'}</strong>
     <small>{existingCover?'Izvēlies jaunu, lai nomainītu':'JPG, PNG vai WebP līdz 4 MB · ieteicams 16:9'}</small></span>}
    {imagePreview&&<span className="ev-cover-button" aria-hidden="true"><Icon name="image"/></span>}
    <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Pasākuma vāka attēls" onChange={e=>{pickImage(e.target.files?.[0]);e.target.value='';}}/>
   </label>
   {imagePreview&&<button className="text-button ev-cover-remove" type="button" onClick={removeImage}>Noņemt attēlu</button>}

   <div className="ev-chips">
    {orgChip}
    <label className={'ev-chip ev-chip-visibility'+(privateEvent?' is-private':'')}>
     <Icon name={privateEvent?'lock':'globe'}/>
     <select aria-label="Redzamība" value={form.visibility} disabled={publishedEdit} onChange={e=>update('visibility',e.target.value)}>
      <option value="public">Publisks</option><option value="private">Privāts</option>
     </select><Icon name="chevron"/>
    </label>
   </div>
   <p className="ev-hint">{publishedEdit?'Publicēts pasākums paliek publisks.':VISIBILITY_HINTS[form.visibility]+(privateEvent?', bez MEETS pārbaudes.':'.')}</p>

   <label className="ev-title"><span className="sr-only">Pasākuma nosaukums</span>
    <input required minLength={3} maxLength={200} autoComplete="off" value={form.title} placeholder="Pasākuma nosaukums" onChange={e=>update('title',e.target.value)}/>
   </label>

   <section className="ev-card ev-when" aria-label="Kad notiks">
    <div className="ev-when-rows">
     <div className="ev-when-row">
      <span className="ev-when-dot" aria-hidden="true"/>
      <span className="ev-when-label">{recurring?'No':'Sākums'}</span>
      <input className="ev-pill" type="date" aria-label={recurring?'Grafika sākuma datums':'Sākuma datums'} required min={savedId?undefined:rigaDate()} value={form.date_from||''} onChange={e=>setStartDate(e.target.value)}/>
      {!recurring&&!perDay&&<input className="ev-pill ev-pill-time" type="time" aria-label="Sākuma laiks" value={form.time_from||''} onChange={e=>update('time_from',e.target.value)}/>}
     </div>
     <div className="ev-when-row">
      <span className="ev-when-dot hollow" aria-hidden="true"/>
      <span className="ev-when-label">{recurring?'Līdz':'Beigas'}</span>
      <input className="ev-pill" type="date" aria-label={recurring?'Grafika beigu datums':'Beigu datums'} required={recurring} min={form.date_from||undefined} value={recurring?form.date_to||'':form.date_to||form.date_from||''} onChange={e=>setEndDate(e.target.value)}/>
      {!recurring&&!perDay&&<input className="ev-pill ev-pill-time" type="time" aria-label="Beigu laiks" value={form.time_to||''} onChange={e=>update('time_to',e.target.value)}/>}
     </div>
    </div>
    {multiDay&&!recurring&&<label className="ev-when-toggle"><input type="checkbox" checked={perDay} onChange={e=>chooseDayTimes(e.target.checked)}/>Katrai dienai savs laiks</label>}
    {perDay&&<div className="event-day-times ev-day-times" role="group" aria-label="Katras dienas laiks">
     {dayList.map(day=>{const slot=daySlot(day);return <div className="event-day-time" key={day}>
      <strong>{dayLabel(day)}</strong>
      <label>No<input type="time" value={slot.start} onChange={e=>setDayTime(day,'start',e.target.value)}/></label>
      <label>Līdz<input type="time" value={slot.end} onChange={e=>setDayTime(day,'end',e.target.value)}/></label>
     </div>;})}
    </div>}
    {recurring&&<div className="ev-weekly">
     {savedId&&recurrenceEditScope(form)==='series'&&<p className="ev-hint">Izmaiņas attiecas uz visu sēriju; vienu norisi atsevišķi šeit nemaina.</p>}
     <WeeklySchedule slots={form.recurrence_slots||[]} onChange={v=>update('recurrence_slots',v)} dateFrom={form.date_from} dateTo={form.date_to}/>
    </div>}
    <div className="ev-when-foot"><Icon name="globe"/><strong>{rigaOffsetLabel(form.date_from)}</strong><span>Rīga</span></div>
   </section>

   <section ref={locationRef} className={'ev-card ev-where'+(whereOpen?' open':'')}>
    <button type="button" className="ev-row-button" aria-expanded={whereOpen} aria-controls="ev-where-panel" onClick={()=>setWhereOpen(v=>!v)}>
     <Icon name="pin"/>
     <span className="ev-row-text"><strong>{whereTitle}</strong><small>{whereText}</small></span>
     <span className="ev-row-chevron"><Icon name="chevron"/></span>
    </button>
    {whereOpen&&<div className="ev-panel" id="ev-where-panel">
     <fieldset className="ev-segmented"><legend>Kā notiks?</legend>
      {Object.entries(ATTENDANCE_LABELS).map(([value,label])=><label key={value} className={(form.attendance_mode||'in_person')===value?'active':''}>
       <input type="radio" name="attendance_mode" value={value} checked={(form.attendance_mode||'in_person')===value} onChange={()=>update('attendance_mode',value)}/>{label==='Klātienē un tiešsaistē'?'Abi':label}</label>)}
     </fieldset>
     {form.attendance_mode!=='in_person'&&<label className="ev-field">Saite uz zvanu (Zoom, Teams, Google Meet…)
      <input type="url" inputMode="url" placeholder="https://…" maxLength={500} value={form.online_url||''} onChange={e=>update('online_url',e.target.value)}/>
     </label>}
     {needsVenue||form.attendance_mode!=='online'?<>
      {!account?<div className="ev-signin"><p>Norises vietas glabājas organizatora kontā. Pieslēdzies — ievadītais saglabāsies.</p><button type="button" className="button primary" onClick={startAuth}>Pieslēgties un izvēlēties vietu →</button></div>
      :<div className="ev-venue">
       <label className="ev-field">{form.attendance_mode==='online'?'Vieta, no kuras pasākums notiek':'Norises vieta'}
        <select aria-label="Pasākuma norises adrese" value={form.venue_id||''} onChange={e=>selectAddress(e.target.value)}>
         <option value="">Izvēlies vietu</option>
         {addressOptions.mine.length>0&&<optgroup label="Manas vietas">{addressOptions.mine.map(v=><option key={v.id} value={v.id}>{v.name} — {v.address}</option>)}</optgroup>}
         {addressOptions.shared.length>0&&<optgroup label="Pievienotās publiskās vietas">{addressOptions.shared.map(v=><option key={v.id} value={v.id}>{v.name} — {v.address}</option>)}</optgroup>}
         {form.venue_id&&!selectedVenue&&<option value={form.venue_id}>Iepriekš izvēlētā vieta (nav pieejama)</option>}
        </select>
       </label>
       <button className="button ev-add-venue" type="button" disabled={!orgId||!canEdit||busy} onClick={()=>setAddressOpen(true)}>+ Jauna vieta</button>
       {!addressOptions.mine.length&&!selectedVenue&&<p className="ev-hint">Šim organizatoram vēl nav saglabātu vietu. Pievieno pirmo — tā saglabāsies nākamajiem pasākumiem.</p>}
      </div>}
     </>:<p className="ev-hint">Privātam tiešsaistes pasākumam vieta nav vajadzīga.</p>}
    </div>}
   </section>

   <section className="ev-card ev-desc">
    {descOpen?<label className="ev-desc-field"><span className="sr-only">Apraksts</span>
     <textarea rows={4} maxLength={6000} autoFocus={!form.description} value={form.description} placeholder="Kas notiks un kam pasākums paredzēts?" onChange={e=>update('description',e.target.value)}/>
    </label>:<button type="button" className="ev-row-button" onClick={()=>setDescOpen(true)}>
     <Icon name="text"/><span className="ev-row-text"><strong>Pievienot aprakstu</strong></span>
    </button>}
   </section>

   <h2 className="ev-section-title">Pasākuma iestatījumi</h2>
   <section className="ev-card ev-options">
    <label className="ev-option"><Icon name="tag"/><span>Kategorija</span>
     <select value={form.category} onChange={e=>update('category',e.target.value)}>{EVENT_CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label>
    <label className="ev-option"><Icon name="ticket"/><span>Dalības maksa</span>
     <select value={form.price_status} onChange={e=>update('price_status',e.target.value)}>{Object.entries(PRICE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {['paid','mixed'].includes(form.price_status)&&<div className="ev-option ev-price">
     <label>No, EUR<input required type="number" min="0" step="0.01" inputMode="decimal" value={form.price_min??''} onChange={e=>update('price_min',e.target.value)}/></label>
     <label>Līdz, EUR<input required type="number" min="0" step="0.01" inputMode="decimal" value={form.price_max??''} onChange={e=>update('price_max',e.target.value)}/></label>
    </div>}
    <label className="ev-option"><Icon name="repeat"/><span>Atkārtojas</span>
     <select value={recurring?'weekly':'no'} onChange={e=>chooseRepeat(e.target.value==='weekly')}><option value="no">Nē</option><option value="weekly">Katru nedēļu</option></select></label>
   </section>

   <div className="ev-submit">
    <p className="ev-hint">{submitNote}</p>
    <button className="ev-primary" type="submit" disabled={busy||viewer}>{busy?'Saglabā…':primaryLabel}</button>
    {!publishedEdit&&<button type="button" className="ev-secondary" disabled={busy||viewer} onClick={()=>save('draft')}>{account&&orgId?'Saglabāt melnrakstu':'Saglabāt ierīcē'}</button>}
    {!publishedEdit&&<button type="button" className="text-button ev-reset" onClick={()=>{if(window.confirm('Notīrīt aizpildīto formu? Ievadītais tiks dzēsts no šīs ierīces.')){clearLocal();setForm({...DEFAULT});setSaveVenue(false);setSavedId('');removeImage();setNotice('Forma notīrīta.');}}}>Notīrīt formu</button>}
   </div>
  </form>}

  <EventVenueDialog open={addressOpen&&stage==='edit'} onClose={()=>setAddressOpen(false)} onSave={addOrChooseVenue}
    busy={addressBusy} existingVenues={addressOptions.mine} publicVenues={publicVenues}/>

  {stage==='auth'&&<section className="ev-card ev-auth"><h2>Pieslēdzies, lai turpinātu</h2><p className="meets-muted">Ievadītais pasākums paliks saglabāts šajā ierīcē.</p><Authentication onSuccess={async value=>{
    try{
     const oldGuest=scopedDraftKey(null,orgId);const result=await load(value);
     const chosen=result.result.organizations?.find(o=>o.id===orgId)?.id||(result.result.organizations?.length===1?result.result.organizations[0].id:'');
     setOrgId(chosen);try{localStorage.removeItem(oldGuest);localStorage.removeItem(EVENT_DRAFT_KEY);}catch{}
     setStage('edit');setError('');
     if(needsVenue&&!form.venue_id){setWhereOpen(true);setNotice('Pieslēgšanās veiksmīga. Izvēlies vai pievieno norises vietu.');}
     else setNotice('Pieslēgšanās veiksmīga. Pārbaudi un izveido pasākumu.');
    }catch(e){setError(e.message);}
   }}/><button className="button" type="button" onClick={()=>setStage('edit')}>← Atpakaļ</button></section>}

  {stage==='done'&&<section className="ev-done" aria-live="polite">
   <div className="ev-done-icon" aria-hidden="true">✓</div>
   <h2>{doneTitle}</h2>
   <p className="ev-done-event"><strong>{form.title}</strong><span>{scheduleLines(form)[0]}</span></p>
   <p className="meets-muted">{doneText}</p>
   {shareToken&&<div className="ev-share">
    <label className="ev-field">Saite uz pasākumu
     <span className="ev-share-row"><input readOnly value={shareUrl} onFocus={e=>e.target.select()}/><button type="button" className="button" onClick={copyLink}>{copied?'✓ Nokopēta':'Kopēt'}</button></span>
    </label>
    <a className="button" href={sharePath(shareToken)} target="_blank" rel="noopener noreferrer">Atvērt pasākuma lapu ↗</a>
   </div>}
   {shareToken&&<a className="ev-flyer" href={flyerPath(shareToken)} target="_blank" rel="noopener noreferrer">
    <Icon name="flyer"/><span className="ev-row-text"><strong>Sludinājums drukai</strong><small>A4 ar QR kodu — izdrukā vai saglabā PDF</small></span><span aria-hidden="true">→</span>
   </a>}
   <div className="ev-done-actions"><button type="button" className="button primary" onClick={restart}>+ Vēl viens pasākums</button><Link className="button" href={'/organizators?org='+orgId+'&panel=events'}>Pasākumu saraksts →</Link></div>
  </section>}
 </section>;

 return account?<ProfileShell session={account} activeOrganization={activeOrg}>{editor}</ProfileShell>:editor;
}
export default function SimpleEventPage(){return <Suspense fallback={<p role="status">Ielādē formu…</p>}><SimpleEventFlow/></Suspense>;}
