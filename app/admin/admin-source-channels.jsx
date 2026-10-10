'use client';

import {useMemo,useState} from 'react';

function sourceGroup(source){
 if(source.municipality_id)return 'municipality';
 const domain=String(source.domain||'').toLowerCase();
 if(domain.includes('basket'))return 'basketball';
 if(domain==='lff.lv')return 'football';
 if(domain==='athletics.lv')return 'athletics';
 return 'other';
}

function groupLabel(key){
 return ({
  municipality:'Pašvaldību avoti',
  basketball:'Basketbols',
  football:'Futbols',
  athletics:'Vieglatlētika',
  other:'Citi avoti'
 })[key]||'Citi avoti';
}

export default function AdminSourceChannels({sources,events,onToggle,onEdit,onPublish,busySourceId,busy}){
 const [openSource,setOpenSource]=useState(null);
 const [sourceSearch,setSourceSearch]=useState('');
 const [sourceStatus,setSourceStatus]=useState('');
 const [visibleCount,setVisibleCount]=useState(25);
 const currentEvents=Array.isArray(events)?events:[];
 const selectedSource=Array.isArray(sources)?sources.find(s=>s.id===openSource):null;
 const sourceEvents=useMemo(()=>{
  if(!selectedSource)return [];
  const domain=String(selectedSource.domain||'').toLowerCase();
  const query=sourceSearch.toLocaleLowerCase('lv').trim();
  return currentEvents.filter(event=>
   (event.sources||[]).some(s=>String(s.source||'').toLowerCase()===domain)&&
   (!sourceStatus||event.status===sourceStatus)&&
   (!query||[event.title,event.venue_name,event.address_raw,event.municipality].some(v=>String(v||'').toLocaleLowerCase('lv').includes(query)))
  ).sort((a,b)=>String(a.date_from||'').localeCompare(String(b.date_from||''))||String(a.title||'').localeCompare(String(b.title||''),'lv'));
 },[currentEvents,selectedSource,sourceSearch,sourceStatus]);
 function toggleList(source){
  if(openSource===source.id){setOpenSource(null);return;}
  setOpenSource(source.id);setSourceSearch('');setSourceStatus('');setVisibleCount(25);
 }
 const rows=Array.isArray(sources)?sources:[];
 const enabled=rows.filter(source=>source.map_visible!==false).length;
 const groups=['municipality','basketball','football','athletics','other']
  .map(key=>({key,label:groupLabel(key),items:rows.filter(source=>sourceGroup(source)===key)}))
  .filter(group=>group.items.length);

 return <section className="admin-source-channels">
  <div className="admin-overview-panel-head">
   <div>
    <span>Publiskā karte</span>
    <h2>Datu avoti / ielādes kanāli</h2>
    <p>Katru mājaslapu var atsevišķi ieslēgt vai izslēgt kartes rādīšanai. Izslēgšana neizdzēš importētos pasākumus un neaptur pašu importu.</p>
   </div>
   <span className="quality-badge ok">{enabled} no {rows.length} ieslēgti</span>
  </div>

  {groups.map(group=><div className="source-channel-group" key={group.key}>
   <div className="source-channel-group-head">
    <h3>{group.label}</h3>
    <span>{group.items.filter(source=>source.map_visible!==false).length}/{group.items.length} ieslēgti</span>
   </div>
   <div className="source-channel-grid">
    {group.items.map(source=>{
     const active=source.map_visible!==false;
     const busy=String(busySourceId)===String(source.id);
     return <article className={'source-channel-card '+(active?'is-enabled':'is-disabled')} key={source.id}>
      <div className="source-channel-copy">
       <div className="source-channel-title">
        <strong>{source.label||source.domain}</strong>
        <span className={'quality-badge '+(active?'ok':'bad')}>{active?'Kartē redzams':'Kartē paslēpts'}</span>
       </div>
       <a href={source.calendar_url||('https://'+source.domain)} target="_blank" rel="noreferrer">{source.domain} ↗</a>
       <small>Aktuāli: {source.current_event_count??0} · publicēti: {source.published_event_count??0} · kopā sasaistīti: {source.event_count??0}</small>
       {source.municipality_id&&source.last_read_at&&<small className="source-channel-refresh-meta">
        ↻ Pārlasīts: {new Intl.DateTimeFormat('lv-LV',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Riga'}).format(new Date(source.last_read_at))}
        {' · '}Jauni: <strong>{source.last_result?.new??0}</strong>
        {source.last_status==='partial'&&<span className="source-channel-refresh-warning"> · Avotā notikumi nav atrasti</span>}
       </small>}
      </div>
      <label className="source-channel-switch">
       <input
        type="checkbox"
        checked={active}
        disabled={busy}
        onChange={()=>onToggle(source)}
        aria-label={(active?'Atslēgt ':'Ieslēgt ')+(source.label||source.domain)+' kartes rādīšanai'}
       />
       <span aria-hidden="true"></span>
       <b>{busy?'Saglabā…':active?'Ieslēgts':'Izslēgts'}</b>
      </label>
      <button type="button" className="button compact source-channel-open" aria-expanded={openSource===source.id} onClick={()=>toggleList(source)}>{openSource===source.id?'Aizvērt pasākumus':'Skatīt pasākumus'}</button>
     </article>;
    })}
   </div>
   {group.items.some(source=>source.id===openSource)&&selectedSource&&<div className="source-event-panel">
    <div className="source-event-heading">
     <div><h4>{selectedSource.label||selectedSource.domain} — pasākumi</h4><p>Rādīti tikai šī avota aktuālie ieraksti. Pasākumus var labot arī tad, ja avots kartē ir atslēgts.</p></div>
     <button className="button compact" type="button" onClick={()=>setOpenSource(null)}>Aizvērt ✕</button>
    </div>
    <div className="source-event-toolbar">
     <label>Meklēt <input type="search" value={sourceSearch} onChange={e=>{setSourceSearch(e.target.value);setVisibleCount(25);}} placeholder="Pasākums, vieta, pašvaldība…"/></label>
     <label>Statuss <select value={sourceStatus} onChange={e=>{setSourceStatus(e.target.value);setVisibleCount(25);}}>
      <option value="">Visi statusi</option><option value="pending_review">Jāpublicē</option><option value="published">Publicēti</option><option value="draft">Melnraksti</option><option value="rejected">Noraidīti</option>
     </select></label>
     <span className="source-event-count">{sourceEvents.length} ieraksti</span>
    </div>
    <div className="table-scroll" role="region" aria-label="Atlasītā avota pasākumi" tabIndex={0}>
     <table className="events-table source-events-table"><thead><tr><th>Datums</th><th>Pasākums</th><th>Norises vieta</th><th>Statuss</th><th>Darbības</th></tr></thead>
      <tbody>{sourceEvents.slice(0,visibleCount).map(event=>{
       const verified=event.attendance_mode==='online'||event.location_quality==='verified_exact';
       return <tr key={event.id}>
        <td>{event.date_from||'—'}{event.date_to&&event.date_to!==event.date_from?' – '+event.date_to:''}</td>
        <td><strong>{event.title}</strong><small className="table-subline">{event.event_type||event.primary_category||''}</small></td>
        <td>{event.venue_name||event.address_raw||'Nav norādīta'}<small className="table-subline">{event.municipality||''}</small></td>
        <td><span className={'quality-badge '+(event.status==='published'?'ok':verified?'warn':'bad')}>{event.status==='published'?'Publicēts':verified?'Gatavs publicēšanai':'Jāpārbauda lokācija'}</span></td>
        <td><div className="admin-actions">
         <button type="button" className="button compact" onClick={()=>onEdit(event)}>Labot</button>
         {event.status!=='published'&&<button type="button" className="button primary compact" disabled={!verified||busy} title={!verified?'Vispirms verificē lokāciju':'Publicēt pasākumu'} onClick={()=>onPublish(event)}>{busy?'Saglabā…':'Publicēt'}</button>}
        </div></td>
       </tr>;
      })}</tbody>
     </table>
    </div>
    {!sourceEvents.length&&<p className="sync-text">Šajā avotā atlasītajiem kritērijiem nav aktuālu pasākumu.</p>}
    {visibleCount<sourceEvents.length&&<button type="button" className="button compact" onClick={()=>setVisibleCount(n=>n+25)}>Rādīt vēl 25 ({sourceEvents.length-visibleCount} atlikuši)</button>}
   </div>}
  </div>)}

  {!rows.length&&<p className="sync-text">Nav atrasts neviens konfigurēts datu avots.</p>}
 </section>;
}
