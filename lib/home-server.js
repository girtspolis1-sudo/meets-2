import 'server-only';
import {readEventsCached} from './events-server.js';
import {rigaTodayIso} from './event-date.js';
import {eventGroup} from './home-category-filters.js';
import {matchesLevel} from './sport-level.js';
import {municipalities,topLeagues,weekendTowns} from './event-listings.js';
import {gameSports,homeGames,homePicks} from './home-picks.js';

// The nearest coming events, the home page lists (picks, this week's games and
// their sports, weekend towns), the largest municipalities and leagues, for
// server-rendered content on the home and list pages. Empty when the catalogue
// cannot be read.
export async function nearestEvents(limit=24){
 try{
  const {events}=await readEventsCached();
  const today=rigaTodayIso();
  const near=events.filter(e=>e.id&&e.title&&eventGroup(e)!=='civic'&&matchesLevel(e)&&e.date_from>=today).slice(0,limit);
  return {near,picks:homePicks(events,today),games:homeGames(events,today),sports:gameSports(events,today),
   weekend:weekendTowns(events,today),towns:municipalities(events),leagues:topLeagues(events,today,6)};
 }catch{return {near:[],picks:[],games:[],sports:[],weekend:[],towns:[],leagues:[]};}
}
