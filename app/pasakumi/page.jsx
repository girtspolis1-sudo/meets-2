import EventCatalog from './event-catalog.jsx';
import EventLinkList from '../components/event-link-list.jsx';
import {nearestEvents} from '../../lib/home-server.js';
import {pageMeta} from '../../lib/page-meta.js';

export const dynamic='force-static';
export const revalidate=300;
export const metadata = {
 title:'Pasākumu saraksts',
 description:'Gaidāmie pasākumi visā Latvijā: koncerti, izrādes, izstādes, sports un tirdziņi. Filtrē pēc datuma, novada un intereses.',
 ...pageMeta('/pasakumi',{title:'Pasākumu saraksts'})
};
export default async function EventsPage() {
 const {near}=await nearestEvents(24);
 return <section className="section catalog"><p className="eyebrow">Pasākumi</p><h1>Kas notiek</h1><p className="lead">Gaidāmie pasākumi visā Latvijā — šodien, rīt un tuvākajos mēnešos.</p>
  <EventCatalog fallback={near.length?<EventLinkList events={near} className="catalog-fallback-list"/>:null}/></section>;
}
