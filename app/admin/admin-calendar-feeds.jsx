'use client';

import {useEffect,useState} from 'react';
import {adminRpc} from '../../lib/admin-auth.js';

const DEFAULT_SKIP='domes sēde, komitejas sēde, komiteju sēde, ārkārtas sēde, pašvaldības darba kalendārs';
const EMPTY={id:null,url:'',label:'',municipality_id:'',default_category:'',active:true,feed_format:'',skip_types:DEFAULT_SKIP};

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
const skipList=text=>String(text||'').split(/[,;\n]/).map(s=>s.trim()).filter(Boolean);

// Calendar feeds: .ics links and municipality RSS feeds (TVP /lv/rss/events),
// read every night. New events wait for their place to be approved in Mapping;
// RSS events are linked to the weekly HTML import of the same municipality.
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

 function payload(f,overrides={}){
  return {p_id:f.id,p_url:f.url,p_label:f.label,p_municipality_id:f.municipality_id?Number(f.municipality_id):null,
   p_default_category:f.default_category||null,p_active:f.active,p_feed_format:f.feed_format||null,
   p_skip_types:skipList(f.skip_types),...overrides};
 }
 async function save(event){
  event.preventDefault();
  setBusy(true);setError('');setMessage('');
  try{
   const result=await adminRpc(supabaseUrl,publishableKey,'meets_admin_save_calendar_feed',payload(form));
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
 const formOf=feed=>({id:feed.id,url:feed.url,label:feed.label,municipality_id:feed.municipality_id?String(feed.municipality_id):'',
  default_category:feed.default_category||'',active:feed.active,feed_format:feed.feed_format_locked?feed.feed_format:'',
  skip_types:(feed.skip_types||[]).join(', ')});
 async function toggle(feed){
  setError('');
  try{await adminRpc(supabaseUrl,publishableKey,'meets_admin_save_calendar_feed',payload(formOf(feed),{p_active:!feed.active}));await load();}
  catch(e){setError(e.message||'Neizdevās saglabāt.');}
 }
 const set=(key,value)=>setForm(f=>({...f,[key]:value}));

 return <section className="admin-import-health admin-calendar-feeds" aria-labelledby="calendar-feeds-title">
  <div className="admin-overview-panel-head">
   <div><span>Datu avoti</span><h3 id="calendar-feeds-title">Kalendāru saites un RSS plūsmas</h3></div>
   <button type="button" className="button compact" onClick={load}>Atjaunot</button>
  </div>
  <p className="sync-text calendar-feeds-help">Rīkotāja vai pašvaldības kalendāra saite (.ics, <code>webcal://</code>) vai pašvaldības RSS plūsma (<code>https://www.…lv/lv/rss/events</code>). Tiek ielādēta katru nakti; RSS pasākumi tiek sasaistīti ar tās pašas pašvaldības iknedēļas HTML kalendāru, lai viens pasākums būtu viens ieraksts. Jaunie pasākumi gaida vietas apstiprinājumu sadaļā Mapping.</p>
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}
  {message&&<p className="meets-organizer-success" role="status">{message}</p>}
  <form className="calendar-feed-form" onSubmit={save}>
   <label>Saite<input type="url" required value={form.url} onChange={e=>set('url',e.target.value)} placeholder="https://…/calendar.ics vai …/lv/rss/events"/></label>
   <label>Avota nosaukums<input required minLength={2} maxLength={120} value={form.label} onChange={e=>set('label',e.target.value)} placeholder="Kultūras nams “…”"/></label>
   <label>Novads<select value={form.municipality_id} onChange={e=>set('municipality_id',e.target.value)}>
    <option value="">— noteikt pēc adreses —</option>
    {data.municipalities.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
   </select></label>
   <label>Formāts<select value={form.feed_format} onChange={e=>set('feed_format',e.target.value)}>
    <option value="">Noteikt pēc satura</option>
    <option value="ics">ICS (kalendārs)</option>
    <option value="rss">RSS (pašvaldības plūsma)</option>
   </select></label>
   <label>Kategorija, ja kalendārā nav<input value={form.default_category} onChange={e=>set('default_category',e.target.value)} placeholder="Koncerts, Sports…"/></label>
   <label>Neimportēt, ja veids vai nosaukums satur<input value={form.skip_types} onChange={e=>set('skip_types',e.target.value)} placeholder={DEFAULT_SKIP}/></label>
   <div className="calendar-feed-actions">
    <button type="submit" className="button primary" disabled={busy}>{busy?'Saglabā…':form.id?'Saglabāt izmaiņas':'Pievienot un ielādēt'}</button>
    {form.id&&<button type="button" className="button" onClick={()=>setForm(EMPTY)}>Atcelt</button>}
   </div>
  </form>
  <div className="import-health-list calendar-feed-list">
   {data.feeds.map(feed=>{
    const [tone,label]=statusBadge(feed);
    return <article key={feed.id}>
     <div><strong><span className={'feed-format feed-format-'+feed.feed_format}>{String(feed.feed_format||'ics').toUpperCase()}</span> {feed.label}</strong><span>{feed.url}</span></div>
     <span className={'quality-badge '+tone}>{label}</span>
     <small>{feed.municipality||'Novads pēc adreses'} · pēdējā ielāde: {when(feed.last_run_at)}
      {feed.last_status==='failed'&&feed.last_success_at&&<> · pēdējā veiksmīgā: {when(feed.last_success_at)}</>}</small>
     {feed.last_found!=null&&<small>Atrasti {feed.last_found}{feed.last_feed_items!=null&&feed.last_feed_items!==feed.last_found?` (plūsmā ${feed.last_feed_items})`:''}
      {feed.last_created!=null&&<> · jauni {feed.last_created}</>}{feed.last_updated!=null&&<> · atjaunoti {feed.last_updated}</>}
      {feed.last_skipped?<> · izlaisti {feed.last_skipped}</>:null} · aktuāli {feed.upcoming}, publicēti {feed.published}</small>}
     {feed.last_status==='failed'&&feed.last_error&&<small className="import-error">{feed.last_error}</small>}
     {feed.zero_runs>=3&&<small className="import-error">{feed.zero_runs} ielādes pēc kārtas bez neviena ieraksta.</small>}
     {feed.gap_detected_at&&Date.now()-Date.parse(feed.gap_detected_at)<864e5&&<small className="import-error">Starp ielādēm varēja pazust ieraksti — plūsma jāielādē biežāk.</small>}
     <small className="calendar-feed-row-actions">
      <button type="button" className="text-button" onClick={()=>run(feed)} disabled={!feed.active}>Ielādēt tagad</button>
      <button type="button" className="text-button" onClick={()=>setForm(formOf(feed))}>Labot</button>
      <button type="button" className="text-button" onClick={()=>toggle(feed)}>{feed.active?'Izslēgt':'Ieslēgt'}</button>
     </small>
    </article>;
   })}
   {!data.feeds.length&&<p className="admin-empty-inline">Vēl nav pievienota neviena saite.</p>}
  </div>
 </section>;
}
