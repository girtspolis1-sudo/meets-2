import OsmEventMap from './osm-event-map.jsx';
export const metadata = { title: 'Pasākumu karte' };
export default function MapPage() {
 return <section className="section map-page">
  <p className="eyebrow">01 / Atklāj</p>
  <h1>Pasākumu karte</h1>
  <p className="lead">OpenStreetMap karte ar MEETS 2 pasākumu punktiem no Supabase.</p>
  <OsmEventMap/>
 </section>;
}
