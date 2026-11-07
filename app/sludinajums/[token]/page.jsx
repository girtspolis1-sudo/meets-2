import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {cache} from 'react';
import FlyerToolbar from './flyer-toolbar.jsx';
import MeetsSunMark from '../../components/meets-sun-mark.jsx';
import {readSharedEvent,requestOrigin} from '../../../lib/shared-event-server.js';
import {coverImageUrl,excerpt,flyerTextLines,placeLines,priceLine,scheduleLines,sharePath} from '../../../lib/shared-event.js';
import {qrPath} from '../../../lib/qr-path.js';

export const dynamic='force-dynamic';

const findEvent=cache(async token=>{try{return await readSharedEvent(token);}catch{return null;}});

export async function generateMetadata({params}){
 const {token}=await params;
 const event=await findEvent(token);
 return {title:event?'Sludinājums: '+event.title:'Sludinājums nav pieejams',robots:{index:false,follow:false}};
}

const MONTH=new Intl.DateTimeFormat('lv-LV',{month:'short',timeZone:'UTC'});
function dateBadge(iso){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||'')))return null;
 const date=new Date(iso+'T12:00:00Z');
 return {day:date.getUTCDate(),month:MONTH.format(date).replace('.','').toLocaleUpperCase('lv')};
}

export default async function FlyerPage({params}){
 const {token}=await params;
 const event=await findEvent(token);
 if(!event)notFound();
 const link=requestOrigin(await headers())+sharePath(token);
 const qr=qrPath(link);
 const image=coverImageUrl(process.env.SUPABASE_URL,event.cover_image_path);
 const badge=dateBadge(event.date_from);
 const when=scheduleLines(event,{maxDays:4});
 const where=placeLines(event);
 const price=priceLine(event);
 // The description takes the lines left on the sheet (about 65 characters each).
 const textLines=flyerTextLines({title:event.title,when,where,price});
 const text=textLines?excerpt(event.description,textLines*65):'';
 const org=event.organization?.name||'';
 return <div className="flyer-screen">
  <FlyerToolbar backHref={sharePath(token)}/>
  <article className={'flyer-sheet'+(image?' has-image':'')} aria-label={'Sludinājums: '+event.title}>
   <header className="flyer-top">
    {image?<img src={image} alt=""/>:<MeetsSunMark className="flyer-mark"/>}
    <span className="flyer-brand">meets.lv</span>
    {badge&&<span className="flyer-date"><strong>{badge.day}</strong><small>{badge.month}</small></span>}
   </header>
   <div className="flyer-body">
    <p className="flyer-category">{event.category||'Pasākums'}</p>
    <h1 className="flyer-title">{event.title}</h1>
    <div className="flyer-when">{when.map((line,i)=><span key={i}>{line}</span>)}</div>
    <div className="flyer-where">{where.map((line,i)=><span key={i}>{line}</span>)}</div>
    {price&&<p className="flyer-price">{price}</p>}
    {text&&<p className="flyer-text" style={{'--flyer-text-lines':textLines}}>{text}</p>}
   </div>
   <footer className="flyer-foot">
    <svg className="flyer-qr" viewBox={`-4 -4 ${qr.size+8} ${qr.size+8}`} role="img" aria-label="QR kods uz pasākuma lapu" shapeRendering="crispEdges">
     <rect x="-4" y="-4" width={qr.size+8} height={qr.size+8} fill="#fff"/>
     <path d={qr.d} fill="#1b2430"/>
    </svg>
    <div className="flyer-foot-text">
     <strong>Skenē un uzzini vairāk</strong>
     {org&&<span>Organizē: {org}</span>}
     <span className="flyer-link">{link.replace(/^https?:\/\//,'')}</span>
    </div>
    <span className="flyer-foot-brand">meets<span>.</span>lv</span>
   </footer>
  </article>
 </div>;
}
