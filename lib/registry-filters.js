import {eventGroup} from './home-category-filters.js';
import {rigaDate, distanceKm, coordinates} from './meets-personal.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORY=new Set(['','music','stage','culture','sport','active','markets','learning','community']);
const PERIOD=new Set(['all','today','tomorrow','3days','week','month','custom']);
const PRICE=new Set(['','free','paid','mixed']);
const COUNTRY=new Set(['','LV','EE','LT']);
function compact(value,max=120){return typeof value==='string'?value.trim().slice(0,max):'';}
function isoDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))?value:'';}
export function validUuid(value){return typeof value==='string'&&UUID.test(value);}
export function cleanRegistryFilters(input={}){
 if(!input||Array.isArray(input)||typeof input!=='object')input={};
 const category=compact(input.category,32),period=compact(input.period,16),price=compact(input.price,12),country=compact(input.country,3);
 const radius=Number(input.radius);
 const latitude=Number(input.latitude),longitude=Number(input.longitude);
 const hasPosition=input.latitude!==''&&input.longitude!==''&&input.latitude!=null&&input.longitude!=null&&
  Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude>=53.5&&latitude<=60.8&&longitude>=16&&longitude<=31.5;
 const from=isoDate(input.from),to=isoDate(input.to);
 return {
  category:CATEGORY.has(category)?category:'',
  period:PERIOD.has(period)?period:'all',
  municipality:compact(input.municipality,140),
  country:COUNTRY.has(country)?country:'',
  price:PRICE.has(price)?price:'',
  event_type:compact(input.event_type,120),
  query:compact(input.query,120),
  from:from&&to&&from<=to?from:'',
  to:from&&to&&from<=to?to:'',
  selection_mode:input.selection_mode==='manual'?'manual':undefined,
  radius:hasPosition&&[5,10,25,30,50].includes(radius)?radius:0,
  latitude:hasPosition?latitude:null,
  longitude:hasPosition?longitude:null
 };
}
export function cleanRegistryIds(values){
 if(!Array.isArray(values)||values.length>100)throw Error('Sarakstā drīkst būt līdz 100 manuāli atlasītiem pasākumiem.');
 if(values.some(value=>!validUuid(value)))throw Error('Nederīgs pasākuma identifikators.');
 return [...new Set(values)];
}
function addDays(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function periodBounds(filters,today){
 if(filters.period==='today')return [today,today];
 if(filters.period==='tomorrow'){const t=addDays(today,1);return [t,t];}
 if(filters.period==='3days')return [today,addDays(today,2)];
 if(filters.period==='week'){const week=new Date(today+'T12:00:00Z').getUTCDay();return [today,addDays(today,(7-week)%7)];}
 if(filters.period==='month')return [today,today.slice(0,7)+'-'+String(new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7)),0)).getUTCDate()).padStart(2,'0')];
 if(filters.period==='custom'&&filters.from&&filters.to)return [filters.from,filters.to];
 return ['', ''];
}
export function filterRegistryEvents(events,rawFilters={},included=[],excluded=[],today=rigaDate()){
 const f=cleanRegistryFilters(rawFilters),includedSet=new Set(included),excludedSet=new Set(excluded);
 const [start,end]=periodBounds(f,today);
 const q=f.query.toLocaleLowerCase('lv');
 return (events||[]).filter(event=>{
  if(excludedSet.has(event.id))return false;
  if(includedSet.has(event.id))return true;
  if(f.selection_mode==='manual')return false;
  if(f.category&&eventGroup(event)!==f.category)return false;
  if(f.municipality&&event.municipality!==f.municipality)return false;
  if(f.country&&event.country_code!==f.country)return false;
  if(f.price&&event.price_status!==f.price)return false;
  if(f.event_type&&event.event_type!==f.event_type)return false;
  if(q&&!String(event.title+' '+(event.description||'')+' '+(event.venue_name||'')).toLocaleLowerCase('lv').includes(q))return false;
  const eventStart=String(event.date_from||''),eventEnd=String(event.date_to||event.date_from||'');
  if(start&&eventEnd<start)return false;
  if(end&&eventStart>end)return false;
  if(f.radius){
   const point=coordinates(event);
   if(!point||distanceKm({latitude:f.latitude,longitude:f.longitude},point)>f.radius)return false;
  }
  return true;
 }).sort((a,b)=>String(a.date_from).localeCompare(String(b.date_from))||String(a.title).localeCompare(String(b.title),'lv'));
}
