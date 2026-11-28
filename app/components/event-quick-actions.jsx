'use client';
import {track} from '../../lib/analytics.js';
import {useEffect,useMemo,useState} from 'react';
import {icsContent,navigationLinks} from '../../lib/meets-personal.js';
import {eventShareUrl,eventShareTargets,officialEventUrl} from '../../lib/event-sharing.js';
import {filterRegistryEvents} from '../../lib/registry-filters.js';
import {isManualCollection,eventInCollection} from '../../lib/personal-collections.js';
import {refreshSession} from '../../lib/auth-client.js';
import SharedIcon from './line-icon.jsx';

const FAVORITES_KEY='meets_favorites_v1';
const SESSION_KEY='meets_user_session_v1';
// The action icons come from the shared set (lib/icon-paths.js); the calendar
// button shows the calendar with a plus.
function Icon({name}){return <SharedIcon name={name==='calendar'?'calendar-add':name} size={18} strokeWidth={1.5}/>;}
export function saveIcs(event){
 const str=icsContent(event);if(!str)return false;
 const blob=new Blob([str],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='meets-'+event.id+'.ics';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
}
export async function copyLink(value){
 if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return;}
 const field=document.createElement('textarea');field.value=value;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const success=document.execCommand('copy');field.remove();if(!success)throw new Error('Kopēšana nav pieejama');
}
function sessionRead(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch{return null;}}

export default function EventQuickActions({event,saved,onSave,onCalendar,compact=false,disabledFavorite=false,favoriteOnly=false,listOnly=false,quiet=false,noFavorite=false,noOfficial=false,leading=null}){
 const [localSaved,setLocalSaved]=useState(false),[busy,setBusy]=useState(false),[menu,setMenu]=useState(''),[status,setStatus]=useState('');
 const [registries,setRegistries]=useState([]),[listLoading,setListLoading]=useState(false),[newList,setNewList]=useState('');
 const controlled=typeof saved==='boolean'&&typeof onSave==='function',isSaved=controlled?saved:localSaved;
 const links=navigationLinks(event),official=officialEventUrl(event),url=eventShareUrl(event,typeof window!=='undefined'?window.location.origin:undefined),targets=eventShareTargets(event,url);
 const personalLists=useMemo(()=>registries.filter(isManualCollection),[registries]);

 useEffect(()=>{
  const refresh=()=>{try{const values=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');setLocalSaved(Array.isArray(values)&&values.map(String).includes(String(event.id)));}catch{setLocalSaved(false);}};
  refresh();window.addEventListener('storage',refresh);window.addEventListener('meets-favorites-changed',refresh);
  return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('meets-favorites-changed',refresh);};
 },[event.id]);

 async function favorite(){
  if(busy||disabledFavorite)return;if(controlled){onSave(event.id);return;}
  const next=!isSaved;setBusy(true);setStatus('');
  try{
   const old=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]'),values=new Set(Array.isArray(old)?old.map(String):[]);
   next?values.add(String(event.id)):values.delete(String(event.id));
   let session=sessionRead();
   if(session?.access_token){
    if(session.expires_at&&session.expires_at<Date.now()+120000&&session.refresh_token){
     try{session=await refreshSession(session.refresh_token);}catch{throw Error('Pieslēdzies atkārtoti, lai saglabātu kontā.');}
     localStorage.setItem(SESSION_KEY,JSON.stringify(session));
    }
    const res=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:next?'add':'remove',token:session.access_token,eventId:event.id})});if(!res.ok)throw Error('Saglabāšana kontā neizdevās.');
   }
   localStorage.setItem(FAVORITES_KEY,JSON.stringify([...values]));setLocalSaved(next);window.dispatchEvent(new Event('meets-favorites-changed'));
   if(next)track('save_event',{item_id:event.id,item_category:event.primary_category,municipality:event.municipality});
  }catch(e){setStatus(e?.message||'Neizdevās saglabāt pasākumu.');}finally{setBusy(false);}
 }
 function calendar(){setStatus('');if(onCalendar)onCalendar(event);else if(!saveIcs(event))setStatus('Kalendāra ieraksts nav pieejams.');}
 async function share(){
  setStatus('');if(navigator.share){try{await navigator.share({title:event.title||'meets.lv pasākums',url});setMenu('');return;}catch(e){if(e?.name==='AbortError')return;}}
  setMenu(previous=>previous==='share'?'':'share');
 }
 async function copy(){try{await copyLink(url);setStatus('Pasākuma saite nokopēta.');setMenu('');}catch{setStatus('Neizdevās kopēt.');}}

 async function loadLists(){
  const session=sessionRead();
  if(!session?.access_token){setStatus('Pieslēdzies meets.lv kontā, lai pievienotu pasākumu sarakstam.');setMenu('lists');return;}
  setListLoading(true);setStatus('');
  try{
   const r=await fetch('/api/registries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'list',token:session.access_token})});
   const b=await r.json();if(!r.ok)throw Error(b.error||'Sarakstus neizdevās ielādēt.');setRegistries(b.registries||[]);setMenu('lists');
  }catch(e){setStatus(e.message);}finally{setListLoading(false);}
 }
 function belongs(item){return isManualCollection(item)?eventInCollection(item,event.id):filterRegistryEvents([event],item.filters||{},item.included_event_ids||[],item.excluded_event_ids||[]).length>0;}
 async function toggleList(item){
  const session=sessionRead();if(!session?.access_token)return;
  const enabled=!belongs(item);setListLoading(true);setStatus('');
  try{
   const r=await fetch('/api/registries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'toggleEvent',token:session.access_token,id:item.id,event_id:event.id,enabled})});
   const b=await r.json();if(!r.ok)throw Error(b.error||'Sarakstu neizdevās atjaunināt.');
   setRegistries(all=>all.map(x=>x.id===item.id?b.registry:x));setStatus(enabled?'Pievienots sarakstam.':'Izņemts no saraksta. Pasākums nav dzēsts.');
  }catch(e){setStatus(e.message);}finally{setListLoading(false);}
 }
 async function createList(e){
  e.preventDefault();const title=newList.trim();if(title.length<3)return;
  const session=sessionRead();if(!session?.access_token)return;
  setListLoading(true);setStatus('');
  try{
   const r=await fetch('/api/registries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'createQuick',token:session.access_token,title,event_id:event.id})});
   const b=await r.json();if(!r.ok)throw Error(b.error||'Sarakstu neizdevās izveidot.');
   setRegistries(all=>[b.registry,...all]);setNewList('');setStatus('Izveidots jauns saraksts un pasākums tam pievienots.');
  }catch(e){setStatus(e.message);}finally{setListLoading(false);}
 }

 if(favoriteOnly)return <span className="meets-card-favorite">
  <button type="button" className={'meets-card-favorite-button'+(isSaved?' is-saved':'')}
   aria-label={isSaved?'Noņemt no saglabātajiem':'Saglabāt pasākumu'}
   aria-pressed={isSaved} title={isSaved?'Noņemt no saglabātajiem':'Saglabāt pasākumu'}
   disabled={busy||disabledFavorite} onClick={favorite}><Icon name="heart"/></button>
  {status&&<small className="meets-card-favorite-status" role="status">{status}</small>}
 </span>;
 const listPicker=menu==='lists'&&<div className="meets-list-picker" role="group" aria-label="Pievienot pasākumu sarakstam">
  {sessionRead()?.access_token?<><strong>Pievienot manam sarakstam</strong>
   {personalLists.map(item=><label key={item.id}><input type="checkbox" checked={belongs(item)} disabled={listLoading} onChange={()=>toggleList(item)}/><span>{item.title}</span></label>)}
   {!personalLists.length&&<small>Vēl nav manuālu sarakstu — izveido pirmo!</small>}
   <form onSubmit={createList}><input value={newList} maxLength={120} onChange={e=>setNewList(e.target.value)} placeholder="Jauns saraksts" aria-label="Jauna saraksta nosaukums"/><button type="submit" disabled={listLoading||newList.trim().length<3}>+ Izveidot</button></form>
   <a href="/mani-registri">Atvērt manas kolekcijas →</a></>:<a href="/profils">Pieslēgties, lai veidotu sarakstus →</a>}
 </div>;
 if(listOnly)return null;
 /* Collection picker is hidden while the personal experience uses one shared event list. */
 if(false)return <div className="meets-card-list-trigger">
  <button type="button" className="meets-add-to-list" aria-label={'Pievienot sarakstam: '+event.title}
   aria-expanded={menu==='lists'} disabled={listLoading} onClick={()=>menu==='lists'?setMenu(''):loadLists()}>
   <Icon name="list"/> Pievienot sarakstam
  </button>{listPicker}{status&&<small role="status" className="meets-card-list-status">{status}</small>}
 </div>;
  const opts=[{label:'WhatsApp',href:targets.whatsapp},{label:'Messenger',href:targets.messenger},{label:'Telegram',href:targets.telegram},{label:'Facebook',href:targets.facebook},{label:'X',href:targets.x}];
 return <div className={'meets-event-actions-wrapper'+(compact?' compact':'')+(quiet?' meets-quiet-actions':'')}>
  <div className="meets-event-action-grid meets-circle-actions" role="group" aria-label={'Pasākuma darbības: '+(event.title||'Pasākums')}>
   {leading}
   {!noFavorite&&<button type="button" className="meets-circle-action" aria-pressed={isSaved} aria-label={isSaved?'Noņemt no saglabātajiem':'Saglabāt pasākumu'} title={isSaved?'Noņemt no saglabātajiem':'Saglabāt'} disabled={busy||disabledFavorite} onClick={favorite}><Icon name="heart"/><small className="meets-quiet-label">Saglabāt</small></button>}
   <button type="button" className="meets-circle-action" aria-label="Pievienot kalendāram" title="Kalendārā" onClick={calendar}><Icon name="calendar"/><small className="meets-quiet-label">Kalendārs</small></button>
   <button type="button" className="meets-circle-action" aria-label="Norādes uz norises vietu" title="Norādes" aria-expanded={menu==='route'} disabled={!links.google} onClick={()=>{setStatus('');setMenu(previous=>previous==='route'?'':'route');}}><Icon name="pin"/><small className="meets-quiet-label">Norādes</small></button>
   {noOfficial?null:official?<a className="meets-circle-action" href={official} target="_blank" rel="noopener noreferrer" aria-label="Rīkotāja lapa (atveras jaunā cilnē)" title="Rīkotāja lapa"><Icon name="external"/><small className="meets-quiet-label">Rīkotāja lapa</small></a>:<span className="meets-circle-action disabled" aria-label="Nav rīkotāja lapas" title="Nav rīkotāja lapas"><Icon name="external"/><small className="meets-quiet-label">Rīkotāja lapa</small></span>}
   <button type="button" className="meets-circle-action" aria-label="Dalīties ar pasākumu" aria-expanded={menu==='share'} title="Dalīties" onClick={share}><Icon name="share"/><small className="meets-quiet-label">Dalīties</small></button>
  </div>
  {menu==='route'&&<div className="meets-circle-options" role="group" aria-label="Norāžu izvēle"><a href={links.google} target="_blank" rel="noopener noreferrer">Google Maps ↗</a>{links.waze&&<a href={links.waze} target="_blank" rel="noopener noreferrer">Waze ↗</a>}</div>}
  {menu==='share'&&<div className="meets-circle-options" role="group" aria-label="Kopīgot pasākumu">{opts.map(option=><a href={option.href} key={option.label} target="_blank" rel="noopener noreferrer">{option.label}</a>)}<button type="button" onClick={copy}>Kopēt saiti <SharedIcon name="copy" size={15}/></button></div>}
  {status&&<p className="meets-circle-feedback" role="status">{status}</p>}
 </div>;
}
