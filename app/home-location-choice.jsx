'use client';
import {useEffect,useState} from 'react';
const STORAGE_KEY='meets_location_choice_v1';
const RIGA={lat:56.9496,lon:24.1052,label:'Rīgas centrs',source:'fallback'};
export default function HomeLocationChoice(){
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{try{setOpen(!localStorage.getItem(STORAGE_KEY));}catch{setOpen(true);}},[]);
 function save(location){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(location));}catch{}setOpen(false);setBusy(false);}
 function locate(){
  if(!navigator.geolocation){save(RIGA);return;}
  setBusy(true);
  navigator.geolocation.getCurrentPosition(({coords})=>{
   const {latitude:lat,longitude:lon}=coords;
   if(lat>=53.5&&lat<=60.8&&lon>=16&&lon<=31.5)save({lat,lon,label:'Mana atrašanās vieta',source:'browser'});
   else save(RIGA);
  },()=>save(RIGA),{enableHighAccuracy:true,timeout:8000,maximumAge:300000});
 }
 if(!open)return null;
 return <div className="meets-location-overlay"><section role="dialog" aria-modal="true" aria-labelledby="home-location-title" className="meets-location-dialog">
  <span className="meets-location-symbol" aria-hidden="true">📍</span>
  <h2 id="home-location-title">Pasākumi Tavā tuvumā</h2>
  <p>Vai noteikt Tavu atrašanās vietu, lai kartē parādītu tuvākos pasākumus? Ja nevēlies, izmantosim Rīgas centru.</p>
  <div className="meets-location-dialog-actions">
   <button className="meets-location-accept" type="button" disabled={busy} onClick={locate}>{busy?'Nosakām lokāciju…':'Noteikt manu atrašanās vietu'}</button>
   <button className="meets-location-decline" type="button" onClick={()=>save(RIGA)}>Turpināt ar Rīgas centru</button>
  </div>
 </section></div>;
}