import EventCatalog from './event-catalog.jsx';
import EventLinkList from '../components/event-link-list.jsx';
import {nearestEvents} from '../../lib/home-server.js';

export const dynamic='force-dynamic';
export const metadata = {
 title:'Pasākumu saraksts',
 description:'Gaidāmie pasākumi visā Latvijā: koncerti, izrādes, izstādes, sports un tirdziņi. Filtrē pēc datuma, novada un intereses.',
 alternates:{canonical:'/pasakumi'}
};
export default async function EventsPage() {
 const {near}=await nearestEvents(24);
 return <section className="section catalog"><p className="eyebrow">Pasākumi</p><h1>Kas notiek</h1><p className="lead">Gaidāmie pasākumi visā Latvijā — šodien, rīt un tuvākajos mēnešos.</p>
  <EventCatalog fallback={near.length?<EventLinkList events={near} className="catalog-fallback-list"/>:null}/></section>;
}
