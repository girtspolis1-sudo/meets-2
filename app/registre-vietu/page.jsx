'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import VenueLocationPicker from '../organizators/venue-location-picker.jsx';
import Authentication from '../components/account-auth-flow.jsx';
import {QUICK_VENUE_EMPTY,VENUE_DRAFT_KEY,validateQuickVenue,isCoordinatePair} from '../../lib/event-entry.js';
const SESSION='meets_user_session_v1';
function readSession(){try{return JSON.parse(localStorage.getItem(SESSION)||'null');}catch{return null;}}
export default function VenueRegistration(){
 const [form,setForm]=useState({...QUICK_VENUE_EMPTY}),[loaded,setLoaded]=useState(false),[account,setAccount]=useState(null),[organizations,setOrganizations]=useState([]),[orgId,setOrgId]=useState(''),[myVenues,setMyVenues]=useState([]),[step,setStep]=useState('edit'),[existingId,setExistingId]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[saved,setSaved]=useState(null);
 async function request(action,data={},token=account?.access_token){
  const response=await fetch('/api/organizer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token,...data}),cache:'no-store'});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Neizdevās saglabāt.');return result;
 }
 async function onLogin(session){
  const result=await request('list',{},session.access_token);setAccount(session);setOrganizations(result.organizations||[]);setOrgId(result.organizations?.[0]?.id||'');setMyVenues(result.venues||[]);setStep('preview');setError('');
 }
 useEffect(()=>{
  let active=true;
  try{const d=JSON.parse(localStorage.getItem(VENUE_DRAFT_KEY)||'null');if(d&&typeof d==='object'&&!Array.isArray(d))setForm({...QUICK_VENUE_EMPTY,...Object.fromEntries(Object.keys(QUICK_VENUE_EMPTY).map(k=>[k,d[k]??QUICK_VENUE_EMPTY[k]]))});}catch{}
  setLoaded(true);
  (async()=>{
   let session=readSession();if(!session?.access_token)return;
   try{
    let result;
    try{result=await request('list',{},session.access_token);}
    catch{
     if(!session.refresh_token)throw Error('Sesija beigusies.');
     const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh',token:session.refresh_token})});
     if(!r.ok)throw Error('Sesija beigusies.');
     session=await r.json();localStorage.setItem(SESSION,JSON.stringify(session));result=await request('list',{},session.access_token);
    }
    if(active){setAccount(session);setOrganizations(result.organizations||[]);setOrgId(result.organizations?.[0]?.id||'');setMyVenues(result.venues||[]);}
   }catch{/* Registration remains available, authentication can be requested later. */}
  })();
  return()=>{active=false;};
 },[]);
 useEffect(()=>{if(loaded&&step!=='done')try{localStorage.setItem(VENUE_DRAFT_KEY,JSON.stringify(form));}catch{}},[form,loaded,step]);
 function update(k,v){setForm(x=>({...x,[k]:v}));setError('');}
 function choose(place){
  const owned=myVenues.find(v=>v.id===place.venueId&&v.organization_id===orgId);
  setForm(f=>({...f,name:owned?.name||place.name||f.name,address:owned?.address||place.address||'',latitude:owned?.latitude??place.latitude??'',longitude:owned?.longitude??place.longitude??''}));
  setExistingId(owned?.id||'');setError('');
 }
 function continueToPreview(event){event.preventDefault();if(existingId){setSaved({id:existingId,name:form.name});setStep('done');return;}
  const issue=validateQuickVenue(form);if(issue){setError(issue);return;}setStep('preview');setError('');window.scrollTo({top:0,behavior:'smooth'});
 }
 async function persist(){
  if(!account){setStep('auth');return;}
  const issue=validateQuickVenue(form);if(issue){setError(issue);setStep('edit');return;}
  setBusy(true);setError('');
  try{
   let id=orgId;
   if(!id){const created=await request('createOrganization',{name:form.name,kind:'venue'});id=created.item.id;setOrgId(id);setOrganizations(o=>[created.item,...o]);}
   const item=await request('createVenue',{...form,organization_id:id});
   setSaved(item.item);setStep('done');localStorage.removeItem(VENUE_DRAFT_KEY);
  }catch(e){
   if(/sesija|Pieslēdzies/i.test(e.message))setStep('auth');
   setError(e.message);
  }finally{setBusy(false);}
 }
 const hasLocation=Boolean(form.address||isCoordinatePair(form));
 return <section className="meets-organizer-page quick-flow">
  <div className="meets-account-heading"><div><p className="eyebrow">MEETS · Pastāvīga vieta</p><h1>{step==='done'?'Norises vieta saglabāta':'Pievienot norises vietu'}</h1><p className="meets-muted">Reģistrē vietu vienreiz un izmanto tās adresi nākamajiem pasākumiem.</p></div>
   <Link href="/registre-pasakumu" className="button">← Atpakaļ</Link></div>
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}{message&&<p className="meets-organizer-success" role="status">{message}</p>}
  {step==='edit'&&<form className="quick-flow-card" onSubmit={continueToPreview}>
   {organizations.length>1&&<label>Vietas pārvaldītājs<select value={orgId} onChange={e=>{setOrgId(e.target.value);setExistingId('');}}>
    {organizations.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></label>}
   <VenueLocationPicker value={form} existingVenues={myVenues.filter(v=>v.organization_id===orgId)} onSelect={choose}/>
   {hasLocation&&<>
    <label>Vietas nosaukums *<input required minLength={2} maxLength={160} value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Piemēram, Mārupes sporta zāle"/></label>
    <label>Adrese<input maxLength={300} value={form.address} onChange={e=>update('address',e.target.value)}/></label>
    {existingId&&<p className="quick-flow-note">✓ Šī vieta jau ir tavā reģistrā. Vari uzreiz izmantot to pasākumam.</p>}
    <label className="quick-flow-check"><input type="checkbox" checked={form.is_public===true} onChange={e=>update('is_public',e.target.checked)}/>
     Publiskot norises vietas profilu un tās pasākumu kalendāru</label>
    <details className="quick-flow-details"><summary>Papildu informācija (nav obligāta)</summary>
     <label>Kā nokļūt<textarea rows={2} maxLength={2000} value={form.directions} onChange={e=>update('directions',e.target.value)} placeholder="Ieeja, stāvvieta, sabiedriskais transports…"/></label>
     <label>Vietas apraksts<textarea rows={3} maxLength={4000} value={form.description} onChange={e=>update('description',e.target.value)}/></label></details>
   </>}
   <p className="quick-flow-note">Vietas saglabāšana pati par sevi nepublicē pasākumu kartē. Tas jāizveido atsevišķi.</p>
   <div className="quick-flow-actions"><button className="button primary" type="submit">Turpināt →</button>
    <button className="button" type="button" onClick={()=>{localStorage.setItem(VENUE_DRAFT_KEY,JSON.stringify(form));setMessage('Vietas melnraksts saglabāts šajā ierīcē.');}}>Saglabāt melnrakstu</button></div>
  </form>}
  {step==='preview'&&<div className="quick-flow-card"><p className="eyebrow">Pārbaudi vietu</p><h2>{form.name}</h2>
   <p>⌖ {form.address||'Precīza vieta norādīta kartē'}</p>
   {isCoordinatePair(form)&&<p className="quick-flow-note">Punkts: {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}</p>}
   {form.description&&<p>{form.description}</p>}
   <p className="quick-flow-note">{form.is_public?'Publiska vieta: kalendārs būs redzams pēc saglabāšanas.':'Privāta vieta: publiska kalendāra nebūs.'}</p>
   <div className="quick-flow-actions"><button className="button" onClick={()=>setStep('edit')}>← Labot</button>
    <button className="button primary" disabled={busy} onClick={persist}>{busy?'Saglabā…':'Saglabāt vietu →'}</button></div></div>}
  {step==='auth'&&<div className="quick-flow-card"><Authentication onSuccess={onLogin}/>
   <button className="button" type="button" onClick={()=>setStep('preview')}>← Atpakaļ</button></div>}
  {step==='done'&&<div className="quick-flow-card"><div className="quick-flow-success">✓</div><h2>{saved?.name||form.name}</h2>
   <p>Vieta pievienota tavām pastāvīgajām norises vietām.</p>
   {form.is_public===true&&saved?.id&&<p><Link href={'/vietas/'+saved.id}>Skatīt publisko profilu un iframe kalendāru ↗</Link></p>}
   <div className="quick-flow-actions"><Link className="button primary" href={'/registre-pasakumu/vienkarsi?venue='+saved?.id+'&org='+orgId}>+ Pasākums šajā vietā →</Link>
    <Link className="button" href="/organizators">Manas vietas →</Link></div></div>}
 </section>;
}
