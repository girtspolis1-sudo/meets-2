'use client';
import {useEffect,useRef,useState} from 'react';
import {loadLeaflet,addRasterLayer} from '../../lib/leaflet-runtime.js';
import {eventMapIcon} from '../../lib/event-map-icons.js';
import {coordinates,navigationLinks} from '../../lib/meets-personal.js';

export default function PersonalMap({events=[]}){
 const el=useRef(null),instance=useRef(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false,cleanup=null;
  async function init(){
   if(instance.current){try{instance.current.remove();}catch{}instance.current=null;}
   const points=events.map(event=>({event,coords:coordinates(event)})).filter(x=>x.coords);
   if(!points.length)return;
   try{
    const L=await loadLeaflet();if(cancelled||!el.current)return;
    const map=L.map(el.current,{scrollWheelZoom:false,attributionControl:true,zoomControl:true});
    instance.current=map;
    const raster=addRasterLayer(L,map,{onFailure:()=>{if(!cancelled)setError('Kartes pamatne pašlaik nav pieejama. Navigācijas saites darbojas.');}});
    cleanup=raster.cleanup;
    const locations=[];
    for(const {event,coords} of points){
     const icon=eventMapIcon(event);
     const marker=L.marker([coords.latitude,coords.longitude],{icon:L.divIcon({
      className:'meets-personal-pin',html:'<span aria-hidden="true">'+icon.glyph+'</span>',
      iconSize:[40,44],iconAnchor:[20,44],popupAnchor:[0,-42]
     })}).addTo(map);
     const div=document.createElement('div');div.className='meets-personal-popup';
     const label=document.createElement('strong');label.textContent=event.title||'Pasākums';div.appendChild(label);
     const date=document.createElement('p');date.textContent=event.date_from||'';div.appendChild(date);
     const links=document.createElement('div');links.className='meets-personal-popup-links';
     const nav=navigationLinks(event);
     for(const [href,text] of [[nav.google,'Google Maps'],[nav.waze,'Waze']]){
      if(!href)continue;
      const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=text;links.appendChild(a);
     }
     div.appendChild(links);marker.bindPopup(div);
     locations.push([coords.latitude,coords.longitude]);
    }
    if(locations.length===1)map.setView(locations[0],12);
    else map.fitBounds(locations,{padding:[45,45],maxZoom:12});
    setTimeout(()=>{if(!cancelled)map.invalidateSize();},100);
   }catch(e){if(!cancelled)setError('Karti neizdevās ielādēt. Atver Google Maps vai Waze no pasākuma kartītes.');}
  }
  init();
  return()=>{cancelled=true;cleanup?.();if(instance.current){try{instance.current.remove();}catch{}instance.current=null;}};
 },[events]);
 const withCoords=events.filter(e=>coordinates(e));
 return <div className="meets-personal-map-wrap">
  {!withCoords.length?<div className="meets-account-empty"><span>⌖</span><h3>Vēl nav precīzu kartes punktu</h3><p>Saglabā pasākumus ar norises vietas koordinātām, lai tos redzētu savā kartē.</p></div>:
   <><div className="meets-personal-map" ref={el} aria-label="Saglabāto pasākumu interaktīvā karte" role="region"/>{error&&<p className="meets-muted" role="status">{error}</p>}</>}
  {!!events.length&&<p className="meets-muted">Kartē: {withCoords.length} no {events.length} pasākumiem ar precīzām koordinātām. Pārvietošanai uz norises vietu izvēlies Google Maps vai Waze.</p>}
 </div>;
}
