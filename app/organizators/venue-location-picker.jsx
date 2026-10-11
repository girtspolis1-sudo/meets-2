'use client';

import {useEffect,useRef,useState} from 'react';
import {loadLeaflet} from '../../lib/leaflet-runtime.js';

const DEFAULT_CENTER=[56.95,24.11];
const BALTIC_BOUNDS=[[53.5,16],[60.8,31.5]];
function validPoint(lat,lon){
 const a=Number(lat),b=Number(lon);
 return lat!==''&&lat!=null&&lon!==''&&lon!=null&&Number.isFinite(a)&&Number.isFinite(b)&&a>=-90&&a<=90&&b>=-180&&b<=180;
}
function shortCoordinate(value){return Number(value).toFixed(6);}
function isNearbyPlace(place,query){
 const text=(String(place.name||'')+' '+String(place.address||'')).toLocaleLowerCase('lv');
 return text.includes(query.toLocaleLowerCase('lv'));
}

/**
 * Reusable organizer location editor. Coordinates always flow to the parent form:
 * selecting a map search result or tapping the map never saves a separate record.
 */
export default function VenueLocationPicker({latitude,longitude,onSelect,existingVenues=[]}){
 const [mode,setMode]=useState('search');
 const [query,setQuery]=useState('');
 const [results,setResults]=useState([]);
 const [searching,setSearching]=useState(false);
 const [searchError,setSearchError]=useState('');
 const [mapError,setMapError]=useState('');
 const mapElement=useRef(null);
 const mapRef=useRef(null);
 const leafletRef=useRef(null);
 const markerRef=useRef(null);
 const onSelectRef=useRef(onSelect);
 const modeRef=useRef(mode);
 const selectedRef=useRef({latitude,longitude});
 const requestRef=useRef(0);
 const hasPoint=validPoint(latitude,longitude);
 const matches=existingVenues.filter(v=>isNearbyPlace(v,query.trim())).slice(0,8);

 useEffect(()=>{onSelectRef.current=onSelect;},[onSelect]);
 useEffect(()=>{modeRef.current=mode;mapRef.current?.invalidateSize();},[mode]);
 useEffect(()=>{selectedRef.current={latitude,longitude};},[latitude,longitude]);

 useEffect(()=>{
  let stopped=false;
  let map=null,marker=null;
  async function initialize(){
   try{
    const L=await loadLeaflet();
    if(stopped||!mapElement.current)return;
    leafletRef.current=L;
    const current=selectedRef.current;
    const isSelected=validPoint(current.latitude,current.longitude);
    const center=isSelected?[Number(current.latitude),Number(current.longitude)]:DEFAULT_CENTER;
    map=L.map(mapElement.current,{scrollWheelZoom:false,zoomControl:true}).setView(center,isSelected?15:7);
    mapRef.current=map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
     attribution:'© OpenStreetMap contributors',maxZoom:19
    }).addTo(map);
    map.on('click',event=>{
     if(modeRef.current!=='map')return;
     onSelectRef.current?.({
      latitude:Number(event.latlng.lat.toFixed(6)),
      longitude:Number(event.latlng.lng.toFixed(6))
     });
    });
    // A circle marker needs no external icon assets and works with the raster fallback.
    if(isSelected){
     marker=L.circleMarker(center,{radius:10,color:'#fff',weight:3,fillColor:'#6d28d9',fillOpacity:1}).addTo(map);
     markerRef.current=marker;
    }
    requestAnimationFrame(()=>{if(!stopped)map.invalidateSize();});
   }catch{
    if(!stopped)setMapError('Karti neizdevās atvērt. Koordinātas vari ievadīt arī manuāli.');
   }
  }
  initialize();
  return ()=>{
   stopped=true;
   markerRef.current=null;
   leafletRef.current=null;
   mapRef.current=null;
   if(map)map.remove();
  };
 },[]);

 useEffect(()=>{
  const map=mapRef.current,L=leafletRef.current;
  if(!map||!L)return;
  if(!hasPoint){
   markerRef.current?.remove();
   markerRef.current=null;
   return;
  }
  const center=[Number(latitude),Number(longitude)];
  if(!markerRef.current)markerRef.current=L.circleMarker(center,{radius:10,color:'#fff',weight:3,fillColor:'#6d28d9',fillOpacity:1}).addTo(map);
  else markerRef.current.setLatLng(center);
  if(!map.getBounds().contains(center)||map.getZoom()<13)map.setView(center,15);
 },[latitude,longitude,hasPoint]);

 async function searchLocations(){
  const text=query.trim();
  if(text.length<2){setSearchError('Ievadi vismaz 2 rakstzīmes.');return;}
  const seq=++requestRef.current;
  setSearching(true);setSearchError('');setResults([]);
  try{
   const response=await fetch('/api/geocode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:text})});
   const data=await response.json();
   if(seq!==requestRef.current)return;
   if(!response.ok)throw Error(data.error||'Vietu meklēšana neizdevās.');
   setResults(data.results||[]);
   if(!data.results?.length)setSearchError('Vieta nav atrasta. Izmēģini citu adresi vai atzīmē punktu kartē.');
  }catch(error){
   if(seq===requestRef.current)setSearchError(error.message||'Vietu meklēšana neizdevās.');
  }finally{if(seq===requestRef.current)setSearching(false);}
 }
 function selectPlace(place){
  const valid=validPoint(place.latitude,place.longitude);
  onSelect?.({
   latitude:valid?Number(place.latitude):'',
   longitude:valid?Number(place.longitude):'',
   name:place.name||place.label||'',
   address:place.address||place.displayName||'',
   ...(place.venueId?{venueId:place.venueId}:{})
  });
  setResults([]);setSearchError('');
 }
 function setManualCoordinate(field,value){
  onSelect?.({latitude:field==='latitude'?value:latitude,longitude:field==='longitude'?value:longitude});
 }

 return <section className="meets-location-picker" aria-label="Norises vietas izvēle kartē">
  <div className="meets-location-picker-title">
   <strong>Norises vieta kartē</strong>
   <span>Atrodi vietu sarakstā vai atzīmē precīzu punktu pats.</span>
  </div>
  <div className="meets-location-picker-tabs" role="group" aria-label="Vietas izvēles veids">
   <button type="button" aria-pressed={mode==='search'} className={mode==='search'?'active':''} onClick={()=>setMode('search')}>⌕ Meklēt vietu</button>
   <button type="button" aria-pressed={mode==='map'} className={mode==='map'?'active':''} onClick={()=>setMode('map')}>⌖ Atzīmēt kartē</button>
  </div>
  {mode==='search'?<div className="meets-location-picker-search">
   <div className="meets-location-picker-search-row">
    <input type="search" aria-label="Meklēt norises vietu vai adresi" value={query} onChange={event=>{setQuery(event.target.value);setResults([]);setSearchError('');requestRef.current++;setSearching(false);}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();searchLocations();}}} placeholder="Meklē stadionu, ielu, pilsētu…"/>
    <button type="button" className="button" disabled={searching} onClick={searchLocations}>{searching?'Meklē…':'Meklēt'}</button>
   </div>
   {matches.length>0&&<div className="meets-location-picker-results" aria-label="Manas saglabātās vietas">
    <small>Jau saglabātās vietas</small>
    {matches.map(place=><button key={place.id} type="button" onClick={()=>selectPlace({...place,venueId:place.id})}>
     <strong>{place.name}</strong><span>{place.address}</span>
    </button>)}
   </div>}
   {results.length>0&&<div className="meets-location-picker-results" aria-label="Adreses meklēšanas rezultāti">
    <small>Kartes meklētāja rezultāti</small>
    {results.map(place=><button type="button" key={place.id} onClick={()=>selectPlace(place)}>
     <strong>{place.label}</strong><span>{place.displayName}</span>
    </button>)}
   </div>}
   {searchError&&<p role="status" className="meets-location-picker-message">{searchError}</p>}
  </div>:<p className="meets-location-picker-hint">Pieskaries kartei, lai ieliktu punktu. Ja vajag, pietuvini karti un atzīmē vēlreiz.</p>}
  <div ref={mapElement} className="meets-location-picker-map" aria-label="Interaktīva norises vietas karte"/>
  {mapError&&<p role="status" className="meets-location-picker-message">{mapError}</p>}
  {hasPoint?<p className="meets-location-picker-selected" role="status">✓ Punkts izvēlēts: <strong>{shortCoordinate(latitude)}, {shortCoordinate(longitude)}</strong>
   <button type="button" onClick={()=>onSelect?.({latitude:'',longitude:''})}>Noņemt punktu</button>
  </p>:<p className="meets-location-picker-hint">Punkts vēl nav izvēlēts. Precīzu vietu var norādīt ar meklētāju vai kartē.</p>}
  <details className="meets-location-picker-manual">
   <summary>Precizēt koordinātas manuāli</summary>
   <div className="meets-organizer-grid">
    <label>Platums<input inputMode="decimal" value={latitude??''} onChange={event=>setManualCoordinate('latitude',event.target.value)} placeholder="56.949600"/></label>
    <label>Garums<input inputMode="decimal" value={longitude??''} onChange={event=>setManualCoordinate('longitude',event.target.value)} placeholder="24.105200"/></label>
   </div>
  </details>
  <small className="meets-location-picker-credit">Kartes dati © OpenStreetMap contributors</small>
 </section>;
}
