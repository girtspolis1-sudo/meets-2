import {eventGroup} from './home-category-filters.js';
import {matchesLevel} from './sport-level.js';
import {isBackgroundLong} from './event-duration.js';
import {cardImage} from './discovery-card.js';

// The events the home page shows under "Tuvākajās dienās". The server renders
// them before the catalogue loads in the browser and the browser renders the
// same list afterwards, so the page does not jump.
export const HOME_PICK_COUNT=6;

// Coming events in date order; on the same day an event with its own picture
// first. Council meetings, youth competitions (unless chosen) and exhibitions
// that are simply running are left out: they come back on their opening day
// and in their last week.
export function homePicks(events,today,limit=HOME_PICK_COUNT){
 return (Array.isArray(events)?events:[])
  .filter(e=>e&&e.id&&e.title&&eventGroup(e)!=='civic'&&matchesLevel(e)&&!isBackgroundLong(e,today)&&String(e.date_to||e.date_from||'')>=today)
  .sort((a,b)=>{
   const date=String(a.date_from||'9999').localeCompare(String(b.date_from||'9999'));
   if(date)return date;
   return Number(Boolean(cardImage(b)))-Number(Boolean(cardImage(a)));
  })
  .slice(0,limit);
}
