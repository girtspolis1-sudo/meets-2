import {NextResponse} from 'next/server';
import {cleanDetails,cleanTournament} from '../../../lib/tournament.js';
import {TOURNAMENT_TOKEN,gameFromRow,readScorerTournament,readSharedTournament,teamFromRow} from '../../../lib/tournament-server.js';

export const dynamic='force-dynamic';
const BASE=()=>process.env.SUPABASE_URL;
const KEY=()=>process.env.SUPABASE_PUBLISHABLE_KEY;
const UUID=TOURNAMENT_TOKEN;
const FAILED='Darbība neizdevās. Pārbaudi ievadītos datus un piekļuves tiesības.';
const LIST_FIELDS='id,organization_id,submission_id,title,sport,format,play_date,venue,youth,status,share_token,created_at,updated_at';

// Readable messages from the database functions (they raise them in Latvian).
function safeError(raw){
 let message='';try{message=JSON.parse(raw).message||'';}catch{}
 return /^[A-ZĀČĒĢĪĶĻŅŠŪŽ][^\n]{3,120}$/.test(message)?message:FAILED;
}
async function call(path,token,{method='GET',body=null}={}){
 const headers={apikey:KEY(),'Content-Type':'application/json',Prefer:'return=representation'};
 if(token)headers.Authorization='Bearer '+token;
 const res=await fetch(BASE()+'/rest/v1/'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 const raw=await res.text();
 if(!res.ok){
  console.error('tournament_rest_failed',{path:path.split('?')[0],method,status:res.status,details:raw.slice(0,240)});
  const error=new Error(safeError(raw));error.safe=true;error.status=res.status;throw error;
 }
 return raw?JSON.parse(raw):null;
}
const rpc=(name,token,body)=>call('rpc/'+name,token,{method:'POST',body});

function score(value){
 if(value===null||value===undefined||value==='')return null;
 const n=Number(value);
 if(!Number.isInteger(n)||n<0||n>999)throw Object.assign(new Error('Rezultātam jābūt veselam skaitlim no 0 līdz 999.'),{safe:true});
 return n;
}
function scoreArgs(data){
 const home=score(data.home),away=score(data.away);
 if((home===null)!==(away===null))throw Object.assign(new Error('Ievadi abu komandu rezultātu.'),{safe:true});
 const no=Number(data.no);
 if(!Number.isInteger(no)||no<1||no>400)throw Object.assign(new Error('Nederīga spēle.'),{safe:true});
 return {p_no:no,p_home:home,p_away:away,p_details:cleanDetails(data.details)};
}
const fail=(error,status=400)=>NextResponse.json({error},{status});

// Public reads by link: ?share=<token> (published tournament) or ?scorer=<token> (court link).
export async function GET(request){
 const url=new URL(request.url);
 const share=url.searchParams.get('share'),scorer=url.searchParams.get('scorer');
 try{
  const data=share?await readSharedTournament(share):scorer?await readScorerTournament(scorer):null;
  if(!data)return fail('Turnīrs nav atrasts vai vēl nav publicēts.',404);
  // The public page asks every 30 seconds from every open screen: the CDN
  // answers them from a copy at most 10 seconds old, so a full hall does not
  // reach the database. A court secretary always gets the live record.
  const cacheControl=share?'public, max-age=0, s-maxage=10, stale-while-revalidate=20':'no-store';
  return NextResponse.json({tournament:data},{headers:{'Cache-Control':cacheControl}});
 }catch(error){
  console.error('tournament_public_failed',{message:error?.message});
  return fail('Turnīru neizdevās ielādēt.',502);
 }
}

export async function POST(request){
 try{
  if(!BASE()||!KEY())return fail('Nav savienojuma ar kontu servisu.',503);
  const data=await request.json();
  const {action,token}=data||{};

  // A court secretary enters a result through the court link, without an account.
  if(action==='scorerScore'){
   if(!UUID.test(String(data.scorer_token||'')))return fail('Nederīga rezultātu saite.');
   await rpc('meets_scorer_set_score',null,{p_token:data.scorer_token,...scoreArgs(data)});
   return NextResponse.json({ok:true});
  }

  if(typeof token!=='string'||!token)return fail('Lūdzu, pieslēdzies.',401);
  const userResponse=await fetch(BASE()+'/auth/v1/user',{headers:{apikey:KEY(),Authorization:'Bearer '+token},cache:'no-store'});
  if(!userResponse.ok)return fail('Sesija beigusies. Pieslēdzies atkārtoti.',401);
  const user=await userResponse.json();
  if(!UUID.test(user?.id||''))return fail('Nepareiza sesija.',401);

  // Tournaments the user may see: their organizers' and the ones given to them.
  if(action==='list'){
   const filter=UUID.test(data.organization_id||'')?'&organization_id=eq.'+data.organization_id:'';
   const items=await call('meets_tournaments?select='+LIST_FIELDS+filter+'&order=play_date.desc.nullsfirst,created_at.desc',token)||[];
   // How far each tournament is: games in the schedule and games with a result.
   const ids=items.map(t=>t.id).slice(0,100);
   const games=ids.length?await call('meets_tournament_games?select=tournament_id,home_score&tournament_id=in.('+ids.join(',')+')',token).catch(()=>[]):[];
   const count={};
   for(const g of games||[]){const c=count[g.tournament_id]=count[g.tournament_id]||{games_total:0,games_scored:0};c.games_total++;if(g.home_score!==null&&g.home_score!==undefined)c.games_scored++;}
   return NextResponse.json({tournaments:items.map(t=>({...t,...(count[t.id]||{games_total:0,games_scored:0})}))});
  }

  if(action==='save'){
   const input=data.tournament||{};
   if(!UUID.test(input.organization_id||''))return fail('Izvēlies rīkotāju.');
   if(input.id&&!UUID.test(input.id))return fail('Nederīgs turnīrs.');
   let clean;
   try{clean=cleanTournament({...input,teams:data.teams,games:data.games});}
   catch(error){return fail(error.message);}
   const {teams,games,...fields}=clean;
   const id=await rpc('meets_tournament_save',token,{
    p_tournament:{...fields,id:input.id||null,organization_id:input.organization_id},
    p_teams:teams,
    p_games:games.map(({home_score,away_score,details,...game})=>game)
   });
   return NextResponse.json({id});
  }

  if(!UUID.test(data.id||''))return fail('Nederīgs turnīrs.');

  if(action==='get'){
   const [found,teams,games,scorers]=await Promise.all([
    call('meets_tournaments?select=*&id=eq.'+data.id,token),
    call('meets_tournament_teams?select=*&tournament_id=eq.'+data.id+'&order=group_key,seed',token),
    call('meets_tournament_games?select=*&tournament_id=eq.'+data.id+'&order=no',token),
    call('meets_tournament_scorers?select=court,token&tournament_id=eq.'+data.id+'&order=court',token).catch(()=>[])
   ]);
   const item=found?.[0];
   if(!item)return fail('Turnīrs nav atrasts vai tev nav tam piekļuves.',404);
   const org=item.organization_id;
   // What the user may do: edit this one, create and delete in the organizer, invite people.
   const [edit,create,manage]=await Promise.all([
    rpc('meets_can_edit_item',token,{p_kind:'tournament',p_item:item.id,p_org:org}).catch(()=>false),
    rpc('meets_org_can_edit',token,{p_org:org}).catch(()=>false),
    rpc('meets_org_can_manage',token,{p_org:org}).catch(()=>false)
   ]);
   return NextResponse.json({
    tournament:item,
    teams:(teams||[]).map(teamFromRow),
    games:(games||[]).map(gameFromRow),
    scorers:scorers||[],
    rights:{edit:edit===true,create:create===true,manage:manage===true}
   });
  }

  if(action==='score'){
   await rpc('meets_tournament_set_score',token,{p_tournament:data.id,...scoreArgs(data)});
   return NextResponse.json({ok:true});
  }

  if(action==='scorerLink'){
   const court=String(data.court||'').trim();
   if(!court||court.length>40)return fail('Izvēlies laukumu.');
   const link=await rpc('meets_tournament_scorer_link',token,{p_tournament:data.id,p_court:court,p_renew:data.renew===true});
   return NextResponse.json({court,token:link});
  }

  if(action==='delete'){
   const removed=await call('meets_tournaments?id=eq.'+data.id,token,{method:'DELETE'});
   if(!removed?.length)return fail('Turnīru var dzēst tikai rīkotāja komanda ar rediģēšanas tiesībām.',403);
   return NextResponse.json({ok:true});
  }

  return fail('Neatbalstīta darbība.');
 }catch(error){
  return fail(error?.safe?error.message:'Neizdevās izpildīt pieprasījumu.',error?.status===401?401:400);
 }
}
