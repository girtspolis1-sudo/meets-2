import {Suspense} from 'react';
import OsmEventMap from './osm-event-map.jsx';
import {pageMeta} from '../../lib/page-meta.js';

export const metadata={title:'Pasākumu karte',description:'Visi gaidāmie pasākumi Latvijā kartē: redzi, kas notiek tev tuvumā šodien, rīt un brīvdienās.',...pageMeta('/karte',{title:'Pasākumu karte'})};

export default function MapPage(){
 return <section className="map-page">
  <h1 className="sr-only">Pasākumu karte</h1>
  <Suspense fallback={<p role="status">Ielādē karti…</p>}><OsmEventMap/></Suspense>
 </section>;
}
