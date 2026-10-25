'use client';
import {useEffect,useState} from 'react';
import {placeFromEvent} from '../../lib/location-follow.js';

const SESSION_KEY='meets_user_session_v1';
let cacheToken='',cachedLocations=null,ongoing=null;
async function readLocations(token){
 if(token!==cacheToken){cacheToken=token;cachedLocations=null;ongoing=null;}
 if(cachedLocations)return cachedLocations;
 if(!ongoing)ongoing=account('locationFollows',token).then(result=>{cachedLocations=result.locations||[];return cachedLocations;}).finally(()=>{ongoing=null;});
 return ongoing;
}
function setCache(token,place,enabled){
 if(cacheToken!==token){cacheToken=token;cachedLocations=[];}
 if(cachedLocations){cachedLocations=cachedLocations.filter(x=>x.location_key!==place.key);
  if(enabled)cachedLocations.push({location_key:place.key,location_name:place.name,municipality:place.municipality});}
}

function session(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch{return null;}}
async function account(action,token,fields={}){
 const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
  body:JSON.stringify({action,token,...fields})});
 const b=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(b.error||'Neizdevās saglabāt norises vietu.');
 return b;
}
export default function EventVenueFavorite({event,compact=false}){
 const place=placeFromEvent(event);
 const [following,setFollowing]=useState(false),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[status,setStatus]=useState('');
 useEffect(()=>{let live=true;
  async function load(){
   const current=session();if(!current?.access_token){if(live)setReady(true);return;}
   try{const locations=await readLocations(current.access_token);
    if(live)setFollowing(locations.some(x=>x.location_key===place?.key));
   }catch{}finally{if(live)setReady(true);}
  }
  load();const refresh=()=>{if(live)load();};
  window.addEventListener('meets-location-follows-changed',refresh);
  return()=>{live=false;window.removeEventListener('meets-location-follows-changed',refresh);};
 },[place?.key]);
 if(!place)return null;
 async function toggle(){
  const current=session();if(!current?.access_token){window.location.assign('/profils');return;}
  setBusy(true);setStatus('');
  try{
   await account('followLocation',current.access_token,{
    locationKey:place.key,locationName:place.name,municipality:place.municipality,enabled:!following
   });
   setCache(current.access_token,place,!following);
   setFollowing(v=>!v);
   setStatus(!following?'Vieta pievienota iecienītajām.':'Vieta noņemta no iecienītajām.');
   window.dispatchEvent(new Event('meets-location-follows-changed'));
  }catch(e){setStatus(e.message);}finally{setBusy(false);}
 }
 return <span className={'meets-place-favorite'+(compact?' compact':'')}>
  <button type="button" className={following?'active':''} aria-pressed={following}
   aria-label={(following?'Noņemt iecienīto vietu: ':'Pievienot iecienītajām vietām: ')+place.name}
   title={place.name} disabled={!ready||busy} onClick={toggle}>
   <svg viewBox="0 0 24 24" width="16" height="16" fill={following?'currentColor':'none'}
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.6" fill={following?'#fff':'none'}/>
   </svg>
   <span>{following?(compact?'Sekoju':'Sekoju vietai'):(compact?'Sekot':'Sekot vietai')}</span>
  </button>{status&&<small role="status">{status}</small>}
 </span>;
}
