import Link from 'next/link';
import {Manrope,Unbounded} from 'next/font/google';
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
import './meets-theme.css';
import './mobile-bottom-nav.css';

// latin-ext carries the Latvian letters (ā č ē ģ ī ķ ļ ņ š ū ž).
const manrope=Manrope({subsets:['latin','latin-ext'],weight:['400','500','600','700','800'],variable:'--font-manrope',display:'swap'});
const unbounded=Unbounded({subsets:['latin','latin-ext'],weight:['500','600','700'],variable:'--font-unbounded',display:'swap'});

function Wordmark(){
  return <span className="meets-wordmark">meets<span>.</span>lv</span>;
}

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
  return <html lang="lv" className={manrope.variable+' '+unbounded.variable}><body>
    <a className="skip" href="#saturs">Pāriet uz saturu</a>
    <header className="header">
      <Link className="brand" href="/" aria-label="meets.lv sākumlapa">
        <Wordmark/>
      </Link>
      <SiteNav/>
    </header>
    <main id="saturs">{children}</main>
    <MobileBottomNav/>
    <footer>
      <Wordmark/>
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
