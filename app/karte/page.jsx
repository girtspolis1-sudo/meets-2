import {Suspense} from 'react';
import OsmEventMap from './osm-event-map.jsx';

export const metadata={title:'Pasākumu karte'};

export default function MapPage(){
 return <section className="map-page">
  <Suspense fallback={<p role="status">Ielādē karti…</p>}><OsmEventMap/></Suspense>
 </section>;
}
