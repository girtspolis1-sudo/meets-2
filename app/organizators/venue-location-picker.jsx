'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {loadLeaflet} from '../../lib/leaflet-runtime.js';

const CENTER=[56.95,24.11];
const NO_POINT={latitude:'',longitude:''};
function validPoint(latitude,longitude){
 if(latitude==null||longitude==null||latitude===''||longitude==='')return false;
 const lat=Number(latitude),lon=Number(longitude);
 return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
}
function withinBaltics(lat,lon){
 return lat>=53.5&&lat<=60.8&&lon>=16&&lon<=31.5;
}
function normalize(value){
 return String(value||'').toLocaleLowerCase('lv').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}
function summaryAddress(value){
 return String(value?.address||'').trim()||'Adrese nav norādīta — saglabāsim precīzu kartes punktu.';
}
function mapPoint(value){
 return validPoint(value?.latitude,value?.longitude)?[Number(value.latitude),Number(value.longitude)]:null;
}

function LocationMap({point,onPick,preview=false}){
 const element=useRef(null),mapRef=useRef(null),leafletRef=useRef(null),markerRef=useRef(null),onPickRef=useRef(onPick);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{onPickRef.current=onPick;},[onPick]);
 useEffect(()=>{
  let disposed=false,map,tiles,observer;
  (async()=>{
   try{
    const L=await loadLeaflet();
    if(disposed||!element.current)return;
    leafletRef.current=L;
    const current=point&&validPoint(point.latitude,point.longitude)?[Number(point.latitude),Number(point.longitude)]:CENTER;
    map=L.map(element.current,{zoomControl:!preview,scrollWheelZoom:!preview,dragging:!preview,
     doubleClickZoom:!preview,touchZoom:!preview,keyboard:!preview,attributionControl:true});
    mapRef.current=map;
    map.setView(current,point?15:7);
    tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
     attribution:'© OpenStreetMap contributors',maxZoom:19
    }).addTo(map);
    let errors=0;
    tiles.on('tileerror',()=>{errors++;if(!disposed&&errors>=4)setFailed(true);});
    if(onPickRef.current&&!preview){
     map.on('click',event=>{
      const latitude=Number(event.latlng.lat.toFixed(6));
      const longitude=Number(event.latlng.lng.toFixed(6));
      if(withinBaltics(latitude,longitude))onPickRef.current?.({latitude,longitude});
     });
    }
    if(point&&validPoint(point.latitude,point.longitude)){
     markerRef.current=L.circleMarker(current,{radius:9,color:'#fff',weight:3,fillColor:'#6d28d9',fillOpacity:1}).addTo(map);
    }
    observer=new ResizeObserver(()=>map.invalidateSize());
    observer.observe(element.current);
    requestAnimationFrame(()=>{if(!disposed)map.invalidateSize();});
   }catch{if(!disposed)setFailed(true);}
  })();
  return ()=>{disposed=true;observer?.disconnect();markerRef.current=null;mapRef.current=null;leafletRef.current=null;map?.remove();};
 },[preview]);
 useEffect(()=>{
  const map=mapRef.current,L=leafletRef.current;
  if(!map||!L)return;
  const coords=mapPoint(point);
  if(!coords){markerRef.current?.remove();markerRef.current=null;return;}
  if(!markerRef.current)markerRef.current=L.circleMarker(coords,{radius:9,color:'#fff',weight:3,fillColor:'#6d28d9',fillOpacity:1}).addTo(map);
  else markerRef.current.setLatLng(coords);
  map.setView(coords,Math.max(map.getZoom(),14),{animate:false});
 },[point?.latitude,point?.longitude]);
 return <div className={preview?'meets-location-mini-map':'meets-location-full-map'}>
  <div className="meets-location-map-canvas" ref={element} aria-label={preview?'Izvēlētās vietas kartes priekšskatījums':'Karte — pieskaries, lai atzīmētu punktu'}/>
  {failed&&<p className="meets-location-map-fallback" role="status">Karti pašlaik neizdevās ielādēt. Vari precizēt koordinātas manuāli.</p>}
 </div>;
}

function PinMapDialog({initial,onClose,onConfirm}){
 const dialogRef=useRef(null);
 const [candidate,setCandidate]=useState(()=>({...initial}));
 const [address,setAddress]=useState(initial.address||'');
 const [manualOpen,setManualOpen]=useState(false);
 const [locating,setLocating]=useState(false);
 const [locationMessage,setLocationMessage]=useState('');
 const [searchText,setSearchText]=useState('');
 const [results,setResults]=useState([]);
 const [searching,setSearching]=useState(false);
 const [searchError,setSearchError]=useState('');
 const requestRef=useRef(0);
 useEffect(()=>{
  const node=dialogRef.current;
  if(node&&!node.open)node.showModal();
  return ()=>{if(node?.open)node.close();};
 },[]);
 async function reversePoint(point){
  const request=++requestRef.current;
  try{
   const response=await fetch('/api/geocode',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({reverse:true,latitude:point.latitude,longitude:point.longitude})});
   const data=await response.json();
   if(request===requestRef.current&&response.ok&&data.address)setAddress(data.address);
  }catch{/* A map pin is still a valid location. */}
 }
 function choose(point){
  if(!validPoint(point.latitude,point.longitude)||!withinBaltics(Number(point.latitude),Number(point.longitude)))return;
  setCandidate(previous=>({...previous,...point,venueId:''}));
  setLocationMessage('');
  setAddress('');
  reversePoint(point);
 }
 function locate(){
  if(!navigator.geolocation){setLocationMessage('Šajā ierīcē atrašanās vieta nav pieejama.');return;}
  setLocating(true);setLocationMessage('');
  navigator.geolocation.getCurrentPosition(
   position=>{setLocating(false);choose({latitude:Number(position.coords.latitude.toFixed(6)),longitude:Number(position.coords.longitude.toFixed(6))});},
   ()=>{setLocating(false);setLocationMessage('Atrašanās vietu neizdevās noteikt. Vari izvēlēties punktu kartē.');},
   {enableHighAccuracy:true,timeout:10000,maximumAge:0}
  );
 }
 async function findOnMap(){
  if(searchText.trim().length<2){setSearchError('Ievadi vismaz 2 rakstzīmes.');return;}
  setSearching(true);setSearchError('');setResults([]);
  try{
   const response=await fetch('/api/geocode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:searchText.trim()})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Meklēšana nav pieejama.');
   setResults(data.results||[]);
   if(!data.results?.length)setSearchError('Adrese nav atrasta. Atzīmē punktu kartē.');
  }catch(error){setSearchError(error.message||'Meklēšana neizdevās.');}
  finally{setSearching(false);}
 }
 function applyResult(place){
  requestRef.current++;
  const point={latitude:place.latitude,longitude:place.longitude,name:place.label,address:place.displayName};
  setCandidate(point);setAddress(place.displayName||'');
  setResults([]);setSearchError('');
 }
 const canConfirm=validPoint(candidate.latitude,candidate.longitude)&&withinBaltics(Number(candidate.latitude),Number(candidate.longitude));
 return <dialog className="meets-pin-dialog" ref={dialogRef} aria-label="Atzīmēt norises vietu kartē" onCancel={event=>{event.preventDefault();onClose();}}>
  <div className="meets-pin-dialog-layout">
   <header className="meets-pin-dialog-header">
    <div><strong>Izvēlies vietu kartē</strong><span>Pietuvini un pieskaries precīzai vietai</span></div>
    <button type="button" onClick={onClose} className="meets-pin-dialog-close" aria-label="Aizvērt karti">×</button>
   </header>
   <div className="meets-pin-dialog-tools">
    <div className="meets-pin-search-row">
     <input type="search" aria-label="Meklēt adresi kartē" placeholder="Meklē adresi kartē…" value={searchText}
      onChange={event=>{setSearchText(event.target.value);setResults([]);setSearchError('');}}
      onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();findOnMap();}}}/>
     <button type="button" onClick={findOnMap} disabled={searching}>{searching?'Meklē…':'Meklēt'}</button>
    </div>
    {results.length>0&&<div className="meets-pin-search-results">
     {results.map(place=><button type="button" key={place.id} onClick={()=>applyResult(place)}>
      <strong>{place.label}</strong><span>{place.displayName}</span>
     </button>)}
    </div>}
    {searchError&&<p className="meets-location-picker-message" role="status">{searchError}</p>}
    <button type="button" className="meets-pin-my-position" disabled={locating} onClick={locate}>⌖ {locating?'Nosaka atrašanās vietu…':'Mana atrašanās vieta'}</button>
   </div>
   <LocationMap point={candidate} onPick={choose}/>
   <div className="meets-pin-dialog-footer">
    {locationMessage&&<p className="meets-location-picker-message" role="status">{locationMessage}</p>}
    {canConfirm?<div className="meets-pin-confirm-details">
     <span>✓ Punkts atzīmēts</span>
     <strong>{Number(candidate.latitude).toFixed(6)}, {Number(candidate.longitude).toFixed(6)}</strong>
     {address&&<small>{address}</small>}
    </div>:<p className="meets-location-picker-hint">Atzīmē punktu kartē, lai turpinātu.</p>}
    <details open={manualOpen} onToggle={event=>setManualOpen(event.currentTarget.open)} className="meets-pin-manual">
     <summary>Precizēt koordinātas manuāli</summary>
     <div className="meets-organizer-grid">
      <label>Platums<input inputMode="decimal" aria-label="Platums" value={candidate.latitude??''} onChange={event=>setCandidate(previous=>({...previous,latitude:event.target.value}))}/></label>
      <label>Garums<input inputMode="decimal" aria-label="Garums" value={candidate.longitude??''} onChange={event=>setCandidate(previous=>({...previous,longitude:event.target.value}))}/></label>
     </div>
    </details>
    <button type="button" className="meets-pin-confirm" disabled={!canConfirm}
     onClick={()=>onConfirm({...candidate,latitude:Number(candidate.latitude),longitude:Number(candidate.longitude),address:address||candidate.address||''})}>
     Apstiprināt šo vietu
    </button>
   </div>
  </div>
 </dialog>;
}

export default function VenueLocationPicker({value={},onSelect,existingVenues=[],publicVenues=[]}){
 const [query,setQuery]=useState('');
 const [focused,setFocused]=useState(false);
 const [catalog,setCatalog]=useState([]);
 const [fetching,setFetching]=useState(false);
 const [catalogError,setCatalogError]=useState('');
 const [addressResults,setAddressResults]=useState([]);
 const [addressLoading,setAddressLoading]=useState(false);
 const [searchError,setSearchError]=useState('');
 const [pinOpen,setPinOpen]=useState(false);
 const [pinStart,setPinStart]=useState(NO_POINT);
 const [manualAddress,setManualAddress]=useState(false);
 const [manualValue,setManualValue]=useState('');
 const requestRef=useRef(0);
 const hasPoint=validPoint(value.latitude,value.longitude);
 const selected=Boolean(hasPoint||String(value.address||'').trim()||value.venueId);
 const localResults=useMemo(()=>{
  const needle=normalize(query);
  if(!needle)return existingVenues.slice(0,5);
  return existingVenues.filter(v=>normalize(v.name+' '+v.address).includes(needle)).slice(0,7);
 },[existingVenues,query]);
 const publicResults=useMemo(()=>{
  const needle=normalize(query);
  if(!needle)return [];
  return publicVenues.filter(v=>normalize(v.name+' '+v.address).includes(needle)).slice(0,7);
 },[publicVenues,query]);
 useEffect(()=>{
  if(!focused||query.trim().length<2){setCatalog([]);setCatalogError('');setFetching(false);return;}
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setFetching(true);setCatalogError('');
   try{
    const response=await fetch('/api/venue-catalog?q='+encodeURIComponent(query.trim()),{signal:controller.signal});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Saraksts nav pieejams');
    setCatalog(data.locations||[]);
   }catch(error){if(error.name!=='AbortError'){setCatalog([]);setCatalogError('MEETS katalogs īslaicīgi nav pieejams.');}}
   finally{if(!controller.signal.aborted)setFetching(false);}
  },450);
  return ()=>{clearTimeout(timer);controller.abort();};
 },[query,focused]);
 function commit(place){
  onSelect?.({
   name:place.name||place.label||'',
   address:place.address||place.displayName||'',
   latitude:validPoint(place.latitude,place.longitude)?Number(place.latitude):'',
   longitude:validPoint(place.latitude,place.longitude)?Number(place.longitude):'',
   venueId:place.venueId||''
  });
  setPinOpen(false);setFocused(false);setQuery('');setCatalog([]);setAddressResults([]);setSearchError('');
 }
 function preview(place){
  setPinStart({...place,venueId:place.venueId||''});
  setPinOpen(true);setFocused(false);
 }
 async function searchExternal(){
  if(query.trim().length<2){setSearchError('Ievadi vismaz 2 rakstzīmes.');return;}
  const request=++requestRef.current;
  setAddressLoading(true);setSearchError('');setAddressResults([]);
  try{
   const response=await fetch('/api/geocode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:query.trim()})});
   const data=await response.json();
   if(request!==requestRef.current)return;
   if(!response.ok)throw Error(data.error||'Vietu meklēšana neizdevās.');
   setAddressResults(data.results||[]);
   if(!data.results?.length)setSearchError('Nekas nav atrasts. Vari atzīmēt punktu kartē.');
  }catch(error){if(request===requestRef.current)setSearchError(error.message||'Vietu meklēšana neizdevās.');}
  finally{if(request===requestRef.current)setAddressLoading(false);}
 }
 function openMap(){
  const point=selected?value:NO_POINT;
  preview({...point,name:value.name||'',address:value.address||''});
 }
 function submitManualAddress(){
  if(manualValue.trim().length<5){setSearchError('Ievadi pilnu adresi vai atzīmē punktu kartē.');return;}
  commit({name:'',address:manualValue.trim(),...NO_POINT});
  setManualAddress(false);
 }
 return <section className="meets-location-picker" aria-label="Norises vietas izvēle">
  <div className="meets-location-picker-title">
   <strong>Kur atrodas norises vieta?</strong>
   <span>Vispirms atrodi vietu; detaļas aizpildīsi pēc tās apstiprināšanas.</span>
  </div>
  {selected?<div className="meets-location-confirmed">
   {hasPoint&&<LocationMap point={value} preview/>}
   <div className="meets-location-confirmed-body">
    <span className="meets-location-confirmed-state">✓ Vieta izvēlēta</span>
    <strong>{value.name||'Izvēlēta atrašanās vieta'}</strong>
    <small>{summaryAddress(value)}</small>
    <button type="button" className="meets-location-change" onClick={openMap}>⌖ Mainīt atrašanās vietu</button>
   </div>
  </div>:<>
   <div className="meets-location-picker-search">
    <div className="meets-location-picker-search-row">
     <input type="search" aria-label="Meklē vietu vai adresi" placeholder="Meklē vietu vai adresi…"
      value={query} onFocus={()=>setFocused(true)}
      onChange={event=>{setQuery(event.target.value);setFocused(true);setAddressResults([]);setSearchError('');requestRef.current++;setAddressLoading(false);}}
      onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();searchExternal();}}}/>
     <button type="button" onClick={searchExternal} disabled={addressLoading} aria-label="Meklēt kartes adresēs">{addressLoading?'Meklē…':'Meklēt'}</button>
    </div>
    {focused&&<div className="meets-location-picker-results" aria-label="Vietu meklēšanas rezultāti">
     {localResults.length>0&&<>
      <small>Manas saglabātās vietas</small>
      {localResults.map(place=><button key={place.id} type="button" onClick={()=>preview({...place,venueId:place.id})}>
       <strong>⌖ {place.name} <em>MEETS · Mana vieta</em></strong><span>{place.address||'Bez adreses'}</span>
      </button>)}
     </>}
     {publicResults.length>0&&<>
      <small>Publiskās MEETS norises vietas</small>
      {publicResults.map(place=><button key={'public-'+place.id} type="button" onClick={()=>preview({...place,venueId:place.id})}>
       <strong>⌖ {place.name} <em>MEETS · Publiska vieta</em></strong><span>{place.address||'Bez adreses'}</span>
      </button>)}
     </>}
     {catalog.length>0&&<>
      <small>MEETS vietu katalogs</small>
      {catalog.filter(place=>!localResults.some(own=>normalize(own.name)===normalize(place.name)&&Math.abs(Number(own.latitude)-place.latitude)<0.001)).slice(0,7).map(place=><button key={place.id} type="button" onClick={()=>preview(place)}>
       <strong>⌖ {place.name} <em>MEETS</em></strong><span>{place.address}</span>
      </button>)}
     </>}
     {addressResults.length>0&&<>
      <small>OpenStreetMap adreses un objekti</small>
      {addressResults.map(place=><button type="button" key={place.id} onClick={()=>preview({...place,name:place.label,address:place.displayName})}>
       <strong>⌖ {place.label}</strong><span>{place.displayName}</span>
      </button>)}
     </>}
     {fetching&&<small>Notiek MEETS vietu meklēšana…</small>}
     {catalogError&&<small>{catalogError}</small>}
     {!localResults.length&&!publicResults.length&&!catalog.length&&!addressResults.length&&!fetching&&<small>Sāc rakstīt vai izmanto karti zemāk.</small>}
    </div>}
   </div>
   {searchError&&<p role="status" className="meets-location-picker-message">{searchError}</p>}
   <button type="button" className="meets-location-open-map" onClick={openMap}>
    <span>⌖ Izvēlēties punktu kartē</span><span aria-hidden="true">›</span>
   </button>
   <button type="button" className="meets-location-manual-link" onClick={()=>setManualAddress(current=>!current)}>
    {manualAddress?'Atcelt adreses ievadīšanu':'Nevari atrast vietu? Ievadi adresi manuāli'}
   </button>
   {manualAddress&&<div className="meets-location-manual-address">
    <label>Adrese<input aria-label="Adrese manuāli" value={manualValue} onChange={event=>setManualValue(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();submitManualAddress();}}} placeholder="Iela, pilsēta, Latvija" minLength={5}/></label>
    <button type="button" onClick={submitManualAddress}>Turpināt ar šo adresi</button>
   </div>}
  </>}
  {pinOpen&&<PinMapDialog initial={pinStart} onClose={()=>setPinOpen(false)} onConfirm={commit}/>}
 </section>;
}
