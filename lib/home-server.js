import 'server-only';
import {readEventsCached} from './events-server.js';
import {rigaTodayIso} from './event-date.js';
import {eventGroup} from './home-category-filters.js';
import {municipalities} from './event-listings.js';

// The nearest coming events and the largest municipalities, for server-rendered
// links on the home and list pages. Empty when the catalogue cannot be read.
export async function nearestEvents(limit=24){
 try{
  const {events}=await readEventsCached();
  const today=rigaTodayIso();
  const near=events.filter(e=>e.id&&e.title&&eventGroup(e)!=='civic'&&e.date_from>=today).slice(0,limit);
  return {near,towns:municipalities(events)};
 }catch{return {near:[],towns:[]};}
}
