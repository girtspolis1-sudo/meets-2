'use client';

import {useMemo,useState} from 'react';

export default function AdminMappingList({groups,mappings,onMap,onEditEvent,onEditMapping,onToggleMapping,busyMappingId}){
 const [query,setQuery]=useState('');
 const q=query.trim().toLocaleLowerCase('lv');

 const filtered=useMemo(()=>groups.filter(group=>{
  if(!q)return true;
  return [group.alias,group.municipality,group.countryCode,...group.sources]
   .some(value=>String(value||'').toLocaleLowerCase('lv').includes(q));
 }),[groups,q]);

 return <div className="admin-mapping-workspace">
  <div className="admin-sheet-intro compact">
   <div>
    <p className="eyebrow">Atkārtoti izmantojama korekcija</p>
    <h2>Adreses un vietu mapping</h2>
    <p>Vienreiz norādi pareizo vietu. Visi esošie ieraksti ar to pašu nosaukumu tiek salaboti, un nākamajos importos korekcija tiek piemērota automātiski.</p>
   </div>
   <strong className="admin-issue-count">{groups.length} neatpazīti aliasi</strong>
  </div>

  <div className="admin-mapping-toolbar">
   <label>Meklēt aliasu
    <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="OC Ventspils, Keila Tervisekeskus…"/>
   </label>
   <span><strong>{filtered.length}</strong> grupas · <strong>{mappings.length}</strong> saglabāti mappingi</span>
  </div>

  <div className="table-scroll admin-mapping-table-wrap" role="region" aria-label="Neatpazīto adrešu mapping" tabIndex={0}>
   <table className="events-table admin-mapping-table">
    <thead><tr><th>Ielasītais nosaukums</th><th>Konteksts</th><th>Avoti</th><th>Pasākumi</th><th>Kvalitāte</th><th>Korekcija</th></tr></thead>
    <tbody>
     {filtered.map(group=><tr key={group.key}>
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
     </tr>)}
    </tbody>
   </table>
  </div>

  <details className="saved-mappings">
   <summary>Saglabātie mappingi ({mappings.length})</summary>
   <div className="table-scroll" role="region" aria-label="Saglabātie mappingi" tabIndex={0}>
    <table className="events-table admin-mapping-table saved">
     <thead><tr><th>Ielasītais alias</th><th>Sākotnējā adrese</th><th>→ Pareizā vieta</th><th>Adrese</th><th>Konteksts</th><th>Lietojums</th><th>Statuss / darbības</th></tr></thead>
     <tbody>{mappings.map(mapping=><tr key={mapping.id}>
      <td><strong>{mapping.alias_text}</strong><small className="table-subline">Labots: {mapping.updated_at?new Date(mapping.updated_at).toLocaleString('lv-LV'):'—'}</small></td>
      <td>{mapping.original_address_text||'—'}</td>
      <td>{mapping.canonical_venue_name}</td>
      <td>{mapping.canonical_address_text||'—'}<small className="table-subline">{Number(mapping.latitude).toFixed(5)}, {Number(mapping.longitude).toFixed(5)}</small></td>
      <td>{[mapping.municipality,mapping.country_code].filter(Boolean).join(' · ')||'Globāls'}</td>
      <td>{mapping.current_events||0} pašlaik<small className="table-subline">{mapping.apply_count||0} piemērošanas</small></td>
      <td>
       <span className={'quality-badge '+(mapping.active?'ok':'bad')}>{mapping.active?'Aktīvs':'Izslēgts'}</span>
       <div className="admin-actions mapping-actions">
        <button type="button" className="button compact" onClick={()=>onEditMapping(mapping)} disabled={busyMappingId===mapping.id}>Labot</button>
        <button type="button" className="text-button" onClick={()=>onToggleMapping(mapping)} disabled={busyMappingId===mapping.id}>
         {busyMappingId===mapping.id?'Saglabā…':mapping.active?'Deaktivizēt':'Aktivizēt'}
        </button>
       </div>
      </td>
     </tr>)}</tbody>
    </table>
   </div>
  </details>
 </div>;
}
