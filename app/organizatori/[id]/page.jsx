import Icon from '../../components/line-icon.jsx';
import Link from 'next/link';
import EventRow from '../../components/event-row.jsx';
import EventListActions from '../../components/event-list-actions.jsx';
import {nearbyMapPath} from '../../../lib/event-sharing.js';
import {notFound,permanentRedirect} from 'next/navigation';
import {publicOrganizer,validOrganizerId} from '../../../lib/public-organizers.js';
import {organizerPath} from '../../../lib/organizer-path.js';
import FollowButton from '../../components/follow-button.jsx';
import {socialLabel} from '../../../lib/social-links.js';
import ShareButton from '../../components/share-button.jsx';
import {eventPath} from '../../../lib/seo.js';

export const dynamic='force-dynamic';
// Link previews on Facebook, WhatsApp and others: name, description and logo.
export async function generateMetadata({params}){
 const {id}=await params;const value=await publicOrganizer(id);const org=value?.organization;
 if(!org)return {title:'meets.lv rīkotājs'};
 const count=Array.isArray(value.events)?value.events.length:0;
 const description=(String(org.description||'').trim().slice(0,180)||'Rīkotāja pasākumi meets.lv kartē.')+(count?' · '+count+' gaidāmi pasākumi':'');
 const title=org.name+' — pasākumi meets.lv';
 const path=organizerPath(org);
 const images=org.image_url?[{url:org.image_url,alt:org.name}]:undefined;
 return {title,description,alternates:{canonical:path},
  openGraph:{title,description,type:'profile',url:path,siteName:'meets.lv',locale:'lv_LV',images},
  twitter:{card:'summary',title,description,images:images?.map(i=>i.url)}};
}

const CONTACT_LABEL={email:'E-pasts',phone:'Telefons',person:'Kontaktpersona',other:'Kontakts'};
const REQUISITES=[['legal_name','Nosaukums'],['reg_number','Reģ. Nr.'],['vat_number','PVN Nr.'],['bank_name','Banka'],['bank_account','Konts']];
function directionsUrl(lat,lon,address){
 if(Number.isFinite(lat)&&Number.isFinite(lon))return 'https://www.google.com/maps/dir/?api=1&destination='+lat+','+lon;
 return address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address):'';
}

export default async function OrganizerPublicPage({params}){
 const {id}=await params,value=await publicOrganizer(id);if(!value)notFound();
 const org=value.organization;
 // Old links by id move to the readable name address.
 if(validOrganizerId(id)&&org.slug)permanentRedirect(organizerPath(org));
 const details=value.contactDetails||{},events=Array.isArray(value.events)?value.events:[],venues=Array.isArray(value.venues)?value.venues:[];
 const contacts=Array.isArray(details.contacts)?details.contacts.filter(c=>c?.value):[];
 const requisites=details.requisites&&typeof details.requisites==='object'?REQUISITES.filter(([k])=>details.requisites[k]):[];
 const socials=(Array.isArray(org.social_links)?org.social_links:[]).filter(l=>/^https:\/\//.test(String(l?.url||'')));
 const lat=Number(details.address_latitude),lon=Number(details.address_longitude);
 const hasPoint=details.address_latitude!=null&&Number.isFinite(lat)&&Number.isFinite(lon);
 const route=directionsUrl(hasPoint?lat:NaN,hasPoint?lon:NaN,details.address);
 const mapHref='/karte?org='+encodeURIComponent(org.id);
 const path=organizerPath(org);
 const hasInfo=details.address||contacts.length||requisites.length;
 return <section className="org-site">
  <header className="org-site-hero">
   <div className="org-site-logo">{org.image_url?<img src={org.image_url} alt=""/>:<span>{org.name.slice(0,1).toLocaleUpperCase('lv')}</span>}</div>
   <div className="org-site-intro">
    <p className="eyebrow">Rīkotājs</p>
    <h1>{org.name}</h1>
    {org.description&&<p className="org-site-description">{org.description}</p>}
    <ul className="org-site-stats" aria-label="Īsumā">
     <li><strong>{events.length}</strong> {events.length===1?'gaidāms pasākums':'gaidāmi pasākumi'}</li>
     {venues.length>0&&<li><strong>{venues.length}</strong> {venues.length===1?'norises vieta':'norises vietas'}</li>}
     {details.address&&<li><Icon name="pin" size={16}/> {details.address}</li>}
    </ul>
    {(org.public_url||socials.length>0)&&<div className="org-site-links">
     {org.public_url&&<a href={org.public_url} target="_blank" rel="noopener noreferrer" className="org-site-link web"><Icon name="globe" size={16}/> Mājaslapa</a>}
     {socials.map(l=><a key={l.network} href={l.url} target="_blank" rel="noopener noreferrer" className={'org-site-link social-'+l.network}>{socialLabel(l.network)}</a>)}
    </div>}
   </div>
   <div className="org-site-actions">
    <FollowButton targetKind="organization" targetId={org.id} className="button primary" label="Sekot rīkotājam" followingLabel="Seko rīkotājam"/>
    <ShareButton path={path} title={org.name+' — pasākumi meets.lv'} label="Dalīties ar lapu"/>
    {events.length>0&&<Link className="button" href={mapHref}>Pasākumi kartē →</Link>}
   </div>
  </header>

  <section className="org-site-section" aria-labelledby="org-events">
   <div className="org-site-section-head">
    <div><h2 id="org-events">Gaidāmie pasākumi</h2><p>Visi rīkotāja publicētie pasākumi vienuviet.</p></div>
   </div>
   {/* The shared event row (prompt_vienoti_pasakumi.md): the same tile, date chip and actions as the listing pages. */}
   {events.length?<ul className="event-link-list elist">{events.map(e=>{
    const ev={...e,primary_category:e.primary_category||e.category,venue_name:e.venue_name||e.address};
    const map=e.id?nearbyMapPath(ev):null;
    return <EventRow key={e.submission_id||e.id} event={ev} href={e.id?undefined:false} actions={e.id?<>
     {map&&<Link className="elist-map" href={map}><span>Kartē</span></Link>}
     <EventListActions event={ev}/>
    </>:null}/>;})}</ul>
   :<p className="org-empty">Šobrīd nav gaidāmu pasākumu. Seko rīkotājam — paziņosim, kad parādīsies jauni.</p>}
  </section>

  {(hasInfo||venues.length>0)&&<div className="org-site-grid">
   {(details.address||venues.length>0)&&<section className="org-site-card" aria-labelledby="org-where">
    <h2 id="org-where">Kur mūs atrast</h2>
    {details.address&&<div className="org-site-place">
     <strong>{details.address}</strong>
     <span className="org-site-place-actions">
      {route&&<a className="button compact" href={route} target="_blank" rel="noopener noreferrer">Norādes ↗</a>}
      {hasPoint&&<Link className="button compact ghost" href={'/karte?lat='+lat.toFixed(4)+'&lon='+lon.toFixed(4)+'&radius=5'}>Pasākumi apkārtnē</Link>}
     </span>
    </div>}
    {venues.length>0&&<ul className="org-site-venues">{venues.map(v=><li key={v.id}>
     <div><strong>{v.name}</strong>{v.address&&<span>{v.address}</span>}</div>
     <span className="org-site-place-actions">
      {directionsUrl(Number(v.latitude),Number(v.longitude),v.address)&&<a className="button compact ghost" href={directionsUrl(Number(v.latitude),Number(v.longitude),v.address)} target="_blank" rel="noopener noreferrer">Norādes ↗</a>}
      <Link className="button compact ghost" href={'/vietas/'+v.id}>Vieta →</Link>
     </span>
    </li>)}</ul>}
   </section>}
   {contacts.length>0&&<section className="org-site-card" aria-labelledby="org-contacts">
    <h2 id="org-contacts">Kontakti</h2>
    <dl className="org-site-list">{contacts.map((c,i)=><div key={i}><dt>{c.label||CONTACT_LABEL[c.type]||'Kontakts'}</dt>
     <dd>{c.type==='email'?<a href={'mailto:'+c.value}>{c.value}</a>:c.type==='phone'?<a href={'tel:'+String(c.value).replace(/\s+/g,'')}>{c.value}</a>:c.value}</dd></div>)}</dl>
   </section>}
   {requisites.length>0&&<section className="org-site-card" aria-labelledby="org-requisites">
    <h2 id="org-requisites">Rekvizīti</h2>
    <dl className="org-site-list">{requisites.map(([k,label])=><div key={k}><dt>{label}</dt><dd>{details.requisites[k]}</dd></div>)}</dl>
   </section>}
  </div>}

  <footer className="org-site-foot">
   <p>Šī lapa ir daļa no <Link href="/karte">meets.lv</Link> — pasākumu karte visā Latvijā.</p>
  </footer>
 </section>;
}
