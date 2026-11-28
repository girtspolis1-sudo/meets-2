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
export default function EventVenueFavorite({event,compact=false,fullLabel=false,asAction=false}){
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
   setStatus(!following?'Tagad seko šai norises vietai.':'Sekošana norises vietai pārtraukta.');
   window.dispatchEvent(new Event('meets-location-follows-changed'));
  }catch(e){setStatus(e.message);}finally{setBusy(false);}
 }
 // A bell, as for following on the home page: outlined to follow, filled while
 // following. The route button beside it keeps the pin.
 const icon=<svg viewBox="0 0 24 24" width="18" height="18" fill={following?'currentColor':'none'}
  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>
 </svg>;
 // In a card's action row: the same round button as Kalendārs, Norādes, Rīkotāja lapa.
 if(asAction)return <button type="button" className={'meets-circle-action meets-place-action'+(following?' active':'')} aria-pressed={following}
  aria-label={(following?'Pārtraukt sekošanu vietai: ':'Sekot norises vietai: ')+place.name}
  title={(following?'Seko vietai: ':'Sekot vietai: ')+place.name} disabled={!ready||busy} onClick={toggle}>
  {icon}<small className="meets-quiet-label">{following?'Seko vietai':'Sekot vietai'}</small>
  {status&&<span className="sr-only" role="status">{status}</span>}
 </button>;
 return <span className={'meets-place-favorite'+(compact?' compact':'')}>
  <button type="button" className={following?'active':''} aria-pressed={following}
   aria-label={(following?'Pārtraukt sekošanu vietai: ':'Sekot norises vietai: ')+place.name}
   title={place.name} disabled={!ready||busy} onClick={toggle}>
   {icon}
   <span>{following?(compact&&!fullLabel?'Seko':'Seko vietai'):(compact&&!fullLabel?'Sekot':'Sekot vietai')}</span>
  </button>{status&&<small role="status">{status}</small>}
 </span>;
}
