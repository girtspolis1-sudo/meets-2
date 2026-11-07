import Link from 'next/link';
import {notFound,permanentRedirect} from 'next/navigation';
import {publicOrganizer,validOrganizerId} from '../../../lib/public-organizers.js';
import {organizerPath} from '../../../lib/organizer-path.js';
import FollowButton from '../../components/follow-button.jsx';
import {socialLabel} from '../../../lib/social-links.js';
import ShareButton from '../../components/share-button.jsx';

export const dynamic='force-dynamic';
// Link previews on Facebook, WhatsApp and others: name, description and logo.
export async function generateMetadata({params}){
 const {id}=await params;const value=await publicOrganizer(id);const org=value?.organization;
 if(!org)return {title:'MEETS rīkotājs'};
 const count=Array.isArray(value.events)?value.events.length:0;
 const description=(String(org.description||'').trim().slice(0,180)||'Rīkotāja pasākumi MEETS kartē.')+(count?' · '+count+' gaidāmi pasākumi':'');
 const title=org.name+' — pasākumi MEETS';
 const path=organizerPath(org);
 const images=org.image_url?[{url:org.image_url,alt:org.name}]:undefined;
 return {title,description,alternates:{canonical:path},
  openGraph:{title,description,type:'profile',url:path,siteName:'MEETS',locale:'lv_LV',images},
  twitter:{card:'summary',title,description,images:images?.map(i=>i.url)}};
}

const WD=['svētdiena','pirmdiena','otrdiena','trešdiena','ceturtdiena','piektdiena','sestdiena'];
const MONTHS=['janv.','febr.','marts','apr.','maijs','jūn.','jūl.','aug.','sept.','okt.','nov.','dec.'];
function dateParts(e){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(e.date_from||'')))return null;
 const d=new Date(e.date_from+'T12:00:00Z');
 const wd=WD[d.getUTCDay()];
 return {day:d.getUTCDate(),month:MONTHS[d.getUTCMonth()],weekday:wd.charAt(0).toLocaleUpperCase('lv')+wd.slice(1)};
}
function eventWhen(e){
 const parts=[];
 if(e.date_to&&e.date_to!==e.date_from)parts.push('līdz '+e.date_to.slice(8,10)+'.'+e.date_to.slice(5,7)+'.');
 const from=String(e.time_from||'').slice(0,5),to=String(e.time_to||'').slice(0,5);
 if(from)parts.push(to?from+'–'+to:from);
 return parts.join(' · ');
}
function priceText(e){
 if(e.price_status==='free')return 'Bezmaksas';
 const min=Number(e.price_min),max=Number(e.price_max);
 if(e.price_min!=null&&Number.isFinite(min)&&min>0)return (Number.isFinite(max)&&max>min?min+'–'+max:String(min)).replace(/\./g,',')+' €';
 return e.price_status==='paid'?'Maksas':'';
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
    <p className="eyebrow">Rīkotājs · MEETS</p>
    <h1>{org.name}</h1>
    {org.description&&<p className="org-site-description">{org.description}</p>}
    <ul className="org-site-stats" aria-label="Īsumā">
     <li><strong>{events.length}</strong> {events.length===1?'gaidāms pasākums':'gaidāmi pasākumi'}</li>
     {venues.length>0&&<li><strong>{venues.length}</strong> {venues.length===1?'norises vieta':'norises vietas'}</li>}
     {details.address&&<li>📍 {details.address}</li>}
    </ul>
    {(org.public_url||socials.length>0)&&<div className="org-site-links">
     {org.public_url&&<a href={org.public_url} target="_blank" rel="noopener noreferrer" className="org-site-link web">🌐 Mājaslapa</a>}
     {socials.map(l=><a key={l.network} href={l.url} target="_blank" rel="noopener noreferrer" className={'org-site-link social-'+l.network}>{socialLabel(l.network)}</a>)}
    </div>}
   </div>
   <div className="org-site-actions">
    <FollowButton targetKind="organization" targetId={org.id} className="button primary" label="Sekot" followingLabel="Sekoju"/>
    <ShareButton path={path} title={org.name+' — pasākumi MEETS'} label="Dalīties ar lapu"/>
    {events.length>0&&<Link className="button" href={mapHref}>Pasākumi kartē →</Link>}
   </div>
  </header>

  <section className="org-site-section" aria-labelledby="org-events">
   <div className="org-site-section-head">
    <div><h2 id="org-events">Gaidāmie pasākumi</h2><p>Visi rīkotāja publicētie pasākumi vienuviet.</p></div>
    {events.length>0&&<Link className="button" href={mapHref}>Rādīt kartē →</Link>}
   </div>
   {events.length?<div className="org-site-events">{events.map(e=>{
    const d=dateParts(e),when=eventWhen(e),price=priceText(e);
    return <article key={e.submission_id||e.id} className="org-site-event">
     <div className="org-site-date" aria-hidden="true">{d?<><strong>{d.day}</strong><span>{d.month}</span></>:<span>—</span>}</div>
     <div className="org-site-event-body">
      <p className="org-site-event-when">{d?d.weekday:''}{when?' · '+when:''}</p>
      <h3>{e.id?<Link href={'/pasakumi/'+e.id}>{e.title}</Link>:e.title}</h3>
      <p className="org-site-event-place">{e.venue_name||e.address||'Vieta nav norādīta'}</p>
      {e.description&&<p className="org-site-event-text">{String(e.description).slice(0,180)}{String(e.description).length>180?'…':''}</p>}
      <div className="org-site-event-foot">
       {(e.category||price)&&<span className="org-site-tags">{e.category&&<span>{e.category}</span>}{price&&<span className={e.price_status==='free'?'free':''}>{price}</span>}</span>}
       {e.id&&<span className="org-site-event-actions">
        <Link className="button compact" href={'/pasakumi/'+e.id}>Atvērt</Link>
        <Link className="button compact ghost" href={'/karte?event='+e.id}>Kartē</Link>
        <ShareButton path={'/pasakumi/'+e.id} title={e.title} label="Dalīties" className="button compact ghost"/>
       </span>}
      </div>
     </div>
    </article>;})}</div>
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
   <ShareButton path={path} title={org.name+' — pasākumi MEETS'} label="Dalīties ar šo lapu" className="button compact"/>
  </footer>
 </section>;
}
