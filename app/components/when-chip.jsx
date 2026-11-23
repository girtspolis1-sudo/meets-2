import {liveBadge,shortDate,whenLabel} from '../../lib/map-nearby.js';
import {rigaClockMinutes} from '../../lib/event-date.js';
import {eventTerm} from '../../lib/event-term.js';
import {isBackgroundLong,isLastDays} from '../../lib/event-duration.js';

// When the event is: "Šodien 18:00", "Rīt", "Apskatāms līdz 28. nov.", coloured
// like the map pin (today, tomorrow, later, last days, long-running). No hooks,
// so server pages and client lists both use it.
export function whenTone(event,today){
 return isBackgroundLong(event,today)?'long':isLastDays(event,today)?'lastdays':eventTerm(event,today).tone;
}
export default function WhenChip({event,today,className=''}){
 const multiDay=event.date_to&&event.date_to>event.date_from&&String(event.date_from)>=String(today);
 const live=liveBadge(event,today,rigaClockMinutes());
 return <span className={'when-chip event-facts-when term-'+whenTone(event,today)+(className?' '+className:'')}>
  {live==='now'?'Notiek tagad':whenLabel(event,today)}{multiDay?' – '+shortDate(event.date_to):''}
 </span>;
}
