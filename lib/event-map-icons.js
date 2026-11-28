import {HOME_CATEGORY_FILTERS,eventGroup,sourceType} from './home-category-filters.js';

// One shared icon family for meets.lv home cards and map markers: `icon` is a
// name in lib/icon-paths.js (line icons, no emoji), `label` says it in words.
// Prefer structured sport/source fields; use explicit event-title sport terms only
// when the title unambiguously names the activity. Unknown events stay generic.
export const GENERAL_EVENT_ICON='event';

const specificSportIcons=[
 {icon:'cycling',label:'Riteņbraukšana',match:/\b(?:velo\w*|velobrauc\w*|ritenbrauk\w*|mtb|bmx|gravel)\b/i},
 {icon:'basketball',label:'Basketbols',match:/\b(?:basketbol\w*|basketball\w*|ljbl)\b/i},
 {icon:'football',label:'Futbols',match:/\b(?:futbol\w*|football\w*|futsal)\b/i},
 {icon:'volleyball',label:'Volejbols',match:/\b(?:volejbol\w*|volleyball\w*)\b/i},
 {icon:'handball',label:'Handbols',match:/\b(?:handbol\w*|handball\w*)\b/i},
 {icon:'hockey',label:'Hokejs',match:/\b(?:hokej\w*|hockey\w*)\b/i},
 {icon:'floorball',label:'Florbols',match:/\b(?:florbol\w*|floorball\w*)\b/i},
 {icon:'table-tennis',label:'Galda teniss',match:/\b(?:galda tenis\w*|table tennis|ping ?pong)\b/i},
 {icon:'tennis',label:'Teniss',match:/\b(?:tenis\w*|tennis\w*|padel\w*)\b/i},
 {icon:'swimming',label:'Peldēšana',match:/\b(?:peld\w*|swimming\w*)\b/i},
 {icon:'baseball',label:'Beisbols',match:/\b(?:beisbol\w*|baseball\w*|softbol\w*)\b/i},
 {icon:'rugby',label:'Regbijs',match:/\b(?:regbij\w*|rugby\w*)\b/i},
 {icon:'badminton',label:'Badmintons',match:/\b(?:badminton\w*)\b/i},
 {icon:'skating',label:'Slidošana',match:/\b(?:slidos\w*|dailslid\w*|skating)\b/i},
 {icon:'skiing',label:'Slēpošana',match:/\b(?:slepo\w*|biatlon\w*|skiing)\b/i},
 {icon:'boxing',label:'Bokss',match:/\b(?:boks\w*|boxing|kikboks\w*)\b/i},
 {icon:'martial',label:'Cīņas sports',match:/\b(?:dzudo|judo|karate\w*|taekvondo|taekwondo|sambo|cinas sport\w*|brivaj\w* cin\w*)\b/i},
 {icon:'gymnastics',label:'Vingrošana',match:/\b(?:vingrosan\w*|gymnastics)\b/i},
 {icon:'weightlifting',label:'Svarcelšana',match:/\b(?:svarcel\w*|pauerlift\w*|powerlift\w*)\b/i},
 {icon:'rowing',label:'Airēšana',match:/\b(?:airesan\w*|kajak\w*|kanoe\w*|smail\w*|rowing)\b/i},
 {icon:'sailing',label:'Burāšana',match:/\b(?:burasan\w*|regat\w*|sailing)\b/i},
 {icon:'golf',label:'Golfs',match:/\b(?:golf\w*|discgolf\w*)\b/i},
 {icon:'chess',label:'Šahs',match:/\b(?:sahs|saha|sahu|chess|dambret\w*)\b/i},
 {icon:'darts',label:'Šautriņas',match:/\b(?:sautrin\w*|darts)\b/i},
 {icon:'motorsport',label:'Motosports',match:/\b(?:motokros\w*|motosport\w*|autosport\w*|rallij\w*|kartin\w*)\b/i},
 {icon:'running',label:'Skriešana',match:/\b(?:skrej\w*|skriesan\w*|maraton\w*|pusmaraton\w*|kross|trail)\b/i}
];
// Strip Latvian diacritics before using ASCII word-boundary matching.
const normalizedText=value=>String(value||'').trim().toLocaleLowerCase('lv')
 .normalize('NFD').replace(/[\u0300-\u036f]/g,'');

function containsSportTerm(text,pattern){return pattern.test(text);}

// League imports name the sport by their source, even when the title is just
// "Team A – Team B".
const SOURCE_ICONS={
 basketball:{icon:'basketball',label:'Basketbols'},lff:{icon:'football',label:'Futbols'},
 hockey:{icon:'hockey',label:'Hokejs'},volleyball:{icon:'volleyball',label:'Volejbols'},
 floorball:{icon:'floorball',label:'Florbols'},handball:{icon:'handball',label:'Handbols'}
};
const SPORT_ICONS=new Set([...specificSportIcons.map(i=>i.icon),...Object.values(SOURCE_ICONS).map(i=>i.icon)]);

export function eventMapIcon(event){
 const source=sourceType(event);
 if(SOURCE_ICONS[source])return {...SOURCE_ICONS[source]};

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
   return {icon:item.icon,label:item.label};
 }
 if(source==='athletics')return {icon:'running',label:'Vieglatlētika'};

 const category=HOME_CATEGORY_FILTERS[group];
 if(category)return {icon:group,label:category.title};
 return {icon:GENERAL_EVENT_ICON,label:'Pasākums'};
}

export function groupedMapIcon(events){
 if(!Array.isArray(events)||!events.length)return {icon:GENERAL_EVENT_ICON,label:'Pasākums'};
 const first=eventMapIcon(events[0]);
 // One pin can represent several events at a venue. Show the specific icon
 // only when all events behind that pin have the same icon.
 for(let i=1;i<events.length;i++){
  if(eventMapIcon(events[i]).icon!==first.icon){
   return {icon:GENERAL_EVENT_ICON,label:'Dažādi pasākumi'};
  }
 }
 return first;
}

// The sport icon of an event (football, basketball, hockey …), or null when no sport is known.
export function sportIcon(event){
 const icon=eventMapIcon(event);
 return SPORT_ICONS.has(icon.icon)?icon:null;
}

// The sport icon shared by every event behind one map pin, or null.
export function groupedSportIcon(events){
 if(!Array.isArray(events)||!events.length)return null;
 const first=sportIcon(events[0]);
 if(!first)return null;
 return events.every(e=>sportIcon(e)?.icon===first.icon)?first:null;
}

// Card icon that names the topic at a glance. Sport first, then the topic read
// from the category, title and tags, then the discovery group. Matching uses
// text without diacritics, so "sēde" and "sede" are the same word.
const TOPIC_ICONS=[
 {icon:'civic',label:'Pašvaldība',match:/\b(?:domes?\b|komitej\w*|sed[ei]s?\b|sedes|deputat\w*|pasvaldib\w* darba|padomes?\b|iedzivotaju padom\w*|publiska apspriesan\w*|sanaksm\w*|klientu apkalposan\w*)/},
 {icon:'flag',label:'Valsts svētki',match:/\b(?:valsts svetk\w*|lacplesa|lapu gajien\w*|neatkaribas|18\. ?novembr\w*|11\. ?novembr\w*)/},
 {icon:'candle',label:'Atceres pasākums',match:/\b(?:atceres|piemin\w*)/},
 {icon:'event',label:'Helovīns',match:/\b(?:helovin\w*|halloween)/},
 {icon:'culture',label:'Leģendu nakts',match:/\b(?:legendu nakt\w*|muzeju nakt\w*)/},
 {icon:'tree',label:'Ziemassvētki',match:/\b(?:ziemassvet\w*|jaunais gads|advent\w*)/},
 {icon:'church',label:'Reliģisks pasākums',match:/\b(?:religisk\w*|dievkalp\w*|baznic\w*|mise\b|draudz\w*)/},
 {icon:'drop',label:'Donoru diena',match:/\b(?:donor\w*|asins)/},
 {icon:'active',label:'Veselība',match:/\b(?:veselib\w*|vingrotaj\w*|joga|jogas|meditac\w*|profilakse|arst\w*)/},
 {icon:'family',label:'Bērniem',match:/\b(?:berniem|bernu|mazul\w*|zidain\w*|pirmsskol\w*)/},
 {icon:'community',label:'Senioriem',match:/\b(?:senior\w*)/},
 {icon:'book',label:'Bibliotēka',match:/\b(?:bibliotek\w*|gramat\w*|lasitav\w*|dzej\w*|literatur\w*|stasti)\b/},
 {icon:'learning',label:'Datorapmācības',match:/\b(?:dator\w*|digital\w*|vebinar\w*)/},
 {icon:'learning',label:'Viktorīna',match:/\b(?:viktorin\w*|erudic\w*|prata spel\w*)/},
 {icon:'learning',label:'Radošā darbnīca',match:/\b(?:darbnic\w*|meistarklas\w*|radosa\w*|radosas|muzejpedagog\w*)/},
 {icon:'learning',label:'Izglītība',match:/\b(?:lekcij\w*|seminar\w*|apmacib\w*|izglitib\w*|kursi|nodarbib\w*)/},
 {icon:'film',label:'Kino',match:/\b(?:kino\w*|filma\w*|filmu)\b/},
 {icon:'stage',label:'Teātris',match:/\b(?:teatr\w*|izrad\w*|amatierteatr\w*|stavizrad\w*)/},
 {icon:'music',label:'Dejas',match:/\b(?:dejas|deju|balle\w*|tautas dej\w*)\b/},
 {icon:'music',label:'Koncerts',match:/\b(?:koncert\w*|muzik\w*|kor\w* skate|festival\w*)/},
 {icon:'culture',label:'Izstāde',match:/\b(?:izstad\w*|ekspozic\w*|muzej\w*|galerij\w*)/},
 {icon:'markets',label:'Tirdziņš',match:/\b(?:tirg\w*|tirdzin\w*|gadatirg\w*)/},
 {icon:'event',label:'Svētki',match:/\b(?:svetki|svetk\w*|jubilej\w*)/},
 {icon:'trophy',label:'Konkurss',match:/\b(?:konkurs\w*|skate)\b/},
 {icon:'active',label:'Pārgājiens',match:/\b(?:pargajien\w*|ekskursij\w*|dabas tak\w*|izpete)\b/},
 {icon:'community',label:'Tikšanās',match:/\b(?:tiksan\w*|kopien\w*|klub\w*|saruna\w*)/}
];
const GROUP_TOPIC={civic:{icon:'civic',label:'Pašvaldības un līdzdalība'},family:{icon:'family',label:'Ģimenēm'}};
export const TOPIC_FALLBACK={icon:'calendar',label:'Pasākums'};
export function eventTopicIcon(event){
 const sport=sportIcon(event);if(sport)return sport;
 const category=normalizedText(event.primary_category);
 const rest=normalizedText([event.title,...(Array.isArray(event.tags)?event.tags:[])].join(' '));
 // The category is the strongest signal; the title only when the category says nothing.
 // A loose category ("Kopienās", "Tikšanās") gives way to a clearer title.
 const fromCategory=TOPIC_ICONS.find(item=>item.match.test(category));
 if(fromCategory&&fromCategory.label!=='Tikšanās')return {icon:fromCategory.icon,label:fromCategory.label};
 const group=eventGroup(event);
 if(GROUP_TOPIC[group])return {...GROUP_TOPIC[group]};
 const fromTitle=TOPIC_ICONS.find(item=>item.match.test(rest));
 if(fromTitle)return {icon:fromTitle.icon,label:fromTitle.label};
 if(fromCategory)return {icon:fromCategory.icon,label:fromCategory.label};
 const fromGroup=HOME_CATEGORY_FILTERS[group];
 if(fromGroup)return {icon:group,label:fromGroup.title};
 return {...TOPIC_FALLBACK};
}
