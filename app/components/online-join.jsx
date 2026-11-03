'use client';
import {useState} from 'react';

export const ONLINE_LABELS={online:'Tiešsaistē',hybrid:'Klātienē un tiešsaistē'};

// How to join an online or hybrid event: the call link and a button to copy it.
export default function OnlineJoin({event,compact=false}){
 const [copied,setCopied]=useState('');
 const mode=event?.attendance_mode;
 if(!ONLINE_LABELS[mode])return null;
 const url=/^https:\/\//.test(String(event.online_url||''))?event.online_url:'';
 async function copy(){
  try{await navigator.clipboard.writeText(url);setCopied('Saite nokopēta.');}
  catch{setCopied('Neizdevās nokopēt — atlasi saiti un nokopē.');}
 }
 return <div className={'online-join'+(compact?' compact':'')}>
  <span className="online-join-mode">
   <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>
   {ONLINE_LABELS[mode]}
  </span>
  {url?<>
   <a className="button primary compact" href={url} target="_blank" rel="noopener noreferrer">Pievienoties zvanam ↗</a>
   <span className="online-join-url"><input readOnly value={url} aria-label="Saite uz zvanu" onFocus={e=>e.target.select()}/>
    <button type="button" className="button compact" onClick={copy}>Kopēt saiti</button></span>
   {copied&&<small role="status">{copied}</small>}
  </>:!compact&&<small className="online-join-note">Pieslēgšanās saiti meklē organizatora lapā.</small>}
 </div>;
}
