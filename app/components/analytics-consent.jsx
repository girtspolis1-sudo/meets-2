'use client';
import Link from 'next/link';
import {Suspense,useEffect,useState} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {CONSENT_EVENT,GA_ID,analyticsHost,pageLocation,pageTitle,readConsent,saveConsent,trackedPath} from '../../lib/analytics.js';

// Loads Google Analytics only after "Pieņemt". Google signals and ad
// personalisation stay off; page views are sent here with masked addresses.
function loadAnalytics(){
 if(typeof window.gtag==='function')return;
 window.dataLayer=window.dataLayer||[];
 window.gtag=function gtag(){window.dataLayer.push(arguments);};
 window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 window.gtag('js',new Date());
 window.gtag('config',GA_ID,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,
  page_location:pageLocation(window.location.href),page_title:pageTitle(window.location.pathname,document.title)});
 const script=document.createElement('script');
 script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+GA_ID;
 document.head.appendChild(script);
 for(const [name,params] of window.__meetsAnalyticsQueue||[])window.gtag('event',name,params);
 window.__meetsAnalyticsQueue=[];
}
function forgetAnalytics(){
 if(typeof window.gtag==='function')window.gtag('consent','update',{analytics_storage:'denied'});
 const domain=window.location.hostname.replace(/^www\./,'');
 for(const name of document.cookie.split(';').map(c=>c.split('=')[0].trim()).filter(n=>n==='_ga'||n.startsWith('_ga_'))){
  for(const d of ['',domain,'.'+domain])document.cookie=name+'=; Max-Age=0; path=/'+(d?'; domain='+d:'');
 }
}

function PageViews({active}){
 const pathname=usePathname(),params=useSearchParams();
 useEffect(()=>{
  if(!active||typeof window.gtag!=='function'||!trackedPath(pathname))return;
  // Wait a moment so the new page has set its title.
  const timer=setTimeout(()=>{
   const location=pageLocation(window.location.href),title=pageTitle(pathname,document.title);
   window.gtag('set',{page_location:location,page_title:title});
   window.gtag('event','page_view',{page_location:location,page_title:title});
  },300);
  return()=>clearTimeout(timer);
 },[active,pathname,params]);
 return null;
}

export default function AnalyticsConsent(){
 const [allowed,setAllowed]=useState(false);
 const [open,setOpen]=useState(false);
 const [active,setActive]=useState(false);
 useEffect(()=>{
  if(!analyticsHost(window.location.hostname))return;
  setAllowed(true);
  const choice=readConsent();
  if(choice==='granted'&&trackedPath(window.location.pathname)){loadAnalytics();setActive(true);}
  else if(!choice)setOpen(true);
  const reopen=()=>setOpen(true);
  window.addEventListener(CONSENT_EVENT,reopen);
  return()=>window.removeEventListener(CONSENT_EVENT,reopen);
 },[]);
 function accept(){saveConsent('granted');loadAnalytics();setActive(true);setOpen(false);}
 function decline(){saveConsent('denied');forgetAnalytics();setActive(false);setOpen(false);}
 return <>
  <Suspense fallback={null}><PageViews active={active}/></Suspense>
  {allowed&&open&&<section className="meets-consent" role="dialog" aria-modal="false" aria-labelledby="meets-consent-title">
   <div>
    <h2 id="meets-consent-title">Vai drīkstam skaitīt apmeklējumus?</h2>
    <p>Ar Google Analytics uzzinām, kuras lapas un pasākumi noder. Analītikas sīkdatnes izmantojam tikai tad, ja piekrīti; reklāmām tās netiek lietotas. <Link href="/privatums#p3">Privātuma politika</Link></p>
   </div>
   <div className="meets-consent-actions">
    <button type="button" className="button" onClick={decline}>Noraidīt</button>
    <button type="button" className="button primary" onClick={accept}>Pieņemt</button>
   </div>
  </section>}
 </>;
}

// "Sīkdatņu iestatījumi" in the footer opens the same choice again.
export function ConsentSettingsLink(){
 const [allowed,setAllowed]=useState(false);
 useEffect(()=>{setAllowed(analyticsHost(window.location.hostname));},[]);
 if(!allowed)return null;
 return <button type="button" className="footer-consent-link" onClick={()=>window.dispatchEvent(new Event(CONSENT_EVENT))}>Sīkdatņu iestatījumi</button>;
}
