import Link from 'next/link';
import PublishedEvents from './published-events.jsx';

export default function Home() {
  return <>
    <section className="hero"><p className="eyebrow">Tavs nākamais piedzīvojums</p><h1>Satiekamies<br/><em>kaut kur tepat.</em></h1>
      <p className="lead">Kultūra, sports un mazi atklājumi visā Latvijā. Vienuviet, tuvāk tev.</p>
      <div className="actions"><Link className="button primary" href="/karte">Atvērt karti <span aria-hidden="true">↗</span></Link><Link className="button" href="/pasakumi">Pasākumu saraksts</Link></div>
    </section>
    <PublishedEvents/>
    <section className="cards" aria-label="Atrodi savu pasākumu">
      <Link className="card" href="/karte"><span className="number">01 / ATKLĀJ</span><h2>Kas notiek tuvumā?</h2><p>Pasākumu karte — top vietu un tuvumā notiekošo pasākumu atlase.</p><span className="card-link">Karte ↗</span></Link>
      <Link className="card" href="/pasakumi"><span className="number">02 / PLĀNO</span><h2>Izvēlies savu notikumu.</h2><p>Publicētie pasākumi, datumu filtri un atlasīto rezultātu Excel eksports.</p><span className="card-link">Pasākumi ↗</span></Link>
    </section>
    <p className="notice">Pasākumu sarakstā pieejami aktuālie datubāzes ieraksti. Interaktīvā karte vēl tiek veidota.</p>
  </>;
}
