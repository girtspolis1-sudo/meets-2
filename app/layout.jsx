import Link from 'next/link';
import SiteNav from './site-nav.jsx';
import MobileBottomNav from './mobile-bottom-nav.jsx';
import AdminFooterControl from './admin-footer-control.jsx';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import './ux-enhancements.css';
import './quick-flow.css';
import './profile-dashboard.css';
import './organizer-workspace.css';
import './discovery-design.css';
import './personal-collections.css';
import './design-refresh.css';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://meets.lv'),
  title: { default: 'MEETS — Pasākumi Latvijā', template: '%s | MEETS' },
  description: 'Atrodi pasākumus Latvijā un Baltijā kartē un pasākumu sarakstā.',
  openGraph: { siteName: 'MEETS', locale: 'lv_LV', type: 'website' },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
    apple: '/meets-logo-purple.png'
  },
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
    </header>
    <main id="saturs">{children}</main>
    <MobileBottomNav/>
    <footer>
      <img className="footer-logo" src="/meets-logo-purple.png" alt="MEETS"/>
      <p>Pasākumi, kas saved cilvēkus kopā.</p>
      <nav className="footer-links" aria-label="Kājenes saites">
        <Link href="/karte">Karte</Link>
        <Link href="/pasakumi">Pasākumi</Link>
        <Link href="/registre-pasakumu">Pievienot pasākumu</Link>
        <Link href="/organizators">Organizatoriem</Link>
      </nav>
      <div className="footer-side">
        <span>Latvija</span>
        <AdminFooterControl/>
      </div>
    </footer>
  </body></html>;
}
