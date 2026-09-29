import Link from 'next/link';
import SiteNav from './site-nav.jsx';
import './globals.css';

export const metadata = {
  title: { default: 'meets 2 — Pasākumi Latvijā', template: '%s | meets 2' },
  description: 'Atrodi pasākumus Latvijā kartē un pasākumu sarakstā.',
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }) {
  return <html lang="lv"><body>
    <a className="skip" href="#saturs">Pāriet uz saturu</a>
    <header className="header"><Link className="brand" href="/" aria-label="meets 2 sākumlapa">meets <span>2</span></Link>
      <SiteNav/>
      <span className="preview">Izstrādes versija</span>
    </header>
    <main id="saturs">{children}</main>
    <footer><span>meets 2</span><p>Pasākumi, kas saved kopā.</p><span>Latvija</span></footer>
  </body></html>;
}
