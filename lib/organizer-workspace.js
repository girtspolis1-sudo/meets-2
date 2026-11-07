import {quickEventIssue,venueRequired} from './event-entry.js';
export function scopedDraftKey(userId,organizationId,prefix='meets_event_draft_v3'){
 return prefix+':'+(userId||'guest')+':'+(organizationId||'unassigned');
}
export function resolveOrganizationId(organizations,requestedId=''){
 const list=Array.isArray(organizations)?organizations:[];
 if(requestedId&&list.some(x=>x.id===requestedId))return requestedId;
 return list.length===1?list[0].id:'';
}
export function canWriteOrganization(role){
 return ['owner','admin','editor'].includes(String(role||''));
}
export function recurrenceEditScope(submission){
 return submission?.schedule_kind==='recurring'?'series':'event';
}
const SHORT_DATE=new Intl.DateTimeFormat('lv-LV',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
function shortDate(iso){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||'')))return '';
 return SHORT_DATE.format(new Date(iso+'T12:00:00Z'));
}
// Same Latvian date style as the public event cards, instead of ISO dates.
export function submissionDateLabel(item){
 const from=shortDate(item?.date_from);
 if(!from)return 'Datums nav norādīts';
 const to=item.date_to&&item.date_to!==item.date_from?shortDate(item.date_to):'';
 return to?from+' – '+to:from;
}
// What an organizer should act on first: returned for fixes, then unfinished drafts.
export function organizerTodo(submissions){
 const list=Array.isArray(submissions)?submissions:[];
 return {rejected:list.filter(x=>x.status==='rejected'),drafts:list.filter(x=>x.status==='draft'),review:list.filter(x=>x.status==='pending_review')};
}

// Editor address for an event started in the organizer area with its name,
// date and visibility; the editor fills the form from these and drops them
// from the address.
export function quickEventHref({orgId='',title='',date='',visibility='public'}={}){
 const params=new URLSearchParams();
 if(orgId)params.set('org',orgId);
 if(String(title).trim())params.set('title',String(title).trim().slice(0,200));
 if(/^\d{4}-\d{2}-\d{2}$/.test(date))params.set('start',date);
 if(visibility==='private')params.set('private','1');
 const query=params.toString();
 return '/registre-pasakumu/vienkarsi'+(query?'?'+query:'');
}

// What an organizer's event needs, as a colour and words for the lists:
//   green  - ready: published, or private and reachable by its link;
//   yellow - on its way: a complete draft, or waiting for MEETS review;
//   red    - needs the organizer: a draft missing information, or MEETS asked
//            for corrections or did not publish it;
//   gray   - cancelled or archived.
// `visibility` is the short "Publ." / "Priv." tag shown next to it.
export function eventStatusMark(item,{archived=false}={}){
 const e=item||{};
 const visibility=e.visibility==='private'?'Priv.':'Publ.';
 const mark=(tone,label,hint='')=>({tone,label,hint,visibility});
 if(archived)return mark('gray','Arhivēts','Pasākums ir beidzies');
 switch(e.status){
  case 'published':return mark('green','Publicēts','Redzams MEETS kartē un sarakstā');
  case 'private':return mark('green','Privāts','Gatavs — pieejams ar saiti');
  case 'pending_review':return mark('yellow',e.event_id?'Izmaiņas pārbaudē':'Gaida apstiprinājumu','MEETS pārbauda');
  case 'rejected':return mark('red','Jālabo','MEETS lūdz precizēt');
  case 'declined':return mark('red','Netika publicēts','MEETS nepublicēja');
  case 'cancelled':return mark('gray','Atcelts');
  case 'draft':{
   const dated=e.schedule_kind==='recurring'||e.schedule_kind==='dated';
   const issue=quickEventIssue(dated?{...e,time_from:'',time_to:''}:{...e,time_from:hm(e.time_from),time_to:hm(e.time_to)},{requireVenue:venueRequired(e)});
   return issue?mark('red','Jāpapildina',issue.message):mark('yellow','Melnraksts','Gatavs iesniegšanai');
  }
  default:return mark('gray',String(e.status||'—'));
 }
}
const hm=value=>value?String(value).slice(0,5):'';
