import Link from 'next/link';
import SiteNav from './site-nav.jsx';
import './globals.css';

export const metadata = {
  title: { default: 'MEETS — Pasākumi Latvijā', template: '%s | MEETS' },
  description: 'Atrodi pasākumus Latvijā un Baltijā kartē un pasākumu sarakstā.',
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }) {
  return <html lang="lv"><body>
    <a className="skip" href="#saturs">Pāriet uz saturu</a>
    <header className="header">
      <Link className="brand" href="/" aria-label="MEETS sākumlapa">
        <img className="brand-logo" src="/meets-logo-purple.png" alt="MEETS"/>
      </Link>
      <SiteNav/>
      <span className="preview">Izstrādes versija</span>
    </header>
    <main id="saturs">{children}</main>
    <footer>
      <img className="footer-logo" src="/meets-logo-purple.png" alt="MEETS"/>
      <p>Pasākumi, kas saved kopā.</p>
      <span>Latvija</span>
    </footer>
  </body></html>;
}
