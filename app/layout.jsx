import Link from 'next/link';
import localFont from 'next/font/local';
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
import './event-share.css';
import './event-create.css';
import './event-calendar.css';

// Fonts ship with the app, so a build never depends on reaching Google Fonts.
// app/fonts holds the variable Google Fonts originals (OFL, licences beside
// them) cut to the latin + latin-ext ranges, which carry ā č ē ģ ī ķ ļ ņ š ū ž,
// and to the weights the site uses.
const manrope=localFont({src:'./fonts/Manrope-latin.woff2',weight:'400 800',variable:'--font-manrope',display:'swap'});
const unbounded=localFont({src:'./fonts/Unbounded-latin.woff2',weight:'500 700',variable:'--font-unbounded',display:'swap'});

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
        <Link href="/organizators">Rīkotājiem</Link>
        <Link href="/privatums">Privātums</Link>
      </nav>
      <div className="footer-side">
        <span>Latvija</span>
        <AdminFooterControl/>
      </div>
    </footer>
  </body></html>;
}
