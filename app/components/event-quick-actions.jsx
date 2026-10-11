'use client';
import {useEffect,useState} from 'react';
import {icsContent,navigationLinks} from '../../lib/meets-personal.js';
import {eventShareUrl,eventShareTargets,officialEventUrl} from '../../lib/event-sharing.js';

const FAVORITES_KEY='meets_favorites_v1';
function Icon({name}){
 const props={viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true};
 switch(name){
  case 'heart':return <svg {...props}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>;
  case 'calendar':return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M12 13v5M9.5 15.5h5"/></svg>;
  case 'pin':return <svg {...props}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.8"/></svg>;
  case 'external':return <svg {...props}><path d="M13 5h6v6M19 5l-9 9"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>;
  default:return <svg {...props}><circle cx="18" cy="5" r="2.2"/><circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="m8 11 8-5m-8 8 8 4"/></svg>;
 }
}
function saveIcs(event){
 const str=icsContent(event);
 if(!str)return false;
 const blob=new Blob([str],{type:'text/calendar;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='meets-'+event.id+'.ics';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 return true;
}
async function copyLink(value){
 if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return;}
 const field=document.createElement('textarea');field.value=value;field.style.position='fixed';field.style.opacity='0';
 document.body.appendChild(field);field.select();
 const success=document.execCommand('copy');field.remove();
 if(!success)throw new Error('Kopēšana nav pieejama');
}

// Used by event cards, saved events, and shared lists. A controlled favorite
// prop preserves the existing map/account flow; guests can still save locally.
export default function EventQuickActions({event,saved,onSave,onCalendar,compact=false,disabledFavorite=false}){
 const [localSaved,setLocalSaved]=useState(false);
 const [busy,setBusy]=useState(false);
 const [menu,setMenu]=useState('');
 const [status,setStatus]=useState('');
 const controlled=typeof saved==='boolean'&&typeof onSave==='function';
 const isSaved=controlled?saved:localSaved;
 const links=navigationLinks(event);
 const official=officialEventUrl(event);
 const url=eventShareUrl(event,typeof window!=='undefined'?window.location.origin:undefined);
 const targets=eventShareTargets(event,url);

 useEffect(()=>{
  const refresh=()=>{
   try{const values=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');setLocalSaved(Array.isArray(values)&&values.map(String).includes(String(event.id)));}
   catch{setLocalSaved(false);}
  };
  refresh();
  window.addEventListener('storage',refresh);
  window.addEventListener('meets-favorites-changed',refresh);
  return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('meets-favorites-changed',refresh);};
 },[event.id]);

 async function favorite(){
  if(busy||disabledFavorite)return;
  if(controlled){onSave(event.id);return;}
  const next=!isSaved;
  setBusy(true);setStatus('');
  try{
   const old=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');
   const values=new Set(Array.isArray(old)?old.map(String):[]);
   if(next)values.add(String(event.id));else values.delete(String(event.id));
   // Persist to the signed-in account when available.
   let session=null;
   try{session=JSON.parse(localStorage.getItem('meets_user_session_v1')||'null');}catch{}
   if(session?.access_token){
    if(session.expires_at&&session.expires_at<Date.now()+120000&&session.refresh_token){
     const res=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh',token:session.refresh_token})});
     if(!res.ok)throw Error('Pieslēdzies atkārtoti, lai saglabātu kontā.');
     const value=await res.json();
     session={...value,expires_at:Date.now()+(value.expires_in||3600)*1000};
     localStorage.setItem('meets_user_session_v1',JSON.stringify(session));
    }
    const res=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:next?'add':'remove',token:session.access_token,eventId:event.id})});
    if(!res.ok)throw Error('Saglabāšana kontā neizdevās.');
   }
   localStorage.setItem(FAVORITES_KEY,JSON.stringify([...values]));
   setLocalSaved(next);
   window.dispatchEvent(new Event('meets-favorites-changed'));
  }catch(e){setStatus(e?.message||'Neizdevās saglabāt pasākumu.');}
  finally{setBusy(false);}
 }
 function calendar(){
  setStatus('');
  if(onCalendar)onCalendar(event);
  else if(!saveIcs(event))setStatus('Kalendāra ieraksts nav pieejams.');
 }
 async function share(){
  setStatus('');
  if(navigator.share){
   try{await navigator.share({title:event.title||'MEETS pasākums',url});setMenu('');return;}
   catch(e){if(e?.name==='AbortError')return;}
  }
  setMenu(previous=>previous==='share'?'':'share');
 }
 async function copy(){
  try{await copyLink(url);setStatus('Pasākuma saite nokopēta.');setMenu('');}
  catch{setStatus('Neizdevās kopēt. Atver pasākuma saiti: '+url);}
 }
 const opts=[
  {label:'WhatsApp',href:targets.whatsapp},
  {label:'Messenger',href:targets.messenger},
  {label:'Telegram',href:targets.telegram},
  {label:'Facebook',href:targets.facebook},
  {label:'X',href:targets.x}
 ];
 return <div className={'meets-event-actions-wrapper'+(compact?' compact':'')}>
  <div className="meets-event-action-grid meets-circle-actions" role="group" aria-label={'Pasākuma darbības: '+(event.title||'Pasākums')}>
   <button type="button" className="meets-circle-action" aria-pressed={isSaved}
    aria-label={isSaved?'Noņemt no saglabātajiem':'Saglabāt pasākumu'}
    title={isSaved?'Noņemt no saglabātajiem':'Saglabāt'} disabled={busy||disabledFavorite}
    onClick={favorite}><Icon name="heart"/></button>
   <button type="button" className="meets-circle-action" aria-label="Pievienot kalendāram"
    title="Kalendārā" onClick={calendar}><Icon name="calendar"/></button>
   <button type="button" className="meets-circle-action" aria-label="Maršruts"
    title="Maršruts" aria-expanded={menu==='route'} disabled={!links.google}
    onClick={()=>{setStatus('');setMenu(previous=>previous==='route'?'':'route');}}><Icon name="pin"/></button>
   {official?<a className="meets-circle-action" href={official} target="_blank" rel="noopener noreferrer"
    aria-label="Oficiālā pasākuma lapa" title="Oficiālā lapa"><Icon name="external"/></a>
    :<span className="meets-circle-action disabled" aria-label="Nav oficiālās saites" title="Nav oficiālās saites"><Icon name="external"/></span>}
   <button type="button" className="meets-circle-action" aria-label="Dalīties ar pasākumu"
    aria-expanded={menu==='share'} title="Dalīties" onClick={share}><Icon name="share"/></button>
  </div>
  {menu==='route'&&<div className="meets-circle-options" role="group" aria-label="Maršruta izvēle">
   <a href={links.google} target="_blank" rel="noopener noreferrer">Google Maps ↗</a>
   {links.waze&&<a href={links.waze} target="_blank" rel="noopener noreferrer">Waze ↗</a>}
  </div>}
  {menu==='share'&&<div className="meets-circle-options" role="group" aria-label="Kopīgot pasākumu">
   {opts.map(option=><a href={option.href} key={option.label} target="_blank" rel="noopener noreferrer">{option.label}</a>)}
   <button type="button" onClick={copy}>Kopēt saiti <span aria-hidden="true">⧉</span></button>
  </div>}
  {status&&<p className="meets-circle-feedback" role="status">{status}</p>}
 </div>;
}
