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

function plain(value){
 return String(value||'').toLocaleLowerCase('lv').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
// "Rīgas valstspilsēta" -> "riga", "Ādažu novads" -> "adaz": enough to find the area in an address.
function areaStem(municipality){
 return plain(String(municipality||'').replace(/\s*(valstspilsēta|novads|pilsēta)\s*$/i,'')).slice(0,5);
}
// Words of a place name worth comparing: no hall numbers ("1.zale") or short
// abbreviations ("vsk.", "SH"), each cut to its stem so "Rīgas" matches "Rīga".
export function nameStems(alias){
 return plain(String(alias||'').replace(/\d+\.?\s*z[aā]le/gi,' ')).split(' ')
  .filter(w=>w.length>3&&!/^\d+$/.test(w)).map(w=>w.slice(0,Math.max(4,w.length-2)));
}
// A suggestion safe to approve in bulk: a known MEETS place with a strong name
// match, or the only exact address result that contains every word of the name.
// Both must lie in the group's municipality when it is known.
export function confidentSuggestion(group){
 const best=bestSuggestion(group?.candidates);
 if(!best?.precise)return null;
 const c=best.candidate;
 const stem=areaStem(group?.municipality);
 if(c.type==='meets_known')return Number(c.score)>=0.85&&c.sameArea!==false?c:null;
 if(stem&&!plain(c.displayName).includes(stem))return null;
 const precise=(group?.candidates||[]).filter(x=>!isAreaCandidate(x));
 const words=nameStems(group?.alias);
 const label=plain((c.label||'')+' '+(c.displayName||''));
 return precise.length===1&&words.length>0&&words.every(w=>label.includes(w))?c:null;
}
