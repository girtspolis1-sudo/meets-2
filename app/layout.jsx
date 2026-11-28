import Link from 'next/link';
import localFont from 'next/font/local';
import SiteNav from './site-nav.jsx';
import MobileBottomNav from './mobile-bottom-nav.jsx';
import AnalyticsConsent,{ConsentSettingsLink} from './components/analytics-consent.jsx';
import AuthReturn from './components/auth-return.jsx';
import {CONTROLLER} from '../lib/legal.js';
import AdminFooterControl from './admin-footer-control.jsx';
import {SITE_URL,siteRobots} from '../lib/seo.js';
import {SPORTS_PATH} from '../lib/nav-sections.js';
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
import './tournament.css';
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
  metadataBase: new URL(SITE_URL),
  title: { default: 'meets.lv — Pasākumi tuvumā', template: '%s | meets.lv' },
  description: 'Kas notiek tev blakus: šodien un brīvdienās. Koncerti, izrādes, izstādes un sporta spēles visā Latvijā.',
  openGraph: { siteName: 'meets.lv', locale: 'lv_LV', type: 'website', images: [{ url: '/og', width: 1200, height: 630 }] },
  // The "m." mark. Search engines want a square favicon in a multiple of 48 px,
  // so the .ico (16/32/48) and the 192 px PNG come before the SVG. Bump ?v= when
  // the files change: browsers keep a favicon cached long after a deploy.
  icons: {
    icon: [
      { url: '/favicon.ico?v=3', sizes: '48x48' },
      { url: '/icon-192.png?v=3', type: 'image/png', sizes: '192x192' },
      { url: '/icon.svg?v=3', type: 'image/svg+xml' }
    ],
    shortcut: '/favicon.ico?v=3',
    apple: [{ url: '/apple-icon.png?v=3', sizes: '180x180' }]
  },
  // Indexed only where NEXT_PUBLIC_ALLOW_INDEXING=true (Vercel Production).
  robots: siteRobots(),
  // Search engine ownership of https://www.meets.lv/: Google Search Console and Bing Webmaster Tools.
  verification: {
    google: 'aauDfGwLpip0cv31cXFcuTwTxKWEF59nghTP0FSnJBA',
    other: { 'msvalidate.01': '873D0FC5F5D0365C2E4BF221424EC60B' }
  }
};

export default function RootLayout({ children }) {
  return <html lang="lv" className={manrope.variable+' '+unbounded.variable}><body><AuthReturn/>
    <a className="skip" href="#saturs">Pāriet uz saturu</a>
    <header className="header">
      <Link className="brand" href="/" aria-label="meets.lv sākumlapa">
        <Wordmark/>
      </Link>
      <SiteNav/>
    </header>
    <main id="saturs">{children}</main>
    <MobileBottomNav/>
    <AnalyticsConsent/>
    <footer>
      <Wordmark/>
      <p>Pasākumi tev blakus. Visā Latvijā.</p>
      <nav className="footer-links" aria-label="Kājenes saites">
        <Link href="/karte">Karte</Link>
        <Link href="/pasakumi">Pasākumi</Link>
        <Link href={SPORTS_PATH}>Sports</Link>
        <Link href="/pasakumi?period=weekend">Brīvdienās</Link>
        <Link href="/registre-pasakumu">Pievienot pasākumu</Link>
        <Link href="/organizators">Rīkotājiem</Link>
        <Link href="/privatums">Privātums</Link>
        <ConsentSettingsLink/>
      </nav>
      <div className="footer-side">
        <span>Latvija</span>
        <AdminFooterControl/>
      </div>
      {/* The last line of every page. */}
      <p className="footer-contact-row"><a className="footer-contact" href={'mailto:'+CONTROLLER.email}>Kontakti: <strong>{CONTROLLER.email}</strong></a></p>
    </footer>
  </body></html>;
}
