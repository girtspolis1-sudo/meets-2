'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {columns,detailColumns,display,filterEventsByColumns,prices,statuses} from '../../lib/catalog.js';
import {useEvents} from '../../lib/use-events.js';
import {navigationLinks} from '../../lib/meets-personal.js';

const pageSize=50;
const mobileFilterKeys=new Set(['date_from','title','municipality','event_type','primary_category','price_status']);

export default function EventCatalog(){
 const {data,loading,error,refresh}=useEvents();
 const [columnFilters,setColumnFilters]=useState({});
 const [page,setPage]=useState(0);
 const [sort,setSort]=useState('date_from');
 const [direction,setDirection]=useState(1);
 const [exporting,setExporting]=useState(false);
 const [exportStatus,setExportStatus]=useState('');
 const [selected,setSelected]=useState(null);
 const [viewMode,setViewMode]=useState('cards');

 const rows=data?.events||[];
 const options=useMemo(()=>({
  municipalities:[...new Set(rows.map(event=>event.municipality).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv')),
  countries:[...new Set(rows.map(event=>event.country_code).filter(Boolean))].sort(),
  statuses:[...new Set(rows.map(event=>event.status).filter(Boolean))].sort(),
  prices:[...new Set(rows.map(event=>event.price_status).filter(Boolean))].sort(),
  eventTypes:[...new Set(rows.map(event=>event.event_type).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'lv')),
  mapStatuses:[...new Set(rows.map(event=>display(event,'map_status')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lv'))
 }),[rows]);

 const filtered=useMemo(()=>filterEventsByColumns(rows,columnFilters).sort((a,b)=>{
  const av=sort==='date_from'?a.date_from:display(a,sort);
  const bv=sort==='date_from'?b.date_from:display(b,sort);
  if(!av)return bv?1:0;
  if(!bv)return -1;
  return String(av).localeCompare(String(bv),'lv',{numeric:true})*direction||a.id.localeCompare(b.id);
 }),[rows,columnFilters,sort,direction]);

 const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
 const current=Math.min(page,pages-1);
 const visible=filtered.slice(current*pageSize,(current+1)*pageSize);
 const activeFilterCount=Object.values(columnFilters).filter(value=>String(value||'').trim()).length;

 function changeColumn(key,value){
  setColumnFilters(filters=>({...filters,[key]:value}));
  setPage(0);
  setExportStatus('');
 }

 function filterControl(key,label){
  const value=columnFilters[key]||'';
  const common={value,onChange:event=>changeColumn(key,event.target.value),'aria-label':'Filtrēt: '+label,title:'Filtrēt '+label};

  if(key==='date_from'||key==='date_to'){
   return <input {...common} type="date" min={data?.window?.from||undefined} max={data?.window?.to||undefined}/>;
  }
  if(key==='municipality'){
   return <select {...common}><option value="">Visas</option>{options.municipalities.map(item=><option key={item} value={item}>{item}</option>)}</select>;
  }
  if(key==='country_code'){
   return <select {...common}><option value="">Visas</option>{options.countries.map(item=><option key={item} value={item}>{display({country_code:item},'country_code')}</option>)}</select>;
  }
  if(key==='status'){
   return <select {...common}><option value="">Visi</option>{options.statuses.map(item=><option key={item} value={item}>{statuses[item]||item}</option>)}</select>;
  }
  if(key==='price_status'){
   return <select {...common}><option value="">Visi</option>{options.prices.map(item=><option key={item} value={item}>{prices[item]||item}</option>)}</select>;
  }
  if(key==='event_type'){
   return <select {...common}><option value="">Visi</option>{options.eventTypes.map(item=><option key={item} value={item}>{display({event_type:item},'event_type')}</option>)}</select>;
  }
  if(key==='map_status'){
   return <select {...common}><option value="">Visi</option>{options.mapStatuses.map(item=><option key={item} value={item}>{item}</option>)}</select>;
  }
  return <input {...common} type="search" placeholder="Filtrēt…"/>;
 }

 async function exportExcel(){
  setExporting(true);
  setExportStatus('');
  try{
   const {createWorkbook}=await import('../../lib/excel.js');
   const buffer=await createWorkbook(filtered,data.fetchedAt);
   const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
   const a=document.createElement('a');
   a.href=url;
   a.download=`Meets-2-pasakumi-${new Date().toISOString().slice(0,10)}.xlsx`;
   a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   setExportStatus(`Eksportēti ${filtered.length} ieraksti.`);
  }catch{
   setExportStatus('Eksports neizdevās. Mēģini vēlreiz.');
  }finally{
   setExporting(false);
  }
 }

 const selectedEvent=rows.find(event=>event.id===selected);

 return <>
  <div className="catalog-toolbar">
   <div>
    <strong>{data?`${rows.length} pasākumi`:'Ielādējam pasākumus…'}</strong>
    <p className="sync-text">{data?`Dati pārlasīti ${new Date(data.fetchedAt).toLocaleString('lv-LV',{timeZone:'Europe/Riga'})}`:'Savienojamies ar datu avotu'} · automātiski ik minūti</p>
   </div>
   <button className="button" onClick={refresh} disabled={loading}>{loading?'Ielādē…':'Pārlasīt datus'}</button>
  </div>

  <p className="catalog-availability-note">Redzami tikai aktuālie publicētie pasākumi nākamo trīs mēnešu periodā. Atlasīto rezultātu var pārskatīt kartītēs vai detalizētā tabulā.</p>

  {error&&<div className="error-message" role="alert">{error} {data&&'Zemāk saglabāti pēdējie veiksmīgi ielādētie dati.'}</div>}

  <div className="catalog-view-switch" role="group" aria-label="Pasākumu attēlošanas veids"><button type="button" aria-pressed={viewMode==='cards'} className={viewMode==='cards'?'active':''} onClick={()=>setViewMode('cards')}>▦ Kartītes</button><button type="button" aria-pressed={viewMode==='table'} className={viewMode==='table'?'active':''} onClick={()=>setViewMode('table')}>☷ Tabula un Excel</button><a href="/karte" className="catalog-map-shortcut">⌖ Skatīt kartē ↗</a></div>
  <div className="result-toolbar">
   <p aria-live="polite"><strong>{filtered.length}</strong> no {rows.length} ierakstiem{activeFilterCount?<> · <strong>{activeFilterCount}</strong> aktīvi kolonu filtri</>:null}</p>
   <button className="text-button" disabled={!activeFilterCount} onClick={()=>{setColumnFilters({});setPage(0);}}>Notīrīt filtrus</button>
   <label className="sort-label">Kārtot pēc<select value={sort} onChange={event=>{setSort(event.target.value);setPage(0);}}><option value="date_from">Datuma</option><option value="title">Nosaukuma</option><option value="municipality">Pašvaldības</option></select></label>
   <button className="button direction-button" onClick={()=>{setDirection(value=>-value);setPage(0);}} aria-label={direction===1?'Kārtot dilstoši':'Kārtot augoši'}>{direction===1?'↑':'↓'}</button>
   {viewMode==='table'&&<button className="button primary" disabled={!data||!filtered.length||exporting} onClick={exportExcel}>{exporting?'Gatavo Excel…':`Lejupielādēt Excel (${filtered.length})`}</button>}
  </div>

  <p role="status" className="sync-text">{exportStatus}</p>

  <details className="mobile-table-filters" open={undefined}>
   <summary>Filtrēt pasākumus{activeFilterCount?` (${activeFilterCount})`:''}</summary>
   <div className="mobile-filter-grid">
    {columns.filter(([key])=>mobileFilterKeys.has(key)).map(([key,label])=><label key={key}>{label}{filterControl(key,label)}</label>)}
   </div>
  </details>

  {data&&filtered.length===0
   ?<div className="empty"><h2>Nav atrastu pasākumu</h2><p>{rows.length?'Pamēģini mainīt vai notīrīt tabulas kolonu filtrus.':'Pašlaik nav publicētu pasākumu. Tiklīdz pasākums tiks publicēts, tas parādīsies šeit.'}</p></div>
   :<>
    {viewMode==='cards'&&<div className="catalog-card-grid">{visible.map(event=>{const nav=navigationLinks(event);return <article className="catalog-event-card" key={event.id}>
     <div className="catalog-event-card-top"><time dateTime={event.date_from}>{display(event,'date_from')||'Datums nav norādīts'}</time><span>{display(event,'event_type')||event.primary_category||'Pasākums'}</span></div>
     <h2>{event.title}</h2><p className="catalog-event-card-location">⌖ {event.venue_name||event.address_raw||event.municipality||'Norises vieta nav zināma'}</p>
     <p className="catalog-event-card-time">{display(event,'time')||'Laiks nav norādīts'} · {display(event,'price_status')||'Maksa nav norādīta'}</p>
     <div className="catalog-event-card-actions"><button className="button compact primary" type="button" onClick={()=>setSelected(event.id)}>Par pasākumu</button><a className="button compact" href={'/karte?q='+encodeURIComponent(event.title)}>Kartē ↗</a>{nav.google&&<a className="button compact" href={nav.google} rel="noopener noreferrer" target="_blank" aria-label={'Maršruts uz '+event.title}>Maršruts ↗</a>}</div>
    </article>})}</div>}
    {viewMode==='table'&&<div className="table-scroll" role="region" aria-label="Pasākumu tabula — ritināma horizontāli" tabIndex={0}>
     <table className="events-table catalog-events-table">
      <caption>Atlasītie pasākumi. Otrajā galvenes rindā vari filtrēt katru kolonnu atsevišķi. Nospied nosaukumu, lai redzētu visu norises informāciju.</caption>
      <thead>
       <tr className="column-title-row"><th scope="col">Nr.</th>{columns.map(([key,label])=><th key={key} scope="col">{label}</th>)}</tr>
       <tr className="column-filter-row" aria-label="Kolonu filtri"><th aria-label="Numerācija"></th>{columns.map(([key,label])=><th key={key}>{filterControl(key,label)}</th>)}</tr>
      </thead>
      <tbody>{visible.map((event,index)=><tr key={event.id}>
       <td>{current*pageSize+index+1}</td>
       {columns.map(([key])=><td key={key}>
        {key==='title'
         ?<button className="event-title" onClick={()=>setSelected(event.id)}>{event.title}</button>
         :key==='source_url'
          ?event.sources.filter(source=>source.url).map((source,j)=><a className="source-link" key={j} href={source.url} target="_blank" rel="noopener noreferrer">Atvērt avotu ↗</a>)
          :key==='status'
           ?<span className={`badge ${event.status}`}>{display(event,key)}</span>
           :display(event,key)||'—'}
       </td>)}
      </tr>)}</tbody>
     </table>
    </div>}

    {viewMode==='table'&&<div className="mobile-events">{visible.map(event=><article key={event.id} className="mobile-event">
     <div className="mobile-event-meta">
      <div><strong>{display(event,'date_from')}</strong><span>{display(event,'time')}</span></div>
      <span className={`badge ${event.status}`}>{display(event,'status')}</span>
     </div>
     <button className="event-title" onClick={()=>setSelected(event.id)}>{event.title}</button>
     <div className="mobile-event-facts">
      <span><b>Vieta</b>{event.venue_name||event.address_raw||'Nav norādīta'}</span>
      <span><b>Pašvaldība</b>{event.municipality||'Nav norādīta'}</span>
      <span><b>Veids</b>{display(event,'event_type')||event.primary_category||'Nav norādīts'}</span>
      <span><b>Maksa</b>{display(event,'price_status')}</span>
     </div>
     <button className="button compact mobile-event-open" onClick={()=>setSelected(event.id)}>Skatīt pasākumu</button>
    </article>)}</div>}
   </>}

  {data&&filtered.length>0&&<nav className="pagination" aria-label="Saraksta lapas">
   <button className="button" disabled={current===0} onClick={()=>setPage(current-1)}>← Iepriekšējā</button>
   <span>{current+1}. / {pages} lapa · {current*pageSize+1}–{Math.min((current+1)*pageSize,filtered.length)}</span>
   <button className="button" disabled={current===pages-1} onClick={()=>setPage(current+1)}>Nākamā →</button>
  </nav>}

  {selectedEvent&&<EventDetails event={selectedEvent} close={()=>setSelected(null)}/>}
 </>;
}

function EventDetails({event,close}){
 const dialog=useRef(null);
 useEffect(()=>{dialog.current.showModal();},[]);
 return <dialog ref={dialog} className="event-dialog" onCancel={close} onClose={close}>
  <div className="detail-header"><h2>{event.title}</h2><button className="button" onClick={close} autoFocus>Aizvērt ✕</button></div>
  <div className="catalog-detail-actions"><a className="button primary" href={'/karte?q='+encodeURIComponent(event.title)}>Atvērt kartē ↗</a>{navigationLinks(event).google&&<a className="button" target="_blank" rel="noopener noreferrer" href={navigationLinks(event).google}>Google Maps ↗</a>}{navigationLinks(event).waze&&<a className="button" target="_blank" rel="noopener noreferrer" href={navigationLinks(event).waze}>Waze ↗</a>}</div>
  <dl>{[...columns,...detailColumns].filter(([key])=>key!=='title').map(([key,label])=><div key={key}>
   <dt>{label}</dt>
   <dd>{key==='source_url'
    ?event.sources.filter(source=>source.url).map((source,index)=><a className="source-link" href={source.url} target="_blank" rel="noopener noreferrer" key={index}>{source.source||'Avots'} ↗</a>)
    :display(event,key)||'Nav norādīts'}</dd>
  </div>)}</dl>
 </dialog>;
}
