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
// Roles in words. "Rīkotājs" creates and manages; "Labotājs" changes existing
// events and tournaments (all of the organizer's, or ones given to them) and creates nothing.
export const ROLE_LABELS={owner:'Īpašnieks',admin:'Administrators',editor:'Rīkotājs',contributor:'Labotājs',viewer:'Skatītājs',item:'Labotājs'};
export const ROLE_HINTS={
 admin:'Visas tiesības, arī komandas uzaicināšana.',
 editor:'Izveido un pārvalda pasākumus un turnīrus.',
 contributor:'Labo esošos pasākumus un turnīrus, jaunus neveido.',
 viewer:'Tikai skatās.'
};
// May the user change this existing event or tournament ('' = a new one)?
export function canEditItem(org,kind,id){
 if(!org)return false;
 if(canWriteOrganization(org.role))return true;
 if(!id)return false;
 return org.role==='contributor'||(org.items||[]).some(x=>x.kind===kind&&x.id===id);
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

// Where people can see an organizer's event, for the lists:
//   map     - the MEETS map and event list (public events after MEETS review);
//   profile - the organizer's public page (published, upcoming, profile public);
//   link    - the event's own share link (private, in review or published).
// Each place is {key,label,state:'on'|'wait'|'off',hint}; `who` says it in one line.
const REACH_LABELS={map:'Karte un saraksts',profile:'Rīkotāja profils',link:'Saite'};
export function eventReach(item,org,today=''){
 const e=item||{},s=e.status;
 const end=e.date_to||e.date_from||'';
 const over=Boolean(today&&end&&end<today);
 const live=s==='published'||s==='pending_review'&&Boolean(e.event_id);
 const linkOn=Boolean(e.share_token)&&['private','pending_review','published'].includes(s);
 const place=(key,state,hint)=>({key,label:REACH_LABELS[key],state,hint});
 const closed={draft:'Melnraksts — vēl nav iesniegts',rejected:'MEETS lūdz precizēt',declined:'MEETS nepublicēja',cancelled:'Pasākums atcelts'}[s]||'';
 let map;
 if(live)map=over?place('map','off','Pasākums beidzies'):place('map','on',s==='pending_review'?'Redzama iepriekšējā versija, izmaiņas pārbaudē':'Redzams kartē un sarakstā');
 else if(s==='pending_review')map=place('map','wait','Parādīsies pēc MEETS pārbaudes');
 else if(s==='private')map=place('map','off','Privāts — kartē un sarakstā nerāda');
 else map=place('map','off',closed||'Nav redzams');
 let profile;
 if(!live)profile=place('profile','off',s==='private'?'Privātus pasākumus profilā nerāda':s==='pending_review'?'Parādīsies pēc publicēšanas':closed||'Nav redzams');
 else if(over)profile=place('profile','off','Profilā rāda tikai gaidāmos');
 else if(!org?.is_public)profile=place('profile','off','Rīkotāja profils nav publisks');
 else profile=place('profile','on','Redzams rīkotāja publiskajā lapā');
 const link=linkOn?place('link','on',s==='private'?'Redz tie, kam iedosi saiti':'Saiti var kopīgot jau tagad'):place('link','off',s==='draft'?'Saite darbosies pēc iesniegšanas':closed||'Saite nedarbojas');
 const who=s==='draft'?'Redz tikai rīkotāja komanda'
  :s==='private'?'Redz tikai tie, kam ir saite'
  :s==='pending_review'&&!e.event_id?'Pagaidām tikai ar saiti — kartē pēc MEETS pārbaudes'
  :live?(over?'Beidzies':profile.state==='on'?'Redz visi: kartē, sarakstā un rīkotāja profilā':'Redz visi kartē un sarakstā')
  :s==='cancelled'?'Atcelts — nav redzams':'Nav redzams — '+(closed||'nav publicēts');
 return {who,places:[map,profile,link]};
}
// Public or private event, and how often it happens.
export function eventFormat(item){
 const kind=item?.schedule_kind==='recurring'?'Atkārtojas':item?.schedule_kind==='dated'?'Vairāki datumi':'';
 return [item?.visibility==='private'?'Privāts':'Publisks',kind].filter(Boolean).join(' · ');
}
