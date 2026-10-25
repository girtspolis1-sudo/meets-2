'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {Suspense} from 'react';
import VenueLocationPicker from '../../organizators/venue-location-picker.jsx';
import Authentication from '../../components/account-auth-flow.jsx';
import {rigaDate} from '../../../lib/meets-personal.js';
import WeeklySchedule from '../../components/weekly-schedule.jsx';
import {countOccurrences,cleanPrice} from '../../../lib/event-schedule.js';
import {EVENT_CATEGORIES,QUICK_EVENT_EMPTY,EVENT_DRAFT_KEY,validateQuickEvent,copyEventDraft,isCoordinatePair} from '../../../lib/event-entry.js';

const SESSION='meets_user_session_v1';
const DEFAULT={...QUICK_EVENT_EMPTY};
function savedSession(){try{return JSON.parse(localStorage.getItem(SESSION)||'null');}catch{return null;}}
function safeSavedDraft(){try{const value=JSON.parse(localStorage.getItem(EVENT_DRAFT_KEY)||'null');return value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(DEFAULT).map(k=>[k,value[k]??DEFAULT[k]])):null;}catch{return null;}}
function prettyDate(date){if(!date)return 'Nav norādīts';const [y,m,d]=date.split('-');return d+'.'+m+'.'+y;}
function SimpleEventFlow(){
 const params=useSearchParams();
 const [form,setForm]=useState(DEFAULT),[restored,setRestored]=useState(false),[account,setAccount]=useState(null),[orgs,setOrgs]=useState([]),[orgId,setOrgId]=useState(''),[venues,setVenues]=useState([]);
 const [stage,setStage]=useState('edit'),[saveVenue,setSaveVenue]=useState(false),[expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[submitted,setSubmitted]=useState(null);
 const [imageFile,setImageFile]=useState(null),[imagePreview,setImagePreview]=useState(''),[savedId,setSavedId]=useState('');
 const [refreshKey,setRefreshKey]=useState(0);
 const selectedVenue=venues.find(v=>v.id===form.venue_id&&v.organization_id===orgId);
 async function call(action,payload={},token=account?.access_token){
  const response=await fetch('/api/organizer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token,...payload}),cache:'no-store'});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Neizdevās saglabāt.');return data;
 }
 async function load(account){
  const result=await call('list',{},account.access_token);
  setAccount(account);setOrgs(result.organizations||[]);setVenues(result.venues||[]);
  setOrgId(before=>result.organizations?.some(o=>o.id===before)?before:(params.get('org')&&result.organizations?.some(o=>o.id===params.get('org'))?params.get('org'):result.organizations?.[0]?.id||''));
  return result;
 }
 useEffect(()=>{
  let active=true;
  const draft=safeSavedDraft();
  if(draft){setForm(draft);setSaveVenue(draft.save_venue===true);}
  setRestored(true);
  (async()=>{
   let session=savedSession();
   if(!session?.access_token)return;
   try{
    let result;
    try{result=await call('list',{},session.access_token);}
    catch{
     if(!session.refresh_token)throw Error('expired');
     const renewed=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh',token:session.refresh_token})});
     if(!renewed.ok)throw Error('expired');
     session=await renewed.json();
     localStorage.setItem(SESSION,JSON.stringify({...session,expires_at:Date.now()+(session.expires_in||3600)*1000}));
     result=await call('list',{},session.access_token);
    }
    if(!active)return;
    setAccount(session);setOrgs(result.organizations||[]);setVenues(result.venues||[]);
    const requested=params.get('org');
    const chosen=result.organizations?.find(o=>o.id===requested)?.id||result.organizations?.[0]?.id||'';
    setOrgId(chosen);
    const copied=params.get('copy');
    if(copied){
     const original=result.submissions?.find(e=>e.id===copied&&e.organization_id===chosen);
     if(original){setForm(copyEventDraft(original));setNotice('Izveidota iepriekšējā pasākuma kopija. Norādi jaunus datumus un pārbaudi vietu.');}
     else setError('Norādītais pasākums nav pieejams kopēšanai tavā organizācijā.');
    }else{
     const venueId=params.get('venue');
     const venue=result.venues?.find(v=>v.id===venueId&&v.organization_id===chosen);
     if(venue)setForm(f=>({...f,venue_id:venue.id,venue_name:venue.name,address:venue.address||'',latitude:venue.latitude??'',longitude:venue.longitude??''}));
    }
   }catch{if(active)setAccount(null);}
  })();
  return()=>{active=false;};
 },[refreshKey]);
 useEffect(()=>{if(restored&&stage!=='done'){try{localStorage.setItem(EVENT_DRAFT_KEY,JSON.stringify({...form,save_venue:saveVenue}));}catch{}}},[form,saveVenue,restored,stage]);
 function update(field,value){setForm(before=>({...before,[field]:value}));setError('');}
 function choose(place){
  const owned=venues.find(v=>v.id===place.venueId&&v.organization_id===orgId);
  setForm(before=>({...before,venue_id:owned?.id||'',venue_name:owned?.name||place.name||before.venue_name,
    address:owned?.address||place.address||'',latitude:owned?.latitude??place.latitude??'',longitude:owned?.longitude??place.longitude??''}));
  setSaveVenue(false);setError('');
 }
 function switchOrg(value){setOrgId(value);setSaveVenue(false);
  if(form.venue_id&&!venues.some(v=>v.id===form.venue_id&&v.organization_id===value))
   setForm(f=>({...f,venue_id:''}));
 }
 function preview(){
  const message=validateQuickEvent(form);
  if(message){setError(message);return;}
  try{
   cleanPrice(form.price_status,form.price_min,form.price_max);
   if(form.schedule_kind==='recurring')countOccurrences(form.date_from,form.date_to,form.recurrence_slots);
  }catch(e){setError(e.message);return;}
  setError('');setStage('preview');window.scrollTo({top:0,behavior:'smooth'});
 }
 function startAuth(){setStage('auth');window.scrollTo({top:0,behavior:'smooth'});}
 async function save(status='pending_review'){
  if(!account)return startAuth();
  const problem=validateQuickEvent(form);
  if(problem){setError(problem);setStage('edit');return;}
  try{cleanPrice(form.price_status,form.price_min,form.price_max);
   if(form.schedule_kind==='recurring')countOccurrences(form.date_from,form.date_to,form.recurrence_slots);
  }catch(e){setError(e.message);setStage('edit');return;}
  setBusy(true);setError('');
  try{
   let chosen=orgId;
   if(!chosen){
    const created=await call('createOrganization',{name:'Mani pasākumi',kind:'organizer'});
    chosen=created.item.id;setOrgId(chosen);setOrgs(o=>[created.item,...o]);
   }
   const fields={...form,organization_id:chosen,
    venue_id:venues.some(v=>v.id===form.venue_id&&v.organization_id===chosen)?form.venue_id:null,
    save_venue:saveVenue,schedule_kind:form.schedule_kind==='recurring'?'recurring':form.date_to&&form.date_to!==form.date_from?'ongoing':'once'};
   let id=savedId;
   if(imageFile){
    // The image is uploaded only to the owner's draft; afterward submission goes to moderation.
    const draft=await call('saveEvent',{...fields,...(id?{id}:{}),status:'draft'});
    id=draft.item.id;setSavedId(id);
    const payload=new FormData();payload.append('token',account.access_token);payload.append('submission_id',id);payload.append('file',imageFile);
    const response=await fetch('/api/event-image',{method:'POST',body:payload});
    const body=await response.json();if(!response.ok)throw Error(body.error||'Attēla augšupielāde neizdevās.');
   }
   const result=await call('saveEvent',{...fields,...(id?{id}:{}),status});
   setSubmitted(result.item);setStage('done');setSavedId('');
   try{localStorage.removeItem(EVENT_DRAFT_KEY);}catch{}
  }catch(e){setError(e.message);if(/sesija|Pieslēdzies/i.test(e.message))setStage('auth');}
  finally{setBusy(false);}
 }
 function restart(){setForm({...DEFAULT});setSubmitted(null);setSaveVenue(false);setImageFile(null);setImagePreview('');setSavedId('');setStage('edit');setError('');setNotice('');localStorage.removeItem(EVENT_DRAFT_KEY);}
 const venueChosen=Boolean(form.venue_id||form.address||isCoordinatePair(form));
 return <section className="meets-organizer-page quick-flow">
  <div className="meets-account-heading">
   <div><p className="eyebrow">MEETS · Pasākuma pievienošana</p><h1>{stage==='done'?'Pasākums saglabāts':stage==='preview'?'Pārbaudi pasākumu':stage==='auth'?'Vēl viens solis':'Jauns pasākums'}</h1>
    <p className="meets-muted">Aizpildi svarīgāko. Pasākumu kartē parādīsim tikai pēc pārbaudes.</p></div>
   <Link className="button" href="/registre-pasakumu">← Izvēlēties citu darbību</Link>
  </div>
  {stage!=='done'&&<div className="quick-flow-progress" aria-label="Reģistrācijas progress">
   <span className={stage==='edit'?'active':''}>1. Informācija</span><span className={stage==='preview'?'active':''}>2. Priekšskatījums</span><span className={stage==='auth'?'active':''}>3. Iesniegšana</span>
  </div>}
  {notice&&<p className="meets-organizer-success" role="status">{notice}</p>}
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}
  {stage==='edit'&&<form className="quick-flow-card" onSubmit={e=>{e.preventDefault();preview();}}>
   {orgs.length>1&&<label>Organizators<select value={orgId} onChange={e=>switchOrg(e.target.value)}>{orgs.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
   <label>Pasākuma nosaukums *<input required minLength={3} maxLength={200} autoComplete="off" value={form.title} placeholder="Piemēram, Ģimenes sporta diena" onChange={e=>update('title',e.target.value)}/></label>
   <label>Pasākuma norise<select value={form.schedule_kind||'once'} onChange={e=>update('schedule_kind',e.target.value)}>
     <option value="once">Vienreizējs pasākums</option>
     <option value="ongoing">Vairāku dienu nepārtraukts pasākums</option>
     <option value="recurring">Atkārtotas nodarbības / notikumi</option>
    </select></label>
   {form.schedule_kind==='recurring'?<>
     <div className="quick-flow-two"><label>Grafiks no *<input required type="date" min={rigaDate()} value={form.date_from} onChange={e=>update('date_from',e.target.value)}/></label>
     <label>Grafiks līdz *<input required type="date" min={form.date_from||rigaDate()} value={form.date_to} onChange={e=>update('date_to',e.target.value)}/></label></div>
     <WeeklySchedule slots={form.recurrence_slots||[]} onChange={v=>update('recurrence_slots',v)} dateFrom={form.date_from} dateTo={form.date_to}/>
   </>:<>
    <div className="quick-flow-two"><label>Datums *<input required type="date" min={rigaDate()} value={form.date_from} onChange={e=>update('date_from',e.target.value)}/></label>
     <label>Sākums<input type="time" value={form.time_from} onChange={e=>update('time_from',e.target.value)}/></label></div>
    <details className="quick-flow-details"><summary>Beigu laiks un datums</summary>
     <div className="quick-flow-two"><label>Beigu datums<input type="date" min={form.date_from||undefined} value={form.date_to} onChange={e=>update('date_to',e.target.value)}/></label>
      <label>Beigu laiks<input type="time" value={form.time_to} onChange={e=>update('time_to',e.target.value)}/></label></div>
     <p className="meets-muted">Izvēlies atkārtošanos, ja pasākums notiek atsevišķās dienās.</p>
    </details>
   </>}
   <h2>Kur notiks?</h2>
   <VenueLocationPicker value={{name:form.venue_name,venueId:form.venue_id,address:form.address,latitude:form.latitude,longitude:form.longitude}}
     existingVenues={venues.filter(v=>v.organization_id===orgId)} onSelect={choose}/>
   {venueChosen&&<>
    <label>Norises vietas nosaukums *<input required minLength={2} maxLength={200} value={form.venue_name} onChange={e=>update('venue_name',e.target.value)} placeholder="Parks, sporta centrs, skola…"/></label>
    <label>Adrese<input maxLength={300} value={form.address} onChange={e=>update('address',e.target.value)}/></label>
    {selectedVenue?<p className="quick-flow-note">✓ Izmantota tava saglabātā vieta “{selectedVenue.name}”.</p>:
     <label className="quick-flow-check"><input type="checkbox" checked={saveVenue} onChange={e=>setSaveVenue(e.target.checked)}/>
      Saglabāt šo vietu manā profilā nākamajiem pasākumiem</label>}
   </>}
   <label>Īss apraksts<textarea rows={3} maxLength={6000} value={form.description} placeholder="Kas notiks un kam pasākums paredzēts?" onChange={e=>update('description',e.target.value)}/></label>
   <div className="quick-flow-two">
    <label>Kategorija<select value={form.category} onChange={e=>update('category',e.target.value)}>{EVENT_CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Dalības maksa<select value={form.price_status} onChange={e=>update('price_status',e.target.value)}>
     <option value="free">Bezmaksas</option><option value="paid">Maksas</option><option value="mixed">Daļēji maksas</option><option value="unknown">Nav zināms</option></select></label>
   </div>
   {['paid','mixed'].includes(form.price_status)&&<div className="quick-flow-two">
    <label>Cena no, EUR *<input required type="number" min="0" step="0.01" value={form.price_min} onChange={e=>update('price_min',e.target.value)}/></label>
    <label>Cena līdz, EUR *<input required type="number" min="0" step="0.01" value={form.price_max} onChange={e=>update('price_max',e.target.value)}/></label>
   </div>}
   <label>Pasākuma attēls (JPG, PNG, WebP līdz 5 MB)
    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{
     const file=e.target.files?.[0];if(!file){setImageFile(null);setImagePreview('');return;}
     if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){
      setError('Atļauti tikai JPG, PNG, WebP attēli līdz 5 MB.');e.target.value='';return;
     }
     setImageFile(file);setImagePreview(URL.createObjectURL(file));setError('');
    }}/></label>
   {imagePreview&&<div><img src={imagePreview} alt="Pasākuma attēla priekšskatījums" className="quick-event-image"/>
    <button type="button" className="button" onClick={()=>{setImageFile(null);setImagePreview('');}}>Noņemt attēlu</button></div>}
   <p className="quick-flow-note">Attēls tiks augšupielādēts tikai pēc pieslēgšanās. Publiskā attēla saite būs pieejama cilvēkiem, kuriem tā ir zināma.</p>
   <div className="quick-flow-actions"><button className="button primary" type="submit">Priekšskatīt un turpināt →</button>
    <button type="button" className="button" onClick={()=>{localStorage.setItem(EVENT_DRAFT_KEY,JSON.stringify({...form,save_venue:saveVenue}));setNotice('Melnraksts saglabāts šajā ierīcē.');}}>Saglabāt melnrakstu</button>
    <button type="button" className="button" onClick={()=>{if(window.confirm('Notīrīt aizpildīto formu?')){setForm({...DEFAULT});setSaveVenue(false);localStorage.removeItem(EVENT_DRAFT_KEY);setNotice('Forma notīrīta.');}}}>Notīrīt</button></div>
   <p className="quick-flow-note">Melnraksts tiek saglabāts šīs pārlūkprogrammas atmiņā arī, ja vēl neesi pieslēdzies.</p>
  </form>}
  {stage==='preview'&&<div className="quick-flow-card quick-flow-preview">
   <p className="eyebrow">Tā redzēsi svarīgāko MEETS pasākumā</p>
   <h2>{form.title}</h2>
   <p><strong>📅 {prettyDate(form.date_from)}{form.date_to&&form.date_to!==form.date_from?' – '+prettyDate(form.date_to):''}</strong>
    {form.time_from?' · '+form.time_from:''}{form.time_to?'–'+form.time_to:''}</p>
   <p>⌖ {form.venue_name} · {form.address||'Vieta atzīmēta kartē'}</p>
   <p>{form.description||'Apraksts nav norādīts.'}</p>
   <div className="quick-flow-tags"><span>{form.category}</span><span>{({free:'Bezmaksas',paid:'Maksas',mixed:'Daļēji maksas',unknown:'Cena nav zināma'})[form.price_status]}
    {['paid','mixed'].includes(form.price_status)?' · '+form.price_min+'–'+form.price_max+' EUR':''}</span></div>
   {form.schedule_kind==='recurring'&&<p><strong>Norises reizes:</strong> {countOccurrences(form.date_from,form.date_to,form.recurrence_slots)} atsevišķi pasākumi kartē</p>}
   {imagePreview&&<img src={imagePreview} alt="" className="quick-event-image"/>
   {saveVenue&&<p className="quick-flow-note">✓ Vietu saglabāsim tavā profilā turpmākai izmantošanai.</p>}
   <p className="meets-muted">Pēc iesniegšanas ieraksts tiks pārbaudīts. Tas nekļūs publisks automātiski.</p>
   <div className="quick-flow-actions"><button className="button" type="button" onClick={()=>setStage('edit')}>← Labot informāciju</button>
    <button className="button primary" type="button" disabled={busy} onClick={()=>account?save('pending_review'):startAuth()}>{busy?'Saglabā…':'Iesniegt pārbaudei →'}</button>
    {account&&<button type="button" className="button" disabled={busy} onClick={()=>save('draft')}>Saglabāt kā privātu melnrakstu</button>}</div>
  </div>}
  {stage==='auth'&&<div className="quick-flow-card"><Authentication onSuccess={async value=>{try{await load(value);setStage('preview');setError('');}catch{setError('Pieslēgšanās veiksmīga, bet organizatora datus neizdevās ielādēt.');}}}/>
   <button className="button" type="button" onClick={()=>setStage('preview')}>← Atpakaļ pie priekšskatījuma</button></div>}
  {stage==='done'&&<div className="quick-flow-card"><div className="quick-flow-success">✓</div>
   <h2>{submitted?.status==='draft'?'Melnraksts saglabāts':'Pasākums nosūtīts pārbaudei!'}</h2>
   <p>{form.title}</p><p className="meets-muted">{submitted?.status==='draft'?'Melnrakstu varēsi turpināt organizatora kabinetā.':'Kartē tas parādīsies pēc administratora apstiprināšanas.'}</p>
   <div className="quick-flow-actions"><button type="button" className="button primary" onClick={restart}>+ Pievienot nākamo pasākumu</button>
    <Link className="button" href="/organizators">Mani iesniegumi →</Link></div></div>}
  <p className="quick-flow-bottom"><Link href="/organizators">Paplašinātā organizatora vide</Link> · <Link href="/registre-vietu">Pievienot pastāvīgu norises vietu</Link></p>
 </section>;
}
export default function SimpleEventPage(){return <Suspense fallback={<p role="status">Ielādē formu…</p>}><SimpleEventFlow/></Suspense>;}
