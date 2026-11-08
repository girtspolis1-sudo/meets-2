'use client';
import {maskPath,track} from '../../lib/analytics.js';
import {useState} from 'react';

function targets(url,text){
 const message=[text,url].filter(Boolean).join(' ');
 return [
  ['Facebook','https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url)],
  ['WhatsApp','https://wa.me/?text='+encodeURIComponent(message)],
  ['Messenger','fb-messenger://share/?link='+encodeURIComponent(url)],
  ['Telegram','https://t.me/share/url?url='+encodeURIComponent(url)+'&text='+encodeURIComponent(text)],
  ['X','https://twitter.com/intent/tweet?url='+encodeURIComponent(url)+'&text='+encodeURIComponent(text)],
  ['LinkedIn','https://www.linkedin.com/sharing/share-offsite/?url='+encodeURIComponent(url)]
 ];
}

// Share a public page: the phone's share sheet when there is one, otherwise a
// small menu with the usual networks and "copy link".
export default function ShareButton({path,title,label='Dalīties',className='button'}){
 const [open,setOpen]=useState(false),[copied,setCopied]=useState(false);
 const url=()=>new URL(path,window.location.origin).toString();
 async function share(){
  if(navigator.share){
   try{await navigator.share({title,url:url()});track('share',{method:'device',content_type:'link',item_id:maskPath(path)});return;}catch(e){if(e?.name==='AbortError')return;}
  }
  setOpen(v=>!v);
 }
 async function copy(){
  try{await navigator.clipboard.writeText(url());track('share',{method:'copy_link',content_type:'link',item_id:maskPath(path)});setCopied(true);setTimeout(()=>setCopied(false),2500);}catch{window.prompt('Nokopē saiti:',url());}
 }
 return <span className="share-button-wrap">
  <button type="button" className={className} aria-expanded={open} onClick={share}>⤴ {label}</button>
  {open&&<span className="share-menu" role="group" aria-label={'Dalīties: '+title}>
   {targets(typeof window==='undefined'?path:url(),title).map(([name,href])=><a key={name} href={href} target="_blank" rel="noopener noreferrer">{name}</a>)}
   <button type="button" onClick={copy}>{copied?'✓ Saite nokopēta':'Kopēt saiti'}</button>
  </span>}
 </span>;
}
