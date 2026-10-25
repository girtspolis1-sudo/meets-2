'use client';
import {useState} from 'react';
import {countOccurrences} from '../../lib/event-schedule.js';
export default function AdminUserSubmissions({items=[],focusedId='',onReview,busy=false,supabaseUrl=''}){
 const [notes,setNotes]=useState({}),[coords,setCoords]=useState({});
 const pending=items.filter(x=>x.status==='pending_review').sort((a,b)=>Number(b.id===focusedId)-Number(a.id===focusedId));
 return <section className="meets-admin-submissions">
  <div className="admin-sheet-intro"><div><p className="eyebrow">Organizatori</p><h2>Lietotāju pasākumi</h2><p>Jaunus pasākumus kartē publicē tikai pēc datu un koordinātu pārbaudes.</p></div></div>
  <div className="meets-organizer-review-list">
   {!pending.length&&<p className="meets-muted">Nav pasākumu, kas gaida apstiprināšanu.</p>}
   {pending.map(item=>{
    const lat=coords[item.id]?.latitude??(item.latitude??'');
    const lon=coords[item.id]?.longitude??(item.longitude??'');
    const valid=lat!==''&&lon!==''&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))&&Number(lat)>=55&&Number(lat)<=59&&Number(lon)>=20&&Number(lon)<=29;
    return <article key={item.id} className={'meets-organizer-review-card'+(item.id===focusedId?' meets-organizer-review-focused':'')}>
     <div className="meets-organizer-review-head"><div><h3>{item.title}</h3><p>{item.organization_name} · {item.date_from} {item.time_from||''}</p></div><span className="meets-organizer-status">Jāpārbauda</span></div>
     <p>{item.description||'Nav apraksta.'}</p>
     {item.cover_image_path&&/^[a-f\d-]+\/[a-f\d-]+\/[a-f\d-]+\.(jpg|png|webp)$/.test(item.cover_image_path)&&supabaseUrl&&<img
      src={supabaseUrl+'/storage/v1/object/public/meets-event-images/'+item.cover_image_path}
      alt="Iesniegtā pasākuma attēls" style={{maxWidth:'100%',maxHeight:240,objectFit:'cover',borderRadius:12}}/>}
     <p><strong>Maksa:</strong> {item.price_status==='free'?'Bezmaksas':item.price_min!=null&&item.price_max!=null?item.price_min+'–'+item.price_max+' EUR':item.price_status||'Nav zināma'}</p>
     {item.schedule_kind==='recurring'&&<section>
      <strong>Atkārtotais grafiks · {item.date_from} – {item.date_to}</strong>
      <p>{(item.recurrence_slots||[]).map(s=>['','Pirmdiena','Otrdiena','Trešdiena','Ceturtdiena','Piektdiena','Sestdiena','Svētdiena'][s.weekday]+' '+s.start+'–'+s.end).join(' · ')}</p>
      <p>{(()=>{try{return countOccurrences(item.date_from,item.date_to,item.recurrence_slots)+' norises reizes tiks publicētas.';}catch{return 'Grafika kļūda. Nepublicēt.';}})()}</p>
     </section>}
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