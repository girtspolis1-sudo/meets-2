'use client';
import {Suspense,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import VenueLocationPicker from '../../organizators/venue-location-picker.jsx';
import Authentication from '../../components/account-auth-flow.jsx';
import ProfileShell from '../../components/profile-shell.jsx';
import {rigaDate} from '../../../lib/meets-personal.js';
import WeeklySchedule from '../../components/weekly-schedule.jsx';
import {countOccurrences,cleanPrice} from '../../../lib/event-schedule.js';
import {EVENT_CATEGORIES,QUICK_EVENT_EMPTY,EVENT_DRAFT_KEY,validateQuickEvent,copyEventDraft,isCoordinatePair} from '../../../lib/event-entry.js';

const SESSION='meets_user_session_v1';
const DRAFT_PREFIX='meets_event_draft_v3';
const DEFAULT={...QUICK_EVENT_EMPTY,recurrence_note:''};

function sessionRead(){try{return JSON.parse(localStorage.getItem(SESSION)||'null');}catch{return null;}}
function draftKey(userId,orgId){return DRAFT_PREFIX+':'+(userId||'guest')+':'+(orgId||'unassigned');}
function safeRead(key){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v&&typeof v==='object'&&!Array.isArray(v)?v:null;}catch{return null;}}
function cleanDraft(value){return {...DEFAULT,...Object.fromEntries(Object.keys(DEFAULT).map(k=>[k,value?.[k]??DEFAULT[k]]))};}
function prettyDate(date){if(!date)return 'Nav norādīts';const [y,m,d]=date.split('-');return d+'.'+m+'.'+y;}
async function refreshAccount(session){
 if(!session?.refresh_token)throw Error('Sesija beigusies.');
 const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh',token:session.refresh_token})});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(body.error||'Sesija beigusies.');
 const next={...body,expires_at:Date.now()+(body.expires_in||3600)*1000};
 localStorage.setItem(SESSION,JSON.stringify(next));window.dispatchEvent(new Event('meets-user-changed'));
 return next;
}

function SimpleEventFlow(){
 const params=useSearchParams();
 const [form,setForm]=useState({...DEFAULT});
 const [account,setAccount]=useState(null);
 const [orgs,setOrgs]=useState([]);
 const [orgId,setOrgId]=useState('');
 const [venues,setVenues]=useState([]);
 const [publicVenues,setPublicVenues]=useState([]);
 const [stage,setStage]=useState('edit');
 const [saveVenue,setSaveVenue]=useState(false);
 const [busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [submitted,setSubmitted]=useState(null);
 const [imageFile,setImageFile]=useState(null);
 const [imagePreview,setImagePreview]=useState('');
 const [savedId,setSavedId]=useState('');
 const [lastSaved,setLastSaved]=useState('');
 const initialized=useRef(false);
 const activeOrg=orgs.find(o=>o.id===orgId)||null;
 const selectedVenue=[...venues,...publicVenues].find(v=>v.id===form.venue_id);
 const managedSelected=selectedVenue?.organization_id===orgId;
 const canEdit=activeOrg?.role!=='viewer';

 async function call(action,payload={},token=account?.access_token){
  const response=await fetch('/api/organizer',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action,token,...payload})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const e=new Error(body.error||'Neizdevās saglabāt.');e.status=response.status;throw e;}
  return body;
 }

 function persistLocal(nextForm=form,nextOrg=orgId,nextAccount=account){
  try{
   const key=draftKey(nextAccount?.user?.id,nextOrg);
   localStorage.setItem(key,JSON.stringify({...nextForm,save_venue:saveVenue,saved_id:savedId||''}));
   setLastSaved(new Date().toLocaleTimeString('lv-LV',{hour:'2-digit',minute:'2-digit'}));
  }catch{}
 }
 function restoreLocal(userId,nextOrg){
  const scoped=safeRead(draftKey(userId,nextOrg));
  if(scoped)return scoped;
  if(!userId){
   const legacy=safeRead(EVENT_DRAFT_KEY);
   if(legacy)return legacy;
  }
  return null;
 }
 function clearLocal(userId=account?.user?.id,nextOrg=orgId){
  try{localStorage.removeItem(draftKey(userId,nextOrg));if(!userId)localStorage.removeItem(EVENT_DRAFT_KEY);}catch{}
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
  setAccount(current);setOrgs(result.organizations||[]);setVenues(result.venues||[]);setPublicVenues(result.publicVenues||[]);
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
   const chosen=available.find(o=>o.id===requestedOrg)?.id||(available.length===1?available[0]?.id:'');
   setOrgId(chosen||'');
   let next=null;
   if(editId&&chosen){
    const original=(result.submissions||[]).find(e=>e.id===editId&&e.organization_id===chosen);
    if(original){next=cleanDraft(original);setSavedId(original.id);setNotice(original.schedule_kind==='recurring'?'Tu labo visu atkārtotā pasākuma sēriju. Viena norise netiks mainīta atsevišķi.':'Atvērts esošais pasākums labošanai.');}
    else setError('Norādītais pasākums nav pieejams labošanai šajā organizācijā.');
   }else if(copyId&&chosen){
    const original=(result.submissions||[]).find(e=>e.id===copyId&&e.organization_id===chosen);
    if(original){next=copyEventDraft(original);setNotice('Izveidota kopija. Pārbaudi jaunos datumus — kopija netiks publicēta automātiski.');}
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
   if(next)setForm(next);
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
 function choose(place){
  const all=[...venues,...publicVenues];
  const picked=all.find(v=>v.id===place.venueId);
  setForm(before=>({...before,venue_id:picked?.id||'',venue_name:picked?.name||place.name||before.venue_name,
   address:picked?.address||place.address||'',latitude:picked?.latitude??place.latitude??'',longitude:picked?.longitude??place.longitude??''}));
  setSaveVenue(false);setError('');
 }
 function switchOrg(value){
  persistLocal(form,orgId,account);
  const stored=restoreLocal(account?.user?.id,value);
  setOrgId(value);setSavedId(stored?.saved_id||'');setSaveVenue(stored?.save_venue===true);setForm(stored?cleanDraft(stored):{...DEFAULT});setNotice(stored?'Atjaunots šīs organizācijas melnraksts.':'');setError('');
  const u=new URL(window.location.href);u.searchParams.set('org',value);u.searchParams.delete('edit');u.searchParams.delete('copy');u.searchParams.delete('venue');window.history.replaceState(null,'',u.pathname+'?'+u.searchParams.toString());
 }
 function validateForPreview(){
  const message=validateQuickEvent(form);
  if(message){setError(message);return false;}
  try{
   cleanPrice(form.price_status,form.price_min,form.price_max);
   if(form.schedule_kind==='recurring')countOccurrences(form.date_from,form.date_to,form.recurrence_slots);
  }catch(e){setError(e.message);return false;}
  return true;
 }
 function preview(){if(!validateForPreview())return;setError('');setStage('preview');window.scrollTo({top:0,behavior:'smooth'});}
 function startAuth(){setStage('auth');window.scrollTo({top:0,behavior:'smooth'});}
 function organizerSetup(){
  persistLocal();
  const returnPath='/registre-pasakumu/vienkarsi';
  const target='/organizators?new=1&return='+encodeURIComponent(returnPath);
  window.location.assign(target);
 }
 async function save(status='draft'){
  if(!account){persistLocal();setNotice('Melnraksts saglabāts šajā ierīcē. Pieslēdzies, lai saglabātu to kontā.');if(status!=='draft')startAuth();return;}
  if(!orgId){persistLocal();organizerSetup();return;}
  if(!canEdit){setError('Šajā organizācijā tev ir tikai skatīšanas tiesības.');return;}
  if(status==='pending_review'&&!validateForPreview()){setStage('edit');return;}
  setBusy(true);setError('');
  try{
   const fields={...form,organization_id:orgId,
    venue_id:selectedVenue?.id||null,
    save_venue:saveVenue,
    schedule_kind:form.schedule_kind==='recurring'?'recurring':form.schedule_kind==='ongoing'||(form.date_to&&form.date_to!==form.date_from)?'ongoing':'once'};
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
   setSubmitted(result.item);setStage('done');clearLocal();setNotice('');
  }catch(e){setError(e.message);if(e.status===401)startAuth();}
  finally{setBusy(false);}
 }
 function restart(){clearLocal();setForm({...DEFAULT});setSubmitted(null);setSaveVenue(false);setImageFile(null);setImagePreview('');setSavedId('');setStage('edit');setError('');setNotice('');}
 const venueChosen=Boolean(form.venue_id||form.address||isCoordinatePair(form));

 if(!loaded)return <p className="meets-profile-skeleton" role="status">Ielādē pasākuma redaktoru…</p>;

 const editor=<section className="meets-organizer-page quick-flow unified-event-editor">
  <div className="meets-account-heading"><div><p className="eyebrow">MEETS · Pasākuma redaktors</p><h1>{stage==='done'?'Pasākums saglabāts':savedId?'Labot pasākumu':'Jauns pasākums'}</h1>
   <p className="meets-muted">{activeOrg?<><strong>{activeOrg.name}</strong> vārdā · </>:null}viens redaktors jaunam pasākumam, labošanai un dublēšanai.</p></div>
   <Link className="button" href={orgId?'/organizators?org='+orgId+'&panel=events':'/organizators'}>← Pasākumu pārvaldība</Link></div>

  {orgs.length>1&&stage!=='done'&&<div className="event-editor-context"><label>Organizators<select value={orgId} onChange={e=>switchOrg(e.target.value)}><option value="">Izvēlies organizatoru</option>{orgs.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></label></div>}
  {account&&orgs.length===0&&stage!=='done'&&<div className="event-editor-org-needed"><strong>Lai iesniegtu pasākumu, aktivizē organizēšanu.</strong><p>Esošais ievadītais saturs tiks saglabāts un atjaunots pēc organizatora izveides.</p><button className="button primary" type="button" onClick={organizerSetup}>Sākt organizēt →</button></div>}
  {account&&orgId&&activeOrg?.role==='viewer'&&<p className="meets-inline-error">Tev ir skatītāja loma. Pasākumu vari apskatīt, bet ne saglabāt vai iesniegt.</p>}
  {notice&&<p className="meets-organizer-success" role="status">{notice}</p>}
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}
  {stage!=='done'&&stage!=='auth'&&<div className="event-save-state" role="status"><span>{busy?'Saglabā…':lastSaved?'Pēdējā lokālā saglabāšana '+lastSaved:'Izmaiņas automātiski saglabājas šajā ierīcē.'}</span>{account&&orgId&&<span>· Melnrakstu vari saglabāt arī kontā.</span>}</div>}

  {stage==='edit'&&<form className="quick-flow-card event-editor-form" onSubmit={e=>{e.preventDefault();preview();}}>
   <section className="event-editor-section"><div className="event-editor-section-title"><span>1</span><div><h2>Kas notiks?</h2><p>Nosaukums, kategorija, īss apraksts un attēls.</p></div></div>
    <label>Pasākuma nosaukums *<input required minLength={3} maxLength={200} autoComplete="off" value={form.title} placeholder="Piemēram, Ģimenes sporta diena" onChange={e=>update('title',e.target.value)}/></label>
    <div className="quick-flow-two"><label>Kategorija<select value={form.category} onChange={e=>update('category',e.target.value)}>{EVENT_CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label>
     <label>Pasākuma attēls<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{
      const file=e.target.files?.[0];if(!file){setImageFile(null);setImagePreview('');return;}
      if(file.size>4*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Atļauti JPG, PNG un WebP attēli līdz 4 MB.');e.target.value='';return;}
      if(imagePreview)URL.revokeObjectURL(imagePreview);setImageFile(file);setImagePreview(URL.createObjectURL(file));setError('');
     }}/></label></div>
    {imagePreview&&<div className="event-image-preview"><img src={imagePreview} alt="Pasākuma attēla priekšskatījums"/><button className="button" type="button" onClick={()=>{URL.revokeObjectURL(imagePreview);setImageFile(null);setImagePreview('');}}>Noņemt attēlu</button></div>}
    <label>Īss apraksts<textarea rows={4} maxLength={6000} value={form.description} placeholder="Kas notiks un kam pasākums paredzēts?" onChange={e=>update('description',e.target.value)}/></label>
   </section>

   <section className="event-editor-section"><div className="event-editor-section-title"><span>2</span><div><h2>Kad?</h2><p>Izvēlies vienreizēju, vairāku dienu vai atkārtotu norisi.</p></div></div>
    <label>Norises veids<select value={form.schedule_kind||'once'} onChange={e=>update('schedule_kind',e.target.value)}><option value="once">Vienreizējs</option><option value="ongoing">Vairāku dienu</option><option value="recurring">Atkārtots grafiks</option></select></label>
    {savedId&&form.schedule_kind==='recurring'&&<fieldset className="recurrence-scope"><legend>Ko labo?</legend><label><input type="radio" checked readOnly/> Visu sērijas grafiku</label><label aria-disabled="true"><input type="radio" disabled/> Tikai vienu norisi — šajā redaktorā nav pieejams</label><small>Izmaiņas visai sērijai nekad netiek veiktas klusām.</small></fieldset>}
    {form.schedule_kind==='recurring'?<>
     <div className="quick-flow-two"><label>Grafiks no *<input required type="date" min={savedId?undefined:rigaDate()} value={form.date_from||''} onChange={e=>update('date_from',e.target.value)}/></label><label>Grafiks līdz *<input required type="date" min={form.date_from||rigaDate()} value={form.date_to||''} onChange={e=>update('date_to',e.target.value)}/></label></div>
     <WeeklySchedule slots={form.recurrence_slots||[]} onChange={v=>update('recurrence_slots',v)} dateFrom={form.date_from} dateTo={form.date_to}/>
    </>:<div className="quick-flow-two"><label>Datums no *<input required type="date" min={savedId?undefined:rigaDate()} value={form.date_from||''} onChange={e=>update('date_from',e.target.value)}/></label>
     <label>Datums līdz<input type="date" min={form.date_from||undefined} value={form.date_to||''} onChange={e=>update('date_to',e.target.value)}/></label>
     <label>Sākuma laiks<input type="time" value={form.time_from||''} onChange={e=>update('time_from',e.target.value)}/></label><label>Beigu laiks<input type="time" value={form.time_to||''} onChange={e=>update('time_to',e.target.value)}/></label></div>}
   </section>

   <section className="event-editor-section"><div className="event-editor-section-title"><span>3</span><div><h2>Kur?</h2><p>Izmanto savu vietu, publisku MEETS vietu vai atzīmē jaunu punktu.</p></div></div>
    <VenueLocationPicker value={{name:form.venue_name,venueId:form.venue_id,address:form.address,latitude:form.latitude,longitude:form.longitude}}
      existingVenues={venues.filter(v=>v.organization_id===orgId)} publicVenues={publicVenues} onSelect={choose}/>
    {venueChosen&&<>
     <label>Norises vietas nosaukums *<input required minLength={2} maxLength={200} value={form.venue_name||''} onChange={e=>update('venue_name',e.target.value)}/></label>
     <label>Adrese<input maxLength={300} value={form.address||''} onChange={e=>update('address',e.target.value)}/></label>
     {selectedVenue?<p className="quick-flow-note">✓ {managedSelected?'Pārvaldīta organizācijas vieta.':'Publiska MEETS vieta. Vari to izmantot, bet tās profils paliek vietas pārvaldītāja īpašumā.'}</p>:
      <label className="quick-flow-check"><input type="checkbox" checked={saveVenue} onChange={e=>setSaveVenue(e.target.checked)}/> Saglabāt kā šīs organizācijas pārvaldītu vietu</label>}
    </>}
   </section>

   <section className="event-editor-section"><div className="event-editor-section-title"><span>4</span><div><h2>Dalība</h2><p>Norādi, vai pasākums ir bezmaksas vai maksas.</p></div></div>
    <label>Dalības maksa<select value={form.price_status} onChange={e=>update('price_status',e.target.value)}><option value="free">Bezmaksas</option><option value="paid">Maksas</option><option value="mixed">Cenu diapazons / daļēji maksas</option><option value="unknown">Nav zināms</option></select></label>
    {['paid','mixed'].includes(form.price_status)&&<div className="quick-flow-two"><label>Cena no, EUR *<input required type="number" min="0" step="0.01" value={form.price_min??''} onChange={e=>update('price_min',e.target.value)}/></label><label>Cena līdz, EUR *<input required type="number" min="0" step="0.01" value={form.price_max??''} onChange={e=>update('price_max',e.target.value)}/></label></div>}
   </section>

   <div className="quick-flow-actions event-editor-actions">
    <button className="button primary" type="submit">Priekšskatīt →</button>
    <button type="button" className="button" disabled={busy||activeOrg?.role==='viewer'} onClick={()=>save('draft')}>{busy?'Saglabā…':account&&orgId?'Saglabāt melnrakstu kontā':'Saglabāt melnrakstu'}</button>
    <button type="button" className="button" onClick={()=>{if(window.confirm('Notīrīt aizpildīto formu?')){clearLocal();setForm({...DEFAULT});setSaveVenue(false);setSavedId('');setNotice('Forma notīrīta.');}}}>Notīrīt</button>
   </div>
  </form>}

  {stage==='preview'&&<div className="quick-flow-card quick-flow-preview">
   <div className="event-editor-section-title"><span>5</span><div><h2>Priekšskatījums un iesniegšana</h2><p>Pārbaudi svarīgāko pirms nosūtīšanas moderatoram.</p></div></div>
   <p className="eyebrow">{activeOrg?.name||'Organizators nav izvēlēts'}</p><h2>{form.title}</h2>
   <p><strong>📅 {prettyDate(form.date_from)}{form.date_to&&form.date_to!==form.date_from?' – '+prettyDate(form.date_to):''}</strong>{form.time_from?' · '+form.time_from:''}{form.time_to?'–'+form.time_to:''}</p>
   <p>⌖ {form.venue_name} · {form.address||'Vieta atzīmēta kartē'}</p><p>{form.description||'Apraksts nav norādīts.'}</p>
   <div className="quick-flow-tags"><span>{form.category}</span><span>{({free:'Bezmaksas',paid:'Maksas',mixed:'Cenu diapazons',unknown:'Cena nav zināma'})[form.price_status]}{['paid','mixed'].includes(form.price_status)?' · '+form.price_min+'–'+form.price_max+' EUR':''}</span></div>
   {form.schedule_kind==='recurring'&&<p><strong>Norises reizes:</strong> {countOccurrences(form.date_from,form.date_to,form.recurrence_slots)}</p>}
   {imagePreview&&<img src={imagePreview} alt="" className="quick-event-image"/>}
   <p className="meets-muted">Iesniegšana neapiet moderāciju. Pasākums kartē būs redzams tikai pēc apstiprināšanas.</p>
   <div className="quick-flow-actions"><button className="button" type="button" onClick={()=>setStage('edit')}>← Labot</button>
    <button className="button primary" type="button" disabled={busy||activeOrg?.role==='viewer'} onClick={()=>account?save('pending_review'):startAuth()}>{busy?'Saglabā…':'Iesniegt pārbaudei →'}</button>
    <button type="button" className="button" disabled={busy||activeOrg?.role==='viewer'} onClick={()=>save('draft')}>Saglabāt kā melnrakstu</button></div>
  </div>}

  {stage==='auth'&&<div className="quick-flow-card"><h2>Pieslēdzies, lai turpinātu</h2><p className="meets-muted">Ievadītais pasākums paliks saglabāts šajā ierīcē.</p><Authentication onSuccess={async value=>{
    try{
     const oldGuest=draftKey(null,orgId);const result=await load(value);
     const chosen=result.result.organizations?.find(o=>o.id===orgId)?.id||(result.result.organizations?.length===1?result.result.organizations[0].id:'');
     setOrgId(chosen);try{localStorage.removeItem(oldGuest);localStorage.removeItem(EVENT_DRAFT_KEY);}catch{}
     setStage('preview');setError('');setNotice('Pieslēgšanās veiksmīga. Pārbaudi organizatoru un iesniedz pasākumu.');
    }catch(e){setError(e.message);}
   }}/><button className="button" type="button" onClick={()=>setStage('preview')}>← Atpakaļ</button></div>}

  {stage==='done'&&<div className="quick-flow-card"><div className="quick-flow-success">✓</div><h2>Pasākums nosūtīts pārbaudei</h2><p>{form.title}</p><p className="meets-muted">Ieraksts kļūs publisks tikai pēc moderatora apstiprināšanas.</p>
   <div className="quick-flow-actions"><button type="button" className="button primary" onClick={restart}>+ Pievienot nākamo pasākumu</button><Link className="button" href={'/organizators?org='+orgId+'&panel=events'}>Pasākumu saraksts →</Link></div></div>}
 </section>;

 return account?<ProfileShell session={account} activeOrganization={activeOrg}>{editor}</ProfileShell>:editor;
}
export default function SimpleEventPage(){return <Suspense fallback={<p role="status">Ielādē formu…</p>}><SimpleEventFlow/></Suspense>;}
