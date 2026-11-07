'use client';
import {useMemo,useState} from 'react';

function when(value){
 if(!value)return '—';
 try{return new Date(value).toLocaleDateString('lv-LV',{day:'2-digit',month:'2-digit',year:'numeric'});}catch{return '—';}
}

// Every registered organizer, with the permission to publish without review.
export default function AdminOrganizers({organizations=[],onSetTrust,busy=false}){
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState('');
 const list=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase('lv');
  return organizations.filter(o=>
   (!filter||(filter==='trusted'?o.trusted:filter==='suggested'?o.suggested:!o.trusted))&&
   (!q||[o.name,o.owner_email].some(v=>String(v||'').toLocaleLowerCase('lv').includes(q))));
 },[organizations,query,filter]);
 const trustedCount=organizations.filter(o=>o.trusted).length;
 const suggestedCount=organizations.filter(o=>o.suggested).length;

 function toggle(org){
  const next=!org.trusted;
  const text=next
   ?`Atļaut “${org.name}” publicēt pasākumus bez MEETS pārbaudes?\nPasākumi parādīsies kartē uzreiz, ja automātiskās pārbaudes (vieta, datums, cena, dublikāti) būs kārtībā. Rīkotājs to redzēs pirms iesniegšanas.`
   :`Atcelt “${org.name}” atļauju? Turpmāk visi pasākumi atkal tiks pārbaudīti.`;
  if(window.confirm(text))onSetTrust(org,next);
 }

 return <section className="admin-organizers">
  <div className="admin-sheet-intro compact"><div>
   <p className="eyebrow">Rīkotāji</p>
   <h2>Reģistrētie rīkotāji</h2>
   <p>Uzticamie rīkotāji publicē bez papildu pārbaudes — pasākums kartē parādās uzreiz, ja automātiskās pārbaudes ir kārtībā. Pirms iesniegšanas rīkotājs redz brīdinājumu, ka pārbaude nenotiks.</p>
  </div></div>
  <div className="admin-toolbar">
   <label>Meklēt<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nosaukums vai e-pasts"/></label>
   <div className="admin-bucket-tabs" role="group" aria-label="Rīkotāju filtrs">
    {[['','Visi',organizations.length],['trusted','Publicē bez pārbaudes',trustedCount],['suggested','Ieteikts uzticēties',suggestedCount],['review','Ar pārbaudi',organizations.length-trustedCount]].map(([key,label,count])=>
     <button key={key} type="button" aria-pressed={filter===key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label} <span>{count}</span></button>)}
   </div>
  </div>
  <div className="table-scroll" role="region" aria-label="Rīkotāji" tabIndex={0}>
   <table className="events-table admin-organizers-table">
    <thead><tr><th>Rīkotājs</th><th>Īpašnieks</th><th>Publicēti</th><th>Gaida</th><th>Noraidīti / lūgts precizēt</th><th>Pēdējais iesniegums</th><th>Publicēšana</th></tr></thead>
    <tbody>{list.length?list.map(org=><tr key={org.id} className={org.trusted?'org-trusted':''}>
     <td><strong>{org.name}</strong>{org.suggested&&!org.trusted&&<small className="table-subline">Ieteikts: 3+ publicēti bez labojumiem</small>}</td>
     <td>{org.owner_email||'—'}</td>
     <td>{org.published??0}</td>
     <td>{org.pending??0}</td>
     <td>{(org.declined??0)+' / '+(org.changes_requested??0)}</td>
     <td>{when(org.last_submitted_at)}</td>
     <td><label className="admin-trust-toggle">
      <input type="checkbox" checked={org.trusted===true} disabled={busy} onChange={()=>toggle(org)}/>
      <span>{org.trusted?'Bez pārbaudes'+(org.trusted_at?' kopš '+when(org.trusted_at):''):'Ar pārbaudi'}</span>
     </label></td>
    </tr>):<tr><td colSpan={7}><p className="admin-empty-inline">Nav rīkotāju pēc šī filtra.</p></td></tr>}</tbody>
   </table>
  </div>
 </section>;
}
