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
