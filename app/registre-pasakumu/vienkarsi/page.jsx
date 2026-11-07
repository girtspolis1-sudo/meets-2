'use client';
import {Suspense,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import EventVenueDialog from '../../components/event-venue-dialog.jsx';
import Authentication from '../../components/account-auth-flow.jsx';
import ProfileShell from '../../components/profile-shell.jsx';
import WeeklySchedule from '../../components/weekly-schedule.jsx';
import {rigaDate} from '../../../lib/meets-personal.js';
import {countOccurrences,cleanPrice,cleanDatedSlots,datesBetween,DEFAULT_START,defaultEndTime,SCHEDULE_MODES,scheduleModeOf,nextDateAfter} from '../../../lib/event-schedule.js';
import {ATTENDANCE_LABELS,EVENT_CATEGORIES,QUICK_EVENT_EMPTY,EVENT_DRAFT_KEY,quickEventIssue,normalizeEventTime,copyEventDraft,venueRequired} from '../../../lib/event-entry.js';
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
 // The field the last error belongs to: it is marked and scrolled into view.
 const [issue,setIssue]=useState(null);
 // Signed in without an organizer profile: it is made from this name on saving.
 const [newOrgName,setNewOrgName]=useState('');
 // Asks once more before the event is created or sent: private or public.
 const [confirming,setConfirming]=useState(false);
 // How the event takes place: single, range, weekly or dates (lib/event-schedule.js).
 const [mode,setMode]=useState('single');
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

 const orgPending=Boolean(account&&!orgs.length);
 const canEdit=activeOrg?canWriteOrganization(activeOrg.role):orgPending;
 const viewer=activeOrg?.role==='viewer';
 const privateEvent=form.visibility==='private';
 // Trusted organizers are published without MEETS review.
 const trusted=activeOrg?.trusted===true;
 const recurring=mode==='weekly';
 const chosenDays=mode==='dates';
 const perDay=mode==='range'&&form.schedule_kind==='dated';
 const multiDay=mode==='range'&&Boolean(form.date_to&&form.date_to!==form.date_from);
 const needsVenue=venueRequired(form);

 async function call(action,payload={},token=account?.access_token){
  const response=await fetch('/api/organizer',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action,token,...payload})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const e=new Error(body.error||'Neizdevās saglabāt.');e.status=response.status;e.field=body.field||'';throw e;}
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
   // Started in the organizer area: name, date and visibility come along.
   const preTitle=(params.get('title')||'').slice(0,200),preStart=params.get('start')||'',prePrivate=params.get('private')==='1';
   if(!next&&!editId&&!copyId&&(preTitle||preStart||prePrivate)){
    next={...DEFAULT,title:preTitle,visibility:prePrivate?'private':'public',
     date_from:/^\d{4}-\d{2}-\d{2}$/.test(preStart)&&preStart>=rigaDate()?preStart:''};
    const u=new URL(window.location.href);['title','start','private'].forEach(k=>u.searchParams.delete(k));
    window.history.replaceState(null,'',u.pathname+(u.searchParams.toString()?'?'+u.searchParams.toString():''));
   }
   if(!next){
    const stored=restoreLocal(session?.user?.id,chosen);
    if(stored){next=cleanDraft(stored);setSaveVenue(stored.save_venue===true);setSavedId(stored.saved_id||'');setNotice('Atjaunots iepriekš saglabātais melnraksts.');}
   }
   if(next){setForm(next);setMode(scheduleModeOf(next));if(next.description)setDescOpen(true);}
   setLoaded(true);
  })();
  return()=>{alive=false;};
 },[]);

 useEffect(()=>{
  if(!loaded||stage==='done')return;
  const timer=setTimeout(()=>persistLocal(),600);
  return()=>clearTimeout(timer);
 },[form,saveVenue,savedId,loaded,stage,orgId,account?.user?.id]);

 useEffect(()=>{if(!error)setIssue(null);},[error]);
 useEffect(()=>{
  if(!issue?.field)return;
  const box=document.querySelector('[data-field~="'+issue.field+'"]');
  if(!box)return;
  box.scrollIntoView({behavior:'smooth',block:'center'});
  const input=box.querySelector('[aria-invalid="true"]')||box.querySelector('input:not([type=file]):not([type=radio]),select,textarea');
  // Date and time pickers are not opened by themselves; the field is only shown.
  if(input&&!['date','time'].includes(input.type))setTimeout(()=>input.focus({preventScroll:true}),400);
 },[issue]);
 function fail(field,message){
  setError(message);setIssue(field?{field,message}:null);
  if(field==='venue'||field==='online_url')setWhereOpen(true);
 }
 function errorField(message){
  const m=String(message||'');
  if(/organizator|organizācij/i.test(m))return 'organization';
  if(/viet|adres/i.test(m))return 'venue';
  if(/zvan|https/i.test(m))return 'online_url';
  if(/cen|EUR|maks/i.test(m))return 'price';
  if(/laik/i.test(m))return 'time_to';
  if(/datum/i.test(m))return 'date_from';
  if(/nosaukum/i.test(m))return 'title';
  return '';
 }
 function update(field,value){setForm(before=>({...before,[field]:value}));setError('');}
 function applyVenue(venue){
  if(!venue)return;
  setForm(prev=>({...prev,venue_id:venue.id,venue_name:venue.name,
   address:venue.address||'',latitude:venue.latitude??'',longitude:venue.longitude??''}));
  setSaveVenue(false);setError('');
 }
 async function addOrChooseVenue(next){
  if(!account?.access_token||(orgId&&!canEdit))throw Error('Pieslēdzies organizatora kontam ar rediģēšanas tiesībām.');
  if(!orgId&&(orgs.length||newOrgName.trim().length<2))throw Error(orgs.length?'Vispirms izvēlies organizatoru pasākuma augšā.':'Vispirms ieraksti organizatora nosaukumu pasākuma augšā.');
  setAddressBusy(true);
  try{
   const org=orgId||await ensureOrg();
   if(!org)throw Error('Vispirms norādi organizatoru.');
   const known=[...venues,...publicVenues].find(v=>v.id===next.venue_id);
   let item=known;
   if(known&&known.organization_id!==org){
    const result=await call('useVenue',{organization_id:org,venue_id:known.id});
    item=result.item||known;
   }else if(!known){
    const result=await call('createVenue',{organization_id:org,name:next.name,
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
  setOrgId(value);setSavedId(stored?.saved_id||'');setSaveVenue(stored?.save_venue===true);setForm(stored?cleanDraft(stored):{...DEFAULT});setMode(stored?scheduleModeOf(stored):'single');setNotice(stored?'Atjaunots šī organizatora melnraksts.':'');setError('');
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
 function daySlot(day){return (form.recurrence_slots||[]).find(x=>x.date===day)||{date:day,start:form.time_from||DEFAULT_START,end:form.time_to||defaultEndTime(form.time_from||DEFAULT_START)};}
 function setDayTime(day,key,value){
  const slots=datesBetween(form.date_from,form.date_to).map(d=>{const s=daySlot(d);return d===day?{...s,[key]:value}:s;});
  update('recurrence_slots',slots);
 }
 function chooseDayTimes(on){
  setForm(before=>{
   if(!on)return {...before,schedule_kind:'once',recurrence_slots:[]};
   const start=before.time_from||DEFAULT_START,end=before.time_to||defaultEndTime(start);
   return {...before,schedule_kind:'dated',recurrence_slots:datesBetween(before.date_from,before.date_to).map(date=>({date,start,end}))};
  });
 }
 // Switching how the event takes place keeps the start date and time.
 function chooseMode(next){
  setMode(next);
  setForm(before=>{
   const start=before.time_from||'',end=before.time_to||'';
   if(next==='weekly')return {...before,schedule_kind:'recurring',recurrence_slots:before.schedule_kind==='recurring'?before.recurrence_slots:[]};
   if(next==='dates'){
    const kept=before.schedule_kind==='dated'?before.recurrence_slots:[];
    const slots=kept.length?kept:[{date:before.date_from||'',start:start||DEFAULT_START,end:end||defaultEndTime(start||DEFAULT_START)}];
    return withSlotDates({...before,schedule_kind:'dated',recurrence_slots:slots});
   }
   if(next==='single')return {...before,schedule_kind:'once',date_to:'',recurrence_slots:[]};
   return {...before,schedule_kind:'once',recurrence_slots:[]};
  });
  setError('');
 }
 // Chosen days: the first and last day make the event's date range.
 function withSlotDates(next){
  const days=(next.recurrence_slots||[]).map(s=>s.date).filter(Boolean).sort();
  return {...next,date_from:days[0]||'',date_to:days.length>1?days[days.length-1]:''};
 }
 function setChosenDay(index,key,value){
  setForm(before=>{
   const slots=(before.recurrence_slots||[]).map((slot,i)=>{
    if(i!==index)return slot;
    const changed={...slot,[key]:value};
    if(key==='start'&&value&&(!slot.end||slot.end<=value))changed.end=defaultEndTime(value);
    return changed;
   });
   return withSlotDates({...before,recurrence_slots:slots});
  });
  setError('');
 }
 function addChosenDay(){
  setForm(before=>{
   const slots=before.recurrence_slots||[];
   const last=slots[slots.length-1]||{};
   return withSlotDates({...before,recurrence_slots:[...slots,{date:nextDateAfter(slots,before.date_from),start:last.start||DEFAULT_START,end:last.end||defaultEndTime(last.start||DEFAULT_START)}]});
  });
 }
 function removeChosenDay(index){setForm(before=>withSlotDates({...before,recurrence_slots:(before.recurrence_slots||[]).filter((_,i)=>i!==index)}));}
 // An empty time field opens at 16:00, and the end two hours after the start.
 function suggestTime(event,value,apply){
  if(event.currentTarget.value||!value)return;
  event.currentTarget.value=value;
  apply(value);
 }
 function setStartTime(value){
  setForm(before=>({...before,time_from:value,
   ...(value&&(!before.time_to||before.time_to<=value)&&(!before.date_to||before.date_to===before.date_from)?{time_to:defaultEndTime(value)}:{})}));
  setError('');
 }
 function openLocation(){setWhereOpen(true);locationRef.current?.scrollIntoView({behavior:'smooth',block:'center'});}
 // Checks the form top to bottom and marks the first field to fix. Before
 // signing in only what needs no account is checked; the place comes after.
 function validateForSubmit({guest=false}={}){
  const values=perDay||recurring||chosenDays?{...form,time_from:'',time_to:''}:form;
  const first=quickEventIssue(values,{requireVenue:false});
  if(first){fail(first.field,first.message);return false;}
  if(!guest&&!orgId){
   if(orgs.length){fail('organization','Izvēlies, kurš organizators rīko pasākumu.');return false;}
   if(newOrgName.trim().length<2){fail('organization','Ieraksti organizatora nosaukumu — vismaz 2 rakstzīmes.');return false;}
  }
  try{cleanPrice(form.price_status,form.price_min,form.price_max);}
  catch(e){fail('price',e.message);return false;}
  try{
   if(recurring)countOccurrences(form.date_from,form.date_to,form.recurrence_slots);
   if(mode==='range'&&(!form.date_to||form.date_to<=form.date_from))throw Error('Norādi beigu datumu, kas ir pēc sākuma datuma.');
   if(chosenDays){
    const slots=form.recurrence_slots||[];
    if(slots.some(s=>!s.date))throw Error('Katrai norisei izvēlies datumu.');
    if(!savedId&&slots.some(s=>s.date<rigaDate()))throw Error('Norises dienas nevar būt pagātnē.');
    cleanDatedSlots(slots,form.date_from,form.date_to||form.date_from);
   }
   if(perDay){
    cleanDatedSlots(datesBetween(form.date_from,form.date_to).map(daySlot),form.date_from,form.date_to);
   }
  }catch(e){fail('schedule',e.message);return false;}
  if(guest)return true;
  if(needsVenue&&!form.venue_id){fail('venue','Izvēlies norises vietu no saraksta vai pievieno jaunu ar “+ Jauna vieta”.');return false;}
  const place=quickEventIssue(values,{requireVenue:needsVenue});
  if(place){fail(place.field,place.message);return false;}
  return true;
 }
 // The organizer of the event; made from the typed name when there is none yet.
 async function ensureOrg(){
  if(orgId)return orgId;
  if(orgs.length){fail('organization','Izvēlies, kurš organizators rīko pasākumu.');return '';}
  const name=newOrgName.trim();
  if(name.length<2){fail('organization','Ieraksti organizatora nosaukumu — vismaz 2 rakstzīmes.');return '';}
  const result=await call('createOrganization',{name,kind:'organizer'});
  const item=result.item;
  if(!item?.id)throw Error('Organizatoru neizdevās izveidot.');
  setOrgs([item]);setOrgId(item.id);clearLocal(account?.user?.id,'');
  const u=new URL(window.location.href);u.searchParams.set('org',item.id);window.history.replaceState(null,'',u.pathname+'?'+u.searchParams.toString());
  setNotice('Organizators “'+item.name+'” izveidots. Profilu vari papildināt vēlāk.');
  return item.id;
 }
 function startAuth(){persistLocal();setStage('auth');window.scrollTo({top:0,behavior:'smooth'});}
 async function save(status='draft'){
  if(!account){persistLocal();if(status==='draft')setNotice('Melnraksts saglabāts šajā ierīcē. Pieslēdzies, lai saglabātu to kontā.');else startAuth();return;}
  if(orgId&&!canEdit){setError('Šim organizatoram tev ir tikai skatīšanas tiesības.');return;}
  if(status!=='draft'&&!validateForSubmit())return;
  if(status==='draft'&&publishedEdit){setError('Publicētam pasākumam izmaiņas iesniedz pārbaudei — melnraksts nav pieejams.');return;}
  // The table keeps no event without a name, not even a draft.
  if(form.title.trim().length<3){fail('title','Lai saglabātu, ieraksti pasākuma nosaukumu (vismaz 3 rakstzīmes).');return;}
  setBusy(true);setError('');
  try{
   const org=await ensureOrg();
   if(!org)return;
   // A private online-only event keeps no place, even one picked earlier.
   const placeless=!needsVenue;
   const fields={...form,organization_id:org,
    visibility:publishedEdit?'public':form.visibility,
    venue_id:placeless?null:selectedVenue?.id||null,
    ...(placeless?{venue_name:'',address:'',latitude:'',longitude:''}:{}),
    save_venue:false,
    ...(perDay?{recurrence_slots:datesBetween(form.date_from,form.date_to).map(daySlot),time_from:'',time_to:''}:{}),
    ...(chosenDays?{recurrence_slots:[...(form.recurrence_slots||[])].sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)),time_from:'',time_to:''}:{}),
    ...(mode==='single'?{date_to:''}:{}),
    schedule_kind:recurring?'recurring':perDay||chosenDays?'dated':multiDay?'ongoing':'once'};
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
   if(status==='draft'){setNotice('Melnraksts saglabāts kontā.');persistLocal({...form},org,account);return;}
   setSubmitted(result.item);setStage('done');clearLocal(account?.user?.id,org);setNotice('');window.scrollTo({top:0,behavior:'smooth'});
  }catch(e){
   if(e.status===401){setError(e.message);startAuth();return;}
   fail(e.field||errorField(e.message),e.message);
  }
  finally{setBusy(false);}
 }
 function submit(event){
  event.preventDefault();
  if(!account){if(validateForSubmit({guest:true}))startAuth();return;}
  if(orgId&&!canEdit){setError('Šim organizatoram tev ir tikai skatīšanas tiesības.');return;}
  if(validateForSubmit())setConfirming(true);
 }
 function confirmSubmit(){
  setConfirming(false);
  save(publishedEdit||!privateEvent?'pending_review':'private');
 }
 useEffect(()=>{
  if(!confirming)return;
  const close=e=>{if(e.key==='Escape')setConfirming(false);};
  window.addEventListener('keydown',close);
  return()=>window.removeEventListener('keydown',close);
 },[confirming]);
 function pickImage(file){
  if(!file){setImageFile(null);setImagePreview('');return;}
  if(file.size>4*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Atļauti JPG, PNG un WebP attēli līdz 4 MB.');return;}
  if(imagePreview)URL.revokeObjectURL(imagePreview);setImageFile(file);setImagePreview(URL.createObjectURL(file));setError('');
 }
 function removeImage(){if(imagePreview)URL.revokeObjectURL(imagePreview);setImageFile(null);setImagePreview('');}
 function restart(){clearLocal();setPublishedEdit(false);setForm({...DEFAULT});setMode('single');setSubmitted(null);setSaveVenue(false);removeImage();setExistingCover(false);setSavedId('');setStage('edit');setError('');setNotice('');setCopied(false);setWhereOpen(false);setDescOpen(false);}
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

 const asPrivate=privateEvent&&!publishedEdit;
 const confirmText=publishedEdit?{
  title:trusted?'Publicēt izmaiņas?':'Iesniegt izmaiņas pārbaudei?',
  points:trusted?['Izmaiņas apmeklētāji redzēs uzreiz.','Pasākums paliek publisks MEETS kartē un sarakstā.']
   :['MEETS pārbaudīs izmaiņas, parasti 1–2 darba dienās.','Līdz tam apmeklētāji redz pašreizējo publicēto versiju.'],
  yes:trusted?'Jā, publicēt izmaiņas':'Jā, iesniegt izmaiņas'}
  :asPrivate?{title:'Izveidot privātu pasākumu?',
  points:['Redzēs tikai tie, kam nosūtīsi saiti.','Pasākums nebūs MEETS kartē un sarakstā, un MEETS to nepārbauda.','Vēlāk to vari padarīt publisku.'],
  yes:'Jā, izveidot privātu'}
  :trusted?{title:'Publicēt pasākumu visiem?',
  points:['Pasākums uzreiz būs redzams visiem MEETS kartē un sarakstā.','Saiti un sludinājumu drukai saņemsi uzreiz.'],
  yes:'Jā, publicēt'}
  :{title:'Iesniegt publisku pasākumu?',
  points:['MEETS pārbaudīs pasākumu, parasti 1–2 darba dienās.','Pēc apstiprināšanas to redzēs visi MEETS kartē un sarakstā.','Saiti un sludinājumu drukai saņemsi uzreiz.'],
  yes:'Jā, iesniegt pārbaudei'};
 const confirmPlace=[selectedVenue?.name,form.attendance_mode!=='in_person'?'Tiešsaistē':''].filter(Boolean).join(' · ');
 const bad=name=>issue?.field===name;
 const invalid=name=>bad(name)?{'aria-invalid':true,'aria-describedby':'ev-err-'+name}:{};
 const errorFor=(...names)=>{const name=names.find(bad);return name?<span className="ev-field-error" id={'ev-err-'+name} role="alert">{issue.message}</span>:null;};
 const orgChip=!account?<button type="button" className="ev-chip" onClick={startAuth}>Pieslēgties</button>
  :!orgs.length?<label className={'ev-chip ev-chip-input'+(bad('organization')?' has-error':'')}><span className="ev-avatar" aria-hidden="true">{(newOrgName.trim()||'+').slice(0,1)}</span>
    <input aria-label="Organizatora nosaukums" placeholder="Organizatora nosaukums" maxLength={160} autoComplete="organization" value={newOrgName} onChange={e=>{setNewOrgName(e.target.value);setError('');}} {...invalid('organization')}/></label>
  :orgs.length===1?<span className="ev-chip ev-chip-static"><span className="ev-avatar" aria-hidden="true">{(activeOrg?.name||'?').slice(0,1)}</span><span className="ev-chip-text">{activeOrg?.name}</span></span>
  :<label className={'ev-chip'+(bad('organization')?' has-error':'')}><span className="ev-avatar" aria-hidden="true">{(activeOrg?.name||'?').slice(0,1)}</span>
    <select aria-label="Organizators" {...invalid('organization')} value={orgId} onChange={e=>switchOrg(e.target.value)}><option value="">Izvēlies organizatoru</option>{orgs.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select><Icon name="chevron"/></label>;

 const editor=<section className="meets-organizer-page unified-event-editor ev-page">
  <header className="ev-head">
   <Link className="ev-back" href={orgId?'/organizators?org='+orgId+'&panel=events':'/organizators'}>← Pasākumi</Link>
   <h1>{stage==='done'?'Gatavs':savedId?'Labot pasākumu':'Jauns pasākums'}</h1>
   {stage==='edit'&&<span className="ev-save-state" role="status">{busy?'Saglabā…':lastSaved?'Saglabāts ierīcē '+lastSaved:''}</span>}
  </header>

  {account&&orgId&&viewer&&<p className="meets-inline-error">Tev ir skatītāja loma. Pasākumu vari apskatīt, bet ne saglabāt.</p>}
  {notice&&<p className="meets-organizer-success" role="status">{notice}</p>}
  {error&&!issue&&<>
   <p className="meets-inline-error event-inline-validation">{error}</p>
   <div className="event-editor-error-toast" role="alert" aria-atomic="true">
    <span className="event-editor-error-icon" aria-hidden="true">!</span>
    <div className="event-editor-error-content"><strong>Jāpārbauda pasākuma informācija</strong><p>{error}</p></div>
    <button type="button" className="event-editor-error-dismiss" aria-label="Aizvērt kļūdas paziņojumu" onClick={()=>setError('')}>×</button>
   </div>
  </>}

  {stage==='edit'&&<form className="ev-form" noValidate onSubmit={submit}>
   <label className={'ev-title'+(bad('title')?' has-error':'')} data-field="title"><span className="ev-label">Pasākuma nosaukums</span>
    <input required minLength={3} maxLength={200} autoComplete="off" enterKeyHint="next" value={form.title} placeholder="Piem., Rudens koncerts" onChange={e=>update('title',e.target.value)} {...invalid('title')}/>
    {errorFor('title')}
   </label>
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

   <div className="ev-chips" data-field="organization">
    {orgChip}
    <label className={'ev-chip ev-chip-visibility'+(privateEvent?' is-private':'')}>
     <Icon name={privateEvent?'lock':'globe'}/>
     <select aria-label="Redzamība" value={form.visibility} disabled={publishedEdit} onChange={e=>update('visibility',e.target.value)}>
      <option value="public">Publisks</option><option value="private">Privāts</option>
     </select><Icon name="chevron"/>
    </label>
   </div>
   {errorFor('organization')}
   {orgPending&&<p className="ev-hint ev-org-hint">Ieraksti, kas rīko pasākumu (piem., “Balvu sporta zāle”). Organizatora profils izveidosies kopā ar pasākumu — pārējo papildināsi vēlāk.</p>}
   <p className="ev-hint">{publishedEdit?'Publicēts pasākums paliek publisks.':VISIBILITY_HINTS[form.visibility]+(privateEvent?', bez MEETS pārbaudes.':'.')}</p>


   <section className={'ev-card ev-when'+(['date_from','date_to','time_from','time_to','schedule'].some(bad)?' has-error':'')} aria-label="Kad notiks" data-field="date_from date_to time_from time_to schedule">
    <fieldset className="ev-when-mode"><legend>Kā notiek</legend><div className="ev-when-mode-grid">
     {SCHEDULE_MODES.map(([value,label])=><label key={value} className={mode===value?'active':''}>
      <input type="radio" name="schedule-mode" value={value} checked={mode===value} disabled={publishedEdit&&value!==mode&&(value==='weekly'||mode==='weekly')} onChange={()=>chooseMode(value)}/>{label}</label>)}
    </div></fieldset>
    {!chosenDays&&<div className="ev-when-rows">
     <div className="ev-when-row">
      <span className="ev-when-dot" aria-hidden="true"/>
      <span className="ev-when-label">{recurring?'No':mode==='single'?'Datums':'Sākums'}</span>
      <input className="ev-pill" type="date" aria-label={recurring?'Grafika sākuma datums':'Sākuma datums'} {...invalid('date_from')} required min={savedId?undefined:rigaDate()} value={form.date_from||''} onChange={e=>setStartDate(e.target.value)}/>
      {!recurring&&!perDay&&<input className="ev-pill ev-pill-time" type="time" aria-label="Sākuma laiks" {...invalid('time_from')} value={form.time_from||''}
       onPointerDown={e=>suggestTime(e,DEFAULT_START,setStartTime)} onFocus={e=>suggestTime(e,DEFAULT_START,setStartTime)} onChange={e=>setStartTime(e.target.value)}/>}
     </div>
     {(mode!=='single'||!perDay)&&<div className="ev-when-row">
      <span className="ev-when-dot hollow" aria-hidden="true"/>
      <span className="ev-when-label">{recurring?'Līdz':mode==='single'?'Beidzas':'Beigas'}</span>
      {mode!=='single'&&<input className="ev-pill" type="date" aria-label={recurring?'Grafika beigu datums':'Beigu datums'} {...invalid('date_to')} required min={form.date_from||undefined} value={form.date_to||''} onChange={e=>setEndDate(e.target.value)}/>}
      {!recurring&&!perDay&&<input className="ev-pill ev-pill-time" type="time" aria-label="Beigu laiks" {...invalid('time_to')} value={form.time_to||''}
       onPointerDown={e=>suggestTime(e,defaultEndTime(form.time_from||DEFAULT_START),v=>update('time_to',v))} onFocus={e=>suggestTime(e,defaultEndTime(form.time_from||DEFAULT_START),v=>update('time_to',v))} onChange={e=>update('time_to',e.target.value)}/>}
     </div>}
    </div>}
    {mode==='range'&&multiDay&&<label className="ev-when-toggle"><input type="checkbox" checked={perDay} onChange={e=>chooseDayTimes(e.target.checked)}/>Katrai dienai savs laiks</label>}
    {perDay&&<div className="event-day-times ev-day-times" role="group" aria-label="Katras dienas laiks">
     {dayList.map(day=>{const slot=daySlot(day);return <div className="event-day-time" key={day}>
      <strong>{dayLabel(day)}</strong>
      <label>No<input type="time" value={slot.start} onChange={e=>setDayTime(day,'start',e.target.value)}/></label>
      <label>Līdz<input type="time" value={slot.end} onChange={e=>setDayTime(day,'end',e.target.value)}/></label>
     </div>;})}
    </div>}
    {chosenDays&&<div className="ev-dates" role="group" aria-label="Norises dienas">
     {(form.recurrence_slots||[]).map((slot,index)=><div className="ev-date-row" key={index}>
      <input className="ev-pill" type="date" aria-label={'Norises diena '+(index+1)} min={savedId?undefined:rigaDate()} value={slot.date||''} onChange={e=>setChosenDay(index,'date',e.target.value)}/>
      <input className="ev-pill ev-pill-time" type="time" aria-label={'Sākuma laiks, '+(index+1)+'. diena'} value={slot.start||''} onChange={e=>setChosenDay(index,'start',e.target.value)}/>
      <input className="ev-pill ev-pill-time" type="time" aria-label={'Beigu laiks, '+(index+1)+'. diena'} value={slot.end||''} onChange={e=>setChosenDay(index,'end',e.target.value)}/>
      <button type="button" className="ev-date-remove" aria-label={'Noņemt '+(index+1)+'. dienu'} disabled={(form.recurrence_slots||[]).length<2} onClick={()=>removeChosenDay(index)}>✕</button>
     </div>)}
     <button type="button" className="ev-date-add" disabled={(form.recurrence_slots||[]).length>=62} onClick={addChosenDay}>+ Pievienot dienu</button>
     <p className="ev-hint">Piemēram, treniņi vai nodarbības dažādās dienās. Katrai dienai var būt savs laiks.</p>
    </div>}
    {recurring&&<div className="ev-weekly">
     {savedId&&recurrenceEditScope(form)==='series'&&<p className="ev-hint">Izmaiņas attiecas uz visu sēriju; vienu norisi atsevišķi šeit nemaina.</p>}
     <WeeklySchedule slots={form.recurrence_slots||[]} onChange={v=>update('recurrence_slots',v)} dateFrom={form.date_from} dateTo={form.date_to}/>
    </div>}
    {errorFor('date_from','date_to','time_from','time_to','schedule')}
    <div className="ev-when-foot"><Icon name="globe"/><strong>{rigaOffsetLabel(form.date_from)}</strong><span>Rīga</span></div>
   </section>

   <section ref={locationRef} className={'ev-card ev-where'+(whereOpen?' open':'')+(bad('venue')||bad('online_url')?' has-error':'')} data-field="venue online_url">
    <button type="button" className="ev-row-button" aria-expanded={whereOpen} aria-controls="ev-where-panel" onClick={()=>setWhereOpen(v=>!v)}>
     <Icon name="pin"/>
     <span className="ev-row-text"><strong>{whereTitle}</strong><small>{whereText}</small></span>
     <span className="ev-row-chevron"><Icon name="chevron"/></span>
    </button>
    {errorFor('venue','online_url')}
    {whereOpen&&<div className="ev-panel" id="ev-where-panel">
     <fieldset className="ev-segmented"><legend>Kā notiks?</legend>
      {Object.entries(ATTENDANCE_LABELS).map(([value,label])=><label key={value} className={(form.attendance_mode||'in_person')===value?'active':''}>
       <input type="radio" name="attendance_mode" value={value} checked={(form.attendance_mode||'in_person')===value} onChange={()=>update('attendance_mode',value)}/>{label==='Klātienē un tiešsaistē'?'Abi':label}</label>)}
     </fieldset>
     {form.attendance_mode!=='in_person'&&<label className="ev-field">Saite uz zvanu (Zoom, Teams, Google Meet…)
      <input type="url" inputMode="url" placeholder="https://…" maxLength={500} {...invalid('online_url')} value={form.online_url||''} onChange={e=>update('online_url',e.target.value)}/>
     </label>}
     {needsVenue||form.attendance_mode!=='online'?<>
      {!account?<div className="ev-signin"><p>Norises vietas glabājas organizatora kontā. Pieslēdzies — ievadītais saglabāsies.</p><button type="button" className="button primary" onClick={startAuth}>Pieslēgties un izvēlēties vietu →</button></div>
      :<div className="ev-venue">
       <label className="ev-field">{form.attendance_mode==='online'?'Vieta, no kuras pasākums notiek':'Norises vieta'}
        <select aria-label="Pasākuma norises adrese" {...invalid('venue')} value={form.venue_id||''} onChange={e=>selectAddress(e.target.value)}>
         <option value="">Izvēlies vietu</option>
         {addressOptions.mine.length>0&&<optgroup label="Manas vietas">{addressOptions.mine.map(v=><option key={v.id} value={v.id}>{v.name} — {v.address}</option>)}</optgroup>}
         {addressOptions.shared.length>0&&<optgroup label="Pievienotās publiskās vietas">{addressOptions.shared.map(v=><option key={v.id} value={v.id}>{v.name} — {v.address}</option>)}</optgroup>}
         {form.venue_id&&!selectedVenue&&<option value={form.venue_id}>Iepriekš izvēlētā vieta (nav pieejama)</option>}
        </select>
       </label>
       <button className="button ev-add-venue" type="button" disabled={(orgId?!canEdit:!orgPending)||busy} onClick={()=>setAddressOpen(true)}>+ Jauna vieta</button>
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
   <section className={'ev-card ev-options'+(['category','price_status','price'].some(bad)?' has-error':'')} data-field="category price_status price">
    <label className="ev-option"><Icon name="tag"/><span>Kategorija</span>
     <select value={form.category} {...invalid('category')} onChange={e=>update('category',e.target.value)}>{EVENT_CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label>
    <label className="ev-option"><Icon name="ticket"/><span>Dalības maksa</span>
     <select value={form.price_status} {...invalid('price_status')} onChange={e=>update('price_status',e.target.value)}>{Object.entries(PRICE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {['paid','mixed'].includes(form.price_status)&&<div className="ev-option ev-price">
     <label>No, EUR<input required {...invalid('price')} type="number" min="0" step="0.01" inputMode="decimal" value={form.price_min??''} onChange={e=>update('price_min',e.target.value)}/></label>
     <label>Līdz, EUR<input required type="number" min="0" step="0.01" inputMode="decimal" value={form.price_max??''} onChange={e=>update('price_max',e.target.value)}/></label>
    </div>}
    {errorFor('category','price_status','price')}
   </section>

   <div className="ev-submit">
    <p className="ev-hint">{submitNote}</p>
    <button className="ev-primary" type="submit" disabled={busy||viewer}>{busy?'Saglabā…':primaryLabel}</button>
    {!publishedEdit&&<button type="button" className="ev-secondary" disabled={busy||viewer} onClick={()=>save('draft')}>{account&&orgId?'Saglabāt melnrakstu':'Saglabāt ierīcē'}</button>}
    {!publishedEdit&&<button type="button" className="text-button ev-reset" onClick={()=>{if(window.confirm('Notīrīt aizpildīto formu? Ievadītais tiks dzēsts no šīs ierīces.')){clearLocal();setForm({...DEFAULT});setMode('single');setSaveVenue(false);setSavedId('');removeImage();setNotice('Forma notīrīta.');}}}>Notīrīt formu</button>}
   </div>
  </form>}

  {confirming&&stage==='edit'&&<div className="ev-confirm-backdrop" onClick={e=>{if(e.target===e.currentTarget)setConfirming(false);}}>
   <div className="ev-confirm" role="dialog" aria-modal="true" aria-labelledby="ev-confirm-title">
    <span className={'ev-confirm-badge '+(asPrivate?'is-private':'is-public')}><Icon name={asPrivate?'lock':'globe'}/>{asPrivate?'Privāts pasākums':'Publisks pasākums'}</span>
    <h2 id="ev-confirm-title">{confirmText.title}</h2>
    <p className="ev-confirm-event"><strong>{form.title}</strong><span>{scheduleLines(form)[0]}</span>{confirmPlace&&<span>{confirmPlace}</span>}</p>
    <ul className="ev-confirm-points">{confirmText.points.map(point=><li key={point}>{point}</li>)}</ul>
    <div className="ev-confirm-actions">
     <button type="button" className="ev-primary" autoFocus onClick={confirmSubmit}>{confirmText.yes}</button>
     <button type="button" className="ev-secondary" onClick={()=>setConfirming(false)}>Atpakaļ labot</button>
    </div>
    {!publishedEdit&&<button type="button" className="text-button ev-confirm-switch" onClick={()=>update('visibility',asPrivate?'public':'private')}>
     {asPrivate?'Padarīt publisku (MEETS pārbaude, karte un saraksts)':'Padarīt privātu (tikai ar saiti)'}</button>}
   </div>
  </div>}

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
