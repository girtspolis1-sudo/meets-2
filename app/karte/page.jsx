import {Suspense} from 'react';
import OsmEventMap from './osm-event-map.jsx';

export const metadata={title:'Pasākumu karte',description:'Visi gaidāmie pasākumi Latvijā kartē: redzi, kas notiek tev tuvumā šodien, rīt un nedēļas nogalē.',alternates:{canonical:'/karte'}};

export default function MapPage(){
 return <section className="map-page">
  <Suspense fallback={<p role="status">Ielādē karti…</p>}><OsmEventMap/></Suspense>
 </section>;
}
