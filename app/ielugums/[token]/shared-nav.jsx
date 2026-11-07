'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {accountRequest,currentSession} from '../../../lib/account-store.js';

const EDITOR='/registre-pasakumu/vienkarsi';
const STATUS={private:'Privāts',pending_review:'Gaida MEETS pārbaudi',published:'Publicēts'};

function Arrow(){return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18 9 12l6-6"/></svg>;}
function Building(){return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 21V5l8-3 8 3v16M8 9h2M14 9h2M8 13h2M14 13h2M10 21v-4h4v4"/></svg>;}

// Top of a shared event page. Links open it in a new tab, where the browser
// has nothing to go back to, so "back" leads to the organizer's events (for the
// organizer) or to the public MEETS pages. The organizer also sees that this is
// their own event and how others see it.
export default function SharedEventNav({token,status}){
 const [owner,setOwner]=useState(null);
 const [canGoBack,setCanGoBack]=useState(false);
 useEffect(()=>{
  try{setCanGoBack(window.history.length>1&&Boolean(document.referrer)&&new URL(document.referrer).origin===window.location.origin);}catch{}
  if(!currentSession())return;
  let alive=true;
  accountRequest('/api/organizer','list').then(data=>{
   const item=(data?.submissions||[]).find(s=>s.share_token===token);
   if(!alive||!item)return;
   const org=(data.organizations||[]).find(o=>o.id===item.organization_id);
   setOwner({id:item.id,orgId:item.organization_id,orgName:org?.name||'',canEdit:org&&org.role!=='viewer',status:item.status,eventId:item.event_id});
  }).catch(()=>{});
  return()=>{alive=false;};
 },[token]);

 const fallback=owner?'/organizators?org='+owner.orgId+'&panel=events':'/pasakumi';
 const backLabel=owner?'Atpakaļ uz maniem pasākumiem':'Atpakaļ';
 function back(event){
  if(!canGoBack)return;
  event.preventDefault();
  window.history.back();
 }
 const editable=owner?.canEdit&&['private','pending_review','published','draft','rejected'].includes(owner.status);

 return <>
  <nav className={'shared-nav'+(owner?' is-owner':'')} aria-label="Pasākuma lapas navigācija">
   <a className="shared-nav-back" href={fallback} onClick={back} aria-label={backLabel} title={backLabel}><Arrow/></a>
   {owner?<div className="shared-nav-owner">
    <small><Building/> Rīkotāja skats</small>
    <strong>{owner.orgName||'Tavs pasākums'}</strong>
   </div>:<div className="shared-nav-public">
    <small>MEETS pasākums</small>
    <strong>Kopīgots ar saiti</strong>
   </div>}
   <div className="shared-nav-links">
    {owner?<>
     {editable&&<Link className="shared-nav-link" href={EDITOR+'?org='+owner.orgId+'&edit='+owner.id}>Labot</Link>}
     <Link className="shared-nav-link" href={fallback}>Mani pasākumi</Link>
    </>:<>
     <Link className="shared-nav-link" href="/pasakumi">Visi pasākumi</Link>
     <Link className="shared-nav-link" href="/karte">Karte</Link>
    </>}
   </div>
  </nav>
  {owner&&<p className="shared-owner-note" role="note">
   Tu redzi lapu tā, kā to redz {status==='private'?'tie, kam nosūtīsi saiti':'apmeklētāji'}. Statuss: <strong>{STATUS[owner.status]||STATUS[status]||owner.status}</strong>.
   {owner.status==='published'&&owner.eventId?<> <Link href={'/pasakumi/'+owner.eventId}>Publiskā lapa MEETS sarakstā →</Link></>:null}
  </p>}
 </>;
}
