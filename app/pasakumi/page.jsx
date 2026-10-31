import EventCatalog from './event-catalog.jsx';
export const metadata = {title:'Pasākumu saraksts'};
export default function EventsPage() {
 return <section className="section catalog"><p className="eyebrow">Pasākumi</p><h1>Kas notiek</h1><p className="lead">Gaidāmie pasākumi visā Latvijā — šodien, rīt un tuvākajos mēnešos.</p><EventCatalog/></section>;
}
