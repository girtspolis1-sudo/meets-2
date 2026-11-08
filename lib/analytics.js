// Google Analytics 4 for meets.lv, only with the visitor's consent.
// Nothing is loaded and nothing is sent to Google until "Pieņemt" is chosen;
// preview and local addresses never load it. No personal data in events.
export const GA_ID='G-35QTLEMNLP';
export const CONSENT_KEY='meets_analytics_consent_v1';
export const CONSENT_EVENT='meets-consent-open';
const HOSTS=new Set(['meets.lv','www.meets.lv']);

export function analyticsHost(host){return HOSTS.has(String(host||'').toLowerCase());}
// Pages that are never measured: the admin area.
export function trackedPath(path){return !String(path||'').startsWith('/admin');}

export function readConsent(){
 try{const value=localStorage.getItem(CONSENT_KEY);return value==='granted'||value==='denied'?value:'';}catch{return '';}
}
export function saveConsent(value){
 try{localStorage.setItem(CONSENT_KEY,value);}catch{}
}

// Event parameters: short text and numbers only; e-mail-like values are dropped.
const EMAIL=/[^\s@]+@[^\s@]+\.[^\s@]+/;
export function cleanParams(params={}){
 const out={};
 for(const [key,value] of Object.entries(params||{})){
  if(value===undefined||value===null||value==='')continue;
  if(typeof value==='number'||typeof value==='boolean'){out[key]=value;continue;}
  const text=String(value).slice(0,100);
  if(EMAIL.test(text))continue;
  out[key]=text;
 }
 return out;
}

// Share links are private: their token never goes to Google, and only a few
// harmless query parameters are kept.
const TOKEN_PATH=/^\/(ielugums|sludinajums|saraksts)\/[^/?#]+/;
const KEEP_PARAMS=['view','period','category'];
export function maskPath(path){return String(path||'').replace(TOKEN_PATH,'/$1/:token');}
export function pageLocation(href){
 let url;try{url=new URL(href);}catch{return '';}
 url.pathname=maskPath(url.pathname);
 const kept=new URLSearchParams();
 for(const key of KEEP_PARAMS)if(url.searchParams.get(key))kept.set(key,url.searchParams.get(key));
 url.search=kept.toString();url.hash='';
 return url.toString();
}
// Titles of shared pages name a private event, so they are replaced.
export function pageTitle(path,title){
 const m=String(path||'').match(TOKEN_PATH);
 if(!m)return String(title||'').slice(0,100);
 return m[1]==='sludinajums'?'Sludinājums drukai':m[1]==='saraksts'?'Kopīgots saraksts':'Kopīgots pasākums';
}

// Sends one event when analytics is on; events sent before the script is
// ready wait in a short queue.
export function track(name,params){
 if(typeof window==='undefined'||readConsent()!=='granted')return;
 const clean=cleanParams(params);
 if(typeof window.gtag==='function')window.gtag('event',name,clean);
 else (window.__meetsAnalyticsQueue=window.__meetsAnalyticsQueue||[]).push([name,clean]);
}
