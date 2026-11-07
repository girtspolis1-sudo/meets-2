// One shared event form contract for simple and advanced submissions.
export const EVENT_CATEGORIES=[
 'Mūzika un dejas','Teātris un kino','Kultūra','Sports','Ģimenēm',
 'Izstādes','Tirdziņi','Izglītība','Cits'
];
export const QUICK_EVENT_EMPTY={
 title:'',description:'',category:'Cits',date_from:'',date_to:'',
 time_from:'',time_to:'',recurrence_slots:[],price_min:'',price_max:'',venue_id:'',venue_name:'',address:'',
 latitude:'',longitude:'',price_status:'free',schedule_kind:'once',
 attendance_mode:'in_person',online_url:'',visibility:'public'
};
// A place is needed for the map; a private event that happens only online needs none.
export function venueRequired(input){
 return !(input?.visibility==='private'&&input?.attendance_mode==='online');
}
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
const EVENT_TIME=/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,6}))?)?$/;
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
// The first problem of an event form: which field and what to say. The editor
// marks that field; the API only needs the message (validateQuickEvent).
export function quickEventIssue(input,{requireVenue=true}={}){
 const d=input||{},title=String(d.title||'').trim();
 const issue=(field,message)=>({field,message});
 if(title.length<3)return issue('title',title?'Nosaukumam vajag vismaz 3 rakstzīmes.':'Ieraksti pasākuma nosaukumu.');
 if(title.length>200)return issue('title','Nosaukums nedrīkst pārsniegt 200 rakstzīmes.');
 if(!validDate(d.date_from))return issue('date_from','Norādi pasākuma sākuma datumu.');
 if(d.date_to&&!validDate(d.date_to))return issue('date_to','Norādi derīgu beigu datumu.');
 if(d.date_to&&d.date_to<d.date_from)return issue('date_to','Beigu datums nevar būt pirms sākuma datuma.');
 if(!validTime(d.time_from))return issue('time_from','Norādi derīgu sākuma laiku.');
 if(!validTime(d.time_to))return issue('time_to','Norādi derīgu beigu laiku.');
 if(d.time_from&&d.time_to&&(!d.date_to||d.date_to===d.date_from)&&timeSeconds(d.time_to)<=timeSeconds(d.time_from))
  return issue('time_to','Vienas dienas pasākuma beigu laikam jābūt pēc sākuma laika.');
 if(!EVENT_CATEGORIES.includes(d.category))return issue('category','Izvēlies pasākuma kategoriju.');
 if(!['free','paid','mixed','unknown'].includes(d.price_status))return issue('price_status','Izvēlies dalības maksas veidu.');
 if(d.attendance_mode&&!ATTENDANCE_MODES.includes(d.attendance_mode))return issue('venue','Izvēlies, kā pasākums notiks.');
 if(d.online_url&&!/^https:\/\/\S+$/.test(String(d.online_url).trim()))return issue('online_url','Saitei uz zvanu jāsākas ar https://.');
 if(requireVenue){
  if(String(d.venue_name||'').trim().length<2)return issue('venue','Izvēlies norises vietu vai pievieno jaunu.');
  if(!String(d.address||'').trim()&&!isCoordinatePair(d))return issue('venue','Norises vietai vajag adresi vai punktu kartē.');
 }
 return null;
}
export function validateQuickEvent(input,options){
 return quickEventIssue(input,options)?.message||'';
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

// How an event takes place. The place is given in every case; online events add a call link.
export const ATTENDANCE_MODES=['in_person','online','hybrid'];
export const ATTENDANCE_LABELS={in_person:'Klātienē',online:'Tiešsaistē',hybrid:'Klātienē un tiešsaistē'};
// A call link: https only, trimmed; '' when empty or not a link.
export function cleanOnlineUrl(value){
 const url=String(value||'').trim();
 if(!url)return '';
 if(!/^https:\/\/\S+$/.test(url)||url.length>500)throw Error('Saitei uz zvanu jāsākas ar https:// (piem., Zoom vai Teams saite).');
 try{new URL(url);}catch{throw Error('Saite uz zvanu nav derīga.');}
 return url;
}
