'use client';

import {useMemo,useState} from 'react';
import {bestSuggestion,confidentSuggestion} from '../../lib/admin-location.js';

function Suggestion({group,onAccept}){
 const best=bestSuggestion(group.candidates);
 if(!best)return <span className="mapping-suggestion-none">{group.suggestedAt?'Nav atrasts':'—'}</span>;
 const {candidate,precise}=best;
 return <div className="mapping-suggestion">
  <strong>{candidate.label||candidate.displayName}</strong>
  <small className="table-subline">{candidate.displayName}</small>
  {precise?<button type="button" className="button compact primary" onClick={()=>onAccept(group,candidate)}>Apstiprināt</button>
   :<small className="mapping-suggestion-area">Tikai apdzīvota vieta — norādi precīzu vietu</small>}
  {candidate.sourceUrl&&<a className="text-button" href={candidate.sourceUrl} target="_blank" rel="noopener noreferrer">Kartē ↗</a>}
 </div>;
}

export default function AdminMappingList({groups,mappings,onMap,onEditEvent,onEditMapping,onToggleMapping,busyMappingId,suggestionRunning=false,suggestionProgress='',onFindSuggestions,onStopSuggestions,onAcceptSuggestion,onAcceptMany,bulkProgress=''}){
 const [reviewing,setReviewing]=useState(false);
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
 const withoutSuggestion=groups.filter(group=>group.alias&&!group.suggestedAt).length;
 // Strong, unambiguous suggestions that can be approved together after a quick look.
 const confident=useMemo(()=>groups.filter(g=>g.alias).map(group=>({group,candidate:confidentSuggestion(group)})).filter(x=>x.candidate),[groups]);
 const confidentEvents=confident.reduce((sum,x)=>sum+x.group.events.length,0);

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

  {view==='issues'&&onFindSuggestions&&<div className="mapping-suggestion-bar" role="status">
   <div><strong>Automātiski adrešu ieteikumi</strong><span>{suggestionProgress||(withoutSuggestion?(withoutSuggestion===1?'1 vietai':withoutSuggestion+' vietām')+' vēl nav meklēts ieteikums. Meklēšana notiek pa vienai vietai sekundē, tāpēc var aizņemt dažas minūtes.':'Visām vietām ieteikumi ir meklēti.')}</span></div>
   {suggestionRunning?<button type="button" className="button" onClick={onStopSuggestions}>Apturēt</button>
    :withoutSuggestion>0&&<button type="button" className="button primary" onClick={onFindSuggestions}>Atrast ieteikumus</button>}
  </div>}
  {view==='issues'&&onAcceptMany&&(confident.length>0||bulkProgress)&&<div className="mapping-bulk-bar" role="status">
   <div><strong>{bulkProgress||(confident.length===1?'1 vietai':confident.length+' vietām')+' ir droša atbilstība'}</strong>
    {!bulkProgress&&<span>Var apstiprināt uzreiz — tas sakārtos {confidentEvents} {confidentEvents%10===1&&confidentEvents%100!==11?'pasākumu':'pasākumus'} un nākamos importus.</span>}</div>
   {!bulkProgress&&<button type="button" className="button" onClick={()=>setReviewing(v=>!v)} aria-expanded={reviewing}>{reviewing?'Paslēpt sarakstu':'Pārskatīt'}</button>}
   {!bulkProgress&&<button type="button" className="button primary" onClick={()=>onAcceptMany(confident)}>Apstiprināt visas ({confident.length})</button>}
  </div>}
  {view==='issues'&&reviewing&&!bulkProgress&&confident.length>0&&<ul className="mapping-bulk-list">
   {confident.map(({group,candidate})=><li key={group.key}>
    <strong>{group.alias}</strong> → {candidate.label||candidate.displayName}
    <small>{[candidate.source||'Adrešu meklēšana',candidate.displayName!==candidate.label&&candidate.displayName,group.events.length+(group.events.length===1?' pasākums':' pasākumi')].filter(Boolean).join(' · ')}</small>
    <a href={'https://www.openstreetmap.org/?mlat='+candidate.latitude+'&mlon='+candidate.longitude+'#map=17/'+candidate.latitude+'/'+candidate.longitude} target="_blank" rel="noreferrer">Kartē ↗</a>
   </li>)}
  </ul>}
  {view==='issues'&&<div className="admin-mapping-mobile-cards">{filteredGroups.map(group=><article key={group.key} className="admin-mapping-mobile-card">
    <div><span className="quality-badge bad">Jālabo</span><strong>{group.alias||'Nav adreses'}</strong><small>{group.municipality||group.countryCode||'Konteksts nav noteikts'} · {group.events.length} pasākumi</small>{group.alias&&onAcceptSuggestion&&<Suggestion group={group} onAccept={onAcceptSuggestion}/>}</div>
    <button type="button" className="button primary compact" onClick={()=>group.alias?onMap(group):onEditEvent(group.events[0])}>Labot vietu ↗</button>
   </article>)}</div>}
  {view==='issues'&&<div className="table-scroll admin-mapping-table-wrap" role="region" aria-label="Neatpazīto adrešu mapping" tabIndex={0}>
   <table className="events-table admin-mapping-table">
    <thead><tr><th>Statuss</th><th>Ielasītais nosaukums</th><th>Konteksts</th><th>Avoti</th><th>Aktuālie pasākumi</th><th>Ieteikums</th><th>Darbība</th></tr></thead>
    <tbody>
     {filteredGroups.length?filteredGroups.map(group=><tr key={group.key} className="mapping-needs-review">
      <td><span className="quality-badge bad">Jālabo</span></td>
      <td><strong>{group.alias||'Nav vietas/adreses'}</strong>{group.sampleAddress&&group.sampleAddress!==group.alias&&<small className="table-subline">{group.sampleAddress}</small>}</td>
      <td>{group.municipality||'—'}<small className="table-subline">{group.countryCode||'—'}</small></td>
      <td>{group.sources.join(', ')||'—'}</td>
      <td><strong>{group.events.length}</strong><small className="table-subline">{group.firstDate||'—'} → {group.lastDate||'—'}</small></td>
      <td>{group.alias&&onAcceptSuggestion?<Suggestion group={group} onAccept={onAcceptSuggestion}/>:group.qualities.map(value=><span key={value} className="quality-badge bad">{value}</span>)}</td>
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
