'use client';

import {useEffect,useState} from 'react';
import {adminRpc} from '../../lib/admin-auth.js';

function dateText(value){
 if(!value)return '';
 try{return new Intl.DateTimeFormat('lv-LV',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Riga'}).format(new Date(String(value).length===10?value+'T12:00:00':value));}
 catch{return String(value);}
}
// Postgres errors come back as JSON text; the message is what the admin needs.
function errorText(error){
 try{return JSON.parse(error.message).message||error.message;}catch{return error?.message||'Darbība neizdevās.';}
}

// "Tas ir mans pasākums": organizers asking for an imported event. Approving makes
// the event a published submission of that organizer (meets_admin_decide_event_claim).
export default function AdminEventClaims({supabaseUrl,publishableKey}){
 const [claims,setClaims]=useState(null);
 const [notes,setNotes]=useState({});
 const [busy,setBusy]=useState('');
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');

 async function load(){
  try{setClaims(await adminRpc(supabaseUrl,publishableKey,'meets_admin_event_claims',{})||[]);}
  catch(e){setError(errorText(e));setClaims([]);}
 }
 useEffect(()=>{load();},[]);

 async function decide(claim,approve){
  setBusy(claim.id);setError('');setMessage('');
  try{
   await adminRpc(supabaseUrl,publishableKey,'meets_admin_decide_event_claim',{p_claim:claim.id,p_approve:approve,p_note:notes[claim.id]||''});
   setMessage(approve?'Pasākums piešķirts rīkotājam “'+claim.organization_name+'”.':'Pieteikums noraidīts.');
   await load();
  }catch(e){setError(errorText(e));}
  finally{setBusy('');}
 }

 if(claims===null)return <section className="admin-panel admin-event-claims" aria-busy="true"><p role="status">Ielādē rīkotāju pieteikumus…</p></section>;
 const pending=claims.filter(c=>c.status==='pending');
 const decided=claims.filter(c=>c.status!=='pending');
 if(!claims.length&&!error)return null;
 return <section className="admin-panel admin-event-claims" aria-labelledby="admin-claims-title">
  <header className="admin-panel-head">
   <h2 id="admin-claims-title">“Tas ir mans pasākums” <span className="admin-count">{pending.length}</span></h2>
   <p className="meets-muted">Rīkotāji piesaka importētus pasākumus. Pēc apstiprināšanas pasākums parādās ar rīkotāja vārdu, un rīkotājs to var papildināt savā vidē.</p>
  </header>
  {message&&<p className="admin-inline-ok" role="status">{message}</p>}
  {error&&<p className="meets-inline-error" role="alert">{error}</p>}
  {pending.length?<ul className="admin-claim-list">
   {pending.map(claim=><li key={claim.id} className="admin-claim">
    <div className="admin-claim-main">
     <strong><a href={'/pasakumi/'+encodeURIComponent(claim.event_id)} target="_blank" rel="noreferrer">{claim.title}</a></strong>
     <small>{dateText(claim.date_from)}{claim.venue_name?' · '+claim.venue_name:''}{claim.source_url?<> · <a href={claim.source_url} target="_blank" rel="noreferrer">avots ↗</a></>:null}</small>
     <p>Piesaka <strong>{claim.organization_name}</strong>{claim.organization_public?'':' (rīkotāja profils nav publisks)'} · {claim.user_email||'—'} · {dateText(claim.created_at)}</p>
     {claim.message&&<blockquote>{claim.message}</blockquote>}
     {!claim.claimable&&<p className="meets-inline-error">Pasākumu vairs nevar piešķirt: tas jau pieder rīkotājam vai ir beidzies.</p>}
    </div>
    <div className="admin-claim-actions">
     <label>Piezīme rīkotājam<input value={notes[claim.id]||''} maxLength={1000} onChange={e=>setNotes(n=>({...n,[claim.id]:e.target.value}))}/></label>
     <button type="button" className="button primary compact" disabled={busy===claim.id||!claim.claimable} onClick={()=>decide(claim,true)}>Apstiprināt</button>
     <button type="button" className="button compact" disabled={busy===claim.id} onClick={()=>decide(claim,false)}>Noraidīt</button>
    </div>
   </li>)}
  </ul>:<p className="meets-muted">Neizskatītu pieteikumu nav.</p>}
  {decided.length>0&&<details className="admin-claims-history"><summary>Pēdējās 30 dienās izskatīti: {decided.length}</summary>
   <ul>{decided.map(claim=><li key={claim.id}>{claim.status==='approved'?'Apstiprināts':'Noraidīts'} · {claim.title} · {claim.organization_name} · {dateText(claim.decided_at)}{claim.admin_note?' · '+claim.admin_note:''}</li>)}</ul>
  </details>}
 </section>;
}
