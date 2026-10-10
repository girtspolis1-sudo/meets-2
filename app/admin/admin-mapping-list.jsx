'use client';

import {useMemo,useState} from 'react';

export default function AdminMappingList({groups,mappings,onMap,onEditEvent,onEditMapping,onToggleMapping,busyMappingId}){
 const [query,setQuery]=useState('');
 const [view,setView]=useState('issues');
 const q=query.trim().toLocaleLowerCase('lv');

 const filteredGroups=useMemo(()=>groups.filter(group=>{
  if(!q)return true;
  return [group.alias,group.municipality,group.countryCode,...group.sources]
   .some(value=>String(value||'').toLocaleLowerCase('lv').includes(q));
 }).sort((a,b)=>b.events.length-a.events.length),[groups,q]);

 const filteredMappings=useMemo(()=>mappings.filter(mapping=>{
  if(!q)return true;
  return [
   mapping.alias_text,mapping.original_address_text,mapping.canonical_venue_name,
   mapping.canonical_address_text,mapping.municipality,mapping.country_code
  ].some(value=>String(value||'').toLocaleLowerCase('lv').includes(q));
 }),[mappings,q]);

 const activeMappings=mappings.filter(mapping=>mapping.active);

 return <div className="admin-mapping-workspace">
  <div className="admin-sheet-intro compact">
   <div>
    <p className="eyebrow">Lokāciju kvalitātes darba rinda</p>
    <h2>Adreses un vietu mapping</h2>
    <p>Jālabo — vietas, kurām vēl nav drošas lokācijas. Sakārtoti — jau saglabātie mappingi; tie ir atzīmēti zaļi, bet tos jebkurā brīdī var atkārtoti labot.</p>
   </div>
   <div className="mapping-summary-chips">
    <strong className="admin-issue-count">{groups.length} jālabo</strong>
    <strong className="admin-ok-count">{activeMappings.length} sakārtoti</strong>
   </div>
  </div>

  <div className="admin-mapping-toolbar">
   <label>Meklēt vietu vai aliasu
    <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="OC Ventspils, Keila Tervisekeskus…"/>
   </label>
   <div className="mapping-view-tabs" role="group" aria-label="Mapping statusi">
    <button type="button" aria-pressed={view==='issues'} className={view==='issues'?'active attention':''} onClick={()=>setView('issues')}>Jālabo <span>{groups.length}</span></button>
    <button type="button" role="tab" aria-selected={view==='resolved'} className={view==='resolved'?'active success':''} onClick={()=>setView('resolved')}>Sakārtoti <span>{activeMappings.length}</span></button>
   </div>
  </div>

  {view==='issues'&&<div className="admin-mapping-mobile-cards">{filteredGroups.map(group=><article key={group.key} className="admin-mapping-mobile-card">
    <div><span className="quality-badge bad">Jālabo</span><strong>{group.alias||'Nav adreses'}</strong><small>{group.municipality||group.countryCode||'Konteksts nav noteikts'} · {group.events.length} pasākumi</small></div>
    <button type="button" className="button primary compact" onClick={()=>group.alias?onMap(group):onEditEvent(group.events[0])}>Labot vietu ↗</button>
   </article>)}</div>}
  {view==='issues'&&<div className="table-scroll admin-mapping-table-wrap" role="region" aria-label="Neatpazīto adrešu mapping" tabIndex={0}>
   <table className="events-table admin-mapping-table">
    <thead><tr><th>Statuss</th><th>Ielasītais nosaukums</th><th>Konteksts</th><th>Avoti</th><th>Aktuālie pasākumi</th><th>Kvalitāte</th><th>Darbība</th></tr></thead>
    <tbody>
     {filteredGroups.length?filteredGroups.map(group=><tr key={group.key} className="mapping-needs-review">
      <td><span className="quality-badge bad">Jālabo</span></td>
      <td><strong>{group.alias||'Nav vietas/adreses'}</strong>{group.sampleAddress&&group.sampleAddress!==group.alias&&<small className="table-subline">{group.sampleAddress}</small>}</td>
      <td>{group.municipality||'—'}<small className="table-subline">{group.countryCode||'—'}</small></td>
      <td>{group.sources.join(', ')||'—'}</td>
      <td><strong>{group.events.length}</strong><small className="table-subline">{group.firstDate||'—'} → {group.lastDate||'—'}</small></td>
      <td>{group.qualities.map(value=><span key={value} className="quality-badge bad">{value}</span>)}</td>
      <td>
       {group.alias
        ?<button type="button" className="button primary compact" onClick={()=>onMap(group)}>Norādīt korekciju</button>
        :<button type="button" className="button compact" onClick={()=>onEditEvent(group.events[0])}>Labot ierakstu</button>}
      </td>
     </tr>):<tr><td colSpan={7}><p className="admin-empty-inline">Nav neatpazītu aktuālo vietu pēc izvēlētā filtra.</p></td></tr>}
    </tbody>
   </table>
  </div>}

  {view==='resolved'&&<div className="table-scroll admin-mapping-table-wrap" role="region" aria-label="Saglabātie mappingi" tabIndex={0}>
   <table className="events-table admin-mapping-table saved">
    <thead><tr><th>Statuss</th><th>Ielasītais alias</th><th>→ Pareizā vieta</th><th>Adrese</th><th>Konteksts</th><th>Lietojums</th><th>Darbības</th></tr></thead>
    <tbody>{filteredMappings.length?filteredMappings.map(mapping=><tr key={mapping.id} className={mapping.active?'mapping-resolved':'mapping-disabled'}>
     <td><span className={'quality-badge '+(mapping.active?'ok':'bad')}>{mapping.active?'Sakārtots':'Izslēgts'}</span></td>
     <td><strong>{mapping.alias_text}</strong><small className="table-subline">Labots: {mapping.updated_at?new Date(mapping.updated_at).toLocaleString('lv-LV'):'—'}</small>{mapping.original_address_text&&<small className="table-subline">Sākotnēji: {mapping.original_address_text}</small>}</td>
     <td><strong>{mapping.canonical_venue_name}</strong></td>
     <td>{mapping.canonical_address_text||'—'}<small className="table-subline">{Number(mapping.latitude).toFixed(5)}, {Number(mapping.longitude).toFixed(5)}</small></td>
     <td>{[mapping.municipality,mapping.country_code].filter(Boolean).join(' · ')||'Globāls'}</td>
     <td><strong>{mapping.current_events||0} aktuāli</strong><small className="table-subline">{mapping.total_events??mapping.current_events??0} kopā · {mapping.apply_count||0} piemērošanas</small></td>
     <td>
      <div className="admin-actions mapping-actions">
       <button type="button" className="button compact" onClick={()=>onEditMapping(mapping)} disabled={busyMappingId===mapping.id}>Labot mappingu</button>
       <button type="button" className="text-button" onClick={()=>onToggleMapping(mapping)} disabled={busyMappingId===mapping.id}>
        {busyMappingId===mapping.id?'Saglabā…':mapping.active?'Deaktivizēt':'Aktivizēt'}
       </button>
      </div>
     </td>
    </tr>):<tr><td colSpan={7}><p className="admin-empty-inline">Nav saglabātu mappingu pēc izvēlētā filtra.</p></td></tr>}</tbody>
   </table>
  </div>}
 </div>;
}
