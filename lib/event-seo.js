// Event page metadata and schema.org data. Pure functions: tests/event-seo.test.js.
import {cardDescription,cardLocation} from './discovery-card.js';
import {eventGroup,HOME_CATEGORY_FILTERS} from './home-category-filters.js';
import {SITE_URL,eventPath,isUuid,municipalityShortName} from './seo.js';

const MONTHS=['janv.','febr.','marts','apr.','maijs','jūn.','jūl.','aug.','sept.','okt.','nov.','dec.'];
const MONTHS_GEN=['janvārī','februārī','martā','aprīlī','maijā','jūnijā','jūlijā','augustā','septembrī','oktobrī','novembrī','decembrī'];
const isoDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
const hhmm=v=>/^\d{1,2}:\d{2}/.test(String(v||''))?String(v).padStart(5,'0').slice(0,5):'';

// "14. dec." (title) and "14. decembrī" (sentence)
export function shortDate(iso){
 if(!isoDate(iso))return '';
 return Number(iso.slice(8,10))+'. '+MONTHS[Number(iso.slice(5,7))-1];
}
export function sentenceDate(iso){
 if(!isoDate(iso))return '';
 return Number(iso.slice(8,10))+'. '+MONTHS_GEN[Number(iso.slice(5,7))-1];
}

// Riga's UTC offset on a date and wall-clock time: "+02:00" in winter, "+03:00" in summer.
export function rigaOffset(iso,time='12:00'){
 const [y,m,d]=iso.split('-').map(Number),[h,mi]=(hhmm(time)||'12:00').split(':').map(Number);
 const guess=Date.UTC(y,m-1,d,h,mi);
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Riga',hourCycle:'h23',year:'numeric',
  month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(guess)).map(p=>[p.type,p.value]));
 const shown=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute);
 const minutes=Math.round((shown-guess)/60000),sign=minutes<0?'-':'+',abs=Math.abs(minutes);
 return sign+String(Math.floor(abs/60)).padStart(2,'0')+':'+String(abs%60).padStart(2,'0');
}
// "2026-12-14T13:00:00+02:00", or the date alone when there is no time (never a midnight placeholder).
export function isoWithZone(date,time){
 if(!isoDate(date))return undefined;
 const t=hhmm(time);
 return t?date+'T'+t+':00'+rigaOffset(date,t):date;
}

const place=e=>e.settlement||e.municipality||'';
export function eventPlaceLabel(event){
 const p=place(event);
 return p&&p!==event.venue_name?municipalityShortName(p):'';
}

// "Ziemassvētku tirdziņš, 13. dec., Ropaži" kept near 60 characters; the template adds "| MEETS".
export function eventTitle(event){
 const title=String(event?.title||'Pasākums').replace(/\s+/g,' ').trim();
 const extras=[shortDate(event?.date_from),eventPlaceLabel(event)].filter(Boolean);
 let text=[title,...extras].join(', ');
 if(text.length<=62)return text;
 text=[title,extras[0]].filter(Boolean).join(', ');
 if(text.length<=62)return text;
 return title.length>62?title.slice(0,61).trimEnd()+'…':title;
}

// A description that is a flattened table (schedules, price lists) makes a poor summary.
export function looksLikeTable(text){
 const s=String(text||'');
 if(/vārds,?\s+uzvārds|mēneša diena/i.test(s.slice(0,160)))return true;
 const head=s.slice(0,200),digits=(head.match(/\d/g)||[]).length;
 return head.length>=80&&digits/head.length>0.18;
}
function categoryWord(event){
 const g=eventGroup(event);
 if(event.home_team&&event.away_team)return 'Spēle';
 if(event.primary_category)return String(event.primary_category);
 return HOME_CATEGORY_FILTERS[g]?.title||'Pasākums';
}
export function factsSentence(event){
 const when=[sentenceDate(event.date_from),hhmm(event.time_from)?'plkst. '+hhmm(event.time_from):''].filter(Boolean).join(' ');
 const where=[event.venue_name,place(event)].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
 const teams=event.home_team&&event.away_team?event.home_team+' – '+event.away_team+'. ':'';
 return (teams+[categoryWord(event)+(when?' '+when:''),where].filter(Boolean).join(', ')+'.').replace(/\s+/g,' ').trim();
}
// Meta description up to ~160 characters: the event's own words when they read as a summary,
// otherwise date, time and place.
export function eventDescription(event,max=160){
 const own=cardDescription(event);
 const facts=factsSentence(event);
 let text=own.length>=80&&!looksLikeTable(own)?own:(own&&!looksLikeTable(own)?facts+' '+own:facts);
 text=text.replace(/\s+/g,' ').trim();
 return text.length>max?text.slice(0,max-1).replace(/\s+\S*$/,'').trimEnd()+'…':text;
}

function postalAddress(event){
 const street=String(event.address_raw||'').trim();
 const hasStreet=/\d/.test(street)&&street!==event.venue_name;
 const address={'@type':'PostalAddress',addressCountry:String(event.country_code||'LV').toUpperCase()};
 if(hasStreet)address.streetAddress=street.split(',')[0].trim();
 if(event.settlement)address.addressLocality=event.settlement;
 else if(/valstspilsēta$/.test(String(event.municipality||'')))address.addressLocality=municipalityShortName(event.municipality);
 if(event.municipality)address.addressRegion=event.municipality;
 return address;
}
function offers(event,url){
 const low=event.price_min==null||event.price_min===''?null:Number(event.price_min);
 if(event.price_status==='free')return {'@type':'Offer',price:0,priceCurrency:'EUR',url};
 if(Number.isFinite(low)&&low>=0)return {'@type':'Offer',price:low,priceCurrency:String(event.currency||'EUR').toUpperCase(),url};
 return undefined;
}

// End of an event that never ends before it starts: a start time with no end time gives no
// end on a one-day event, and the last day's 23:59 on a longer one (a bare date would read as midnight).
export function eventEndDate(event){
 const from=event?.date_from,to=isoDate(event?.date_to)?event.date_to:from;
 if(!isoDate(from))return undefined;
 if(hhmm(event.time_to))return isoWithZone(to,event.time_to);
 if(!hhmm(event.time_from))return to===from?undefined:to;
 return to>from?isoWithZone(to,'23:59'):undefined;
}
// Picture for the event: its own cover, otherwise its generated share card.
export function eventImage(event,cover=''){
 if(String(cover).startsWith('https://'))return cover;
 return isUuid(event?.id)?SITE_URL+'/og/'+String(event.id).toLowerCase():'';
}

// schema.org Event (SportsEvent for matches), following Google's event structured data guide.
export function eventJsonLd(event,{image='',officialUrl=''}={}){
 const url=SITE_URL+eventPath(event);
 const sports=Boolean(event.home_team&&event.away_team)||['sports_match','sports_competition'].includes(event.event_type);
 const online=event.attendance_mode==='online',hybrid=event.attendance_mode==='hybrid';
 const location={'@type':'Place',name:cardLocation(event),address:postalAddress(event)};
 if(event.latitude!=null&&event.longitude!=null)location.geo={'@type':'GeoCoordinates',latitude:Number(event.latitude),longitude:Number(event.longitude)};
 const data={
  '@context':'https://schema.org',
  '@type':sports?'SportsEvent':'Event',
  name:event.title,
  url,
  startDate:isoWithZone(event.date_from,event.time_from),
  endDate:eventEndDate(event),
  eventStatus:event.status==='cancelled'?'https://schema.org/EventCancelled':'https://schema.org/EventScheduled',
  eventAttendanceMode:online?'https://schema.org/OnlineEventAttendanceMode':hybrid?'https://schema.org/MixedEventAttendanceMode':'https://schema.org/OfflineEventAttendanceMode',
  location:online?{'@type':'VirtualLocation',url:event.online_url||url}:location,
  description:eventDescription(event,500),
  inLanguage:'lv'
 };
 const picture=eventImage(event,image);
 if(picture)data.image=[picture];
 const offer=offers(event,officialUrl||url);
 if(offer)data.offers=offer;
 if(event.price_status==='free')data.isAccessibleForFree=true;
 if(event.organizer_name&&isUuid(event.organization_id))data.organizer={'@type':'Organization',name:event.organizer_name,url:SITE_URL+'/organizatori/'+event.organization_id};
 if(sports){
  if(event.home_team)data.homeTeam={'@type':'SportsTeam',name:event.home_team};
  if(event.away_team)data.awayTeam={'@type':'SportsTeam',name:event.away_team};
  if(event.competition_name)data.superEvent={'@type':'SportsEvent',name:event.competition_name};
 }
 return Object.fromEntries(Object.entries(data).filter(([,v])=>v!==undefined&&v!==''));
}
// JSON for a <script type="application/ld+json">; "<" escaped so text can never close the element.
export function jsonLdScript(data){return JSON.stringify(data).replace(/</g,'\\u003c');}
