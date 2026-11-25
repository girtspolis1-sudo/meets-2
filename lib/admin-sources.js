// Labels for Admin → Avoti and the event card: which channel read an event
// (event_sources.seen_via) and what kind of source a municipality uses.

const CHANNELS={rss:'RSS',html:'HTML',ics:'ICS',page:'Lapa'};
const ORDER=['rss','ics','html','page'];

// ["html","rss"] → "RSS + HTML"; unknown channels keep their own name.
export function channelLabel(via){
 const list=[...new Set((Array.isArray(via)?via:[]).filter(Boolean))];
 list.sort((a,b)=>(ORDER.indexOf(a)+1||99)-(ORDER.indexOf(b)+1||99));
 return list.map(c=>CHANNELS[c]||c).join(' + ');
}

// "Ropaži · RSS + HTML" style text for one event_sources row.
export function sourceLabel(source){
 const via=channelLabel(source?.via);
 return [source?.source||'Avots',via].filter(Boolean).join(' · ');
}

// The day each channel last saw the row, newest first: "RSS 21.11., HTML 18.11.".
export function seenText(seen){
 if(!seen||typeof seen!=='object')return '';
 return Object.entries(seen).filter(([,d])=>/^\d{4}-\d{2}-\d{2}/.test(String(d)))
  .sort((a,b)=>String(b[1]).localeCompare(String(a[1])))
  .map(([c,d])=>(CHANNELS[c]||c)+' '+String(d).slice(8,10)+'.'+String(d).slice(5,7)+'.').join(', ');
}

const KIND_TONE={'RSS + HTML':'ok','RSS':'ok','ICS':'ok','ICS + HTML':'ok','HTML':'warn','Sava lapa':'warn','Nav avota':'bad'};
export function kindTone(kind){return KIND_TONE[kind]||'warn';}

// Municipality rows sorted for the overview: problems first, then by name.
export function sortMunicipalities(rows=[]){
 const rank=r=>r.problem?0:r.source_kind==='Nav avota'?2:1;
 return [...rows].sort((a,b)=>rank(a)-rank(b)||String(a.name).localeCompare(String(b.name),'lv'));
}

// Filters for "Avoti pa pašvaldībām": which municipalities use an RSS feed, an ICS feed,
// only the HTML calendar, their own site, nothing, or have a problem.
export const MUNICIPALITY_FILTERS=[
 {key:'',label:'Visas'},
 {key:'rss',label:'Ar RSS plūsmu'},
 {key:'ics',label:'Ar ICS'},
 {key:'html',label:'Tikai HTML'},
 {key:'own',label:'Sava lapa'},
 {key:'none',label:'Nav avota'},
 {key:'problem',label:'Ar problēmu'}
];
const hasFeed=(row,format)=>Array.isArray(row?.feeds)&&row.feeds.some(f=>f?.format===format);
export function matchesMunicipalityFilter(row,key){
 switch(key){
  case 'rss':return hasFeed(row,'rss');
  case 'ics':return hasFeed(row,'ics');
  case 'html':return row?.source_kind==='HTML';
  case 'own':return row?.source_kind==='Sava lapa';
  case 'none':return row?.source_kind==='Nav avota';
  case 'problem':return Boolean(row?.problem);
  default:return true;
 }
}
export function municipalityFilterCounts(rows=[]){
 return Object.fromEntries(MUNICIPALITY_FILTERS.map(f=>[f.key,rows.filter(r=>matchesMunicipalityFilter(r,f.key)).length]));
}
