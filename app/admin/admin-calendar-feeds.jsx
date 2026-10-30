'use client';

import {useEffect,useState} from 'react';
import {adminRpc} from '../../lib/admin-auth.js';

const EMPTY={id:null,url:'',label:'',municipality_id:'',default_category:'',active:true};

function when(value){
 if(!value)return 'Vēl nav ielādēts';
 try{return new Date(value).toLocaleString('lv-LV',{timeZone:'Europe/Riga'});}catch{return String(value);}
}
function statusBadge(feed){
 if(!feed.active)return ['warn','Izslēgta'];
 if(feed.last_status==='failed')return ['bad','Neizdevās'];
 if(feed.last_status==='success')return ['ok','Ielādēta'];
 return ['warn','Gaida ielādi'];
}

// Calendar feeds (.ics): any organizer or municipality calendar link becomes a
// daily import. New events wait for their place to be approved in Mapping.
export default function AdminCalendarFeeds({supabaseUrl,publishableKey}){
 const [data,setData]=useState({feeds:[],municipalities:[]});
 const [form,setForm]=useState(EMPTY);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');

 async function load(){
  try{setData(await adminRpc(supabaseUrl,publishableKey,'meets_admin_calendar_feeds',{})||{feeds:[],municipalities:[]});}
  catch(e){setError(e.message||'Kalendāru saites neizdevās ielādēt.');}
 }
 useEffect(()=>{load();},[]);

 async function save(event){
  event.preventDefault();
  setBusy(true);setError('');setMessage('');
  try{
   const result=await adminRpc(supabaseUrl,publishableKey,'meets_admin_save_calendar_feed',{
    p_id:form.id,p_url:form.url,p_label:form.label,p_municipality_id:form.municipality_id?Number(form.municipality_id):null,
    p_default_category:form.default_category||null,p_active:form.active});
   setMessage(result?.started?'Saglabāts. Pasākumi tiek ielādēti — pēc minūtes nospied “Atjaunot”.':'Izmaiņas saglabātas.');
   setForm(EMPTY);await load();
  }catch(e){setError(e.message||'Kalendāra saiti neizdevās saglabāt.');}
  finally{setBusy(false);}
 }
 async function run(feed){
  setError('');
  try{await adminRpc(supabaseUrl,publishableKey,'meets_admin_run_calendar_feed',{p_id:feed.id});
   setMessage(`“${feed.label}” tiek ielādēts — pēc minūtes nospied “Atjaunot”.`);}
  catch(e){setError(e.message||'Ielādi neizdevās sākt.');}
 }
 async function toggle(feed){
  setError('');
  try{await adminRpc(supabaseUrl,publishableKey,'meets_admin_save_calendar_feed',{p_id:feed.id,p_url:feed.url,p_label:feed.label,
    p_municipality_id:feed.municipality_id,p_default_category:feed.default_category,p_active:!feed.active});await load();}
  catch(e){setError(e.message||'Neizdevās saglabāt.');}
 }
 const set=(key,value)=>setForm(f=>({...f,[key]:value}));

 return <section className="admin-import-health admin-calendar-feeds" aria-labelledby="calendar-feeds-title">
  <div className="admin-overview-panel-head">
   <div><span>Datu avoti</span><h3 id="calendar-feeds-title">Kalendāru saites (.ics)</h3></div>
   <button type="button" className="button compact" onClick={load}>Atjaunot</button>
  </div>
  <p className="sync-text calendar-feeds-help">Organizatora vai pašvaldības kalendāra saite (Google Calendar, Outlook, WordPress “iCal”, <code>webcal://</code>). Tiek ielādēta katru dienu; jaunie pasākumi gaida vietas apstiprinājumu sadaļā Mapping.</p>
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}
  {message&&<p className="meets-organizer-success" role="status">{message}</p>}
  <form className="calendar-feed-form" onSubmit={save}>
   <label>Kalendāra saite<input type="url" required value={form.url} onChange={e=>set('url',e.target.value)} placeholder="https://…/calendar.ics"/></label>
   <label>Avota nosaukums<input required minLength={2} maxLength={120} value={form.label} onChange={e=>set('label',e.target.value)} placeholder="Kultūras nams “…”"/></label>
   <label>Novads<select value={form.municipality_id} onChange={e=>set('municipality_id',e.target.value)}>
    <option value="">— noteikt pēc adreses —</option>
    {data.municipalities.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
   </select></label>
   <label>Kategorija, ja kalendārā nav<input value={form.default_category} onChange={e=>set('default_category',e.target.value)} placeholder="Koncerts, Sports…"/></label>
   <div className="calendar-feed-actions">
    <button type="submit" className="button primary" disabled={busy}>{busy?'Saglabā…':form.id?'Saglabāt izmaiņas':'Pievienot un ielādēt'}</button>
    {form.id&&<button type="button" className="button" onClick={()=>setForm(EMPTY)}>Atcelt</button>}
   </div>
  </form>
  <div className="import-health-list calendar-feed-list">
   {data.feeds.map(feed=>{
    const [tone,label]=statusBadge(feed);
    return <article key={feed.id}>
     <div><strong>{feed.label}</strong><span>{feed.url}</span></div>
     <span className={'quality-badge '+tone}>{label}</span>
     <small>{feed.municipality||'Novads pēc adreses'} · pēdējā ielāde: {when(feed.last_run_at)}
      {feed.last_found!=null&&<> · kalendārā {feed.last_found}</>} · aktuāli {feed.upcoming}, publicēti {feed.published}</small>
     {feed.last_status==='failed'&&feed.last_error&&<small className="import-error">{feed.last_error}</small>}
     <small className="calendar-feed-row-actions">
      <button type="button" className="text-button" onClick={()=>run(feed)} disabled={!feed.active}>Ielādēt tagad</button>
      <button type="button" className="text-button" onClick={()=>setForm({id:feed.id,url:feed.url,label:feed.label,
       municipality_id:feed.municipality_id?String(feed.municipality_id):'',default_category:feed.default_category||'',active:feed.active})}>Labot</button>
      <button type="button" className="text-button" onClick={()=>toggle(feed)}>{feed.active?'Izslēgt':'Ieslēgt'}</button>
     </small>
    </article>;
   })}
   {!data.feeds.length&&<p className="admin-empty-inline">Vēl nav pievienota neviena kalendāra saite.</p>}
  </div>
 </section>;
}
