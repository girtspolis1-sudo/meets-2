// Event lists of city websites that do not use the state platform or an .ics feed:
// Daugavpils, Jelgava, Valmiera and Cēsis. Each parser turns one fetched page into
// plain items; sync-city-events writes them like the other imports. Pure functions,
// tested in tests/city-events.test.js.

const ENTITIES={amp:'&',nbsp:' ',quot:'"',apos:"'",lt:'<',gt:'>',ndash:'–',mdash:'—',hellip:'…',laquo:'«',raquo:'»',bdquo:'„',ldquo:'“',rdquo:'”'};
export function text(html){
 return String(html||'').replace(/<(script|style)[\s\S]*?<\/\1>/gi,' ').replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n')
  .replace(/<[^>]+>/g,' ')
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
  .replace(/&([a-z]+);/gi,(m,n)=>ENTITIES[n.toLowerCase()]??m)
  .replace(/[ \t\u00a0]+/g,' ').replace(/\s*\n\s*/g,'\n').trim();
}
const oneLine=v=>text(v).replace(/\s+/g,' ').trim();
const plain=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const pad=n=>String(n).padStart(2,'0');
const DMY=/(\d{1,2})\.(\d{1,2})\.(\d{4})/;
function dmy(value){const m=String(value||'').match(DMY);return m?m[3]+'-'+pad(m[2])+'-'+pad(m[1]):null;}
function hm(value){const m=String(value||'').match(/\b(\d{1,2})[:.](\d{2})\b/);return m&&Number(m[1])<24?pad(m[1])+':'+m[2]:null;}
const MONTHS={jan:1,feb:2,mar:3,apr:4,mai:5,may:5,jun:6,jul:7,aug:8,sep:9,okt:10,oct:10,nov:11,dec:12};
// "12 Nov" without a year: this year, or next year when that date is more than two months back.
export function dayMonth(day,month,today){
 const m=MONTHS[plain(month).slice(0,3)],d=Number(day);
 if(!m||!(d>=1&&d<=31))return null;
 let year=Number(today.slice(0,4));
 const iso=y=>y+'-'+pad(m)+'-'+pad(d);
 const back=new Date(today+'T12:00:00Z');back.setUTCMonth(back.getUTCMonth()-2);
 if(iso(year)<back.toISOString().slice(0,10))year++;
 return iso(year);
}
// "Venue, Street 10, Town" -> venue "Venue"; an address alone stays the venue.
export function splitPlace(place){
 const value=oneLine(place);
 if(!value)return {venue:null,address:null};
 const first=value.split(',')[0].trim();
 const isAddress=/\d/.test(first)&&/\b(iela|ielā|gatve|aleja|bulvāris|laukums|prospekts|šoseja)\b/i.test(first);
 return {venue:isAddress?value:first,address:value};
}
function priceOf(value){
 const v=oneLine(value);
 if(!v)return {price_status:'unknown',price_text:null};
 if(/bez maksas|bezmaksas|ieeja brīva/i.test(v))return {price_status:'free',price_text:v};
 return {price_status:/\d/.test(v)?'paid':'unknown',price_text:v.slice(0,200)};
}
const keyOf=url=>{try{return new URL(url).pathname.replace(/\/+$/,'');}catch{return '';}};

// daugavpils.lv/afisa/?page=N: cards with day, month, time, title and address.
export function parseDaugavpils(html,today){
 const items=[];
 for(const part of String(html).split('<div class="col-xs-6 col-sm-4 col-md-4 col-lg-3">').slice(1)){
  const url=part.match(/<a href="(https:\/\/www\.daugavpils\.lv\/afisa\/[^"]+)"/)?.[1];
  const title=oneLine(part.match(/<h3>([\s\S]*?)<\/h3>/)?.[1]);
  const day=part.match(/<span class="date">\s*(\d{1,2})\s*<\/span>/)?.[1];
  const month=part.match(/<span class="month">\s*([^<]+?)\s*<\/span>/)?.[1];
  const date=day&&month?dayMonth(day,month,today):null;
  if(!url||!title||!date)continue;
  const {venue,address}=splitPlace(part.match(/<p class="place">([\s\S]*?)<\/p>/)?.[1]);
  items.push({key:keyOf(url),url,title,dateFrom:date,dateTo:date,timeFrom:hm(part.match(/<span class="time">([^<]*)/)?.[1]),timeTo:null,
   venue,address,description:'',category:null,price_status:'unknown',price_text:null});
 }
 return items;
}

// jelgava.lv/pasakumi/page/N/: cards with date, time, title, place and organizer.
export function parseJelgava(html){
 const items=[];
 for(const part of String(html).split('<div class="events-wrap').slice(1)){
  const url=part.match(/<div class="events-title">\s*<a href="(https:\/\/www\.jelgava\.lv\/[^"]+)"/)?.[1];
  const title=oneLine(part.match(/<div class="events-title">\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1]).replace(/^(MAINĪTS|MAINĪTA|ATCELTS)[^!]*!\s*/i,'');
  const dates=[...oneLine(part.match(/<div class="events-dates">([\s\S]*?)<\/div>/)?.[1]).matchAll(new RegExp(DMY,'g'))].map(m=>m[3]+'-'+pad(m[2])+'-'+pad(m[1]));
  if(!url||!title||!dates.length)continue;
  const times=[...oneLine(part.match(/<div class="events-times">([\s\S]*?)<\/div>/)?.[1]).matchAll(/\b(\d{1,2})[:.](\d{2})\b/g)].map(m=>pad(m[1])+':'+m[2]);
  const {venue,address}=splitPlace(part.match(/<div class="events-places">([\s\S]*?)<\/div>/)?.[1]);
  items.push({key:keyOf(url),url,title,dateFrom:dates[0],dateTo:dates[1]&&dates[1]>=dates[0]?dates[1]:dates[0],timeFrom:times[0]||null,timeTo:times[1]||null,
   venue,address,description:'',category:null,...priceOf(part.match(/<div class="events-price">([\s\S]*?)<\/div>/)?.[1])});
 }
 return items;
}

// valmierasnovads.lv/wp-json/valmiera/events: every event of the site as JSON.
export function parseValmiera(list){
 const items=[];
 for(const e of Array.isArray(list)?list:[]){
  const from=/^\d{4}-\d{2}-\d{2}$/.test(e?.startDate||'')?e.startDate:null;
  const title=oneLine(e?.summary);
  if(!from||!title||!/^https:\/\/www\.valmierasnovads\.lv\//.test(e?.link||''))continue;
  const to=/^\d{4}-\d{2}-\d{2}$/.test(e?.endDate||'')&&e.endDate>=from?e.endDate:from;
  const place=oneLine(e?.place);
  items.push({key:keyOf(e.link),url:e.link,title,dateFrom:from,dateTo:to,timeFrom:hm(e?.timeFrom),timeTo:null,
   venue:place||null,address:place||null,description:text(e?.content).slice(0,4000),category:null,price_status:'unknown',price_text:null});
 }
 return items;
}

// pasakumi.cesis.lv: one table of rows with date, time, title, place and price.
export function parseCesis(html){
 const items=[];
 for(const part of String(html).split('<div class="row results-event').slice(1)){
  const url=part.match(/<a class="title" href="(https:\/\/pasakumi\.cesis\.lv\/[^"]+)"/)?.[1];
  const title=oneLine(part.match(/<a class="title"[^>]*>([\s\S]*?)<\/a>/)?.[1]);
  const date=dmy(part.match(/<span class="date">([^<]*)/)?.[1]);
  if(!url||!title||!date)continue;
  const place=oneLine(part.match(/<span class="location">([\s\S]*?)<\/span>/)?.[1]);
  items.push({key:keyOf(url),url,title,dateFrom:date,dateTo:date,timeFrom:hm(part.match(/<span class="time">([^<]*)/)?.[1]),timeTo:null,
   venue:place||null,address:place||null,description:'',category:null,...priceOf(part.match(/<span class="price">([\s\S]*?)<\/span>/)?.[1])});
 }
 return items;
}

// One item per site key and date; later pages repeat running exhibitions.
export function uniqueItems(items){
 const seen=new Map();
 for(const item of items){const k=item.key+'|'+item.dateFrom;if(item.key&&!seen.has(k))seen.set(k,item);}
 return [...seen.values()];
}

export const SITES={
 daugavpils:{domain:'daugavpils.lv',municipality:'Daugavpils valstspilsēta',calendar:'https://www.daugavpils.lv/afisa/',
  pages:n=>'https://www.daugavpils.lv/afisa/'+(n>1?'?page='+n:''),parse:parseDaugavpils,maxPages:15},
 jelgava:{domain:'jelgava.lv',municipality:'Jelgavas valstspilsēta',calendar:'https://www.jelgava.lv/pasakumi/',
  pages:n=>'https://www.jelgava.lv/pasakumi/'+(n>1?'page/'+n+'/':''),parse:parseJelgava,maxPages:15},
 valmiera:{domain:'valmierasnovads.lv',municipality:'Valmieras novads',calendar:'https://www.valmierasnovads.lv/aktualitates/norisu-kalendars/',
  pages:n=>n===1?'https://www.valmierasnovads.lv/wp-json/valmiera/events':null,parse:parseValmiera,json:true,maxPages:1},
 cesis:{domain:'pasakumi.cesis.lv',municipality:'Cēsu novads',calendar:'https://pasakumi.cesis.lv/',
  pages:n=>n===1?'https://pasakumi.cesis.lv/':null,parse:parseCesis,maxPages:1}
};
