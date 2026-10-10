'use client';

import {useEffect,useMemo,useState} from 'react';

const STATUS_LABELS={
 published:'Publicēts',pending_review:'Jāpublicē',draft:'Melnraksts',
 rejected:'Jālabo',cancelled:'Atcelts',archived:'Arhivēts',closed:'Slēgts'
};
const STATUS_TONES={published:'published',pending_review:'pending',draft:'draft',rejected:'problem',cancelled:'muted',archived:'muted',closed:'muted'};
const PAGE_SIZES=[25,50,100];

const lower=value=>String(value??'').toLocaleLowerCase('lv');
const dateEnd=event=>String(event.date_to||event.date_from||'');
const formatDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value).slice(8,10)+'.'+String(value).slice(5,7)+'.'+String(value).slice(0,4):'—';
const matches=(value,query)=>lower(value).includes(lower(query).trim());
const hasCoordinates=event=>event.latitude!=null&&event.longitude!=null&&Number.isFinite(Number(event.latitude))&&Number.isFinite(Number(event.longitude));

function locationProblem(event){
 if(event.attendance_mode==='online')return '';
 if(!String(event.venue_name||event.address_raw||'').trim())return 'Nav norises vietas / adreses';
 if(!hasCoordinates(event))return 'Nav precīza kartes punkta';
 switch(event.location_quality){
  case 'verified_exact':return '';
  case 'fallback_center':return 'Norādīts tikai pašvaldības centrs';
  case 'settlement_center':return 'Norādīts tikai apdzīvotas vietas centrs';
  case 'venue_area':return 'Aptuvena norises vieta';
  case 'venue_unverified':return 'Kartes punkts nav verificēts';
  case 'source_exact':return 'Jāpārbauda avota adrese';
  case 'missing_point':return 'Nav precīza kartes punkta';
  default:return 'Jāpārbauda adrese / koordinātas';
 }
}
function typeOf(event){
 return String(event.primary_category||event.event_type||event.competition_name||event.record_type||'Nav norādīts').trim();
}
function linkedSources(event){
 return Array.isArray(event.sources)?event.sources.filter(s=>s?.source):[];
}
function disabledBySources(event,sourceIndex){
 const sources=linkedSources(event);
 return sources.length>0&&sources.every(s=>sourceIndex.has(lower(s.source))&&sourceIndex.get(lower(s.source))===false);
}
function eventRow(event,today,sourceIndex){
 const expired=!!dateEnd(event)&&dateEnd(event)<today;
 const wrongLocation=locationProblem(event);
 const disabled=disabledBySources(event,sourceIndex);
 let reason='',reasonCode='ready',reasonTone='ok';
 if(event.status==='cancelled'){reason='Pasākums atcelts';reasonCode='cancelled';reasonTone='bad';}
 else if(event.status==='archived'){reason='Arhivēts';reasonCode='ended';reasonTone='muted';}
 else if(expired){reason='Norises datums jau beidzies';reasonCode='ended';reasonTone='muted';}
 else if(disabled){reason='Avots izslēgts kartē';reasonCode='source';reasonTone='bad';}
 else if(wrongLocation){reason=wrongLocation;reasonCode='location';reasonTone='bad';}
 else if(event.status==='draft'){reason='Melnraksts nav iesniegts';reasonCode='draft';reasonTone='warn';}
 else if(event.status==='pending_review'){reason='Gaida administratora apstiprinājumu';reasonCode='waiting';reasonTone='warn';}
 else if(event.status==='published'){reason='Publicēts kartē';reasonCode='ready';reasonTone='ok';}
 else{reason='Nav publicēts';reasonCode='waiting';reasonTone='warn';}
 return {
  id:String(event.id),kind:'catalog',raw:event,title:String(event.title||''),date_from:String(event.date_from||''),
  date_to:String(event.date_to||''),type:typeOf(event),source:linkedSources(event).map(s=>s.source).join(', ')||'—',
  status:String(event.status||''),location:String(event.venue_name||event.address_raw||'—'),
  address:String(event.address_raw||''),municipality:String(event.municipality||event.settlement||''),
  reason,reasonCode,reasonTone,expired
 };
}
function submissionRow(item,today){
 const expired=!!dateEnd(item)&&dateEnd(item)<today;
 const wrongLocation=!String(item.address||item.venue_name||'').trim()?'Nav norises vietas / adreses':
  !hasCoordinates(item)?'Nepieciešama precīzas vietas pārbaude':'';
 let reason='',reasonCode='waiting',reasonTone='warn';
 if(item.status==='rejected'){reason=item.admin_note?'Atgriezts: '+String(item.admin_note):'Atgriezts labošanai';reasonCode='rejected';reasonTone='bad';}
 else if(expired){reason='Norises datums jau beidzies';reasonCode='ended';reasonTone='muted';}
 else if(wrongLocation){reason=wrongLocation;reasonCode='location';reasonTone='bad';}
 else{reason='Gaida administratora apstiprinājumu';}
 return {
  id:'submission:'+item.id,kind:'submission',raw:item,title:String(item.title||''),
  date_from:String(item.date_from||''),date_to:String(item.date_to||''),
  type:String(item.category||'Nav norādīts'),source:'Lietotāja iesniegums',
  status:String(item.status||''),location:String(item.venue_name||item.address||'—'),
  address:String(item.address||''),municipality:String(item.organization_name||''),
  reason,reasonCode,reasonTone,expired
 };
}
const SORTERS={
 date:(a,b)=>a.date_from.localeCompare(b.date_from),
 title:(a,b)=>a.title.localeCompare(b.title,'lv'),
 type:(a,b)=>a.type.localeCompare(b.type,'lv'),
 status:(a,b)=>a.status.localeCompare(b.status,'lv'),
 reason:(a,b)=>a.reason.localeCompare(b.reason,'lv'),
 source:(a,b)=>a.source.localeCompare(b.source,'lv')
};

export default function AdminEventRegister({events=[],submissions=[],sources=[],today,onEditEvent,onOpenSubmission,onSaveSubmission,onPublish,onRefresh,busy=false}){
 const [name,setName]=useState(''),[kindFilter,setKindFilter]=useState(''),[statusFilter,setStatusFilter]=useState(''),
  [reasonFilter,setReasonFilter]=useState(''),[sourceFilter,setSourceFilter]=useState(''),[locationQuery,setLocationQuery]=useState(''),
  [period,setPeriod]=useState('current'),[sort,setSort]=useState('date'),[direction,setDirection]=useState('asc'),
  [page,setPage]=useState(1),[pageSize,setPageSize]=useState(50);
 const [editingSubmission,setEditingSubmission]=useState(null);
 const [savingSubmission,setSavingSubmission]=useState(false);
 const [editError,setEditError]=useState('');
 const rows=useMemo(()=>{
  const sourceIndex=new Map(sources.map(s=>[lower(s.domain),s.map_visible!==false]));
  const catalog=events.map(event=>eventRow(event,today,sourceIndex));
  const existing=new Set(catalog.map(row=>row.id));
  const incoming=submissions.filter(s=>s.status!=='published'||!s.event_id||!existing.has(String(s.event_id)))
   .map(item=>submissionRow(item,today));
  return [...catalog,...incoming];
 },[events,submissions,sources,today]);
 const types=useMemo(()=>[...new Set(rows.map(r=>r.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv')),[rows]);
 const sourceOptions=useMemo(()=>[...new Set(rows.flatMap(r=>r.kind==='catalog'?linkedSources(r.raw).map(s=>s.source):['Lietotāja iesniegums']))].sort((a,b)=>a.localeCompare(b,'lv')),[rows]);
 const filtered=useMemo(()=>{
  const result=rows.filter(row=>{
   if(period==='current'&&row.expired)return false;
   if(name&&!matches(row.title,name))return false;
   if(kindFilter&&row.type!==kindFilter)return false;
   if(sourceFilter&&!(row.kind==='submission'?sourceFilter==='Lietotāja iesniegums':linkedSources(row.raw).some(s=>s.source===sourceFilter)))return false;
   if(locationQuery&&![row.location,row.address,row.municipality].some(v=>matches(v,locationQuery)))return false;
   if(reasonFilter&&row.reasonCode!==reasonFilter)return false;
   if(statusFilter==='not_published'&&row.status==='published')return false;
   if(statusFilter==='published'&&row.status!=='published')return false;
   if(statusFilter==='requires_action'&&!['location','rejected','waiting','draft','source'].includes(row.reasonCode))return false;
   if(statusFilter&&!['not_published','published','requires_action'].includes(statusFilter)&&row.status!==statusFilter)return false;
   return true;
  });
  result.sort((a,b)=>(SORTERS[sort]||SORTERS.date)(a,b)*(direction==='asc'?1:-1)||a.id.localeCompare(b.id));
  return result;
 },[rows,period,name,kindFilter,sourceFilter,locationQuery,reasonFilter,statusFilter,sort,direction]);
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
 const shownPage=Math.min(page,pages);
 const shown=filtered.slice((shownPage-1)*pageSize,shownPage*pageSize);
 const totals=useMemo(()=>({
  published:rows.filter(r=>r.status==='published'&&!r.expired).length,
  unpublished:rows.filter(r=>r.status!=='published'&&!r.expired).length,
  problems:rows.filter(r=>r.reasonCode==='location'&&!r.expired).length
 }),[rows]);
 useEffect(()=>{setPage(1);},[name,kindFilter,sourceFilter,locationQuery,reasonFilter,statusFilter,period,pageSize]);
 function changeSort(key){if(sort===key)setDirection(d=>d==='asc'?'desc':'asc');else{setSort(key);setDirection('asc');}}
 const sortButton=(key,label)=><button type="button" className="admin-register-sort" onClick={()=>changeSort(key)} aria-label={'Kārtot pēc '+label} aria-sort={sort===key?direction==='asc'?'ascending':'descending':undefined}>{label}<span aria-hidden="true">{sort===key?(direction==='asc'?'↑':'↓'):'↕'}</span></button>;
 function reset(){setName('');setKindFilter('');setStatusFilter('');setReasonFilter('');setSourceFilter('');setLocationQuery('');setPeriod('current');setSort('date');setDirection('asc');}
 return <section className="admin-register">
  <div className="admin-register-heading">
   <div><p className="eyebrow">Admin · Ierakstu reģistrs</p><h2>Visi pasākumi vienā tabulā</h2><p>Kolonnu filtri, publicēšanas statuss un precīzs iemesls.</p></div>
   <button type="button" className="button compact" onClick={onRefresh} disabled={busy}>{busy?'Ielādē…':'↻ Pārlasīt'}</button>
  </div>
  <div className="admin-register-stats">
   <div><strong>{rows.length}</strong><span>Kopā</span></div>
   <div><strong>{totals.published}</strong><span>Publicēti · aktuāli</span></div>
   <div><strong>{totals.unpublished}</strong><span>Nav publicēti · aktuāli</span></div>
   <div><strong>{totals.problems}</strong><span>Lokācijas problēmas</span></div>
  </div>
  <div className="admin-register-toolbar">
   <label>Periods<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="current">Aktuālie</option><option value="all">Visi, arī beigušies</option></select></label>
   <label>Ātrais statuss<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
    <option value="">Visi statusi</option><option value="not_published">Nav publicēti</option><option value="published">Publicēti</option>
    <option value="requires_action">Jāpārbauda</option><option value="pending_review">Gaida apstiprināšanu</option>
    <option value="draft">Melnraksti</option><option value="rejected">Atgriezti labošanai</option>
    <option value="cancelled">Atcelti</option><option value="archived">Arhivēti</option>
   </select></label>
   <span className="admin-register-counter">{filtered.length} no {rows.length}</span>
   <button type="button" className="button compact" onClick={reset}>× Notīrīt filtrus</button>
  </div>
  <div className="admin-register-scroll" role="region" aria-label="Pasākumu reģistra Excel tipa tabula; ritini horizontāli, lai redzētu kolonnas" tabIndex={0}>
   <table className="admin-register-table">
    <thead>
     <tr>
      <th>{sortButton('date','Datums')}</th>
      <th>{sortButton('title','Nosaukums')}</th>
      <th>{sortButton('type','Tips / kategorija')}</th>
      <th>{sortButton('status','Statuss')}</th>
      <th>{sortButton('reason','Kāpēc nerāda / jāpārbauda')}</th>
      <th>Norises vieta</th>
      <th>{sortButton('source','Avots')}</th>
      <th className="admin-register-action-heading">Darbības</th>
     </tr>
     <tr className="admin-register-filters">
      <th><span className="admin-register-empty-filter">No / līdz</span></th>
      <th><input type="search" value={name} onChange={e=>setName(e.target.value)} placeholder="Meklēt nosaukumu…" aria-label="Filtrēt pēc pasākuma nosaukuma"/></th>
      <th><select value={kindFilter} onChange={e=>setKindFilter(e.target.value)} aria-label="Filtrēt pēc pasākuma tipa"><option value="">Visi tipi</option>{types.map(t=><option key={t} value={t}>{t}</option>)}</select></th>
      <th><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} aria-label="Filtrēt pēc publicēšanas statusa">
        <option value="">Visi</option><option value="published">Publicēts</option><option value="not_published">Nav publicēts</option><option value="requires_action">Jāpārbauda</option><option value="pending_review">Jāpublicē</option><option value="draft">Melnraksts</option><option value="rejected">Jālabo</option><option value="cancelled">Atcelts</option><option value="archived">Arhivēts</option>
       </select></th>
      <th><select value={reasonFilter} onChange={e=>setReasonFilter(e.target.value)} aria-label="Filtrēt pēc nepublicēšanas iemesla">
       <option value="">Visi iemesli</option>
       <option value="location">Adrese / koordinātas</option><option value="waiting">Gaida apstiprināšanu</option>
       <option value="source">Atslēgts avots</option><option value="rejected">Atgriezts labošanai</option>
       <option value="draft">Melnraksts</option><option value="ended">Beidzies</option>
       <option value="cancelled">Atcelts</option><option value="ready">Viss kārtībā</option>
      </select></th>
      <th><input type="search" value={locationQuery} onChange={e=>setLocationQuery(e.target.value)} placeholder="Meklēt vietu…" aria-label="Filtrēt pēc norises vietas vai adreses"/></th>
      <th><select value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)} aria-label="Filtrēt pēc datu avota"><option value="">Visi avoti</option>{sourceOptions.map(o=><option key={o} value={o}>{o}</option>)}</select></th>
      <th className="admin-register-action-heading"><span>✎</span></th>
     </tr>
    </thead>
    <tbody>
     {shown.map(row=><tr key={row.id} className={row.reasonTone==='bad'?'admin-register-problem':row.reasonTone==='warn'?'admin-register-pending':''}>
      <td className="admin-register-date" title={row.date_to&&row.date_to!==row.date_from?formatDate(row.date_from)+' – '+formatDate(row.date_to):undefined}>
       {formatDate(row.date_from)}{row.date_to&&row.date_to!==row.date_from&&<small>līdz {formatDate(row.date_to)}</small>}
      </td>
      <td className="admin-register-title"><strong title={row.title}>{row.title}</strong>{row.expired&&<small>Beidzies</small>}</td>
      <td><span title={row.type} className="admin-register-ellipsis">{row.type}</span></td>
      <td><span className={'admin-register-status '+(STATUS_TONES[row.status]||'draft')}>{STATUS_LABELS[row.status]||row.status||'Nezināms'}</span></td>
      <td className="admin-register-reason"><span className={'admin-register-reason-dot '+row.reasonTone} aria-hidden="true"/> <span title={row.reason}>{row.reason}</span></td>
      <td className="admin-register-location"><span title={row.location}>{row.location}</span>{row.address&&row.location!==row.address&&<small>{row.address}</small>}{row.municipality&&<small>{row.municipality}</small>}</td>
      <td><span className="admin-register-ellipsis" title={row.source}>{row.source}</span></td>
      <td className="admin-register-actions">
       {row.kind==='catalog'?<div className="admin-register-row-buttons">
        <button type="button" className="button compact" onClick={()=>onEditEvent(row.raw)} title="Labot adresi un kartes punktu">✎ Labot</button>
        {row.status==='pending_review'&&!row.expired&&row.reasonCode==='waiting'&&<button type="button" className="button primary compact" onClick={()=>onPublish(row.raw)} disabled={busy}>Publicēt</button>}
       </div>:<div className="admin-register-row-buttons">
        <button type="button" className="button compact" onClick={()=>{setEditingSubmission({...row.raw,time_from:String(row.raw.time_from||'').slice(0,5),time_to:String(row.raw.time_to||'').slice(0,5),latitude:row.raw.latitude??'',longitude:row.raw.longitude??''});setEditError('');}} title="Labot lietotāja iesnieguma datus">✎ Labot</button>
        {row.status==='pending_review'&&<button type="button" className="button primary compact" onClick={()=>onOpenSubmission(row.raw)}>Pārbaudīt</button>}
       </div>}
      </td>
     </tr>)}
     {!shown.length&&<tr><td colSpan={8} className="admin-register-no-results">Nav ierakstu ar izvēlētajiem filtriem. <button type="button" className="text-button" onClick={reset}>Notīrīt filtrus</button></td></tr>}
    </tbody>
   </table>
  </div>
  <div className="admin-register-footer">
   <span>{shown.length?((shownPage-1)*pageSize+1)+'–'+Math.min(filtered.length,shownPage*pageSize):'0'} no {filtered.length}</span>
   <label>Rindas <select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}>{PAGE_SIZES.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
   <button type="button" className="button compact" onClick={()=>setPage(n=>Math.max(1,n-1))} disabled={shownPage<=1}>←</button>
   <span>{shownPage} / {pages}</span>
   <button type="button" className="button compact" onClick={()=>setPage(n=>Math.min(pages,n+1))} disabled={shownPage>=pages}>→</button>
  </div>
  <p className="admin-register-footnote">“Publicēts” ir datubāzes statuss. Ja pasākums jau beidzies vai tā avots izslēgts, iemesla kolonna paskaidro, kāpēc tas nav redzams kartē.</p>
  {editingSubmission&&<div className="admin-register-modal-backdrop" role="presentation">
   <form role="dialog" aria-modal="true" aria-labelledby="admin-register-editor-title" className="admin-register-editor" onSubmit={async event=>{
    event.preventDefault();setSavingSubmission(true);setEditError('');
    try{await onSaveSubmission(editingSubmission);setEditingSubmission(null);}
    catch(error){setEditError(error?.message||'Labojumu neizdevās saglabāt.');}
    finally{setSavingSubmission(false);}
   }}>
    <div className="admin-register-editor-heading"><h3 id="admin-register-editor-title">Labot pasākumu</h3><button type="button" className="button compact" onClick={()=>setEditingSubmission(null)} disabled={savingSubmission}>× Aizvērt</button></div>
    <label>Nosaukums *<input required minLength={3} maxLength={200} value={editingSubmission.title||''} onChange={e=>setEditingSubmission(v=>({...v,title:e.target.value}))}/></label>
    <div className="admin-register-editor-grid">
     <label>Tips / kategorija<input maxLength={100} value={editingSubmission.category||''} onChange={e=>setEditingSubmission(v=>({...v,category:e.target.value}))}/></label>
     <label>Datums no *<input type="date" required value={editingSubmission.date_from||''} onChange={e=>setEditingSubmission(v=>({...v,date_from:e.target.value}))}/></label>
     <label>Datums līdz<input type="date" min={editingSubmission.date_from||undefined} value={editingSubmission.date_to||''} onChange={e=>setEditingSubmission(v=>({...v,date_to:e.target.value}))}/></label>
     <label>Sākums<input type="time" value={editingSubmission.time_from||''} onChange={e=>setEditingSubmission(v=>({...v,time_from:e.target.value}))}/></label>
     <label>Beigas<input type="time" value={editingSubmission.time_to||''} onChange={e=>setEditingSubmission(v=>({...v,time_to:e.target.value}))}/></label>
     <label>Vietas nosaukums<input maxLength={200} value={editingSubmission.venue_name||''} onChange={e=>setEditingSubmission(v=>({...v,venue_name:e.target.value}))}/></label>
     <label>Adrese<input maxLength={300} value={editingSubmission.address||''} onChange={e=>setEditingSubmission(v=>({...v,address:e.target.value}))}/></label>
     <label>Platums<input type="number" step="any" value={editingSubmission.latitude} onChange={e=>setEditingSubmission(v=>({...v,latitude:e.target.value}))}/></label>
     <label>Garums<input type="number" step="any" value={editingSubmission.longitude} onChange={e=>setEditingSubmission(v=>({...v,longitude:e.target.value}))}/></label>
    </div>
    <label>Apraksts<textarea rows={3} value={editingSubmission.description||''} onChange={e=>setEditingSubmission(v=>({...v,description:e.target.value}))}/></label>
    {editError&&<p role="alert" className="meets-inline-error">{editError}</p>}
    <div className="admin-register-editor-actions"><button className="button primary" type="submit" disabled={savingSubmission}>{savingSubmission?'Saglabā…':'Saglabāt labojumus'}</button><button type="button" className="button" onClick={()=>setEditingSubmission(null)} disabled={savingSubmission}>Atcelt</button></div>
   </form>
  </div>}
 </section>;
}
