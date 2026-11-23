'use client';
import {useState} from 'react';
import EventQuickActions,{copyLink,saveIcs} from './event-quick-actions.jsx';
import {eventShareTargets,eventShareUrl} from '../../lib/event-sharing.js';

function Icon({name}){
 const props={viewBox:'0 0 24 24',width:17,height:17,fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true};
 if(name==='calendar')return <svg {...props}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M12 13v4M10 15h4"/></svg>;
 if(name==='copy')return <svg {...props} width={14} height={14}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>;
 return <svg {...props}><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>;
}

// The small buttons at the end of a list row: calendar, save, share. Share
// opens a narrow tray under the row with the networks and "Kopēt saiti".
export default function EventListActions({event}){
 const [open,setOpen]=useState(false),[status,setStatus]=useState('');
 const url=eventShareUrl(event,typeof window!=='undefined'?window.location.origin:undefined);
 const targets=eventShareTargets(event,url);
 const nets=[['WhatsApp',targets.whatsapp],['Messenger',targets.messenger],['Telegram',targets.telegram],['Facebook',targets.facebook],['X',targets.x]].filter(([,href])=>href);
 function calendar(){setStatus(saveIcs(event)?'':'Kalendāra ieraksts nav pieejams.');}
 async function copy(){try{await copyLink(url);setStatus('Saite nokopēta.');}catch{setStatus('Neizdevās nokopēt.');}}
 return <>
  <div className="elist-buttons">
   <button type="button" className="elist-icon" aria-label={'Pievienot kalendāram: '+event.title} title="Kalendārs" onClick={calendar}><Icon name="calendar"/></button>
   <EventQuickActions event={event} favoriteOnly/>
   <button type="button" className={'elist-icon'+(open?' on':'')} aria-label={'Dalīties: '+event.title} title="Dalīties" aria-expanded={open} onClick={()=>{setStatus('');setOpen(v=>!v);}}><Icon name="share"/></button>
  </div>
  {open&&<div className="elist-share" role="group" aria-label={'Dalīties: '+event.title}>
   <span>Dalīties:</span>
   {nets.map(([label,href])=><a key={label} className="elist-chip" href={href} target="_blank" rel="noopener noreferrer">{label}</a>)}
   <button type="button" className="elist-chip" onClick={copy}><Icon name="copy"/>Kopēt saiti</button>
  </div>}
  {status&&<small className="elist-status" role="status">{status}</small>}
 </>;
}
