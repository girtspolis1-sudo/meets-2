import Link from 'next/link';
import {notFound} from 'next/navigation';
import {publicOrganizer} from '../../../lib/public-organizers.js';
import FollowButton from '../../components/follow-button.jsx';

export const dynamic='force-dynamic';
export async function generateMetadata({params}){const {id}=await params;const value=await publicOrganizer(id);return {title:value?.organization?.name?value.organization.name+' — MEETS organizators':'MEETS organizators'};}
export default async function OrganizerPublicPage({params}){
 const {id}=await params,value=await publicOrganizer(id);if(!value)notFound();
 const org=value.organization,events=Array.isArray(value.events)?value.events:[],venues=Array.isArray(value.venues)?value.venues:[];
 return <section className="public-organizer-page">
  <header className="public-organizer-hero">
   <div className="public-organizer-logo">{org.image_url?<img src={org.image_url} alt=""/>:<span>{org.name.slice(0,1).toLocaleUpperCase('lv')}</span>}</div>
   <div><p className="eyebrow">MEETS · Organizators</p><h1>{org.name}</h1>{org.description&&<p>{org.description}</p>}
    <div className="public-organizer-contacts">{org.public_email&&<a href={'mailto:'+org.public_email}>{org.public_email}</a>}{org.public_phone&&<a href={'tel:'+org.public_phone}>{org.public_phone}</a>}{org.public_url&&<a href={org.public_url} target="_blank" rel="noopener noreferrer">Mājaslapa ↗</a>}</div>
   </div><FollowButton targetKind="organization" targetId={org.id} className="button primary"/>
  </header>
  <section className="public-organizer-section"><div className="org-panel-head"><div><h2>Gaidāmie pasākumi</h2><p>Publicētie pasākumi, ko šis organizators ir iesniedzis MEETS.</p></div><Link className="button" href="/karte">Atvērt karti →</Link></div>
   <div className="public-event-grid">{events.map(e=><article key={e.submission_id||e.id}><span>{e.date_from||'Datums nav norādīts'}</span><h3>{e.title}</h3><p>{e.venue_name||e.address||'Vieta nav norādīta'}</p>{e.id&&<Link href={'/karte?event='+e.id}>Atvērt pasākumu →</Link>}</article>)}</div>
   {!events.length&&<p className="org-empty">Šobrīd nav gaidāmu publicētu pasākumu.</p>}
  </section>
  {venues.length>0&&<section className="public-organizer-section"><h2>Norises vietas</h2><div className="public-venue-grid">{venues.map(v=><article key={v.id}><h3>{v.name}</h3><p>{v.address}</p><Link href={'/vietas/'+v.id}>Atvērt vietu →</Link></article>)}</div></section>}
 </section>;
}
