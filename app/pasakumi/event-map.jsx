'use client';
import {useEffect,useRef} from 'react';
const bounds={minLon:20.7,maxLon:28.3,minLat:55.6,maxLat:58.1};
function pos(lat,lon){return{x:(lon-bounds.minLon)/(bounds.maxLon-bounds.minLon)*100,y:(bounds.maxLat-lat)/(bounds.maxLat-bounds.minLat)*100}}
export default function EventMap({events,onSelect}){
 const mapEvents=events.filter(e=>Number.isFinite(Number(e.latitude))&&Number.isFinite(Number(e.longitude)));
 const groups=new Map(); for(const e of mapEvents){const p=pos(Number(e.latitude),Number(e.longitude));const k=Math.round(p.x*2)+'-'+Math.round(p.y*2);const g=groups.get(k)||{...p,events:[]};g.events.push(e);groups.set(k,g)}
 return <section id="karte" className="event-map-section"><div className="map-heading"><div><p className="eyebrow">Karte</p><h2>Pasākumi Latvijā</h2></div><p><strong>{mapEvents.length}</strong> ar kartes punktu · <strong>{events.length-mapEvents.length}</strong> bez koordinātām</p></div>
 <div className="latvia-map" role="region" aria-label="Pasākumu karte Latvijā"><div className="latvia-shape" aria-hidden="true"/>{[...groups.values()].map((g,i)=><button key={i} className="map-marker" style={{left:g.x+'%',top:g.y+'%'}} title={g.events.map(e=>e.title).join('\n')} onClick={()=>onSelect(g.events[0])}><span>{g.events.length}</span></button>)}<div className="map-label riga">Rīga</div><div className="map-label liepaja">Liepāja</div><div className="map-label daugavpils">Daugavpils</div></div>
 <p className="map-note">Punkts rāda datubāzē saglabāto koordinātu. Aptuvenās pašvaldību/apdzīvoto vietu koordinātas nav precīza norises adrese. Klikšķini uz punkta, lai atvērtu pasākumu.</p></section>
}