import Link from 'next/link';
import {SPORTS_PATH,YOUTH_SPORTS_PATH} from '../../../lib/nav-sections.js';
import './sports.css';

// "Pieaugušie · Jaunieši" above the sports lists. The pages are static, so these
// are links to the other level's page, not a filter in the browser.
// On the two sports pages the chosen level is the page itself; on a league or
// listing page it is only the level of what is listed (aria-current="true").
export default function SportLevelLinks({current='senior',page=false}){
 const mark=level=>current===level?(page?'page':'true'):undefined;
 return <nav className="listing-chips sport-level-links" aria-label="Sacensību līmenis">
  <Link href={SPORTS_PATH} aria-current={mark('senior')}>Pieaugušie</Link>
  <Link href={YOUTH_SPORTS_PATH} aria-current={mark('youth')}>Jaunieši</Link>
 </nav>;
}
