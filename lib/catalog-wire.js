// The public catalogue as it travels to the browser.
//
// The map, the list, the table and the personal pages need most event fields,
// but not the long ones (full description, participation terms, internal notes
// about the location) and not the fields only the detail view shows. The list
// payload keeps the list fields, cuts the description, and sends events as rows
// of values under one header instead of repeating every key 2 000 times. That
// makes the response, the JSON.parse on the phone and the copy kept in
// localStorage several times smaller. The full record of one event comes from
// /api/events/[id] (fullEventUrl) when the detail view opens.

export const LIST_FIELDS=[
 'id','title','description','date_from','date_to','time_from','time_to','time_type',
 'event_type','primary_category','status','price_status','price_text','price_min','price_max',
 'venue_name','address_raw','alternative_address','location_precision','municipality','settlement',
 'country_code','latitude','longitude','cover_image_url',
 'governing_body','competition_key','competition_name','competition_type','competition_stage',
 'sport_format','age_group','tags','sources'
];

// Long enough for two lines on a card and the start of the map detail card.
export const LIST_DESCRIPTION_CHARS=280;

export const WIRE_VERSION=2;

function cleanText(value){
 return String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}

// One event in list form. `description_more` tells the detail view that the
// full description is longer and has to be loaded.
export function listEvent(event){
 const row={};
 for(const key of LIST_FIELDS)row[key]=event[key]??null;
 const description=cleanText(event.description);
 if(description.length>LIST_DESCRIPTION_CHARS){
  row.description=description.slice(0,LIST_DESCRIPTION_CHARS).replace(/\s+\S*$/,'')+'…';
  row.description_more=true;
 }else{
  row.description=description||null;
 }
 return row;
}

const WIRE_FIELDS=[...LIST_FIELDS,'description_more'];

export function encodeCatalog(catalog){
 const events=Array.isArray(catalog?.events)?catalog.events:[];
 return {
  v:WIRE_VERSION,
  fields:WIRE_FIELDS,
  rows:events.map(event=>{const row=listEvent(event);return WIRE_FIELDS.map(key=>row[key]??null);}),
  competitions:catalog?.competitions||[],
  total:events.length,
  fetchedAt:catalog?.fetchedAt??null,
  window:catalog?.window??null
 };
}

// Accepts the wire form (v2) and, for safety during a deploy, the old object form.
export function decodeCatalog(payload){
 if(!payload||typeof payload!=='object')return null;
 if(Array.isArray(payload.events))return payload;
 if(payload.v!==WIRE_VERSION||!Array.isArray(payload.fields)||!Array.isArray(payload.rows))return null;
 const fields=payload.fields;
 const events=payload.rows.map(values=>{
  const event={};
  for(let i=0;i<fields.length;i++)event[fields[i]]=values[i]??null;
  if(!Array.isArray(event.tags))event.tags=[];
  if(!Array.isArray(event.sources))event.sources=[];
  event.description_more=event.description_more===true;
  return event;
 });
 return {events,competitions:payload.competitions||[],total:payload.total??events.length,fetchedAt:payload.fetchedAt??null,window:payload.window??null};
}

export function fullEventUrl(id){return '/api/events/'+encodeURIComponent(id);}

// Calendar entries from the list keep the shortened description and point to
// the event page for the rest, so the download needs no extra request.
export function calendarDescription(event,origin='https://meets.lv'){
 const text=String(event?.description||'');
 if(!event?.description_more||!event?.id)return text;
 return text+'\n\nPilns apraksts: '+origin+'/pasakumi/'+encodeURIComponent(event.id);
}
