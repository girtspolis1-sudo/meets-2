import {distanceLabel,isApproximatePlace,liveBadge,priceLabel,shortDate,whenLabel} from '../../lib/map-nearby.js';
import {display} from '../../lib/catalog.js';

// When, where, what and how much — the same lines in the map list, the place
// panel and the event page. No hooks, so server pages can use it too.
export default function EventFacts({event,today,clock=null,km=null,title=null,compact=false}){
 const multiDay=event.date_to&&event.date_to>event.date_from;
 const live=clock===null?'':liveBadge(event,today,clock);
 const place=[event.venue_name,event.settlement||event.municipality].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
 const category=event.primary_category||display(event,'event_type')||'';
 const price=priceLabel(event);
 return <>
  <span className="event-facts-when">{whenLabel(event,today)}{multiDay?' – '+shortDate(event.date_to):''}
   {live&&<em className={'nearby-live '+live}>{live==='now'?'Notiek tagad':'Drīz sāksies'}</em>}</span>
  {title}
  <span className="event-facts-place">{[distanceLabel(km),place].filter(Boolean).join(' · ')||'Vieta nav norādīta'}</span>
  {!compact&&event.address_raw&&event.address_raw!==event.venue_name&&<span className="event-facts-address">{event.address_raw}</span>}
  {!compact&&isApproximatePlace(event)&&<span className="nearby-approx">Precīza vieta nav zināma — kartē rādīts apdzīvotās vietas centrs</span>}
  {(category||price||(compact&&isApproximatePlace(event)))&&<span className="nearby-tags">{category&&<span>{category}</span>}{price&&<span className={event.price_status==='free'?'free':''}>{price}</span>}
   {compact&&isApproximatePlace(event)&&<span className="approx" title="Precīza vieta nav zināma — kartē rādīts apdzīvotās vietas centrs">Aptuvena vieta</span>}</span>}
 </>;
}
