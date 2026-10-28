import EventCatalog from './event-catalog.jsx';
export const metadata = {title:'Pasākumu saraksts'};
export default function EventsPage() {
 return <section className="section catalog"><p className="eyebrow">Pasākumi</p><h1>Pasākumu saraksts</h1><p className="lead">Visi notikumi vienuviet. Atrodi, atlasi un saglabā sev interesējošos.</p><EventCatalog/></section>;
}
