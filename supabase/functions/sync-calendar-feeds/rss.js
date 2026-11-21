// Municipality RSS feeds (TVP platform, /lv/rss/events) as MEETS events. Returns
// the same item shape as occurrences() in ics.js, so syncFeed handles both.
// No libraries: the edge function runs in Deno and the tests in Node.
//
// TVP writes xcal:dtstart/dtend as UTC wall-clock time with a local offset label:
// "08:00:00+02:00" is 10:00 in Riga (checked against the event pages), and an
// all-day event is "22:00:00+02:00" … "21:59:59+02:00" of the day before. The
// feed is checked for that pattern; if TVP fixes the offsets (all-day events end
// at "23:59:59"), the offsets are used as written.

const RIGA='Europe/Riga';

const NAMED={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',hellip:'…',laquo:'«',raquo:'»',
 bdquo:'„',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',euro:'€',copy:'©',shy:''};

export function decodeEntities(text){
 return String(text??'').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(all,code)=>{
  if(code[0]==='#'){
   const n=code[1]==='x'||code[1]==='X'?parseInt(code.slice(2),16):parseInt(code.slice(1),10);
   return Number.isFinite(n)&&n>0&&n<0x110000?String.fromCodePoint(n):all;
  }
  const v=NAMED[code.toLowerCase()];
  return v===undefined?all:v;
 });
}

// Element text: CDATA kept as is, the rest entity-decoded; HTML inside becomes plain text.
export function elementText(raw){
 if(raw==null)return '';
 let out='';
 const re=/<!\[CDATA\[([\s\S]*?)\]\]>/g;let last=0,m;
 while((m=re.exec(raw))){out+=decodeEntities(raw.slice(last,m.index))+m[1];last=re.lastIndex;}
 out+=decodeEntities(raw.slice(last));
 // Escaped HTML in descriptions: line breaks kept, tags dropped, entities left after that decoded.
 if(/<[a-z!\/][^>]*>/i.test(out)){
  out=decodeEntities(out.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li|h\d)>/gi,'\n').replace(/<[^>]+>/g,''));
 }
 return out.replace(/[ \t ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}

function tag(item,name){
 const esc=name.replace(/[:.]/g,m=>'\\'+m);
 const m=item.match(new RegExp('<'+esc+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+esc+'>','i'));
 if(m)return elementText(m[1]);
 return new RegExp('<'+esc+'(?:\\s[^>]*)?/>','i').test(item)?'':null;
}

export function itemBlocks(xml){
 return [...String(xml||'').matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
}

// Same key as meets_private.tvp_url_key(): host without www., path without trailing / and query.
export function tvpUrlKey(url){
 const s=String(url||'').trim().toLowerCase().split('#')[0].split('?')[0];
 if(!s)return '';
 return s.replace(/^[a-z][a-z0-9+.-]*:\/\//,'').replace(/^www\./,'').replace(/\/+$/,'');
}

function wallClock(date){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:RIGA,hourCycle:'h23',year:'numeric',month:'2-digit',
  day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(date).map(x=>[x.type,x.value]));
 return {date:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute,seconds:p.hour+':'+p.minute+':'+p.second};
}

const STAMP=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

// 'utc' when the feed writes UTC clock times with a local label (TVP), 'offset' when the offsets are true.
export function detectClock(blocks){
 for(const b of blocks){
  const end=tag(b,'xcal:dtend')||'';
  const m=end.match(STAMP);
  if(!m||m[6]!=='59'||m[5]!=='59')continue;
  if(m[4]==='23')return 'offset';
  if(m[4]==='21'||m[4]==='20')return 'utc';
 }
 return 'utc';
}

// A feed time stamp as a Riga date and time.
export function rigaTime(value,clock='utc'){
 const m=String(value||'').trim().match(STAMP);
 if(!m)return null;
 const [,y,mo,d,h,mi,s='00',zone]=m;
 let ms=Date.UTC(+y,+mo-1,+d,+h,+mi,+s);
 if(clock==='offset'&&zone&&zone!=='Z'){
  const z=zone.replace(':','');
  ms-=(z[0]==='-'?-1:1)*(Number(z.slice(1,3))*60+Number(z.slice(3,5)))*60000;
 }
 return wallClock(new Date(ms));
}

function addDays(iso,n){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}

function normalize(text){return String(text||'').toLocaleLowerCase('lv').replace(/\s+/g,' ').trim();}

// An item is skipped when its type or title contains one of the configured phrases.
export function isSkipped(item,skipTypes=[]){
 const type=normalize(item.categories?.[0]),title=normalize(item.title);
 return skipTypes.map(normalize).filter(Boolean).some(p=>type.includes(p)||title.includes(p));
}

function pubDate(text){const t=Date.parse(text||'');return Number.isFinite(t)?new Date(t).toISOString():null;}

// All items with their dates and times in Riga (no window, no filter).
export function parseRss(xml){
 const blocks=itemBlocks(xml),clock=detectClock(blocks);
 const items=[];
 for(const b of blocks){
  const title=tag(b,'title');
  const start=rigaTime(tag(b,'xcal:dtstart'),clock);
  if(!title||!start)continue;
  let end=rigaTime(tag(b,'xcal:dtend'),clock);
  if(end&&(end.date<start.date||(end.date===start.date&&end.seconds<start.seconds)))end=null;
  // All day: 00:00 … 23:59:59 in Riga (after the clock fix).
  const allDay=start.seconds==='00:00:00'&&(!end||end.seconds==='23:59:59');
  const sameMoment=!end||(end.date===start.date&&end.seconds===start.seconds);
  const dateTo=end?end.date:start.date;
  const link=tag(b,'link')||'',guid=tag(b,'guid')||link;
  const type=tag(b,'dc:type')||tag(b,'category')||'';
  const description=[tag(b,'description'),tag(b,'dc:description')].filter(Boolean).join('\n\n');
  items.push({
   key:tvpUrlKey(guid)||guid||title+'|'+start.date,
   title,description,
   dateFrom:start.date,dateTo,
   timeFrom:allDay?null:start.time,
   // dtend equal to dtstart means "no end time", not a zero-length event.
   timeTo:allDay||sameMoment?null:end.time,
   location:tag(b,'xcal:location')||'',
   url:link||(/^https?:/i.test(guid)?guid:''),
   categories:type?[type]:[],
   geo:null,
   allDay,
   pubDate:pubDate(tag(b,'pubDate'))
  });
 }
 return {items,clock,count:blocks.length};
}

// Items for MEETS: without skipped types, between `from` and `to` (YYYY-MM-DD, Riga).
export function rssOccurrences(xml,{from,to,skipTypes=[]}={}){
 const parsed=parseRss(xml);
 const kept=[];let skipped=0;
 for(const item of parsed.items){
  if(isSkipped(item,skipTypes)){skipped++;continue;}
  if((from&&item.dateTo<from)||(to&&item.dateFrom>to))continue;
  kept.push(item);
 }
 const pubs=parsed.items.map(i=>i.pubDate).filter(Boolean).sort();
 return {items:kept.sort((a,b)=>a.dateFrom.localeCompare(b.dateFrom)||String(a.timeFrom||'').localeCompare(String(b.timeFrom||''))),
  skipped,count:parsed.count,clock:parsed.clock,oldestPub:pubs[0]||null};
}

export const isRss=text=>/<rss[\s>]/i.test(String(text||'').slice(0,2000));
export const isIcs=text=>/BEGIN:VCALENDAR/i.test(String(text||''));
export {addDays};

// UTC instant (ISO) of a Riga wall-clock date and time ("HH:MM"), or null.
export function rigaInstant(date,time){
 if(!date||!time)return null;
 const [y,mo,d]=date.split('-').map(Number),[h,mi]=time.split(':').map(Number);
 const target=Date.UTC(y,mo-1,d,h,mi);
 let guess=target;
 for(let i=0;i<3;i++){
  const w=wallClock(new Date(guess));
  const shown=Date.UTC(+w.date.slice(0,4),+w.date.slice(5,7)-1,+w.date.slice(8,10),+w.time.slice(0,2),+w.time.slice(3,5));
  if(shown===target)break;
  guess+=target-shown;
 }
 return new Date(guess).toISOString();
}
