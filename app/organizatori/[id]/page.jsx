import Link from 'next/link';
import {notFound} from 'next/navigation';
import {publicOrganizer} from '../../../lib/public-organizers.js';
import FollowButton from '../../components/follow-button.jsx';
import {socialLabel} from '../../../lib/social-links.js';
import ShareButton from '../../components/share-button.jsx';

export const dynamic='force-dynamic';
// Link previews on Facebook, WhatsApp and others: name, description and logo.
export async function generateMetadata({params}){
 const {id}=await params;const value=await publicOrganizer(id);const org=value?.organization;
 if(!org)return {title:'MEETS organizators'};
 const count=Array.isArray(value.events)?value.events.length:0;
 const description=(String(org.description||'').trim().slice(0,180)||'Organizatora pasākumi MEETS kartē.')+(count?' · '+count+' gaidāmi pasākumi':'');
 const title=org.name+' — MEETS organizators';
 const images=org.image_url?[{url:org.image_url,alt:org.name}]:undefined;
 return {title,description,alternates:{canonical:'/organizatori/'+id},
  openGraph:{title,description,type:'profile',url:'/organizatori/'+id,siteName:'MEETS',locale:'lv_LV',images},
  twitter:{card:images?'summary':'summary',title,description,images:images?.map(i=>i.url)}};
}
const WD=['Sv','P','O','T','C','Pk','S'];
function eventDate(e){
 if(!e.date_from)return 'Datums nav norādīts';
 const d=new Date(e.date_from+'T12:00:00Z');
 const one=WD[d.getUTCDay()]+' '+e.date_from.slice(8,10)+'.'+e.date_from.slice(5,7)+'.';
 const to=e.date_to&&e.date_to!==e.date_from?' – '+e.date_to.slice(8,10)+'.'+e.date_to.slice(5,7)+'.':'';
 return one+to+(e.time_from?' · '+String(e.time_from).slice(0,5):'');
}
export default async function OrganizerPublicPage({params}){
 const {id}=await params,value=await publicOrganizer(id);if(!value)notFound();
 const contactDetails=value.contactDetails||null,org=value.organization,events=Array.isArray(value.events)?value.events:[],venues=Array.isArray(value.venues)?value.venues:[];
 return <section className="public-organizer-page">
  <header className="public-organizer-hero">
   <div className="public-organizer-logo">{org.image_url?<img src={org.image_url} alt=""/>:<span>{org.name.slice(0,1).toLocaleUpperCase('lv')}</span>}</div>
   <div><p className="eyebrow">MEETS · Organizators</p><h1>{org.name}</h1>{org.description&&<p>{org.description}</p>}
    {contactDetails&&<div className="public-organizer-details">{contactDetails.address&&<p><strong>Galvenā adrese:</strong> {contactDetails.address}</p>}{Array.isArray(contactDetails.contacts)&&contactDetails.contacts.map((contact,i)=><p key={i}><strong>{contact.label||({email:'E-pasts',phone:'Telefons',person:'Kontaktpersona',other:'Kontakts'}[contact.type]||'Kontakts')}:</strong> {contact.type==='email'?<a href={'mailto:'+contact.value}>{contact.value}</a>:contact.type==='phone'?<a href={'tel:'+contact.value}>{contact.value}</a>:contact.value}</p>)}</div>}
    <div className="public-organizer-contacts">{org.public_email&&<a href={'mailto:'+org.public_email}>{org.public_email}</a>}{org.public_phone&&<a href={'tel:'+org.public_phone}>{org.public_phone}</a>}{org.public_url&&<a href={org.public_url} target="_blank" rel="noopener noreferrer">Mājaslapa ↗</a>}{(Array.isArray(org.social_links)?org.social_links:[]).filter(l=>/^https:\/\//.test(String(l?.url||''))).map(l=><a key={l.network} className={'public-organizer-social social-'+l.network} href={l.url} target="_blank" rel="noopener noreferrer">{socialLabel(l.network)} ↗</a>)}</div>
   </div><div className="public-organizer-actions"><FollowButton targetKind="organization" targetId={org.id} className="button primary"/><ShareButton path={'/organizatori/'+org.id} title={org.name+' — pasākumi MEETS'} label="Dalīties ar profilu"/></div>
  </header>
  <section className="public-organizer-section"><div className="org-panel-head"><div><h2>Gaidāmie pasākumi</h2><p>Publicētie pasākumi, ko šis organizators ir iesniedzis MEETS.</p></div><Link className="button" href="/karte">Atvērt karti →</Link></div>
   <div className="public-event-grid">{events.map(e=><article key={e.submission_id||e.id}>
    <span>{eventDate(e)}</span><h3>{e.id?<Link href={'/pasakumi/'+e.id}>{e.title}</Link>:e.title}</h3>
    <p>{e.venue_name||e.address||'Vieta nav norādīta'}</p>
    {e.description&&<p className="public-event-description">{String(e.description).slice(0,160)}{String(e.description).length>160?'…':''}</p>}
    {e.id&&<div className="public-event-actions"><Link className="button compact" href={'/pasakumi/'+e.id}>Atvērt →</Link><Link className="button compact ghost" href={'/karte?event='+e.id}>Kartē</Link><ShareButton path={'/pasakumi/'+e.id} title={e.title} label="Dalīties" className="button compact ghost"/></div>}
   </article>)}</div>
   {!events.length&&<p className="org-empty">Šobrīd nav gaidāmu publicētu pasākumu.</p>}
  </section>
  {venues.length>0&&<section className="public-organizer-section"><h2>Norises vietas</h2><div className="public-venue-grid">{venues.map(v=><article key={v.id}><h3>{v.name}</h3><p>{v.address}</p><Link href={'/vietas/'+v.id}>Atvērt vietu →</Link></article>)}</div></section>}
 </section>;
}
