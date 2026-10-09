'use client';
import {useState} from 'react';
export default function AdminUserSubmissions({items=[],onReview,busy=false}){
 const [notes,setNotes]=useState({}),[coords,setCoords]=useState({});
 const pending=items.filter(x=>x.status==='pending_review');
 return <section className="meets-admin-submissions">
  <div className="admin-sheet-intro"><div><p className="eyebrow">Organizatori</p><h2>Lietotāju pasākumi</h2><p>Jaunus pasākumus kartē publicē tikai pēc datu un koordinātu pārbaudes.</p></div></div>
  <div className="meets-organizer-review-list">
   {!pending.length&&<p className="meets-muted">Nav pasākumu, kas gaida apstiprināšanu.</p>}
   {pending.map(item=>{
    const lat=coords[item.id]?.latitude??(item.latitude??'');
    const lon=coords[item.id]?.longitude??(item.longitude??'');
    const valid=lat!==''&&lon!==''&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))&&Number(lat)>=55&&Number(lat)<=59&&Number(lon)>=20&&Number(lon)<=29;
    return <article key={item.id} className="meets-organizer-review-card">
     <div className="meets-organizer-review-head"><div><h3>{item.title}</h3><p>{item.organization_name} · {item.date_from} {item.time_from||''}</p></div><span className="meets-organizer-status">Jāpārbauda</span></div>
     <p>{item.description||'Nav apraksta.'}</p>
     <p><strong>⌖ {item.venue_name||'Nav vietas'}</strong> — {item.address||'Nav adreses'}</p>
     <div className="meets-organizer-grid">
      <label>Platums<input type="number" step="any" placeholder="56.9496" value={lat} onChange={e=>setCoords(c=>({...c,[item.id]:{...c[item.id],latitude:e.target.value}}))}/></label>
      <label>Garums<input type="number" step="any" placeholder="24.1052" value={lon} onChange={e=>setCoords(c=>({...c,[item.id]:{...c[item.id],longitude:e.target.value}}))}/></label>
     </div>
     <label>Piezīme organizatoram<input value={notes[item.id]||''} onChange={e=>setNotes(p=>({...p,[item.id]:e.target.value}))} placeholder="Ja nepieciešami labojumi…"/></label>
     <div className="meets-organizer-buttons">
      <button className="button primary" disabled={busy||!valid} title={!valid?'Vispirms pārbaudi koordinātas':undefined} onClick={()=>onReview(item,true,notes[item.id]||'',Number(lat),Number(lon))}>✓ Publicēt</button>
      <button className="button" disabled={busy} onClick={()=>onReview(item,false,notes[item.id]||'')}>Atgriezt labošanai</button>
     </div>
    </article>;
   })}
  </div>
 </section>;
}