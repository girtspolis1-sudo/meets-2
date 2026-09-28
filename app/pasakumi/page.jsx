import EventCatalog from './event-catalog.jsx';
export const metadata = {title:'Pasākumu saraksts un Excel'};
export default function EventsPage() {
 return <section className="section catalog"><p className="eyebrow">02 / Plāno</p><h1>Pasākumu saraksts</h1><p className="lead">Visi notikumi vienuviet. Atrodi, atlasi un paņem līdzi Excel failā.</p><EventCatalog/></section>;
}
