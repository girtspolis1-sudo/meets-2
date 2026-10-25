import {eventGroup,HOME_CATEGORY_FILTERS} from './home-category-filters.js';

export function cardGroup(event){
 const group=eventGroup(event);
 return group&&HOME_CATEGORY_FILTERS[group]?group:'other';
}
export function cardCategory(event){
 const group=cardGroup(event);
 return HOME_CATEGORY_FILTERS[group]?.title||event.primary_category||'Pasākums';
}
export function cardPrice(event){
 if(event.price_status==='free')return 'Bezmaksas';
 const low=event.price_min==null||event.price_min===''?null:Number(event.price_min);
 const high=event.price_max==null||event.price_max===''?null:Number(event.price_max);
 if(Number.isFinite(low)&&low!==null&&low>=0){
  if(Number.isFinite(high)&&high!==null&&high!==low)return low.toLocaleString('lv-LV')+'–'+high.toLocaleString('lv-LV')+' €';
  return 'No '+low.toLocaleString('lv-LV')+' €';
 }
 return null;
}
export function cardDate(event){
 const iso=event.date_from;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||'')))return 'Datums nav norādīts';
 const value=new Date(iso+'T12:00:00Z');
 if(!Number.isFinite(value.getTime()))return 'Datums nav norādīts';
 const date=value.toLocaleDateString('lv-LV',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 return date+(event.time_from?' · '+String(event.time_from).slice(0,5):'');
}
export function cardLocation(event){
 return event.venue_name||event.settlement||event.municipality||event.address_raw||'Norises vieta nav norādīta';
}
export function cardDescription(event){
 return String(event.description||event.summary||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}
export function cardImage(event){
 const source=String(event.cover_image_url||'').trim();
 // Only existing, trusted HTTPS images or same-origin media are eligible. No fabricated image.
 return source.startsWith('https://')||source.startsWith('/api/')||source.startsWith('/images/')?source:'';
}
