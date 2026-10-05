'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {eventDateRangeLabel,eventDateState,groupDateTone,rigaTodayIso} from '../../lib/event-date.js';
import {addRasterLayer,enableMapLibre,hasWebGL,loadLeaflet,removeLayerSafe,requestedMapMode} from '../../lib/leaflet-runtime.js';

const BALTIC_VIEW={south:53.5,west:16,north:60.8,east:31.5};
const STYLE_URL='https://tiles.openfreemap.org/styles/positron';

function esc(value=''){
 return String(value).replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
 })[char]);
}
function sourceType(event){
 if(String(event.sport_format||'').toLowerCase()==='basketball'||String(event.governing_body||'').toUpperCase()==='LBS')return 'basketball';
 if(String(event.governing_body||'').toUpperCase()==='LFF')return 'lff';
 const sources=(event.sources||[]).map(source=>String(source.source||'').toLowerCase());
 if(sources.includes('estlatbl.com')||sources.includes('basket.lv'))return 'basketball';
 if(sources.includes('lff.lv'))return 'lff';
 if(sources.includes('athletics.lv'))return 'athletics';
 return 'municipality';
}
function glyph(type){return type==='lff'?'⚽':type==='basketball'?'🏀':type==='athletics'?'🏃':'📅';}
function groupType(events){
 const types=[...new Set(events.map(sourceType))];
 return types.length===1?types[0]:'municipality';
}
function dateText(value){
 if(!value)return '—';
 const [year,month,day]=String(value).split('-');
 return year&&month&&day?day+'.'+month+'.'+year:value;
}
function timeText(event){
 if(event.time_type==='all_day')return 'Visu dienu';
 return [event.time_from?.slice(0,5),event.time_to?.slice(0,5)].filter(Boolean).join('–')||'Laiks nav norādīts';
}
function groupsFor(events){
 const groups=new Map();
 for(const event of events){
  const lat=Number(event.latitude),lon=Number(event.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
  if(lat<BALTIC_VIEW.south||lat>BALTIC_VIEW.north||lon<BALTIC_VIEW.west||lon>BALTIC_VIEW.east)continue;
  const key=lat.toFixed(5)+'|'+lon.toFixed(5);
  const group=groups.get(key)||{key,lat,lon,label:event.venue_name||event.address_raw||event.settlement||event.municipality||'Norises vieta',events:[]};
  group.events.push(event);
  groups.set(key,group);
 }
 return [...groups.values()];
}
function popupHtml(group,now){
 const rows=[...group.events].sort((a,b)=>String(a.date_from||'').localeCompare(String(b.date_from||''))||String(a.title||'').localeCompare(String(b.title||''),'lv')).map(event=>{
  const state=eventDateState(event,rigaTodayIso(now),now);
  const quality=event.location_quality||'nav kvalitātes atzīmes';
  const status=event.status||'';
  const rangeLabel=eventDateRangeLabel(event,dateText);
  const rowClass=state.tone==='ended-today'?' class="popup-event-ended"':'';
  return '<li'+rowClass+'><strong>'+esc(event.title)+'</strong>'+
   '<span class="popup-date-row"><span class="event-date-indicator '+esc(state.tone)+'" aria-hidden="true">●</span><span class="event-date-badge '+esc(state.tone)+'" title="'+esc(state.label)+'">'+esc(state.badge)+'</span><span>'+esc(rangeLabel)+' · '+esc(timeText(event))+'</span></span>'+
   '<small>'+esc([status,quality].filter(Boolean).join(' · '))+'</small>'+
   '<button type="button" class="admin-popup-edit" data-admin-edit="'+esc(event.id)+'">Labot</button></li>';
 }).join('');
 return '<div class="location-popup admin-map-popup"><div class="location-popup-head"><strong>'+esc(group.label)+'</strong><span>'+group.events.length+' pasākumi</span></div><ol>'+rows+'</ol></div>';
}

export default function AdminEventMap({events,onEdit}){
 const mapEl=useRef(null);
 const mapRef=useRef(null);
 const layerRef=useRef(null);
 const baseLayerRef=useRef(null);
 const baseCleanupRef=useRef(null);
 const [ready,setReady]=useState(false);
 const [mapMode,setMapMode]=useState('loading');
 const [mapError,setMapError]=useState('');
 const [retry,setRetry]=useState(0);
 const [clockNow,setClockNow]=useState(()=>new Date());
 const groups=useMemo(()=>groupsFor(events),[events]);
 const eventById=useMemo(()=>new Map(events.map(event=>[event.id,event])),[events]);

 useEffect(()=>{
  let cancelled=false;
  let rasterCleanup=null;

  async function init(){
   setReady(false);
   setMapMode('loading');
   setMapError('');
   layerRef.current?.remove();layerRef.current=null;
   baseCleanupRef.current?.();
   baseCleanupRef.current=null;
   removeLayerSafe(baseLayerRef.current);baseLayerRef.current=null;
   if(mapRef.current){try{mapRef.current.remove();}catch{}mapRef.current=null;}

   try{
    const L=await loadLeaflet();
    if(cancelled||!mapEl.current)return;
    const bounds=L.latLngBounds([BALTIC_VIEW.south,BALTIC_VIEW.west],[BALTIC_VIEW.north,BALTIC_VIEW.east]);
    const map=L.map(mapEl.current,{maxBounds:bounds,maxBoundsViscosity:1,minZoom:5}).fitBounds(bounds,{padding:[18,18]});
    mapRef.current=map;
    map._meetsLeaflet=L;

    const requested=requestedMapMode();
    if(requested!=='raster'&&requested!=='fail'&&hasWebGL()){
     try{
      await enableMapLibre(L);
      if(cancelled)return;
      baseLayerRef.current=L.maplibreGL({style:STYLE_URL}).addTo(map);
      map.attributionControl.addAttribution('<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>');
      setMapMode('vector');
      setReady(true);
      return;
     }catch(error){
      console.warn('admin_map_vector_failed_using_raster',error);
      removeLayerSafe(baseLayerRef.current);
      baseLayerRef.current=null;
     }
    }

    if(requested==='fail')throw new Error('Forced map failure');

    const raster=addRasterLayer(L,map,{
     onReady:()=>{if(!cancelled){setMapMode('raster');setReady(true);setMapError('');}},
     onFailure:error=>{
      if(cancelled)return;
      console.error('admin_map_raster_failed',error);
      setMapMode('failed');setReady(false);setMapError('Admin karti neizdevās ielādēt.');
     }
    });
    baseLayerRef.current=raster.layer;
    rasterCleanup=raster.cleanup;
    baseCleanupRef.current=raster.cleanup;
    setMapMode('raster');
    setReady(true);
   }catch(error){
    if(cancelled)return;
    console.error('admin_map_stack_failed',error);
    setMapMode('failed');
    setReady(false);
    setMapError('Admin karti neizdevās ielādēt. Pasākumu labošana joprojām pieejama tabulā.');
   }
  }

  init();
  return()=>{
   cancelled=true;
   rasterCleanup?.();
   baseCleanupRef.current?.();baseCleanupRef.current=null;
   layerRef.current?.remove();layerRef.current=null;
   removeLayerSafe(baseLayerRef.current);baseLayerRef.current=null;
   if(mapRef.current){try{mapRef.current.remove();}catch{}mapRef.current=null;}
  };
 },[retry]);

 useEffect(()=>{
  const timer=window.setInterval(()=>setClockNow(new Date()),30000);
  return()=>window.clearInterval(timer);
 },[]);

 useEffect(()=>{
  if(!ready||!mapRef.current)return;
  const map=mapRef.current,L=map._meetsLeaflet;
  layerRef.current?.remove();
  const layer=L.layerGroup().addTo(map);
  layerRef.current=layer;
  const markerBounds=[];

  for(const group of groups){
   const type=groupType(group.events);
   const tone=groupDateTone(group.events,rigaTodayIso(clockNow),clockNow);
   const dateClass=tone?' date-'+tone:'';
   const grouped=group.events.length>1;
   const size=grouped?44:38;
   const html=grouped
    ?'<span class="event-count-marker '+type+dateClass+'"><span class="event-group-symbol" aria-hidden="true">'+glyph(type)+'</span><strong>'+group.events.length+'</strong></span>'
    :'<span class="event-symbol-marker '+type+dateClass+'"><span aria-hidden="true">'+glyph(type)+'</span></span>';
   const icon=L.divIcon({className:grouped?'event-count-marker-wrap':'event-symbol-marker-wrap',html,iconSize:[size,size],iconAnchor:[size/2,size/2]});
   const marker=L.marker([group.lat,group.lon],{icon,keyboard:true,title:group.label}).addTo(layer);
   marker.bindPopup(popupHtml(group,clockNow),{maxWidth:430,maxHeight:520,autoPan:true,keepInView:true});

   marker.on('popupopen',event=>{
    const root=event.popup.getElement();
    root?.querySelectorAll('[data-admin-edit]').forEach(button=>{
     button.onclick=()=>{
      const selected=eventById.get(button.dataset.adminEdit);
      if(selected){map.closePopup();onEdit(selected);}
     };
    });
   });
   markerBounds.push([group.lat,group.lon]);
  }

  if(markerBounds.length){
   const bounds=L.latLngBounds(markerBounds);
   map.fitBounds(bounds,{padding:[42,42],maxZoom:12});
  }
 },[ready,groups,eventById,onEdit,clockNow]);

 return <section className="admin-map-section">
  <div className="queue-head">
   <div>
    <p className="eyebrow">Admin · karte</p>
    <h2>Pasākumi kartē</h2>
    <p>Redzami pašreiz atlasītie pasākumi ar kartes punktu. Šodienas marķieriem ir zaļa līnija, rītdienas — dzeltena, bet šodienas pasākumiem ar jau pagājušu beigu laiku — sarkana; nospied marķieri un <strong>Labot</strong>, lai uzreiz atvērtu korekciju.</p>
   </div>
   <span className="quality-badge ok">{groups.length} vietas</span>
  </div>
  <div ref={mapEl} className="admin-event-map" aria-label="Admin pasākumu karte"/>
  {mapMode==='raster'&&<div className="admin-map-fallback-note">Rastra rezerves karte</div>}
  {mapError&&<div className="admin-map-error" role="alert">
   <strong>{mapError}</strong>
   <button type="button" className="button compact" onClick={()=>setRetry(value=>value+1)}>Mēģināt vēlreiz</button>
  </div>
 </section>;
}
