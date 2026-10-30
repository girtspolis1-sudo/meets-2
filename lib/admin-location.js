// Automatic address suggestions for the admin "Mapping" queue.
// A suggestion is only offered for one-click approval when it points at a building or
// place, never at a whole town or area (those would put every event on the town centre).
const AREA_TYPES=new Set(['city','town','village','hamlet','suburb','administrative','municipality','county','state','region','neighbourhood','quarter','locality','isolated_dwelling','postcode','country']);

export function isAreaCandidate(candidate){
 return candidate?.category==='boundary'||AREA_TYPES.has(String(candidate?.type||''));
}
// First stored suggestion list among the group's events (they share the same alias).
export function groupCandidates(events){
 for(const event of Array.isArray(events)?events:[]){
  if(Array.isArray(event?.geocode_candidates)&&event.geocode_candidates.length)return event.geocode_candidates;
 }
 return [];
}
export function groupSuggestedAt(events){
 return (Array.isArray(events)?events:[]).find(e=>e?.geocode_suggested_at)?.geocode_suggested_at||null;
}
export function bestSuggestion(candidates){
 const list=(Array.isArray(candidates)?candidates:[]).filter(c=>Number.isFinite(Number(c?.latitude))&&Number.isFinite(Number(c?.longitude)));
 const precise=list.find(c=>!isAreaCandidate(c));
 if(precise)return {candidate:precise,precise:true};
 return list.length?{candidate:list[0],precise:false}:null;
}
export function suggestionQuery(group){
 return [group?.alias,group?.municipality].map(x=>String(x||'').trim()).filter(Boolean)
  .filter((x,i,a)=>a.findIndex(y=>y.toLocaleLowerCase('lv')===x.toLocaleLowerCase('lv'))===i).join(', ');
}
