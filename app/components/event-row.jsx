import Link from 'next/link';
import WhenChip from './when-chip.jsx';
import StatusChip from './status-chip.jsx';
import {rowPlace,rowTile} from '../../lib/event-row.js';
import {eventPath} from '../../lib/seo.js';
import {rigaTodayIso} from '../../lib/event-date.js';
import './event-row.css';

// One event as a row, the same everywhere (prompt_vienoti_pasakumi.md): the date
// tile in the theme colour, the title, the date chip and the place, the theme,
// an actions slot that depends on where the row is, and an optional footer
// line under the row (the profile's plan, visit and reminder controls).
// variant: public | map | personal | organizer | admin.
// No hooks: server pages render it; client lists pass their own title button
// (title), place line (place) and actions.
export default function EventRow({event,today=rigaTodayIso(),variant='public',title=null,href=null,place=null,
 status=null,badges=[],actions=null,footer=null,highlighted=false,muted=false,as:Tag='li',className='',...rest}){
 const tile=rowTile(event);
 const link=href===false?null:href||eventPath(event);
 const heading=title||(link?<Link href={link} className="erow-title">{event.title}</Link>:<span className="erow-title">{event.title}</span>);
 return <Tag className={['erow','erow-'+variant,highlighted?'is-highlighted':'',muted?'is-muted':'',className].filter(Boolean).join(' ')} {...rest}>
  <span className={'erow-tile erow-'+tile.palette} aria-hidden="true"><strong>{tile.day}</strong><small>{tile.month}</small></span>
  <div className="erow-info">
   {heading}
   <span className="erow-facts">
    <WhenChip event={event} today={today}/>
    {status&&<StatusChip status={status}/>}
    <span className="erow-place">{place??rowPlace(event)}</span>
   </span>
   <span className="erow-theme">{tile.label}{badges.map(b=><span key={b} className="erow-badge">{b}</span>)}</span>
  </div>
  {actions&&<div className="erow-end">{actions}</div>}
  {footer&&<div className="erow-footer">{footer}</div>}
 </Tag>;
}
