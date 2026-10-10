import {HOME_CATEGORY_FILTERS,eventGroup,sourceType} from './home-category-filters.js';

// One shared icon family for MEETS home cards and map markers.
// Prefer structured sport/source fields; use explicit event-title sport terms only
// when the title unambiguously names the activity. Unknown events stay generic.
export const GENERAL_EVENT_ICON='🎟️';

const specificSportIcons=[
 {glyph:'🚴',label:'Riteņbraukšana',match:/\b(?:velo\w*|velobrauc\w*|riteņbrauk\w*|mtb|bmx|gravel)\b/iu},
 {glyph:'🏀',label:'Basketbols',match:/\b(?:basketbol\w*|basketball\w*|ljbl)\b/iu},
 {glyph:'⚽',label:'Futbols',match:/\b(?:futbol\w*|football\w*|futsal)\b/iu},
 {glyph:'🏐',label:'Volejbols',match:/\b(?:volejbol\w*|volleyball\w*)\b/iu},
 {glyph:'🤾',label:'Handbols',match:/\b(?:handbol\w*|handball\w*)\b/iu},
 {glyph:'🏒',label:'Hokejs',match:/\b(?:hokej\w*|hockey\w*)\b/iu},
 {glyph:'🎾',label:'Teniss',match:/\b(?:tenis\w*|tennis\w*|padel\w*)\b/iu},
 {glyph:'🏊',label:'Peldēšana',match:/\b(?:peldē\w*|peldēšan\w*|swimming\w*)\b/iu},
 {glyph:'🏃',label:'Skriešana',match:/\b(?:skrēj\w*|skriešan\w*|maraton\w*|pusmaraton\w*|kross|trail)\b/iu}
];
const normalizedText=value=>String(value||'').trim().toLocaleLowerCase('lv');

// Match on word beginnings without assuming JavaScript's ASCII-only \\b
// correctly treats Latvian letters as part of words.
function containsSportTerm(text,pattern){return pattern.test(text);}

export function eventMapIcon(event){
 const source=sourceType(event);
 if(source==='basketball')return {glyph:'🏀',label:'Basketbols'};
 if(source==='lff')return {glyph:'⚽',label:'Futbols'};

 const group=eventGroup(event);
 const structured=[
  event.sport_format,event.competition_name,event.competition_type,
  event.primary_category,event.event_type
 ].filter(Boolean).map(normalizedText).join(' ');
 const title=normalizedText(event.title);

 // The title can reliably identify an explicitly named sports activity
 // (e.g. "Velobrauciens" or "Basketbola spēle").
 for(const item of specificSportIcons){
  if(containsSportTerm(structured,item.match)||containsSportTerm(title,item.match))
   return {glyph:item.glyph,label:item.label};
 }
 if(source==='athletics')return {glyph:'🏃',label:'Vieglatlētika'};

 const category=HOME_CATEGORY_FILTERS[group];
 if(category)return {glyph:category.icon,label:category.title};
 return {glyph:GENERAL_EVENT_ICON,label:'Pasākums'};
}

export function groupedMapIcon(events){
 if(!Array.isArray(events)||!events.length)return {glyph:GENERAL_EVENT_ICON,label:'Pasākums'};
 const first=eventMapIcon(events[0]);
 // One pin can represent several events at a venue. Show the specific icon
 // only when all events behind that pin have the same icon.
 for(let i=1;i<events.length;i++){
  if(eventMapIcon(events[i]).glyph!==first.glyph){
   return {glyph:GENERAL_EVENT_ICON,label:'Dažādi pasākumi'};
  }
 }
 return first;
}
