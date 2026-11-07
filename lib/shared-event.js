// Share links and printable flyers of organizer events. Every event the editor
// creates gets a share token; a private event is seen only through it, a public
// one also through MEETS review, the catalogue and the map.
import {cardPrice} from './discovery-card.js';

const TOKEN=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COVER_PATH=/^[a-f\d-]+\/[a-f\d-]+\/[a-f\d-]+\.(jpg|png|webp)$/;

export const VISIBILITY_LABELS={public:'Publisks',private:'Privāts'};
export const VISIBILITY_HINTS={
 public:'Pēc MEETS pārbaudes redzams kartē un sarakstā',
 private:'Redzams tikai tiem, kam nosūti saiti'
};

export const isShareToken=value=>TOKEN.test(String(value||''));
export const sharePath=token=>'/ielugums/'+token;
export const flyerPath=token=>'/sludinajums/'+token;

// Public storage address of an uploaded cover image, or '' for anything else.
export function coverImageUrl(supabaseUrl,path){
 return supabaseUrl&&COVER_PATH.test(String(path||''))?supabaseUrl+'/storage/v1/object/public/meets-event-images/'+path:'';
}

// UTC offset of Riga on a date: GMT+02:00 in winter, GMT+03:00 in summer.
export function rigaOffsetLabel(iso){
 const day=isoDate(iso)||new Date();
 const part=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Riga',timeZoneName:'longOffset'})
  .formatToParts(day).find(p=>p.type==='timeZoneName');
 return part?.value||'GMT+02:00';
}

const LONG=new Intl.DateTimeFormat('lv-LV',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'});
const DAY_MONTH=new Intl.DateTimeFormat('lv-LV',{day:'numeric',month:'long',timeZone:'UTC'});
const SHORT=new Intl.DateTimeFormat('lv-LV',{day:'numeric',month:'short',timeZone:'UTC'});
const WEEKDAY_SHORT=['Sv','Pr','Ot','Tr','Ce','Pk','Se'];
// ISO weekday 1 = Monday ... 7 = Sunday, as the weekly schedule stores it.
const ON_WEEKDAY=['','Pirmdienās','Otrdienās','Trešdienās','Ceturtdienās','Piektdienās','Sestdienās','Svētdienās'];

function isoDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return null;
 const date=new Date(value+'T12:00:00Z');
 return Number.isNaN(date.getTime())?null:date;
}
const hm=value=>value?String(value).slice(0,5):'';
const span=(a,b)=>a&&b?a+'–'+b:a||'';
const capital=text=>text?text[0].toLocaleUpperCase('lv')+text.slice(1):text;

// "7.–9. novembris" within a month, "30. oktobris – 2. novembris" across months.
export function dateRangeLabel(fromIso,toIso){
 const from=isoDate(fromIso),to=isoDate(toIso);
 if(!from)return '';
 if(!to||toIso===fromIso)return DAY_MONTH.format(from);
 if(from.getUTCMonth()===to.getUTCMonth()&&from.getUTCFullYear()===to.getUTCFullYear())
  return from.getUTCDate()+'.–'+DAY_MONTH.format(to);
 return DAY_MONTH.format(from)+' – '+DAY_MONTH.format(to);
}

// When the event takes place, as short lines for the shared page and the flyer.
export function scheduleLines(event,{maxDays=6}={}){
 const e=event||{};
 const from=isoDate(e.date_from);
 if(!from)return ['Datums nav norādīts'];
 const time=span(hm(e.time_from),hm(e.time_to));
 const slots=Array.isArray(e.recurrence_slots)?e.recurrence_slots:[];
 if(e.schedule_kind==='recurring'){
  const lines=slots.map(s=>ON_WEEKDAY[s.weekday]?ON_WEEKDAY[s.weekday]+' '+span(s.start,s.end):'').filter(Boolean);
  const to=isoDate(e.date_to);
  lines.push(SHORT.format(from)+(to?' – '+SHORT.format(to):''));
  return lines;
 }
 if(e.schedule_kind==='dated'&&slots.length){
  const days=slots.filter(s=>isoDate(s.date)).map(s=>{
   const d=isoDate(s.date);
   return WEEKDAY_SHORT[d.getUTCDay()]+', '+SHORT.format(d)+' '+span(s.start,s.end);
  });
  return days.length>maxDays?[...days.slice(0,maxDays-1),'un vēl '+(days.length-maxDays+1)+' dienas']:days;
 }
 if(e.date_to&&e.date_to!==e.date_from){
  return [dateRangeLabel(e.date_from,e.date_to),time?'Katru dienu '+time:''].filter(Boolean);
 }
 return [capital(LONG.format(from))+(time?', '+time:'')];
}

// Where: the place, the call for online events, or both.
export function placeLines(event){
 const e=event||{};
 const place=[e.venue_name,e.address].map(x=>String(x||'').trim()).filter(Boolean)
  .filter((value,i,all)=>all.indexOf(value)===i);
 if(e.attendance_mode==='online')return ['Tiešsaistē'];
 if(e.attendance_mode==='hybrid')return [...place,'Arī tiešsaistē'];
 return place.length?place:['Vieta nav norādīta'];
}

export function priceLine(event){
 return cardPrice(event||{})||(event?.price_status==='paid'||event?.price_status==='mixed'?'Maksas':'');
}

// Short description for the flyer: whole words, at most `max` characters.
export function excerpt(text,max=420){
 const plain=String(text||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 if(plain.length<=max)return plain;
 const cut=plain.slice(0,max-1);
 return cut.slice(0,Math.max(cut.lastIndexOf(' '),max*0.6)).trimEnd()+'…';
}

// How many description lines fit on the A4 flyer under the title, time, place
// and price, so the text ends on a whole line. Heights are in sheet widths / 100
// (cqw), matching app/event-share.css: 53.1 of body height less a 2-unit margin,
// 2 between blocks.
export function flyerTextLines({title='',when=[],where=[],price=''}={}){
 const titleLines=Math.min(3,Math.max(1,Math.ceil(String(title).length/19)));
 const blocks=4+(price?1:0);
 const used=2.8+titleLines*6.7
  +4.9+Math.max(0,when.length-1)*4.25
  +3.9+Math.max(0,where.length-1)*3.75
  +(price?5.1:0)+blocks*2;
 return Math.max(0,Math.min(8,Math.floor((51.1-used)/3.7)));
}

// Where a shared event stands, in words for its page: private or public, and
// whether the public one is on the map yet.
export function sharedStatusNote(event){
 if(event?.visibility==='private')return 'Privāts pasākums — redzams tikai tiem, kam ir šī saite.';
 if(event?.status==='pending_review'&&!event?.event_id)return 'Publisks pasākums — gaida MEETS pārbaudi; kartē un sarakstā tas parādīsies pēc apstiprināšanas.';
 return 'Publisks pasākums — redzams MEETS kartē un sarakstā.';
}
