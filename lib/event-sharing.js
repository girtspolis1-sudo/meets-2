// Stable, public event link: never include filters, GPS coordinates, or account details.
export function eventSharePath(event){
 const id=String(event?.id||'');
 return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ?'/pasakumi?event='+encodeURIComponent(id):'/pasakumi';
}
export function eventShareUrl(event,origin='https://meets-2.vercel.app'){
 let base;
 try{base=new URL(origin);}catch{base=new URL('https://meets-2.vercel.app');}
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
