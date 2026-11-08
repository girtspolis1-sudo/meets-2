import 'server-only';

export const TOURNAMENT_TOKEN=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public reads by link, without a signed-in user: a published tournament
// (meets_shared_tournament) or what a court secretary sees (meets_scorer_tournament).
async function publicRpc(name,token){
 const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}=process.env;
 if(!TOURNAMENT_TOKEN.test(String(token||''))||!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY)return null;
 const response=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+name,{
  method:'POST',
  headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({p_token:token}),
  cache:'no-store',
  signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw new Error('Tournament upstream status '+response.status);
 const data=await response.json();
 return data&&typeof data==='object'&&typeof data.title==='string'?data:null;
}
export const readSharedTournament=token=>publicRpc('meets_shared_tournament',token);
export const readScorerTournament=token=>publicRpc('meets_scorer_tournament',token);

// Table rows in the shape the tournament functions use (lib/tournament.js).
export function teamFromRow(row){
 return {key:row.key,name:row.name,coach:row.coach||'',group:row.group_key||'',seed:row.seed||0};
}
export function gameFromRow(row){
 return {no:row.no,stage:row.stage,group:row.group_key||'',round:row.round||1,court:row.court||'',
  starts_at:row.starts_at?String(row.starts_at).slice(0,5):null,home:row.home_ref,away:row.away_ref,label:row.label||'',
  place:row.place??null,home_score:row.home_score??null,away_score:row.away_score??null,details:row.details||{}};
}
