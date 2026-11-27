// Latvian Ice Hockey Federation (lhf.lv) — tournament list and pure helpers shared by
// supabase/functions/sync-hockey-events and tests/hockey.test.js.

const BASE='https://www.lhf.lv/lv/turniri/';

// Adult leagues: one full-season games page each.
export const ADULT=[
 {key:'lhf-optibet-hokeja-liga',name:'Optibet hokeja līga',slug:'optibet-hokeja-liga'},
 {key:'lhf-1-liga',name:'Hokeja 1. līga',slug:'1-liga'},
 {key:'lhf-sievietes',name:'Baltijas un Latvijas čempionāts sievietēm',slug:'baltijas-un-latvijas-cempionats-sievietem'}
].map(t=>({...t,url:BASE+t.slug+'/speles',level:'senior',age_group:null}));

// Children's and youth championship (Latvijas Bērnu un Jaunatnes čempionāts hokejā): one
// games page per age group, <base>/<group>/speles. U18M is a second U18 tournament.
const YOUTH_SLUG='latvijas-bernu-un-jaunatnes-cempionats-hokeja';
export const YOUTH_GROUPS=['u18','u18m','u16','u15','u14','u13','u12','u11','u10','u9','u8'];
export const youthAge=group=>group.toUpperCase();
export const YOUTH=YOUTH_GROUPS.map(g=>({key:'lhf-ljc-'+g,name:'Latvijas Bērnu un Jaunatnes čempionāts hokejā ('+youthAge(g)+')',
 slug:YOUTH_SLUG,url:BASE+YOUTH_SLUG+'/'+g+'/speles',level:'youth',age_group:g==='u18m'?'U18':youthAge(g)}));

export const TOURNAMENTS=[...ADULT,...YOUTH];

// Coming games that the federation no longer lists are taken off the map; when a
// tournament page could not be read, or most of its games would go, nothing is touched.
export function staleGames(stored,listedIds,{from,prefix='lhf.lv:'}){
 const listed=new Set(listedIds.map(String));
 const live=stored.filter(e=>e.status!=='archived'&&e.status!=='cancelled'&&e.date_from>=from);
 const gone=live.filter(e=>!listed.has(String(e.import_key).slice(prefix.length)));
 return {gone,trusted:gone.length<=Math.max(5,live.length/2)};
}
