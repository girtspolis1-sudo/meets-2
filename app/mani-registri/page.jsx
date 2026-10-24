'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useEvents} from '../../lib/use-events.js';
import {HOME_GROUP_KEYS,HOME_CATEGORY_FILTERS} from '../../lib/home-category-filters.js';
import {cleanRegistryFilters,filterRegistryEvents} from '../../lib/registry-filters.js';
const KEY='meets_user_session_v1';
const DEFAULT={title:'',description:'',filters:{period:'month'},is_published:false,included_event_ids:[],excluded_event_ids:[]};
function sessionRead(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}}
function short(item){return item.date_from+' · '+item.title;}
export default function MyRegistries(){
 const {data}=useEvents(),events=data?.events||[];
 const [session,setSession]=useState(null),[registries,setRegistries]=useState([]),[profile,setProfile]=useState(''),[editing,setEditing]=useState(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pickQuery,setPickQuery]=useState('');
 async function rpc(action,values={},account=session){
  const result=await fetch('/api/registries',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action,token:account?.access_token,...values})});
  const body=await result.json();
  if(!result.ok)throw Error(body.error||'Neizdevās saglabāt.');
  return body;
 }
 async function refresh(account){
  const result=await rpc('list',{},account);
  setRegistries(result.registries||[]);setProfile(result.profile?.display_name||'');
 }
 useEffect(()=>{
  let active=true;
  (async()=>{
   let account=sessionRead();
   if(!account?.access_token){if(active)setLoading(false);return;}
   try{
    const result=await rpc('list',{},account);
    if(active){setRegistries(result.registries||[]);setProfile(result.profile?.display_name||'');setSession(account);}
   }catch{
    try{
     const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh',token:account.refresh_token})});
     if(!r.ok)throw Error('expired');
     account=await r.json();
     localStorage.setItem(KEY,JSON.stringify(account));
     const result=await rpc('list',{},account);
     if(active){setRegistries(result.registries||[]);setProfile(result.profile?.display_name||'');setSession(account);}
    }catch{if(active)setError('Sesija beigusies. Pieslēdzies atkārtoti.');}
   }finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[]);
 const draft=editing?{...DEFAULT,...editing,filters:cleanRegistryFilters(editing.filters)}:null;
 const preview=useMemo(()=>draft?filterRegistryEvents(events,draft.filters,draft.included_event_ids,draft.excluded_event_ids):[],[events,editing]);
 const municipalities=useMemo(()=>[...new Set(events.map(e=>e.municipality).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv')),[events]);
 const types=useMemo(()=>[...new Set(events.map(e=>e.event_type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv')),[events]);
 const found=useMemo(()=>pickQuery.length>1?events.filter(e=>String(e.title+' '+e.venue_name).toLocaleLowerCase('lv').includes(pickQuery.toLocaleLowerCase('lv'))).slice(0,12):[],[events,pickQuery]);
 function update(patch){setEditing(v=>({...v,...patch}));}
 function filter(field,value){setEditing(v=>({...v,filters:{...v.filters,[field]:value}}));}
 function changeManual(id,action){
  setEditing(v=>{
   const included=new Set(v.included_event_ids||[]),excluded=new Set(v.excluded_event_ids||[]);
   if(action==='include'){included.add(id);excluded.delete(id);}
   if(action==='exclude'){excluded.add(id);included.delete(id);}
   if(action==='restore'){excluded.delete(id);included.delete(id);}
   return {...v,included_event_ids:[...included],excluded_event_ids:[...excluded]};
  });
 }
 async function perform(action,values={},onSuccess){
  setBusy(true);setError('');setNotice('');
  try{
   const result=await rpc(action,values);
   await refresh(session);
   onSuccess?.(result);
   setNotice('Izmaiņas saglabātas.');
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 async function save(e){e.preventDefault();if(!editing)return;
  await perform('save',editing,()=>{setEditing(null);setPickQuery('');});
 }
 function copyCode(item){
  const url=window.location.origin+'/iegult/'+item.id;
  const html='<iframe src="'+url+'" title="'+item.title.replaceAll('"','&quot;')+'" width="100%" height="620" loading="lazy" style="border:0;border-radius:12px"></iframe>';
  navigator.clipboard.writeText(html).then(()=>setNotice('iframe kods nokopēts.')).catch(()=>setError('Kopēšana neizdevās. Atver publisko saiti.'));
 }
 return <section className="meets-account-page meets-registry-page">
  <div className="meets-account-heading"><div><p className="eyebrow">MEETS · Tavs profils</p><h1>Mani pasākumu reģistri</h1>
   <p className="meets-muted">Izveido savu pasākumu izlasi, saglabā filtrus un ievieto sarakstu savā mājaslapā.</p></div>
   <Link className="button" href="/mani-pasakumi">← Mani pasākumi</Link></div>
  <style>{`
   .meets-registry-page{max-width:1080px;margin:0 auto;padding:20px 16px 55px}
   .registry-panel{border:1px solid #e2e5ee;background:#fff;border-radius:17px;padding:22px;margin:16px 0}
   .registry-panel h2{font-size:21px;margin:0 0 12px}
   .registry-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
   .registry-panel label{display:grid;gap:5px;font-weight:650;font-size:13px;margin:0}
   .registry-panel input,.registry-panel select,.registry-panel textarea{width:100%;min-width:0;border:1px solid #cbd5e1;border-radius:9px;padding:11px;font:inherit;background:#fff}
   .registry-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px;align-items:center}
   .registry-actions button{cursor:pointer}
   .registry-item{border:1px solid #e2e8f0;border-radius:11px;padding:14px;margin:10px 0}
   .registry-item strong{display:block}
   .registry-item small{color:#64748b}
   .registry-event-row{display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #e5e7eb;padding:9px 0}
   .registry-event-row button{flex-shrink:0}
   .registry-panel .registry-note{font-size:13px;color:#64748b}
   @media(max-width:650px){.registry-grid{grid-template-columns:1fr}.registry-panel{padding:16px}}
  `}</style>
  {loading?<p role="status">Ielādē profilu…</p>:!session?<div className="registry-panel"><h2>Nepieciešams MEETS konts</h2>
   <p>Ar vienu MEETS kontu varēsi reģistrēt pasākumus un veidot savus reģistrus.</p>
   <Link className="button primary" href="/mani-pasakumi">Pieslēgties vai reģistrēties →</Link></div>:<>
   <div className="registry-panel"><h2>Mans profils</h2>
    <div className="registry-grid"><label>Profila nosaukums<input value={profile} maxLength={100} placeholder="Piemēram, Mārupe sporto" onChange={e=>setProfile(e.target.value)}/></label>
     <label>E-pasts<input readOnly value={session.user?.email||''}/></label></div>
    <div className="registry-actions"><button type="button" className="button" disabled={busy} onClick={()=>perform('profile',{display_name:profile})}>Saglabāt profilu</button>
     <Link className="button" href="/registre-pasakumu/vienkarsi">+ Vienkāršs pasākums</Link></div>
   </div>
   {!editing?<div className="registry-panel"><div className="meets-account-heading"><div><h2>Mani reģistri ({registries.length})</h2>
    <p className="registry-note">Katram reģistram savi filtri, individuāli pasākumi un publiskais iframe.</p></div>
    <button type="button" className="button primary" disabled={registries.length>=50} onClick={()=>setEditing({...DEFAULT,filters:{period:'month'}})}>+ Jauns reģistrs</button></div>
    {registries.map(item=><div className="registry-item" key={item.id}><strong>{item.title}</strong><small>{item.is_published?'Publisks · iegulšanai gatavs':'Privāts · saite neaktīva'}</small>
     <p>{item.description}</p><div className="registry-actions">
      <button type="button" className="button" onClick={()=>setEditing(item)}>Labot filtrus un pasākumus</button>
      {item.is_published&&<><a className="button" href={'/iegult/'+item.id} target="_blank" rel="noopener noreferrer">Atvērt reģistru ↗</a>
       <button type="button" className="button" onClick={()=>copyCode(item)}>Kopēt iframe</button></>}
      <button type="button" className="button" disabled={busy} onClick={()=>{
       if(window.confirm('Dzēst reģistru “'+item.title+'”?'))perform('delete',{id:item.id});
      }}>Dzēst</button></div></div>)}
    {!registries.length&&<p>Vēl nav saglabātu reģistru. Izveido pirmo, lai varētu to ievietot savā mājaslapā.</p>}
   </div>:<form onSubmit={save} className="registry-panel">
    <div className="meets-account-heading"><h2>{editing.id?'Labot reģistru':'Jauns reģistrs'}</h2><button type="button" className="button" onClick={()=>{setEditing(null);setPickQuery('');}}>Atcelt</button></div>
    <div className="registry-grid"><label>Reģistra nosaukums<input required minLength={3} maxLength={120} value={editing.title} onChange={e=>update({title:e.target.value})}/></label>
     <label>Statuss<select value={editing.is_published?'public':'private'} onChange={e=>update({is_published:e.target.value==='public'})}>
      <option value="private">Privāts</option><option value="public">Publisks — iframe</option></select></label></div>
    <label>Apraksts<textarea maxLength={500} rows={2} value={editing.description||''} onChange={e=>update({description:e.target.value})}/></label>
    <h3>Automātiskā atlase pēc filtriem</h3>
    <div className="registry-grid">
     <label>Kategorija<select value={editing.filters.category||''} onChange={e=>filter('category',e.target.value)}><option value="">Visas kategorijas</option>
      {HOME_GROUP_KEYS.map(key=><option key={key} value={key}>{HOME_CATEGORY_FILTERS[key].title}</option>)}</select></label>
     <label>Datuma periods<select value={editing.filters.period||'all'} onChange={e=>filter('period',e.target.value)}>
      {[['all','Visi aktuālie'],['today','Šodien'],['tomorrow','Rīt'],['3days','3 dienas'],['week','Šonedēļ'],['month','Šomēnes'],['custom','Datumi no–līdz']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
     {editing.filters.period==='custom'&&<><label>No<input type="date" value={editing.filters.from||''} onChange={e=>filter('from',e.target.value)}/></label>
      <label>Līdz<input type="date" value={editing.filters.to||''} onChange={e=>filter('to',e.target.value)}/></label></>}
     <label>Pašvaldība<select value={editing.filters.municipality||''} onChange={e=>filter('municipality',e.target.value)}><option value="">Visas pašvaldības</option>
      {municipalities.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
     <label>Valsts<select value={editing.filters.country||''} onChange={e=>filter('country',e.target.value)}><option value="">Visas</option><option value="LV">Latvija</option><option value="EE">Igaunija</option><option value="LT">Lietuva</option></select></label>
     <label>Maksa<select value={editing.filters.price||''} onChange={e=>filter('price',e.target.value)}><option value="">Visi</option><option value="free">Bezmaksas</option><option value="paid">Maksas</option><option value="mixed">Daļēji maksas</option></select></label>
     <label>Pasākuma veids<select value={editing.filters.event_type||''} onChange={e=>filter('event_type',e.target.value)}><option value="">Visi veidi</option>{types.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
     <label>Meklēt nosaukumā vai vietā<input value={editing.filters.query||''} maxLength={120} onChange={e=>filter('query',e.target.value)} placeholder="Piemēram, futbols"/></label>
    </div>
    <details style={{marginTop:14}}><summary>⌖ Filtrs pēc attāluma no punkta kartē</summary>
     <p className="registry-note">Ievadītās koordinātas būs daļa no publiskā filtra. Neizmanto mājas adresi, ja nevēlies to atklāt.</p>
     <div className="registry-grid"><label>Platums<input type="number" step="any" value={editing.filters.latitude??''} onChange={e=>filter('latitude',e.target.value)}/></label>
      <label>Garums<input type="number" step="any" value={editing.filters.longitude??''} onChange={e=>filter('longitude',e.target.value)}/></label>
      <label>Rādiuss<select value={editing.filters.radius||0} onChange={e=>filter('radius',Number(e.target.value))}><option value={0}>Bez rādiusa</option>{[5,10,25,30,50].map(v=><option key={v} value={v}>{v} km</option>)}</select></label></div>
    </details>
    <h3>Pasākumi reģistrā ({preview.length})</h3>
    <p className="registry-note">Izņemtais pasākums netiks parādīts pat tad, ja atbilst filtriem. Pievienotais būs redzams neatkarīgi no filtriem, ja tas ir publicēts MEETS.</p>
    {preview.slice(0,30).map(item=><div className="registry-event-row" key={item.id}><span>{short(item)}</span>
     <button type="button" className="button" onClick={()=>changeManual(item.id,'exclude')}>Izņemt</button></div>)}
    {preview.length>30&&<p className="registry-note">Priekšskatījumā parādīti pirmie 30 pasākumi.</p>}
    {editing.excluded_event_ids?.length>0&&<details><summary>Izņemtie pasākumi ({editing.excluded_event_ids.length})</summary>
     {editing.excluded_event_ids.map(id=><div className="registry-event-row" key={id}><span>{events.find(e=>e.id===id)?.title||'Pasākums vairs nav katalogā'}</span>
      <button type="button" className="button" onClick={()=>changeManual(id,'restore')}>Atjaunot</button></div>)}</details>}
    <h3>Manuāli pievienot pasākumu</h3><input type="search" placeholder="Meklēt MEETS pasākumu pēc nosaukuma…" value={pickQuery} onChange={e=>setPickQuery(e.target.value)}/>
    {found.map(item=><div className="registry-event-row" key={item.id}><span>{short(item)}</span>
     <button type="button" className="button" onClick={()=>changeManual(item.id,'include')} disabled={(editing.included_event_ids||[]).includes(item.id)}>+ Pievienot</button></div>)}
    <div className="registry-actions"><button className="button primary" disabled={busy} type="submit">{busy?'Saglabā…':'Saglabāt reģistru'}</button>
     <button className="button" type="button" onClick={()=>setEditing(null)}>Atcelt</button></div>
   </form>}
  </>}
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}
  {notice&&<p className="meets-organizer-success" role="status">{notice}</p>}
 </section>;
}
