'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { columns, detailColumns, display, filterEvents, initialFilters, prices, statuses } from '../../lib/catalog.js';
import {useEvents} from '../../lib/use-events.js';
import EventMap from './event-map.jsx';
const pageSize=50;
export default function EventCatalog() {
 const {data,loading,error,refresh}=useEvents();
 const [filters,setFilters]=useState(initialFilters),[page,setPage]=useState(0),[sort,setSort]=useState('date_from'),[direction,setDirection]=useState(1),[exporting,setExporting]=useState(false),[exportStatus,setExportStatus]=useState(''),[selected,setSelected]=useState(null);
 const rows=data?.events||[];
 const options=useMemo(()=>({municipalities:[...new Set(rows.map(e=>e.municipality).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv')),categories:[...new Set(rows.flatMap(e=>[e.primary_category,...e.tags]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv'))}),[data]);
 const filtered=useMemo(()=>filterEvents(rows,filters).sort((a,b)=>{
   const av=sort==='date_from'?a.date_from:display(a,sort),bv=sort==='date_from'?b.date_from:display(b,sort);
   if(!av)return bv?1:0;if(!bv)return -1;
   return String(av).localeCompare(String(bv),'lv',{numeric:true})*direction || a.id.localeCompare(b.id);
 }),[data,filters,sort,direction]);
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),current=Math.min(page,pages-1),visible=filtered.slice(current*pageSize,(current+1)*pageSize);
 const invalid=filters.from&&filters.to&&filters.from>filters.to;
 const change=(key,value)=>{setFilters(f=>({...f,[key]:value}));setPage(0);setExportStatus('');};
 async function exportExcel() {
  setExporting(true);setExportStatus('');
  try { const {createWorkbook}=await import('../../lib/excel.js'); const buffer=await createWorkbook(filtered,data.fetchedAt);
   const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
   const a=document.createElement('a');a.href=url;a.download=`Meets-2-pasakumi-${new Date().toISOString().slice(0,10)}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setExportStatus(`Eksportēti ${filtered.length} ieraksti.`);
  } catch {setExportStatus('Eksports neizdevās. Mēģini vēlreiz.');} finally {setExporting(false);}
 }
 const selectedEvent=rows.find(e=>e.id===selected);
 return <>
  <div className="catalog-toolbar"><div><strong>{data?`${rows.length} pasākumi`:'Ielādējam pasākumus…'}</strong><p className="sync-text">{data?`Dati pārlasīti ${new Date(data.fetchedAt).toLocaleString('lv-LV',{timeZone:'Europe/Riga'})}`:'Savienojamies ar datu avotu'} · automātiski ik minūti</p></div><button className="button" onClick={refresh} disabled={loading}>{loading?'Ielādē…':'Pārlasīt datus'}</button></div>
  <p className="data-note"><strong>Publiskais pasākumu saraksts.</strong> Šeit redzami tikai apstiprinātie <code>published</code> pasākumi; Excel eksports izmanto tieši to pašu datu kopu.</p>
  {data&&<EventMap events={filtered} onSelect={e=>setSelected(e.id)}/>} 
  {error&&<div className="error-message" role="alert">{error} {data&&'Zemāk saglabāti pēdējie veiksmīgi ielādētie dati.'}</div>}
  <div className="filters" aria-label="Pasākumu filtri">
   <label className="search-label">Meklēt pasākumu<input type="search" placeholder="Nosaukums, vieta, adrese…" value={filters.search} onChange={e=>change('search',e.target.value)}/></label>
   <label>Pašvaldība<select value={filters.municipality} onChange={e=>change('municipality',e.target.value)}><option value="">Visas pašvaldības</option>{options.municipalities.map(v=><option key={v}>{v}</option>)}</select></label>
   <label>Kategorija<select value={filters.category} onChange={e=>change('category',e.target.value)}><option value="">Visas kategorijas</option>{options.categories.map(v=><option key={v}>{v}</option>)}</select></label>
   <label>Datums no<input type="date" value={filters.from} onChange={e=>change('from',e.target.value)}/></label>
   <label>Datums līdz<input type="date" value={filters.to} onChange={e=>change('to',e.target.value)}/></label>
   <label>Statuss<select value={filters.status} onChange={e=>change('status',e.target.value)}><option value="">Publicētie</option>{Object.entries(statuses).filter(([v])=>v==='published').map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <label>Dalības maksa<select value={filters.price} onChange={e=>change('price',e.target.value)}><option value="">Visi veidi</option>{Object.entries(prices).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
  </div>
  {invalid&&<p role="alert" className="error-message">Datums “No” nedrīkst būt pēc datuma “Līdz”.</p>}
  <div className="result-toolbar"><p aria-live="polite"><strong>{filtered.length}</strong> no {rows.length} ierakstiem</p><button className="text-button" onClick={()=>{setFilters(initialFilters);setPage(0);}}>Notīrīt filtrus</button><label className="sort-label">Kārtot pēc<select value={sort} onChange={e=>{setSort(e.target.value);setPage(0);}}><option value="date_from">Datuma</option><option value="title">Nosaukuma</option><option value="municipality">Pašvaldības</option></select></label><button className="button direction-button" onClick={()=>{setDirection(d=>-d);setPage(0);}} aria-label={direction===1?'Kārtot dilstoši':'Kārtot augoši'}>{direction===1?'↑':'↓'}</button><button className="button primary" disabled={!data||!filtered.length||exporting||!!invalid} onClick={exportExcel}>{exporting?'Gatavo Excel…':`Lejupielādēt Excel (${filtered.length})`}</button></div>
  <p role="status" className="sync-text">{exportStatus}</p>
  {data&&filtered.length===0?<div className="empty"><h2>Nav atrastu pasākumu</h2><p>{rows.length?'Pamēģini mainīt vai notīrīt filtrus.':'Pašlaik nav publicētu pasākumu. Tiklīdz pasākums tiks publicēts, tas parādīsies šeit.'}</p></div>:<>
  <div className="table-scroll" role="region" aria-label="Pasākumu tabula — ritināma horizontāli" tabIndex={0}><table className="events-table"><caption>Atlasītie pasākumi. Nospied nosaukumu, lai redzētu visu norises informāciju.</caption><thead><tr><th scope="col">Nr.</th>{columns.map(([k,l])=><th key={k} scope="col">{l}</th>)}</tr></thead><tbody>{visible.map((e,i)=><tr key={e.id}><td>{current*pageSize+i+1}</td>{columns.map(([k])=><td key={k}>{k==='title'?<button className="event-title" onClick={()=>setSelected(e.id)}>{e.title}</button>:k==='source_url'?e.sources.filter(s=>s.url).map((s,j)=><a className="source-link" key={j} href={s.url} target="_blank" rel="noopener noreferrer">Atvērt avotu ↗</a>):k==='status'?<span className={`badge ${e.status}`}>{display(e,k)}</span>:display(e,k)||'—'}</td>)}</tr>)}</tbody></table></div>
  <div className="mobile-events">{visible.map(e=><article key={e.id} className="mobile-event"><div className="mobile-event-meta"><span>{display(e,'date_from')}</span><span className={`badge ${e.status}`}>{display(e,'status')}</span></div><button className="event-title" onClick={()=>setSelected(e.id)}>{e.title}</button><p>{e.municipality||'Pašvaldība nav norādīta'} · {display(e,'time')}</p><p>{e.venue_name||e.address_raw||'Vieta nav norādīta'}</p><span>{display(e,'price_status')}</span><button className="text-button" onClick={()=>setSelected(e.id)}>Visa informācija ↗</button></article>)}</div>
  </>}
  {data&&filtered.length>0&&<nav className="pagination" aria-label="Saraksta lapas"><button className="button" disabled={current===0} onClick={()=>setPage(current-1)}>← Iepriekšējā</button><span>{current+1}. / {pages} lapa · {current*pageSize+1}–{Math.min((current+1)*pageSize,filtered.length)}</span><button className="button" disabled={current===pages-1} onClick={()=>setPage(current+1)}>Nākamā →</button></nav>}
  {selectedEvent&&<EventDetails event={selectedEvent} close={()=>setSelected(null)}/>}
 </>;
}
function EventDetails({event,close}) {
 const dialog=useRef(null);
 useEffect(()=>{dialog.current.showModal();},[]);
 return <dialog ref={dialog} className="event-dialog" onCancel={close} onClose={close}><div className="detail-header"><h2>{event.title}</h2><button className="button" onClick={close} autoFocus>Aizvērt ✕</button></div><dl>{[...columns,...detailColumns].filter(([k])=>k!=='title').map(([k,l])=><div key={k}><dt>{l}</dt><dd>{k==='source_url'?event.sources.filter(s=>s.url).map((s,i)=><a className="source-link" href={s.url} target="_blank" rel="noopener noreferrer" key={i}>{s.source||'Avots'} ↗</a>):display(event,k)||'Nav norādīts'}</dd></div>)}</dl></dialog>;
}
