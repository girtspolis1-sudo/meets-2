'use client';

import {useEffect,useState} from 'react';
import {adminRpc} from '../../lib/admin-auth.js';
import {kindTone,sortMunicipalities} from '../../lib/admin-sources.js';

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

 async function load(){
  setError('');
  try{const data=await adminRpc(supabaseUrl,publishableKey,'meets_admin_municipality_sources',{});setRows(Array.isArray(data)?data:[]);}
  catch(e){setError(e.message||'Pašvaldību pārskatu neizdevās ielādēt.');}
 }
 useEffect(()=>{load();},[]);

 const counts=rows.reduce((acc,r)=>{acc[r.source_kind]=(acc[r.source_kind]||0)+1;return acc;},{});
 const sorted=sortMunicipalities(rows);

 return <section className="admin-import-health admin-municipality-sources" aria-labelledby="municipality-sources-title">
  <div className="admin-overview-panel-head">
   <div><span>Pašvaldības</span><h3 id="municipality-sources-title">Avoti pa pašvaldībām</h3></div>
   <button type="button" className="button compact" onClick={load}>Atjaunot</button>
  </div>
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}
  <p className="sync-text calendar-feeds-help">{Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${k}: ${n}`).join(' · ')||'Ielādē…'}</p>
  <details open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
   <summary>Rādīt visas {rows.length} pašvaldības</summary>
   <div className="municipality-sources-table-wrap">
    <table className="municipality-sources-table">
     <thead><tr><th>Pašvaldība</th><th>Avots</th><th>Pēdējā ielāde</th><th>Nākotnes</th><th>Publicēti</th><th>Gaida vietu</th><th>Kategorijas bez sasaistes</th></tr></thead>
     <tbody>{sorted.map(r=><tr key={r.id}>
      <td><strong>{r.name}</strong>{r.domains&&<small className="table-subline">{r.domains}</small>}</td>
      <td><span className={'quality-badge '+kindTone(r.source_kind)}>{r.source_kind}</span>
       {r.frequency&&<small className="table-subline">{r.frequency}</small>}
       {r.problem&&<small className="table-subline import-error">{r.problem}</small>}</td>
      <td>{day(r.last_success_at)}</td>
      <td>{r.future_events}</td>
      <td>{r.published_events}</td>
      <td>{r.pending_locations||'—'}</td>
      <td>{r.unmapped_categories||'—'}</td>
     </tr>)}</tbody>
    </table>
   </div>
  </details>
 </section>;
}
