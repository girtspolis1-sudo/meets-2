'use client';

import {useEffect,useRef,useState} from 'react';
import {addRasterLayer,loadLeaflet} from '../../lib/leaflet-runtime.js';

const DEFAULT_CENTER=[56.9496,24.1052];
const BOUNDS=[[53.5,16],[60.8,31.5]];

function readPoint(latitude,longitude){
 if(latitude===''||latitude==null||longitude===''||longitude==null)return null;
 const lat=Number(latitude),lng=Number(longitude);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)return null;
 return [lat,lng];
}

export default function LocationMapPicker({latitude,longitude,onPick}){
 const mapElement=useRef(null);
 const mapApi=useRef(null);
 const marker=useRef(null);
 const onPickRef=useRef(onPick);
 const searchInput=useRef(null);
 const [mapReady,setMapReady]=useState(false);
 const [mapError,setMapError]=useState('');
 const [query,setQuery]=useState('');
 const [results,setResults]=useState([]);
 const [searching,setSearching]=useState(false);
 const [searchMessage,setSearchMessage]=useState('');
 const point=readPoint(latitude,longitude);

 useEffect(()=>{onPickRef.current=onPick;},[onPick]);

 useEffect(()=>{
  let active=true;
  let map=null,stopTiles=()=>{};
  async function initialize(){
   try{
    const L=await loadLeaflet();
    if(!active||!mapElement.current)return;
    map=L.map(mapElement.current,{
     center:DEFAULT_CENTER,zoom:7,minZoom:5,maxZoom:19,
     maxBounds:BOUNDS,maxBoundsViscosity:1,scrollWheelZoom:false
    });
    mapApi.current={L,map};
    const tiles=addRasterLayer(L,map,{
     onReady:()=>{if(active)setMapError('');},
     onFailure:()=>{if(active)setMapError('Kartes pamatne nav pieejama. Vietu vari atrast meklētājā vai ievadīt koordinātas.');}
    });
    stopTiles=tiles.cleanup;
    map.on('click',event=>{
     onPickRef.current?.({
      latitude:Number(event.latlng.lat.toFixed(6)),
      longitude:Number(event.latlng.lng.toFixed(6))
     });
    });
    if(active){
     setMapReady(true);
     window.setTimeout(()=>{if(active)map.invalidateSize();},100);
    }
   }catch{
    if(active)setMapError('Neizdevās atvērt karti. Vari izmantot vietas meklētāju vai ievadīt koordinātas.');
   }
  }
  initialize();
  return ()=>{
   active=false;
   stopTiles();
   marker.current=null;
   mapApi.current=null;
   if(map){try{map.remove();}catch{}}
  };
 },[]);

 useEffect(()=>{
  if(!mapReady||!mapApi.current)return;
  const {L,map}=mapApi.current;
  const position=readPoint(latitude,longitude);
  if(!position){
   if(marker.current){marker.current.remove();marker.current=null;}
   return;
  }
  if(!marker.current){
   const icon=L.divIcon({
    className:'meets-location-pin-wrapper',
    html:'<span class="meets-location-pin" aria-hidden="true"><span></span></span>',
    iconSize:[36,46],iconAnchor:[18,43]
   });
   const pin=L.marker(position,{icon,draggable:true,keyboard:true,title:'Pārvieto norises vietas punktu'}).addTo(map);
   pin.on('dragend',()=>{
    const selected=pin.getLatLng();
    onPickRef.current?.({latitude:Number(selected.lat.toFixed(6)),longitude:Number(selected.lng.toFixed(6))});
   });
   marker.current=pin;
  }else marker.current.setLatLng(position);
  map.setView(position,Math.max(13,map.getZoom()),{animate:false});
 },[latitude,longitude,mapReady]);

 async function search(){
  const term=query.trim();
  if(term.length<2){setSearchMessage('Ievadi vismaz divas rakstzīmes.');setResults([]);return;}
  setSearching(true);setSearchMessage('');setResults([]);
  try{
   const response=await fetch('/api/geocode',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({query:term})
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Meklēšana neizdevās.');
   const found=Array.isArray(data.results)?data.results:[];
   setResults(found);
   if(!found.length)setSearchMessage('Vieta nav atrasta. Pietuvini karti un atzīmē punktu manuāli.');
  }catch(error){
   setSearchMessage(error.message||'Vietu meklēšana pašlaik nav pieejama.');
  }finally{setSearching(false);}
 }

 function selectResult(result){
  setResults([]);setSearchMessage('');
  setQuery(result.displayName||result.label||'');
  searchInput.current?.blur();
  onPickRef.current?.({
   latitude:Number(result.latitude),longitude:Number(result.longitude),
   address:String(result.displayName||'').slice(0,300),
   label:String(result.label||'').slice(0,200)
  });
 }

 return <div className="meets-location-picker">
  <div className="meets-location-picker-heading">
   <strong>Norādi punktu kartē</strong>
   <span>Meklē vietu vai pieskaries kartei, lai atzīmētu precīzu vietu.</span>
  </div>
  <div className="meets-location-search">
   <label htmlFor="meets-place-search">Meklēt adresi vai vietu kartē</label>
   <div className="meets-location-search-row">
    <input id="meets-place-search" ref={searchInput} type="search"
     placeholder="Piem., Balvu pilsētas estrāde" value={query}
     onChange={event=>{setQuery(event.target.value);setResults([]);setSearchMessage('');}}
     onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();if(!searching)search();}}}/>
    <button type="button" className="button" disabled={searching} onClick={search}>{searching?'Meklē…':'Meklēt'}</button>
   </div>
  </div>
  {results.length>0&&<div className="meets-location-results" aria-label="Atrastas vietas">
   {results.map(item=><button type="button" key={item.id} onClick={()=>selectResult(item)}>
    <strong>{item.label}</strong><span>{item.displayName}</span>
   </button>)}
  </div>}
  {searchMessage&&<p className="meets-location-help" role="status">{searchMessage}</p>}
  <div className="meets-location-map" ref={mapElement} aria-label="Karte norises vietas punkta atzīmēšanai"/>
  {mapError&&<p className="meets-location-help" role="status">{mapError}</p>}
  <div className="meets-location-picker-footer">
   {point?<span className="meets-location-picked">✓ Punkts izvēlēts: {point[0].toFixed(6)}, {point[1].toFixed(6)}</span>
     :<span>Pieskaries kartei vai izvēlies meklēšanas rezultātu.</span>}
   <small>Punktu var pārvietot, velkot violetās krāsas marķieri. © OpenStreetMap</small>
  </div>
 </div>;
}
