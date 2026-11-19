import Link from 'next/link';
import localFont from 'next/font/local';
import SiteNav from './site-nav.jsx';
import MobileBottomNav from './mobile-bottom-nav.jsx';
import AnalyticsConsent,{ConsentSettingsLink} from './components/analytics-consent.jsx';
import AuthReturn from './components/auth-return.jsx';
import {CONTROLLER} from '../lib/legal.js';
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
import './tournament.css';
import './event-create.css';
import './event-calendar.css';

// Fonts ship with the app, so a build never depends on reaching Google Fonts.
// app/fonts holds the variable Google Fonts originals (OFL, licences beside
// them) cut to the latin + latin-ext ranges, which carry ā č ē ģ ī ķ ļ ņ š ū ž,
// and to the weights the site uses.
const manrope=localFont({src:'./fonts/Manrope-latin.woff2',weight:'400 800',variable:'--font-manrope',display:'swap'});
const unbounded=localFont({src:'./fonts/Unbounded-latin.woff2',weight:'500 700',variable:'--font-unbounded',display:'swap'});

// The header wordmark tells the brand in under two seconds (design system
// "meets.lv", component AnimatedLogo): the two e's are two people who meet,
// three rays spark above them, the dot drops like a map pin and a ripple
// spreads from it ("tuvumā"). Pure CSS in meets-theme.css: it plays once when
// the page loads (the layout persists across client navigation), again on
// hover, and not at all with prefers-reduced-motion. The footer stays static.
function Wordmark({animated=false}){
  if(!animated) return <span className="meets-wordmark">meets<span className="wm-dot">.</span>lv</span>;
  return <span className="meets-wordmark is-animated">
    <span className="wm-m">m</span><span className="wm-ee"><span className="wm-e1">e</span><span className="wm-e2">e</span><svg className="wm-rays" viewBox="-450 -940 900 320" aria-hidden="true" focusable="false"><path className="wm-ray wm-r2" pathLength="1" d="M0 -690V-900"/><path className="wm-ray wm-r1" pathLength="1" d="M-300 -660L-410 -820"/><path className="wm-ray wm-r3" pathLength="1" d="M300 -660L410 -820"/></svg></span><span className="wm-ts">ts</span><span className="wm-dot">.</span><span className="wm-lv">lv</span>
  </span>;
}

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://meets.lv'),
  title: { default: 'MEETS — Pasākumi tuvumā', template: '%s | MEETS' },
  description: 'Atrodi, kas notiek tev blakus šodien un nedēļas nogalē: koncerti, izrādes, izstādes un sporta spēles visā Latvijā.',
  openGraph: { siteName: 'MEETS', locale: 'lv_LV', type: 'website' },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
    apple: '/meets-logo-purple.png'
  },
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }) {
  return <html lang="lv" className={manrope.variable+' '+unbounded.variable}><body><AuthReturn/>
    <a className="skip" href="#saturs">Pāriet uz saturu</a>
    <header className="header">
      <Link className="brand" href="/" aria-label="meets.lv sākumlapa">
        <Wordmark animated/>
      </Link>
      <SiteNav/>
    </header>
    <main id="saturs">{children}</main>
    <MobileBottomNav/>
    <AnalyticsConsent/>
    <footer>
      <Wordmark/>
      <p>Pasākumi, kas saved cilvēkus kopā.</p>
      <nav className="footer-links" aria-label="Kājenes saites">
        <Link href="/karte">Karte</Link>
        <Link href="/pasakumi">Pasākumi</Link>
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
