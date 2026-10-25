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
