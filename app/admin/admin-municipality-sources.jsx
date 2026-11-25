'use client';

import {useEffect,useState} from 'react';
import {adminRpc} from '../../lib/admin-auth.js';
import {kindTone,sortMunicipalities,MUNICIPALITY_FILTERS,matchesMunicipalityFilter,municipalityFilterCounts} from '../../lib/admin-sources.js';

function day(value){
 if(!value)return '—';
 try{return new Date(value).toLocaleDateString('lv-LV',{timeZone:'Europe/Riga'});}catch{return String(value).slice(0,10);}
}

// One row per municipality: which source feeds its events (RSS + HTML, HTML,
// ICS, own site or none), how many coming events there are and what waits for
// the admin.
export default function AdminMunicipalitySources({supabaseUrl,publishableKey}){
 const [rows,setRows]=useState([]);
 const [error,setError]=useState('');
 const [open,setOpen]=useState(false);
 const [filter,setFilter]=useState('');
 const [query,setQuery]=useState('');

 async function load(){
  setError('');
  try{const data=await adminRpc(supabaseUrl,publishableKey,'meets_admin_municipality_sources',{});setRows(Array.isArray(data)?data:[]);}
  catch(e){setError(e.message||'Pašvaldību pārskatu neizdevās ielādēt.');}
 }
 useEffect(()=>{load();},[]);

 const filterCounts=municipalityFilterCounts(rows);
 const q=query.trim().toLocaleLowerCase('lv');
 const sorted=sortMunicipalities(rows).filter(r=>matchesMunicipalityFilter(r,filter)&&(!q||[r.name,r.domains].some(v=>String(v||'').toLocaleLowerCase('lv').includes(q))));
 // Choosing a filter opens the table, so the result is visible straight away.
 function choose(key){setFilter(key);if(key)setOpen(true);}

 return <section className="admin-import-health admin-municipality-sources" aria-labelledby="municipality-sources-title">
  <div className="admin-overview-panel-head">
   <div><span>Pašvaldības</span><h3 id="municipality-sources-title">Avoti pa pašvaldībām</h3></div>
   <button type="button" className="button compact" onClick={load}>Atjaunot</button>
  </div>
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}
  {!rows.length&&!error&&<p className="sync-text calendar-feeds-help">Ielādē…</p>}
  <div className="admin-toolbar municipality-sources-toolbar">
   <label>Meklēt<input type="search" value={query} onChange={e=>{setQuery(e.target.value);if(e.target.value)setOpen(true);}} placeholder="Pašvaldība vai domēns"/></label>
   <div className="admin-bucket-tabs" role="group" aria-label="Pašvaldību filtrs pēc avota">
    {MUNICIPALITY_FILTERS.map(f=><button key={f.key} type="button" aria-pressed={filter===f.key} className={filter===f.key?'active':''} onClick={()=>choose(f.key)}>
     {f.label} <span>{filterCounts[f.key]??0}</span></button>)}
   </div>
  </div>
  <details open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
   <summary>{filter||q?'Rādīt atlasītās '+sorted.length+' pašvaldības':'Rādīt visas '+rows.length+' pašvaldības'}</summary>
   <div className="municipality-sources-table-wrap">
    <table className="municipality-sources-table">
     <thead><tr><th>Pašvaldība</th><th>Avots</th><th>Pēdējā ielāde</th><th>Nākotnes</th><th>Publicēti</th><th>Gaida vietu</th><th>Kategorijas bez sasaistes</th></tr></thead>
     <tbody>{sorted.map(r=><tr key={r.id}>
      <td><strong>{r.name}</strong>{r.domains&&<small className="table-subline">{r.domains}</small>}</td>
      <td><span className={'quality-badge '+kindTone(r.source_kind)}>{r.source_kind}</span>
       {r.frequency&&<small className="table-subline">{r.frequency}</small>}
       {r.problem&&<small className="table-subline import-error">{r.problem}</small>}
       {(r.feeds||[]).filter(f=>f.format==='rss').map(f=><small key={f.url} className="table-subline">
        RSS: <a href={f.url} target="_blank" rel="noopener noreferrer">{f.url.replace(/^https?:\/\/(www\.)?/,'')}</a> · {f.last_status==='success'?'strādā':f.last_status==='failed'?'kļūda':'nav nolasīta'}{f.last_success_at?' ('+day(f.last_success_at)+')':''}
       </small>)}</td>
      <td>{day(r.last_success_at)}</td>
      <td>{r.future_events}</td>
      <td>{r.published_events}</td>
      <td>{r.pending_locations||'—'}</td>
      <td>{r.unmapped_categories||'—'}</td>
     </tr>)}</tbody>
    </table>
    {sorted.length===0&&<p className="admin-empty-inline">Nav pašvaldību pēc šī filtra.</p>}
   </div>
  </details>
 </section>;
}
