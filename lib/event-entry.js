// One shared event form contract for simple and advanced submissions.
export const EVENT_CATEGORIES=[
 'Mūzika un dejas','Teātris un kino','Kultūra','Sports','Ģimenēm',
 'Izstādes','Tirdziņi','Izglītība','Cits'
];
export const QUICK_EVENT_EMPTY={
 title:'',description:'',category:'Cits',date_from:'',date_to:'',
 time_from:'',time_to:'',recurrence_slots:[],price_min:'',price_max:'',venue_id:'',venue_name:'',address:'',
 latitude:'',longitude:'',price_status:'free',schedule_kind:'once'
};
export const QUICK_VENUE_EMPTY={
 name:'',address:'',latitude:'',longitude:'',directions:'',description:'',is_public:false
};
export const EVENT_DRAFT_KEY='meets_event_draft_v2';
export const VENUE_DRAFT_KEY='meets_venue_draft_v2';

export function isCoordinatePair(input){
 const {latitude,longitude}=input||{};
 if(latitude==null||longitude==null||latitude===''||longitude==='')return false;
 const lat=Number(latitude),lon=Number(longitude);
 return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
}
function validDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
 const date=new Date(value+'T12:00:00Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
// PostgreSQL TIME values are returned as HH:mm:ss, whereas browser time inputs
// normally edit HH:mm. Both representations are valid and must compare equally.
const EVENT_TIME=/^([01]\\d|2[0-3]):([0-5]\\d)(?::([0-5]\\d)(?:\\.(\\d{1,6}))?)?$/;
function timeSeconds(value){
 const match=EVENT_TIME.exec(String(value||''));
 if(!match)return null;
 return Number(match[1])*3600+Number(match[2])*60+Number(match[3]||0)+Number('0.'+(match[4]||'0'));
}
const validTime=value=>!value||timeSeconds(value)!==null;
export function normalizeEventTime(value){
 const raw=String(value||'');
 const match=EVENT_TIME.exec(raw);
 if(!match)return raw;
 // Seconds with a non-zero value are retained rather than silently discarded.
 return (!match[3]||Number(match[3])===0&&(!match[4]||Number(match[4])===0))?raw.slice(0,5):raw;
}
export function validateQuickEvent(input,{requireVenue=true}={}){
 const d=input||{},title=String(d.title||'').trim();
 if(title.length<3||title.length>200)return 'Pasākuma nosaukumam jābūt 3–200 rakstzīmes garam.';
 if(!validDate(d.date_from))return 'Norādi derīgu pasākuma datumu.';
 if(d.date_to&&!validDate(d.date_to))return 'Norādi derīgu beigu datumu.';
 if(d.date_to&&d.date_to<d.date_from)return 'Beigu datums nevar būt pirms sākuma datuma.';
 if(!validTime(d.time_from)||!validTime(d.time_to))return 'Norādi derīgu sākuma un beigu laiku.';
 if(d.time_from&&d.time_to&&(!d.date_to||d.date_to===d.date_from)&&timeSeconds(d.time_to)<=timeSeconds(d.time_from))
  return 'Vienas dienas pasākuma beigu laikam jābūt pēc sākuma laika.';
 if(!EVENT_CATEGORIES.includes(d.category))return 'Izvēlies pasākuma kategoriju.';
 if(!['free','paid','mixed','unknown'].includes(d.price_status))return 'Izvēlies dalības maksas veidu.';
 if(requireVenue){
  if(String(d.venue_name||'').trim().length<2)return 'Norādi norises vietas nosaukumu.';
  if(!String(d.address||'').trim()&&!isCoordinatePair(d))return 'Izvēlies norises vietu kartē vai ievadi adresi.';
 }
 return '';
}
export function validateQuickVenue(input){
 const d=input||{};
 if(String(d.name||'').trim().length<2||String(d.name||'').trim().length>160)return 'Norādi norises vietas nosaukumu (2–160 rakstzīmes).';
 if(String(d.address||'').trim().length<5&&!isCoordinatePair(d))return 'Norādi adresi vai atzīmē vietu kartē.';
 return '';
}
export function copyEventDraft(submission){
 if(!submission)return {...QUICK_EVENT_EMPTY};
 const result=Object.fromEntries(Object.keys(QUICK_EVENT_EMPTY).map(k=>[k,submission[k]??QUICK_EVENT_EMPTY[k]]));
 return {...result,date_from:'',date_to:'',time_from:normalizeEventTime(result.time_from),time_to:normalizeEventTime(result.time_to),schedule_kind:'once'};
}
