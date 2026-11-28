// The site's main sections, shared by the desktop header (app/site-nav.jsx) and
// the phone dock (app/mobile-bottom-nav.jsx), so both mark the same item.
// Pure; tests in tests/mobile-dock.test.js.

// Sports: adult leagues and games. Youth sport has its own page: youth games are
// shown only where the visitor chose them.
export const SPORTS_PATH='/pasakumi/sports';
export const YOUTH_SPORTS_PATH='/pasakumi/sports/jauniesi';

// Pages that belong to the profile: saved events, following, the organizer's tools.
export const PROFILE_PATHS=['/profils','/mani-pasakumi','/mani-registri','/organizators','/sekosana','/konta-iestatijumi',
 '/registre-vietu','/registre-pasakumu','/registre-turnira'];

const under=(path,base)=>path===base||path.startsWith(base+'/');

// 'home' | 'map' | 'events' | 'sport' | 'profile' | 'admin' | null
export function navSection(pathname){
 const path=String(pathname||'/').split(/[?#]/)[0]||'/';
 if(path==='/')return 'home';
 if(under(path,'/karte'))return 'map';
 if(under(path,'/pasakumi/k/sports')||under(path,'/pasakumi/sports')||under(path,'/turniri'))return 'sport';
 if(under(path,'/pasakumi'))return 'events';
 if(PROFILE_PATHS.some(base=>under(path,base)))return 'profile';
 if(under(path,'/admin'))return 'admin';
 return null;
}

// Desktop header: Karte · Pasākumi · Sports · Mans profils.
export const HEADER_ITEMS=[
 {key:'map',href:'/karte',label:'Karte'},
 {key:'events',href:'/pasakumi',label:'Pasākumi'},
 {key:'sport',href:SPORTS_PATH,label:'Sports'},
 {key:'profile',href:'/profils',label:'Mans profils'}
];

// Phone dock: Sākums · Karte · Pasākumi · Sports · Profils, names shown under the icons.
// Saved events live in the profile.
export const DOCK_ITEMS=[
 {key:'home',href:'/',label:'Sākums',icon:'home'},
 {key:'map',href:'/karte',label:'Karte',icon:'pin'},
 {key:'events',href:'/pasakumi',label:'Pasākumi',icon:'calendar'},
 {key:'sport',href:SPORTS_PATH,label:'Sports',icon:'football'},
 {key:'profile',href:'/profils',label:'Profils',icon:'user'}
];
