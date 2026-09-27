import Link from 'next/link';
export const metadata = { title: 'Pasākumu karte' };
export default function MapPage() {
  return <section className="section"><p className="eyebrow">01 / Atklāj</p><h1>Pasākumu karte</h1><p className="lead">Atrodi, kur vērts būt.</p>
    <div className="empty"><span className="symbol" aria-hidden="true">◎</span><h2>Karte tiek sagatavota</h2><p>Šeit varēsi atlasīt pasākumus pēc atrašanās vietas, attāluma un datuma.</p><p>Pašlaik pasākumu dati vēl nav pieslēgti.</p><Link className="button" href="/pasakumi">Uz pasākumu sarakstu</Link></div>
  </section>;
}
