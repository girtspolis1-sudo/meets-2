// Search engine settings and public addresses, shared by metadata, robots.txt,
// sitemap.xml and the pages. Pure functions: tested in tests/seo.test.js.

export const SITE_URL=(process.env.NEXT_PUBLIC_SITE_URL||'https://meets.lv').replace(/\/+$/,'');

// Indexing is a deliberate switch: on only where NEXT_PUBLIC_ALLOW_INDEXING=true
// (Vercel Production). Preview builds and local runs stay out of search engines.
export function indexingAllowed(env=process.env){
 return String(env.NEXT_PUBLIC_ALLOW_INDEXING||'').trim().toLowerCase()==='true';
}
export const NOINDEX={index:false,follow:false};
export function siteRobots(env=process.env){
 return indexingAllowed(env)?{index:true,follow:true}:NOINDEX;
}
// A public page that should not be in search results on its own (thin or ended), links still followed.
export function pageRobots(indexable,env=process.env){
 if(!indexingAllowed(env))return NOINDEX;
 return indexable?{index:true,follow:true}:{index:false,follow:true};
}

// Never in search results: accounts, admin, forms, links with a private token.
export const PRIVATE_PATHS=['/api/','/admin','/profils','/mani-pasakumi','/sekosana','/konta-iestatijumi','/mani-registri',
 '/atjaunot-paroli','/registre-pasakumu','/registre-turnira','/registre-vietu','/organizators/pieteikt','/saraksts/',
 '/ielugums/','/sludinajums/','/turniri/','/rezultati/','/iegult/','/iegult-vietu/'];

const LV={ā:'a',č:'c',ē:'e',ģ:'g',ī:'i',ķ:'k',ļ:'l',ņ:'n',š:'s',ū:'u',ž:'z',ō:'o',ŗ:'r',ä:'a',ö:'o',ü:'u',õ:'o',ß:'ss'};
// "Ziemassvētku tirdziņš!" → "ziemassvetku-tirdzins"
export function slugify(text,max=60){
 const s=String(text||'').toLocaleLowerCase('lv').replace(/[āčēģīķļņšūžōŗäöüõß]/g,c=>LV[c]||c)
  .normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
 if(s.length<=max)return s;
 const cut=s.slice(0,max);
 return (cut.includes('-')?cut.slice(0,cut.lastIndexOf('-')):cut).replace(/-+$/,'');
}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid=value=>UUID.test(String(value||''));

// Event address: name, place and the first 8 characters of the id
// (/pasakumi/ziemassvetku-tirdzins-ropazi-bbbc0627). Old /pasakumi/<uuid> links redirect here.
export function eventSlug(event){
 const place=slugify(event?.settlement||event?.municipality||'',24);
 const title=slugify(event?.title||'',56)||'pasakums';
 const parts=[title];
 if(place&&!title.includes(place))parts.push(place);
 return parts.join('-');
}
export function eventPath(event){
 const id=String(event?.id||'');
 if(!isUuid(id))return '/pasakumi';
 return '/pasakumi/'+eventSlug(event)+'-'+id.slice(0,8).toLowerCase();
}
export const eventUrl=event=>SITE_URL+eventPath(event);
// "/pasakumi/<param>" → what it asks for: a full id (old link), an event key, or neither.
export function parseEventParam(param){
 const value=decodeURIComponent(String(param||'')).toLowerCase();
 if(isUuid(value))return {kind:'uuid',id:value};
 const m=value.match(/^([a-z0-9-]*?)-?([0-9a-f]{8})$/);
 if(m&&/^[a-z0-9-]*$/.test(value))return {kind:'key',prefix:m[2],slug:m[1]};
 return {kind:'other',value};
}

// Municipalities as the catalogue names them ("Rīgas valstspilsēta", "Ādažu novads").
// The seven state cities get a short address and their own locative form.
const CITIES={
 'Rīgas valstspilsēta':['riga','Rīgā','Rīga'],
 'Jūrmalas valstspilsēta':['jurmala','Jūrmalā','Jūrmala'],
 'Daugavpils valstspilsēta':['daugavpils','Daugavpilī','Daugavpils'],
 'Jelgavas valstspilsēta':['jelgava','Jelgavā','Jelgava'],
 'Liepājas valstspilsēta':['liepaja','Liepājā','Liepāja'],
 'Rēzeknes valstspilsēta':['rezekne','Rēzeknē','Rēzekne'],
 'Ventspils valstspilsēta':['ventspils','Ventspilī','Ventspils']
};
export function isMunicipalityName(name){return /\s(novads|valstspilsēta)$/.test(String(name||''));}
export function municipalitySlug(name){
 const n=String(name||'').trim();
 if(CITIES[n])return CITIES[n][0];
 return isMunicipalityName(n)?slugify(n,60):'';
}
// "Pasākumi Rīgā", "Pasākumi Ādažu novadā"
export function municipalityLocative(name){
 const n=String(name||'').trim();
 if(CITIES[n])return CITIES[n][1];
 return n.replace(/ novads$/,' novadā');
}
export function municipalityShortName(name){
 const n=String(name||'').trim();
 return CITIES[n]?CITIES[n][2]:n;
}

// Category pages use the discovery groups (lib/home-category-filters.js).
export const CATEGORY_SLUGS={music:'muzika',stage:'teatris-un-kino',culture:'izstades-un-kultura',sport:'sports',
 active:'aktiva-atpusta',markets:'tirdzini-un-svetki',learning:'darbnicas',community:'tiksanas-un-kopiena'};
export const categoryKeyFromSlug=slug=>Object.keys(CATEGORY_SLUGS).find(k=>CATEGORY_SLUGS[k]===String(slug||''))||'';

// Time pages under a municipality, in Riga time.
export const TIME_SLUGS={sodien:'šodien',rit:'rīt',brivdienas:'brīvdienās',sonedel:'šonedēļ'};

// A listing page with fewer events than this is shown but not indexed.
export const MIN_INDEXABLE_EVENTS=5;
