'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import Authentication from '../../components/account-auth-flow.jsx';
import {accountRequest,useAccountSession} from '../../../lib/account-store.js';
import {cardDate,cardLocation} from '../../../lib/discovery-card.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Roles that may add events for an organizer (meets_org_can_edit).
const EDITORS=new Set(['owner','admin','editor']);

// "Tas ir mans pasākums": an organizer asks MEETS to give an imported event to
// their organizer profile. After an admin approves it, the event shows the
// organizer and can be completed in the organizer workspace.
export default function ClaimEvent(){
 const id=useSearchParams().get('event')||'';
 const {session,ready}=useAccountSession();
 const [event,setEvent]=useState(null),[eventError,setEventError]=useState('');
 const [orgs,setOrgs]=useState(null),[orgId,setOrgId]=useState('');
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);

 useEffect(()=>{
  if(!UUID.test(id)){setEventError('Pasākums nav norādīts.');return;}
  fetch('/api/events/'+encodeURIComponent(id)).then(r=>r.json().then(d=>({ok:r.ok,d}))).then(({ok,d})=>{
   if(!ok||!d.event)setEventError(d.error||'Pasākums nav atrasts.');
   else if(d.event.organization_id)setEventError('Šim pasākumam jau ir rīkotājs.');
   else setEvent(d.event);
  }).catch(()=>setEventError('Pasākumu neizdevās ielādēt.'));
 },[id]);

 useEffect(()=>{
  if(!session)return;
  accountRequest('/api/organizer','list').then(data=>{
   const list=(data.organizations||[]).filter(o=>EDITORS.has(o.role));
   setOrgs(list);setOrgId(current=>current||list[0]?.id||'');
  }).catch(e=>{setOrgs([]);setError(e.message);});
 },[session]);

 async function submit(e){
  e.preventDefault();setBusy(true);setError('');
  try{await accountRequest('/api/organizer','claimEvent',{event_id:id,organization_id:orgId,message});setDone(true);}
  catch(err){setError(err.message);}
  finally{setBusy(false);}
 }

 return <section className="meets-claim-page" aria-labelledby="claim-title">
  <p className="eyebrow">MEETS · RĪKOTĀJIEM</p>
  <h1 id="claim-title">Tas ir mans pasākums</h1>
  <p className="meets-muted">Šis pasākums MEETS ir nonācis no publiska kalendāra. Kad apstiprināsim, ka to rīko tava organizācija, tas būs redzams ar tavu rīkotāja vārdu, un savā rīkotāja vidē varēsi pievienot attēlu, aprakstu un cenu.</p>

  {eventError?<p className="meets-inline-error" role="alert">{eventError} <Link href="/pasakumi">Uz pasākumiem →</Link></p>
   :!event?<p role="status">Ielādē pasākumu…</p>
   :<div className="meets-claim-event">
    <strong>{event.title}</strong>
    <span>{cardDate(event)} · {cardLocation(event)}</span>
    <Link href={'/pasakumi/'+encodeURIComponent(event.id)}>Skatīt pasākumu</Link>
   </div>}

  {event&&!eventError&&(done?<div className="meets-claim-done" role="status">
    <h2>Pieteikums nosūtīts</h2>
    <p>Pārbaudīsim to parasti 1–2 darba dienu laikā un paziņosim uz e-pastu. Kad pasākums būs piešķirts, tas parādīsies tavā rīkotāja vidē.</p>
    <Link className="button primary" href={'/organizators?org='+encodeURIComponent(orgId)}>Uz rīkotāja vidi →</Link>
   </div>
   :!ready?<p role="status">Pārbauda pieslēgšanos…</p>
   :!session?<div className="meets-claim-auth"><h2>Pieslēdzies, lai turpinātu</h2><Authentication onSuccess={()=>{}}/></div>
   :orgs===null?<p role="status">Ielādē tavus rīkotājus…</p>
   :!orgs.length?<div className="meets-claim-empty">
     <p>Tev vēl nav rīkotāja profila, kurā vari pievienot pasākumus. Izveido to un atgriezies šeit.</p>
     <Link className="button primary" href="/organizators">Izveidot rīkotāju →</Link>
    </div>
   :<form className="meets-claim-form" onSubmit={submit}>
     <label>Rīkotājs
      <select value={orgId} onChange={e=>setOrgId(e.target.value)} required>
       {orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
     </label>
     <label>Kā varam pārliecināties, ka pasākumu rīkojat jūs? <small>(nav obligāti)</small>
      <textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={1000} rows={4}
       placeholder="Piem., esam kultūras nama vadība; pasākums ir mūsu mājaslapā."/>
     </label>
     {error&&<p className="meets-inline-error" role="alert">{error}</p>}
     <button className="button primary" type="submit" disabled={busy||!orgId}>{busy?'Sūta…':'Nosūtīt pieteikumu'}</button>
    </form>)}
 </section>;
}
