import {HOME_CATEGORY_FILTERS,eventGroup,sourceType} from './home-category-filters.js';

// One shared icon family for MEETS home cards and map markers.
// Prefer structured sport/source fields; use explicit event-title sport terms only
// when the title unambiguously names the activity. Unknown events stay generic.
export const GENERAL_EVENT_ICON='🎟️';

const specificSportIcons=[
 {glyph:'🚴',label:'Riteņbraukšana',match:/\b(?:velo\w*|velobrauc\w*|ritenbrauk\w*|mtb|bmx|gravel)\b/i},
 {glyph:'🏀',label:'Basketbols',match:/\b(?:basketbol\w*|basketball\w*|ljbl)\b/i},
 {glyph:'⚽',label:'Futbols',match:/\b(?:futbol\w*|football\w*|futsal)\b/i},
 {glyph:'🏐',label:'Volejbols',match:/\b(?:volejbol\w*|volleyball\w*)\b/i},
 {glyph:'🤾',label:'Handbols',match:/\b(?:handbol\w*|handball\w*)\b/i},
 {glyph:'🏒',label:'Hokejs',match:/\b(?:hokej\w*|hockey\w*)\b/i},
 {glyph:'🎾',label:'Teniss',match:/\b(?:tenis\w*|tennis\w*|padel\w*)\b/i},
 {glyph:'🏊',label:'Peldēšana',match:/\b(?:peld\w*|swimming\w*)\b/i},
 {glyph:'🏃',label:'Skriešana',match:/\b(?:skrej\w*|skriesan\w*|maraton\w*|pusmaraton\w*|kross|trail)\b/i}
];
// Strip Latvian diacritics before using ASCII word-boundary matching.
const normalizedText=value=>String(value||'').trim().toLocaleLowerCase('lv')
 .normalize('NFD').replace(/[\u0300-\u036f]/g,'');

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
  if(containsSportTerm(structured,item.match)||
     ((group==='sport'||group==='active'||!group)&&containsSportTerm(title,item.match)))
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
