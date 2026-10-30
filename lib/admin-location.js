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
// "Rīgas valstspilsēta" -> "riga", "Ādažu novads" -> "adaz": enough to find the area in an address
// ("Rīga" as well as "Rīgas").
function areaStem(municipality){
 return plain(String(municipality||'').replace(/\s*(valstspilsēta|novads|pilsēta)\s*$/i,'')).slice(0,4);
}
// Abbreviations league and municipality calendars use, as in meets_private.place_search_query.
const ABBREVIATIONS={vsk:'vidusskola',psk:'pamatskola',gimn:'gimnazija',sh:'sporta halle',sn:'sporta nams',sk:'sporta komplekss',
 sc:'sporta centrs',oc:'olimpiskais centrs',nss:'novada sporta skola',ss:'sporta skola',kn:'kulturas nams',kc:'kulturas centrs',tn:'tautas nams'};
function expanded(value){
 return plain(String(value||'').replace(/\d+\.?\s*z[aā]le/gi,' ')).split(' ').map(w=>ABBREVIATIONS[w]||w).join(' ');
}
// Numbers and the stems of longer words, so "Rīgas" matches "Rīga" and "vsk." matches "vidusskola".
export function nameStems(alias){
 return expanded(alias).split(' ').filter(w=>/^\d+$/.test(w)||w.length>3)
  .map(w=>/^\d+$/.test(w)?w:w.slice(0,Math.max(4,w.length-2)));
}
// Every number and word of the name appears in the candidate: "Rīgas 47.vsk." is not
// "Rīgas 49.vsk.", "Ķekavas vsk." is not "Ķekavas SK".
export function namesMatch(alias,candidateText){
 const words=nameStems(alias),text=' '+expanded(candidateText)+' ';
 return words.length>0&&words.every(w=>/^\d+$/.test(w)?text.includes(' '+w+' '):text.includes(w));
}
// A suggestion safe to approve in bulk: the one matching address in the address
// register, a known MEETS place with a strong name match, or the only exact address
// result that contains every word of the name.
// Both must lie in the group's municipality when it is known.
export function confidentSuggestion(group){
 const best=bestSuggestion(group?.candidates);
 if(!best?.precise)return null;
 const c=best.candidate;
 const stem=areaStem(group?.municipality);
 // The exact street address from the State Address Register, the only one in the area.
 if(c.type==='address')return c.unique===true&&(!stem||plain(c.displayName).includes(stem))?c:null;
 // A bare town name ("Saldus") does not say which hall in town.
 if(nameStems(group?.alias).length<2)return null;
 if(c.type==='meets_known')return Number(c.score)>=0.85&&c.sameArea!==false&&namesMatch(group?.alias,(c.label||'')+' '+(c.displayName||''))?c:null;
 if(stem&&!plain(c.displayName).includes(stem))return null;
 const precise=(group?.candidates||[]).filter(x=>!isAreaCandidate(x));
 return precise.length===1&&namesMatch(group?.alias,(c.label||'')+' '+(c.displayName||''))?c:null;
}
