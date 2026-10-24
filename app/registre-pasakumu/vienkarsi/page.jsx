'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import VenueLocationPicker from '../../organizators/venue-location-picker.jsx';

const SESSION='meets_user_session_v1';
const BLANK={title:'',description:'',category:'Cits',date_from:'',date_to:'',time_from:'',time_to:'',venue_name:'',address:'',latitude:'',longitude:'',price_status:'free'};
const CATEGORIES=['Mūzika un dejas','Teātris un kino','Kultūra','Sports','Ģimenēm','Izstādes','Tirdziņi','Izglītība','Cits'];
function sessionRead(){try{return JSON.parse(localStorage.getItem(SESSION)||'null');}catch{return null;}}
export default function QuickEventPage(){
 const [account,setAccount]=useState(null),[ready,setReady]=useState(false),[organizations,setOrganizations]=useState([]),[organization,setOrganization]=useState(''),[form,setForm]=useState(BLANK);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 async function call(action,data={},session=account){
  const res=await fetch('/api/organizer',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action,token:session?.access_token,...data})});
  const payload=await res.json();if(!res.ok)throw Error(payload.error||'Darbība neizdevās.');
  return payload;
 }
 useEffect(()=>{
  let active=true;
  (async()=>{
   const current=sessionRead();
   if(!current?.access_token){if(active)setReady(true);return;}
   try{
    let session=current, result;
    try{result=await call('list',{},session);}
    catch{
     if(!session.refresh_token)throw Error('Sesija ir beigusies.');
     const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh',token:session.refresh_token})});
     if(!r.ok)throw Error('Sesija ir beigusies.');
     session=await r.json();localStorage.setItem(SESSION,JSON.stringify(session));
     result=await call('list',{},session);
    }
    if(active){setAccount(session);setOrganizations(result.organizations||[]);setOrganization(result.organizations?.[0]?.id||'');}
   }catch(e){if(active)setError(e.message);}
   finally{if(active)setReady(true);}
  })();
  return()=>{active=false;};
 },[]);
 async function submit(e){
  e.preventDefault();setError('');setSuccess('');
  if(!account){setError('Pieslēdzies MEETS kontā.');return;}
  const d=form.date_from,to=form.date_to;
  if(to&&to<d){setError('Beigu datums nevar būt pirms sākuma datuma.');return;}
  if(!form.venue_name.trim()||!form.address.trim()&&!(form.latitude!==''&&form.longitude!=='')){
   setError('Norādi norises vietu un adresi vai punktu kartē.');return;
  }
  setBusy(true);
  try{
   let id=organization;
   if(!id){
    const created=await call('createOrganization',{name:'Mans pasākumu profils',kind:'organizer'});
    id=created.item.id;setOrganization(id);setOrganizations([{...created.item},...organizations]);
   }
   await call('saveEvent',{...form,organization_id:id,schedule_kind:form.date_to&&form.date_to!==form.date_from?'ongoing':'once',status:'pending_review'});
   setSuccess('Pasākums ir iesniegts MEETS pārbaudei. Kartē tas parādīsies pēc apstiprināšanas.');
   setForm(BLANK);
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 return <section className="meets-organizer-page">
  <div className="meets-account-heading"><div><p className="eyebrow">MEETS · Vienkārša iesniegšana</p>
   <h1>Reģistrēt pasākumu</h1><p className="meets-muted">Aizpildi pamatinformāciju. Pasākums pēc pārbaudes būs pieejams MEETS kartē.</p></div>
   <Link className="button" href="/organizators">Paplašinātais redaktors ↗</Link></div>
  <style>{`
   .quick-event-form{max-width:880px;margin:24px auto;background:white;border:1px solid #e1e6f0;border-radius:20px;padding:28px;display:grid;gap:17px}
   .quick-event-form label{display:grid;gap:6px;font-size:14px;font-weight:700}
   .quick-event-form input,.quick-event-form textarea,.quick-event-form select{width:100%;min-width:0;padding:11px;border:1px solid #cad3df;border-radius:10px;font:inherit}
   .quick-event-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
   .quick-event-form h2{margin:10px 0 0;font-size:21px}
   .quick-event-form .quick-help{font-size:13px;color:#667085;margin:0}
   @media(max-width:600px){.quick-event-form{padding:16px}.quick-event-row{grid-template-columns:1fr}}
  `}</style>
  {!ready?<p role="status">Ielādē…</p>:!account?<div className="quick-event-form"><h2>Nepieciešams lietotāja konts</h2>
   <p className="meets-muted">Pieslēdzies vai izveido kontu, lai iesniegtu savu pasākumu un vēlāk varētu to labot.</p>
   <Link href="/mani-pasakumi" className="button primary">Pieslēgties vai reģistrēties →</Link></div>:
   <form onSubmit={submit} className="quick-event-form">
    {organizations.length>1&&<label>Organizators<select value={organization} onChange={e=>setOrganization(e.target.value)}>
     {organizations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
    <h2>1. Par pasākumu</h2>
    <label>Nosaukums *<input required maxLength={200} minLength={3} placeholder="Piemēram, Sporta diena Mārupē" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></label>
    <label>Apraksts<textarea rows={3} maxLength={6000} placeholder="Kas notiks un kam paredzēts?" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></label>
    <div className="quick-event-row"><label>Kategorija<select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
     {CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
     <label>Ieejas maksa<select value={form.price_status} onChange={e=>setForm(f=>({...f,price_status:e.target.value}))}>
      <option value="free">Bezmaksas</option><option value="paid">Maksas</option><option value="mixed">Ir bezmaksas un maksas iespējas</option></select></label></div>
    <h2>2. Kad notiek?</h2>
    <div className="quick-event-row"><label>Datums no *<input type="date" required value={form.date_from} onChange={e=>setForm(f=>({...f,date_from:e.target.value}))}/></label>
     <label>Datums līdz (ja vairākas dienas)<input type="date" min={form.date_from||undefined} value={form.date_to} onChange={e=>setForm(f=>({...f,date_to:e.target.value}))}/></label>
     <label>Sākuma laiks<input type="time" value={form.time_from} onChange={e=>setForm(f=>({...f,time_from:e.target.value}))}/></label>
     <label>Beigu laiks<input type="time" value={form.time_to} onChange={e=>setForm(f=>({...f,time_to:e.target.value}))}/></label></div>
    <h2>3. Kur notiek?</h2><p className="quick-help">Sameklē adresi vai manuāli atzīmē punktu kartē. Šos datus izmantos MEETS publiskā karte.</p>
    <VenueLocationPicker value={form} onSelect={place=>setForm(f=>({...f,venue_name:place.name||f.venue_name,address:place.address||f.address,latitude:place.latitude??'',longitude:place.longitude??''}))}/>
    <label>Norises vietas nosaukums *<input required maxLength={200} value={form.venue_name} onChange={e=>setForm(f=>({...f,venue_name:e.target.value}))} placeholder="Skola, stadions, laukums…"/></label>
    <label>Adrese<input maxLength={300} value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="Piemēram, Lielā iela 1, Mārupe"/></label>
    <p className="quick-help">Pasākums tiek iesniegts pārbaudei, nevis publicēts uzreiz. Atkārtotiem pasākumiem un norises vietu pārvaldībai izmanto paplašināto redaktoru.</p>
    <button type="submit" disabled={busy} className="button primary">{busy?'Saglabā…':'Iesniegt pasākumu pārbaudei →'}</button>
   </form>}
  {error&&<p role="alert" className="meets-inline-error">{error}</p>}
  {success&&<div className="meets-organizer-success" role="status"><p>{success}</p><Link href="/organizators" className="button">Mani iesniegtie pasākumi ↗</Link></div>}
 </section>;
}
