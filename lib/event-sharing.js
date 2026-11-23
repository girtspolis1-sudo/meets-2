import {eventPath} from './seo.js';
// Stable, public event link: never include filters, GPS coordinates, or account details.
export function eventSharePath(event){
 return eventPath(event);
}
export function eventShareUrl(event,origin='https://meets.lv'){
 let base;
 try{base=new URL(origin);}catch{base=new URL('https://meets.lv');}
 return base.origin+eventSharePath(event);
}
export function eventShareTargets(event,url){
 const link=String(url||eventShareUrl(event));
 const text=String(event?.title||'MEETS pasākums').trim().slice(0,200);
 const message=[text,link].filter(Boolean).join(' ');
 return {
  whatsapp:'https://wa.me/?text='+encodeURIComponent(message),
  messenger:'fb-messenger://share/?link='+encodeURIComponent(link),
  telegram:'https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(text),
  facebook:'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(link),
  x:'https://twitter.com/intent/tweet?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(text)
 };
}
export function officialEventUrl(event){
 const link=(event?.sources||[]).find(source=>/^https?:\/\//i.test(source?.url||''))?.url;
 return link||null;
}

// The map centred on the event's place with a circle around it ("Kartē · 20 km
// apkārtnē"). Null for an event without a map point (online events too).
export const NEARBY_MAP_RADIUS=20;
export function nearbyMapPath(event,radius=NEARBY_MAP_RADIUS){
 const lat=Number(event?.latitude),lon=Number(event?.longitude);
 if(event?.latitude==null||event?.longitude==null||!Number.isFinite(lat)||!Number.isFinite(lon)||event?.attendance_mode==='online')return null;
 const params=new URLSearchParams({lat:lat.toFixed(5),lon:lon.toFixed(5),radius:String(radius)});
 return '/karte?'+params.toString();
}
