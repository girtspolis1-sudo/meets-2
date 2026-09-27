import Link from 'next/link';
export const metadata = { title: 'Pasākumu saraksts' };
export default function EventsPage() {
  return <section className="section"><p className="eyebrow">02 / Plāno</p><h1>Pasākumu saraksts</h1><p className="lead">Atvēli laiku kam interesantam.</p>
    <div className="empty"><span className="symbol" aria-hidden="true">≡</span><h2>Saraksts tiek sagatavots</h2><p>Šeit būs publicētie pasākumi ar meklēšanu, filtriem un Excel eksportu.</p><p>Pašlaik pasākumu dati vēl nav pieslēgti.</p><Link className="button" href="/karte">Uz karti</Link></div>
  </section>;
}
