// IndexNow (Bing, Yandex, Seznam, Naver…): tell search engines which addresses
// changed. Pure helpers: tests/indexnow.test.js.
export const INDEXNOW_ENDPOINT='https://api.indexnow.org/indexnow';
export const validIndexNowKey=key=>/^[A-Za-z0-9-]{8,128}$/.test(String(key||''));

// Event addresses changed since `since` (ISO time), at most 10 000 per request.
export function changedUrls(events,since,urlOf){
 const from=Date.parse(since);
 return events.filter(e=>{const t=Date.parse(e.updated_at||'');return Number.isFinite(t)&&t>=from;}).map(urlOf).slice(0,10000);
}
export function indexNowBody({host,key,keyLocation,urls}){
 return {host,key,keyLocation,urlList:urls};
}
