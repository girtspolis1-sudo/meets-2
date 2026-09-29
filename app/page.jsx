import Link from 'next/link';
import PublishedEvents from './published-events.jsx';

export default function Home() {
  return <>
    <section className="hero"><p className="eyebrow">Tavs nākamais piedzīvojums</p><h1>Satiekamies<br/><em>kaut kur tepat.</em></h1>
      <p className="lead">Kultūra, sports un mazi atklājumi visā Latvijā. Vienuviet, tuvāk tev.</p>
      <div className="actions"><Link className="button primary" href="/karte">Atvērt karti <span aria-hidden="true">↗</span></Link><Link className="button" href="/pasakumi">Pasākumu saraksts</Link></div>
    </section>
    <PublishedEvents/>
    <section className="cards" aria-label="MEETS 2 sadaļas">
      <Link className="card" href="/karte"><span className="number">01 / PUBLISKAIS</span><h2>Pasākumu karte</h2><p>Tikai apstiprinātie pasākumi no viena Supabase datu avota.</p><span className="card-link">Karte ↗</span></Link>
      <Link className="card" href="/pasakumi"><span className="number">02 / PUBLISKAIS</span><h2>Tabula un Excel</h2><p>Tie paši publicētie pasākumi ar filtriem un Excel eksportu.</p><span className="card-link">Pasākumi ↗</span></Link>
      <Link className="card" href="/admin"><span className="number">03 / ADMIN</span><h2>Pārbaude un publicēšana</h2><p>Statusi, apstiprināšana un nepareizu lokāciju labošana.</p><span className="card-link">Admin ↗</span></Link>
    </section>
    <p className="notice">Publiskā karte un tabula izmanto vienu un to pašu <code>published</code> datu kopu. Admin sadaļā apstiprinātās izmaiņas automātiski nonāk abos publiskajos skatos.</p>
  </>;
}
