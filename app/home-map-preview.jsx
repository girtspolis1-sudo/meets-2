'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {eventDateState} from '../lib/event-date.js';
import {addRasterLayer,enableMapLibre,hasWebGL,loadLeaflet,removeLayerSafe,requestedMapMode} from '../lib/leaflet-runtime.js';

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

export default function HomeMapPreview({events=[]}){
 const mapEl=useRef(null);
 const mapRef=useRef(null);
 const baseLayerRef=useRef(null);
 const baseCleanupRef=useRef(null);
 const [mapFailed,setMapFailed]=useState(false);
 const groups=useMemo(()=>groupedLocations(events),[events]);

 useEffect(()=>{
  let cancelled=false;
  let rasterCleanup=null;
  let resizeObserver=null;

  async function init(){
   setMapFailed(false);
   baseCleanupRef.current?.();
   baseCleanupRef.current=null;
   removeLayerSafe(baseLayerRef.current);
   baseLayerRef.current=null;
   if(mapRef.current){try{mapRef.current.remove();}catch{}mapRef.current=null;}

   try{
    const L=await loadLeaflet();
    if(cancelled||!mapEl.current)return;
    const bounds=L.latLngBounds(
     [LATVIA_BOUNDS.south,LATVIA_BOUNDS.west],
     [LATVIA_BOUNDS.north,LATVIA_BOUNDS.east]
    );
    const map=L.map(mapEl.current,{
     zoomControl:false,
     attributionControl:false,
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
    mapRef.current=map;
    resizeObserver=new ResizeObserver(()=>{
     if(cancelled)return;
     map.invalidateSize({pan:false});
     map.fitBounds(bounds,{padding:[8,8]});
    });
    resizeObserver.observe(mapEl.current);

    const requested=requestedMapMode();
    let baseReady=false;
    if(requested!=='raster'&&requested!=='fail'&&hasWebGL()){
     try{
      await enableMapLibre(L);
      if(cancelled)return;
      baseLayerRef.current=L.maplibreGL({style:STYLE_URL}).addTo(map);
      const vectorMap=baseLayerRef.current.getMaplibreMap();
      await new Promise((resolve,reject)=>{
       let timer;
       const cleanup=()=>{
        clearTimeout(timer);
        vectorMap.off('load',ready);
        vectorMap.off('error',failed);
       };
       const ready=()=>{cleanup();resolve();};
       const failed=()=>{cleanup();reject(new Error('Preview vector tiles failed'));};
       baseCleanupRef.current=cleanup;
       vectorMap.once('load',ready);
       vectorMap.once('error',failed);
       timer=setTimeout(failed,12000);
       if(vectorMap.loaded())ready();
      });
      if(cancelled)return;
      baseReady=true;
     }catch(error){
      console.warn('home_map_vector_failed_using_raster',error);
      removeLayerSafe(baseLayerRef.current);baseLayerRef.current=null;
     }
    }
    if(requested==='fail')throw new Error('Forced map failure');

    if(cancelled)return;
    if(!baseReady){
     const raster=addRasterLayer(L,map,{
      onFailure:error=>{
       if(cancelled)return;
       console.error('home_map_raster_failed',error);
       setMapFailed(true);
      }
     });
     baseLayerRef.current=raster.layer;
     rasterCleanup=raster.cleanup;
     baseCleanupRef.current=raster.cleanup;
    }

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
   }catch(error){
    console.error('home_map_preview_failed',error);
    if(!cancelled)setMapFailed(true);
   }
  }

  init();

  return()=>{
   cancelled=true;
   resizeObserver?.disconnect();
   rasterCleanup?.();
   baseCleanupRef.current?.();baseCleanupRef.current=null;
   removeLayerSafe(baseLayerRef.current);baseLayerRef.current=null;
   if(mapRef.current){try{mapRef.current.remove();}catch{}mapRef.current=null;}
  };
 },[groups]);

 return <div className="home-map-card">
  <div ref={mapEl} className="home-map-preview" aria-hidden="true"/>
  {mapFailed&&<div className="home-map-error" role="status">
   <span>Karte pašlaik nav pieejama.</span>
   <Link className="button" href="/pasakumi">Pārlūkot pasākumus</Link>
  </div>}
  {!mapFailed&&<><div className="home-map-shade" aria-hidden="true"/>
  <Link className="home-map-hit" href="/karte" aria-label="Atvērt pilno pasākumu karti"/>
  <div className="home-map-caption" aria-hidden="true">
   <span>Pasākumi kartē</span>
   <strong>Atvērt pilno karti ↗</strong>
  </div>
  </>}
  <div className="home-map-attribution">
   <a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>
   <span> · </span>
   <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>
  </div>
 </div>;
}
