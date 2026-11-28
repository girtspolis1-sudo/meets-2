import {sportOf,toMin,toTime} from './tournament.js';

// A published tournament read as an event, so its page can use the same picture
// top as an event (EventCardMedia: theme picture by sport, date chip, title) and
// the same calendar and directions actions (meets-personal.js). Pure; tests in
// tests/tournament-event.test.js.

// The theme of each tournament sport, as topic-art.js knows it.
const SPORT_TOPIC={basket3x3:'Basketbols',basket5x5:'Basketbols',football:'Futbols',floorball:'Florbols',
 volleyball:'Volejbols',hockey:'Hokejs',handball:'Handbols'};

// First game start and last game end ("HH:MM"), or '' when there is no schedule yet.
export function tournamentHours(t){
 const starts=(t?.games||[]).map(g=>toMin(g.starts_at)).filter(m=>m!==null);
 if(!starts.length)return {from:'',to:''};
 const slot=Number(t?.settings?.slot)||sportOf(t?.sport).slot||15;
 return {from:toTime(Math.min(...starts)),to:toTime(Math.min(Math.max(...starts)+slot,23*60+59))};
}

// link: the page address, written into the calendar entry.
export function tournamentEvent(t,token='',link=''){
 const hours=tournamentHours(t);
 const date=/^\d{4}-\d{2}-\d{2}$/.test(String(t?.play_date||''))?t.play_date:'';
 return {
  id:'turnirs-'+String(token||t?.id||''),
  title:String(t?.title||'Turnīrs'),
  date_from:date,date_to:date,
  time_from:hours.from,time_to:hours.to,
  primary_category:SPORT_TOPIC[t?.sport]||'Sports',
  event_type:'sports_competition',
  // Tournaments have no coordinates: directions search for the venue's name.
  venue_name:String(t?.venue||''),
  address_raw:String(t?.venue||''),
  cover_image_url:null,
  description:link?'Spēļu grafiks un rezultāti: '+link:'Spēļu grafiks un rezultāti meets.lv'
 };
}
