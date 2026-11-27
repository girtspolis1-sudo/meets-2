// Competition level of a sports event: adults ("senior") or children and youth ("youth").
// Pure functions shared by the map, the catalogue, the home page and the listing pages;
// tested in tests/sport-level.test.js.
//
// The filter ?level=all|senior|youth only touches sports events. Everything else is shown
// whatever the choice. Without a choice only adult competitions are shown, because youth
// leagues bring hundreds of games a week.
import {eventGroup} from './home-category-filters.js';

// "Seniori" in sport means adult teams, but the site already has the audience "Senioriem"
// (events for older people), so the choice is called "Pieaugušie" here.
export const LEVELS={all:'Visi',senior:'Pieaugušie',youth:'Jaunieši'};
export const LEVEL_KEYS=['all','senior','youth'];
export const DEFAULT_LEVEL='senior';
export const LEVEL_TITLE='Sacensību līmenis';
// The removable chip for a choice other than the default.
export const LEVEL_CHIPS={all:'Sports: visi līmeņi',youth:'Sports: jaunieši'};

export function levelKey(value){return Object.hasOwn(LEVELS,value)?value:DEFAULT_LEVEL;}

const L='a-zāčēģīķļņšūž';
const lower=value=>String(value||'').toLocaleLowerCase('lv').replace(/[‐-―−]/g,'-');
// "U12", "U-14", "U 16", "U‑12": an age limit up to 21. U23 is an adult (under-23) class.
function hasYouthAge(text){
 for(const m of text.matchAll(new RegExp('(?<!['+L+'0-9])u\\s?-?\\s?(\\d{1,2})(?![0-9])','g')))if(Number(m[1])<=21)return true;
 return false;
}
const word=stems=>new RegExp('(?<!['+L+'])(?:'+stems.join('|')+')','i');
// Word starts, so every Latvian case form matches: jaunatnes, junioriem, bērnu, meitenēm, zēniem.
const YOUTH_WORDS=word(['jaunatn','junior','jaunieš','jauniet','bērn','skolēn','skolu ','zēn','meiten','meiteņ','mazul']);
const SENIOR_AGE=word(['veterān','senior','vīrieš','sieviet','pieaugu']);
const VETERAN_AGE=/\d{2}\s?\+/;
// A sports competition named in a title: needed before a title alone can make an event youth,
// so "Bērnu sporta svētki" (a family day) stays an ordinary event.
const COMPETITION=word(['čempionāt','kaus','turnīr','sacensīb','līg','spartakiād','olimpiād','posm','spēle ','spēles ','sabraukum','festivāl']);
const SPORT_WORDS=word(['basketbol','futbol','florbol','volejbol','hokej','handbol','vieglatlēt','galda teni','teni','peldēš','šah','dambret','badminton','orientēšan','riteņbrauk','slēpo','biatlon','cīņ','džudo','karatē','bokss','boks','svarcel','vingroš','airēš','burāš','motokros','krosa','skrējien','sport']);

function isYouthText(text){return hasYouthAge(text)||YOUTH_WORDS.test(text);}

// What an age group says: 'youth', 'senior' or null.
export function ageGroupLevel(ageGroup){
 const text=lower(ageGroup);
 if(!text.trim())return null;
 if(VETERAN_AGE.test(text)||SENIOR_AGE.test(text))return 'senior';
 if(isYouthText(text))return 'youth';
 return null;
}

// A sports event: a match or competition, an event in the sports group, or a municipal
// event whose title names both a sport and a competition.
export function isSportEvent(e){
 if(!e)return false;
 if(e.event_type==='sports_match'||e.event_type==='sports_competition')return true;
 if(eventGroup(e)==='sport')return true;
 const title=lower(e.title);
 return SPORT_WORDS.test(title)&&COMPETITION.test(title);
}

// 'youth' | 'senior' | null (not a sports event).
// The team names are never read: adult leagues have teams called "Juniori" or "Juniors".
export function sportLevel(e){
 if(!e)return null;
 if(e.sport_level==='youth'||e.sport_level==='senior')return e.sport_level;
 const fromAge=ageGroupLevel(e.age_group);
 if(fromAge)return fromAge;
 if(!isSportEvent(e))return null;
 // A match title is "home – away", so only the competition's own name counts there.
 const named=e.event_type==='sports_match'
  ?[e.competition_name,e.competition_group].map(lower).join(' ')
  :[e.title,e.competition_name].map(lower).join(' ');
 const competition=e.event_type==='sports_match'||e.event_type==='sports_competition'||Boolean(e.competition_name)||COMPETITION.test(named);
 if(competition&&isYouthText(named))return 'youth';
 return 'senior';
}

// Whether an event is shown under a level choice. Events without a sports level always are.
export function matchesLevel(e,level=DEFAULT_LEVEL){
 const key=levelKey(level);
 if(key==='all')return true;
 const own=sportLevel(e);
 return !own||own===key;
}
