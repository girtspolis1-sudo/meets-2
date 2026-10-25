'use client';
import Link from 'next/link';
import EventQuickActions from './event-quick-actions.jsx';
import {cardCategory,cardDate,cardDescription,cardGroup,cardImage,cardLocation,cardPrice} from '../../lib/discovery-card.js';

const EMOJI={music:'🎵',stage:'🎭',culture:'🖼️',sport:'⚽',active:'🌿',markets:'🎉',learning:'💡',community:'🤝',other:'✦'};
export default function DiscoveryEventCard({event,onOpen,actions=false,footer=null}){
 const image=cardImage(event),group=cardGroup(event),price=cardPrice(event),summary=cardDescription(event);
 const detailHref='/pasakumi?event='+encodeURIComponent(event.id);
 return <article className={'meets-discovery-card catalog-event-card theme-'+group}>
  <div className={'meets-discovery-card-media'+(!image?' has-no-image':'')}>
   {image?<img src={image} alt="" loading="lazy" decoding="async" onError={e=>{e.currentTarget.hidden=true;e.currentTarget.parentElement.classList.add('has-no-image');}}/>:null}
   <span className="meets-card-media-symbol" aria-hidden="true">{EMOJI[group]}</span>
   <span className="meets-card-category">{cardCategory(event)}</span>
   <EventQuickActions event={event} favoriteOnly/>
  </div>
  <div className="meets-discovery-card-body">
   <div className="meets-discovery-card-title-row"><h3>{event.title}</h3>{price&&<span className={'meets-discovery-price'+(event.price_status==='free'?' is-free':'')}>{price}</span>}</div>
   <div className="meets-discovery-card-facts">
    <span><span aria-hidden="true">▦</span> {cardDate(event)}</span>
    <span><span aria-hidden="true">⌖</span> {cardLocation(event)}</span>
   </div>
   {summary?<p className="meets-discovery-description">{summary}</p>:<p className="meets-discovery-description is-empty">Vairāk par pasākumu un norisi</p>}
   <div className="meets-discovery-card-cta">
    {onOpen?<button type="button" className="meets-card-main-action" onClick={()=>onOpen(event.id)}>Skatīt vairāk <span aria-hidden="true">→</span></button>:
     <Link href={detailHref} className="meets-card-main-action">Skatīt vairāk <span aria-hidden="true">→</span></Link>}
   </div>
   {actions&&<div className="meets-card-secondary-actions"><EventQuickActions event={event}/></div>}
   {footer&&<div className="meets-card-additional">{footer}</div>}
  </div>
 </article>;
}
