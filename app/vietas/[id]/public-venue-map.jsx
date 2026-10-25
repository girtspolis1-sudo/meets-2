'use client';
import {useEffect,useRef,useState} from 'react';
import {loadLeaflet} from '../../../lib/leaflet-runtime.js';

export default function PublicVenueMap({latitude,longitude,name}){
 const ref=useRef(null),[failed,setFailed]=useState(false);
 const lat=Number(latitude),lon=Number(longitude),valid=Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
 useEffect(()=>{if(!valid)return;let disposed=false,map;(async()=>{try{
  const L=await loadLeaflet();if(disposed||!ref.current)return;
  map=L.map(ref.current,{scrollWheelZoom:false}).setView([lat,lon],15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map);
  L.circleMarker([lat,lon],{radius:9,color:'#fff',weight:3,fillColor:'#6d28d9',fillOpacity:1}).addTo(map).bindTooltip(name||'Norises vieta');
  requestAnimationFrame(()=>map?.invalidateSize());
 }catch{if(!disposed)setFailed(true);}})();return()=>{disposed=true;map?.remove();};},[valid,lat,lon,name]);
 if(!valid)return null;
 return <div className="public-venue-map-wrap"><div ref={ref} className="public-venue-map" aria-label={'Karte: '+(name||'norises vieta')}/>{failed&&<p className="meets-muted">Karti pašlaik neizdevās ielādēt.</p>}</div>;
}
