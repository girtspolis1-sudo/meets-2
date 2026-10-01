'use client';

import {useEffect,useMemo,useRef} from 'react';
import Link from 'next/link';
import {eventDateState} from '../lib/event-date.js';

const LATVIA_BOUNDS={south:55.55,west:20.65,north:58.15,east:28.35};
const STYLE_URL='https://tiles.openfreemap.org/styles/positron';

function markerColor(event){
 const tone=eventDateState(event).tone;
 if(tone==='today')return '#2f8f57';
 if(tone==='tomorrow')return '#d4a900';
 if(String(event?.sport_format||'').toLowerCase()==='basketball')return '#c86c25';
 if(String(event?.governing_body||'').toUpperCase()==='LFF')return '#2c6faa';
 return '#7f00ff';
}

function groupedLocations(events){
 const groups=new Map();
 for(const event of events||[]){
  if(event.country_code&&event.country_code!=='LV')continue;
  const lat=Number(event.latitude),lon=Number(event.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
  if(lat<LATVIA_BOUNDS.south||lat>LATVIA_BOUNDS.north||lon<LATVIA_BOUNDS.west||lon>LATVIA_BOUNDS.east)continue;
  const key=lat.toFixed(4)+'|'+lon.toFixed(4);
  const group=groups.get(key)||{lat,lon,events:[]};
  group.events.push(event);
  groups.set(key,group);
 }
 return [...groups.values()];
}

async function loadMap(){
 const leafletModule=await import('leaflet');
 const L=leafletModule.default||leafletModule;
 await import('@maplibre/maplibre-gl-leaflet');
 if(!L?.maplibreGL)throw new Error('Map preview failed to load');
 return L;
}

export default function HomeMapPreview({events=[]}){
 const mapEl=useRef(null);
 const mapRef=useRef(null);
 const groups=useMemo(()=>groupedLocations(events),[events]);

 useEffect(()=>{
  let cancelled=false;
  loadMap().then(L=>{
   if(cancelled||!mapEl.current||mapRef.current)return;
   const bounds=L.latLngBounds(
    [LATVIA_BOUNDS.south,LATVIA_BOUNDS.west],
    [LATVIA_BOUNDS.north,LATVIA_BOUNDS.east]
   );
   const map=L.map(mapEl.current,{
    zoomControl:false,
    attributionControl:true,
    dragging:false,
    scrollWheelZoom:false,
    doubleClickZoom:false,
    boxZoom:false,
    keyboard:false,
    touchZoom:false,
    tap:false,
    maxBounds:bounds,
    maxBoundsViscosity:1
   }).fitBounds(bounds,{padding:[8,8]});

   L.maplibreGL({style:STYLE_URL}).addTo(map);

   for(const group of groups){
    const representative=group.events.find(event=>eventDateState(event).tone==='today')
     ||group.events.find(event=>eventDateState(event).tone==='tomorrow')
     ||group.events[0];
    const color=markerColor(representative);
    const radius=group.events.length>3?7:5;
    L.circleMarker([group.lat,group.lon],{
     radius,
     color:'#fff',
     weight:2,
     fillColor:color,
     fillOpacity:.96,
     interactive:false
    }).addTo(map);
   }

   map.attributionControl.setPrefix(false);
   map.attributionControl.addAttribution('<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · © OpenStreetMap');
   mapRef.current=map;
  }).catch(error=>console.error('home_map_preview_failed',error));

  return()=>{
   cancelled=true;
   mapRef.current?.remove();
   mapRef.current=null;
  };
 },[groups]);

 return <Link className="home-map-card" href="/karte" aria-label="Atvērt pilno pasākumu karti">
  <div ref={mapEl} className="home-map-preview" aria-hidden="true"/>
  <div className="home-map-shade" aria-hidden="true"/>
  <div className="home-map-caption">
   <span>Pasākumi kartē</span>
   <strong>Atvērt pilno karti ↗</strong>
  </div>
 </Link>;
}
