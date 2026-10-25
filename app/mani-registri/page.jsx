'use client';
import {Suspense,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import PersonalCollections from './personal-collections.jsx';
import {useSearchParams} from 'next/navigation';
import {useEvents} from '../../lib/use-events.js';
import ProfileShell from '../components/profile-shell.jsx';
import {HOME_GROUP_KEYS,HOME_CATEGORY_FILTERS} from '../../lib/home-category-filters.js';
import {cleanRegistryFilters,filterRegistryEvents} from '../../lib/registry-filters.js';

const KEY='meets_user_session_v1';
const DEFAULT={title:'',description:'',filters:{period:'month'},is_published:false,included_event_ids:[],excluded_event_ids:[],organization_id:null};
function sessionRead(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}}
function short(item){return (item.date_from||'Bez datuma')+' · '+item.title;}
async function refreshSession(account){
 const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh',token:account.refresh_token})});
 const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'Sesija beigusies.');
 const next={...b,expires_at:Date.now()+(b.expires_in||3600)*1000};localStorage.setItem(KEY,JSON.stringify(next));window.dispatchEvent(new Event('meets-user-changed'));return next;
}

function ListsInner(){
 const params=useSearchParams(),orgId=params.get('org')||'';
 const {data}=useEvents(),events=data?.events||[];
 const [session,setSession]=useState(null),[registries,setRegistries]=useState([]),[profile,setProfile]=useState(''),[editing,setEditing]=useState(null);
 const [organizations,setOrganizations]=useState([]),[activeOrg,setActiveOrg]=useState(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pickQuery,setPickQuery]=useState('');

 async function rpc(action,values={},account=session){
  const r=await fetch('/api/registries',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action,token:account?.access_token,...values})});
  const b=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(b.error||'Neizdevās saglabāt.');e.status=r.status;throw e;}return b;
 }
 async function organizer(account){
  const r=await fetch('/api/organizer',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action:'list',token:account?.access_token})});
  const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'Organizatorus neizdevās ielādēt.');return b;
 }
 async function refresh(account){
  const [result,orgData]=await Promise.all([rpc('list',{},account),orgId?organizer(account):Promise.resolve({organizations:[]})]);
  setRegistries(result.registries||[]);setProfile(result.profile?.display_name||'');setOrganizations(orgData.organizations||[]);
  setActiveOrg((orgData.organizations||[]).find(o=>o.id===orgId)||null);
  return result;
 }
 useEffect(()=>{let active=true;(async()=>{
  let account=sessionRead();if(!account?.access_token){if(active)setLoading(false);return;}
  try{
   let result;
   try{result=await refresh(account);}
   catch(e){if(e.status&&e.status!==401)throw e;account=await refreshSession(account);result=await refresh(account);}
   if(!active)return;setSession(account);
   const visible=(result.registries||[]).filter(x=>orgId?x.organization_id===orgId:!x.organization_id);
   const editId=params.get('edit'),edit=visible.find(x=>x.id===editId);
   if(edit)setEditing(edit);
   else if(params.get('new')==='1')setEditing({...DEFAULT,organization_id:orgId||null,filters:{period:'month'}});
  }catch(e){if(active)setError(e.message);}finally{if(active)setLoading(false);}
 })();return()=>{active=false;};},[]);

 const visible=useMemo(()=>registries.filter(x=>orgId?x.organization_id===orgId:!x.organization_id),[registries,orgId]);
 const draft=editing?{...DEFAULT,...editing,filters:cleanRegistryFilters(editing.filters),organization_id:editing.organization_id||orgId||null}:null;
 const preview=useMemo(()=>draft?filterRegistryEvents(events,draft.filters,draft.included_event_ids,draft.excluded_event_ids):[],[events,editing]);
 const municipalities=useMemo(()=>[...new Set(events.map(e=>e.municipality).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv')),[events]);
 const types=useMemo(()=>[...new Set(events.map(e=>e.event_type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv')),[events]);
 const found=useMemo(()=>pickQuery.length>1?events.filter(e=>String(e.title+' '+e.venue_name).toLocaleLowerCase('lv').includes(pickQuery.toLocaleLowerCase('lv'))).slice(0,12):[],[events,pickQuery]);
 const canEdit=!orgId||activeOrg?.role!=='viewer';

 function update(patch){setEditing(v=>({...v,...patch}));}
 function filter(field,value){setEditing(v=>({...v,filters:{...v.filters,[field]:value}}));}
 function changeManual(id,action){setEditing(v=>{const included=new Set(v.included_event_ids||[]),excluded=new Set(v.excluded_event_ids||[]);if(action==='include'){included.add(id);excluded.delete(id);}if(action==='exclude'){excluded.add(id);included.delete(id);}if(action==='restore'){excluded.delete(id);included.delete(id);}return {...v,included_event_ids:[...included],excluded_event_ids:[...excluded]};});}
 async function perform(action,values={},onSuccess){
  setBusy(true);setError('');setNotice('');
  try{const result=await rpc(action,values);await refresh(session);onSuccess?.(result);setNotice('Izmaiņas saglabātas.');}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function save(e){e.preventDefault();if(!editing||!canEdit)return;await perform('save',{...editing,organization_id:orgId||null},()=>{setEditing(null);setPickQuery('');});}
 function copyCode(item){
  const url=window.location.origin+'/iegult/'+item.id,html='<iframe src="'+url+'" title="'+item.title.replaceAll('"','&quot;')+'" width="100%" height="620" loading="lazy" style="border:0;border-radius:12px"></iframe>';
  navigator.clipboard.writeText(html).then(()=>setNotice('iframe kods nokopēts.')).catch(()=>setError('Kopēšana neizdevās.'));
 }

 const page=<section className="meets-account-page meets-registry-page">
  <div className="meets-account-heading"><div><p className="eyebrow">{orgId?'Organizēšana':'Mans MEETS'}</p><h1>{orgId?'Publiskie saraksti':'Mani saraksti'}</h1>
   <p className="meets-muted">{orgId?'Veido organizatora publiskas pasākumu izlases un iegulstamus kalendārus.':'Saglabā savas pasākumu izlases. Saraksts nemaina pasākuma īpašnieku.'}</p></div>
   <Link className="button" href={orgId?'/organizators?org='+orgId+'&panel=lists':'/profils'}>← Atpakaļ</Link></div>
  {loading?<p role="status">Ielādē sarakstus…</p>:!session?<div className="registry-panel"><h2>Nepieciešams MEETS konts</h2><p>Pieslēdzies, lai veidotu savus sarakstus.</p><Link className="button primary" href="/profils">Pieslēgties →</Link></div>:<>
   {!orgId&&<div className="registry-panel"><h2>Mans profils</h2><div className="registry-grid"><label>Profila vārds<input value={profile} maxLength={100} onChange={e=>setProfile(e.target.value)}/></label><label>E-pasts<input readOnly value={session.user?.email||''}/></label></div><div className="registry-actions"><button className="button" disabled={busy} onClick={()=>perform('profile',{display_name:profile})}>Saglabāt profilu</button></div></div>}
   {orgId&&activeOrg&&<div className="registry-context"><strong>{activeOrg.name}</strong><span>{activeOrg.role==='viewer'?'Skatīšanas režīms':'Organizācijas saraksti'}</span></div>}
   {!editing?<div className="registry-panel"><div className="meets-account-heading"><div><h2>{orgId?'Organizatora saraksti':'Mani saraksti'} ({visible.length})</h2><p className="registry-note">Katram sarakstam var kombinēt automātiskos filtrus un manuāli izvēlētus pasākumus.</p></div>
    {canEdit&&<button type="button" className="button primary" onClick={()=>setEditing({...DEFAULT,organization_id:orgId||null,filters:{period:'month'}})}>+ Jauns saraksts</button>}</div>
    {visible.map(item=><div className="registry-item" key={item.id}><strong>{item.title}</strong><small>{item.is_published?'Publisks · iegulšanai gatavs':'Privāts'} · {filterRegistryEvents(events,item.filters,item.included_event_ids,item.excluded_event_ids).length} pasākumi</small><p>{item.description}</p><div className="registry-actions">
     {canEdit&&<button className="button" onClick={()=>setEditing(item)}>Labot</button>}{item.is_published&&<><a className="button" href={'/iegult/'+item.id} target="_blank" rel="noopener noreferrer">Priekšskatīt ↗</a><button className="button" onClick={()=>copyCode(item)}>Kopēt iframe</button></>}{canEdit&&<button className="button" disabled={busy} onClick={()=>window.confirm('Dzēst sarakstu “'+item.title+'”?')&&perform('delete',{id:item.id})}>Dzēst</button>}</div></div>)}
    {!visible.length&&<p>Vēl nav saglabātu sarakstu.</p>}
   </div>:<form onSubmit={save} className="registry-panel">
    <div className="meets-account-heading"><h2>{editing.id?'Labot sarakstu':'Jauns saraksts'}</h2><button type="button" className="button" onClick={()=>{setEditing(null);setPickQuery('');}}>Atcelt</button></div>
    <div className="registry-grid"><label>Saraksta nosaukums<input required minLength={3} maxLength={120} value={editing.title} onChange={e=>update({title:e.target.value})}/></label><label>Statuss<select value={editing.is_published?'public':'private'} onChange={e=>update({is_published:e.target.value==='public'})}><option value="private">Privāts</option><option value="public">Publisks — iframe</option></select></label></div>
    <label>Apraksts<textarea maxLength={500} rows={2} value={editing.description||''} onChange={e=>update({description:e.target.value})}/></label>
    <h3>Automātiskā atlase</h3><div className="registry-grid">
     <label>Kategorija<select value={editing.filters.category||''} onChange={e=>filter('category',e.target.value)}><option value="">Visas kategorijas</option>{HOME_GROUP_KEYS.map(k=><option key={k} value={k}>{HOME_CATEGORY_FILTERS[k].title}</option>)}</select></label>
     <label>Datuma periods<select value={editing.filters.period||'all'} onChange={e=>filter('period',e.target.value)}>{[['all','Visi aktuālie'],['today','Šodien'],['tomorrow','Rīt'],['3days','3 dienas'],['week','Šonedēļ'],['month','Šomēnes'],['custom','Datumi no–līdz']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
     {editing.filters.period==='custom'&&<><label>No<input type="date" value={editing.filters.from||''} onChange={e=>filter('from',e.target.value)}/></label><label>Līdz<input type="date" value={editing.filters.to||''} onChange={e=>filter('to',e.target.value)}/></label></>}
     <label>Pašvaldība<select value={editing.filters.municipality||''} onChange={e=>filter('municipality',e.target.value)}><option value="">Visas pašvaldības</option>{municipalities.map(v=><option key={v}>{v}</option>)}</select></label>
     <label>Valsts<select value={editing.filters.country||''} onChange={e=>filter('country',e.target.value)}><option value="">Visas</option><option value="LV">Latvija</option><option value="EE">Igaunija</option><option value="LT">Lietuva</option></select></label>
     <label>Maksa<select value={editing.filters.price||''} onChange={e=>filter('price',e.target.value)}><option value="">Visi</option><option value="free">Bezmaksas</option><option value="paid">Maksas</option><option value="mixed">Daļēji maksas</option></select></label>
     <label>Pasākuma veids<select value={editing.filters.event_type||''} onChange={e=>filter('event_type',e.target.value)}><option value="">Visi veidi</option>{types.map(v=><option key={v}>{v}</option>)}</select></label>
     <label>Meklēt<input value={editing.filters.query||''} maxLength={120} onChange={e=>filter('query',e.target.value)} placeholder="Nosaukums vai vieta"/></label>
    </div>
    <details><summary>Filtrs pēc attāluma</summary><div className="registry-grid"><label>Platums<input type="number" step="any" value={editing.filters.latitude??''} onChange={e=>filter('latitude',e.target.value)}/></label><label>Garums<input type="number" step="any" value={editing.filters.longitude??''} onChange={e=>filter('longitude',e.target.value)}/></label><label>Rādiuss<select value={editing.filters.radius||0} onChange={e=>filter('radius',Number(e.target.value))}><option value={0}>Bez rādiusa</option>{[5,10,25,30,50].map(v=><option key={v}>{v}</option>)}</select></label></div></details>
    <h3>Priekšskatījums ({preview.length})</h3><p className="registry-note">Izņemšana no saraksta neizdzēš pašu pasākumu.</p>
    {preview.slice(0,30).map(item=><div className="registry-event-row" key={item.id}><span>{short(item)}</span><button type="button" className="button" onClick={()=>changeManual(item.id,'exclude')}>Izņemt</button></div>)}
    {editing.excluded_event_ids?.length>0&&<details><summary>Izņemtie ({editing.excluded_event_ids.length})</summary>{editing.excluded_event_ids.map(id=><div className="registry-event-row" key={id}><span>{events.find(e=>e.id===id)?.title||'Pasākums vairs nav katalogā'}</span><button className="button" type="button" onClick={()=>changeManual(id,'restore')}>Atjaunot</button></div>)}</details>}
    <h3>Manuāli pievienot</h3><input type="search" value={pickQuery} onChange={e=>setPickQuery(e.target.value)} placeholder="Meklēt MEETS pasākumu…"/>{found.map(item=><div className="registry-event-row" key={item.id}><span>{short(item)}</span><button className="button" type="button" onClick={()=>changeManual(item.id,'include')} disabled={(editing.included_event_ids||[]).includes(item.id)}>+ Pievienot</button></div>)}
    <div className="registry-actions"><button className="button primary" disabled={busy||!canEdit}>{busy?'Saglabā…':'Saglabāt sarakstu'}</button><button className="button" type="button" onClick={()=>setEditing(null)}>Atcelt</button></div>
   </form>}
  </>}
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}{notice&&<p className="meets-organizer-success" role="status">{notice}</p>}
 </section>;
 return session?<ProfileShell session={session} displayName={profile} activeOrganization={activeOrg} mode={orgId?'organizer':''}>{page}</ProfileShell>:page;
}
function RegistryRouter(){const params=useSearchParams();
 return params.get('org')||params.get('legacy')==='1'?<ListsInner/>:<PersonalCollections/>;
}
export default function MyRegistries(){return <Suspense fallback={<p role="status">Ielādē kolekcijas…</p>}><RegistryRouter/></Suspense>;}
