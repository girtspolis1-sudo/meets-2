// Sports tournaments run by an organizer: templates per sport, formats, the
// schedule on courts, group tables and final places. Pure functions, shared by
// the organizer wizard, the public page, the scorer page and the API.
//
// Teams are referred to in games by references:
//   T:<key>   a team            A1  the winner of group A (A2 second, ...)
//   W:<no>    winner of game no  L:<no>  loser of game no

export const SPORTS={
 basket3x3:{name:'Basketbols 3x3',unit:'punkti',slot:15,draw:false,rank:'wins',points:{win:1,loss:0},
  rules:'Spēle 10 min vai līdz 21 punktam. Tabulā skaita uzvaras; vienādu uzvaru gadījumā savstarpējās spēles, tad vidēji gūtie punkti.'},
 basket5x5:{name:'Basketbols 5x5',unit:'punkti',slot:30,draw:false,rank:'points',points:{win:2,loss:1},
  rules:'Uzvara 2 punkti, zaudējums 1. Vienādu punktu gadījumā savstarpējās spēles, tad punktu starpība.'},
 football:{name:'Futbols',unit:'vārti',slot:20,draw:true,rank:'points',points:{win:3,draw:1,loss:0},
  rules:'Uzvara 3, neizšķirts 1, zaudējums 0. Tad savstarpējās spēles, vārtu starpība, gūtie vārti. Spēlēs par vietām neizšķirta gadījumā uzvarētāju nosaka 11 m sitieni.'},
 floorball:{name:'Florbols',unit:'vārti',slot:20,draw:true,rank:'points',points:{win:3,draw:1,loss:0},
  rules:'Uzvara 3, neizšķirts 1, zaudējums 0. Tad savstarpējās spēles, vārtu starpība, gūtie vārti.'},
 volleyball:{name:'Volejbols',unit:'seti',slot:30,draw:false,rank:'sets',sets:true,
  rules:'Līdz 2 uzvarētiem setiem. 2:0 → 3 punkti, 2:1 → 2, 1:2 → 1, 0:2 → 0. Kārto pēc uzvarām, punktiem, setu attiecības.'},
 hockey:{name:'Hokejs',unit:'vārti',slot:30,draw:false,rank:'points',points:{win:3,otWin:2,otLoss:1,loss:0},overtime:true,
  rules:'Uzvara pamatlaikā 3, papildlaikā vai metienos 2, zaudējums papildlaikā 1, pamatlaikā 0.'},
 handball:{name:'Handbols',unit:'vārti',slot:30,draw:true,rank:'points',points:{win:2,draw:1,loss:0},
  rules:'Uzvara 2, neizšķirts 1, zaudējums 0. Tad savstarpējās spēles, vārtu starpība.'},
 other:{name:'Cits',unit:'punkti',slot:15,draw:true,rank:'points',points:{win:3,draw:1,loss:0},
  rules:'Uzvara 3, neizšķirts 1, zaudējums 0. Tad starpība un gūtie punkti.'}
};
export const FORMATS={
 groups_places:{name:'Grupas un spēles par visām vietām',hint:'Katra komanda spēlē grupā, tad vēl par vietām. 2 vai 4 vienāda lieluma grupas.'},
 round_robin:{name:'Visi pret visiem',hint:'Viena vai vairākas grupas; vietas nosaka grupas tabula.'},
 knockout:{name:'Izslēgšanas spēles',hint:'Zaudētājs izstājas. Spēcīgākie pēc izsēšanas var izlaist pirmo kārtu.'}
};
export const GROUP_KEYS=['A','B','C','D','E','F','G','H'];
export const sportOf=key=>SPORTS[key]||SPORTS.other;

const HHMM=/^([01]\d|2[0-3]):([0-5]\d)$/;
export const toMin=t=>{const m=HHMM.exec(String(t||''));return m?Number(m[1])*60+Number(m[2]):null;};
export const toTime=min=>String(Math.floor(min/60)%24).padStart(2,'0')+':'+String(min%60).padStart(2,'0');
export const isRef=ref=>/^(T:[a-z0-9-]{1,20}|[A-H][1-9]|[WL]:\d{1,3})$/.test(String(ref||''));
export const teamRef=key=>'T:'+key;

// Points one side gets for a result.
export function matchPoints(sportKey,own,other,details={}){
 const s=sportOf(sportKey);
 if(s.sets)return own>other?(other===0?3:2):(own>0?1:0);
 if(own===other)return s.points.draw??0;
 const won=own>other;
 if(s.overtime&&details?.ot)return won?s.points.otWin:s.points.otLoss;
 return won?s.points.win:s.points.loss;
}
export function hasScore(game){return Number.isInteger(game?.home_score)&&Number.isInteger(game?.away_score);}

// Round robin by the circle method: rounds of pairs, every team once per round.
export function roundRobin(items){
 const list=items.slice();
 if(list.length<2)return [];
 if(list.length%2)list.push(null);
 const n=list.length,rounds=[];
 for(let r=0;r<n-1;r++){
  const pairs=[];
  for(let i=0;i<n/2;i++){
   const a=list[i],b=list[n-1-i];
   if(a!==null&&b!==null)pairs.push(r%2?[b,a]:[a,b]);
  }
  rounds.push(pairs);
  list.splice(1,0,list.pop());
 }
 return rounds;
}

export function groupsOf(teams){
 const out={};
 for(const t of [...teams].sort((a,b)=>(a.seed||0)-(b.seed||0)))if(t.group)(out[t.group]=out[t.group]||[]).push(t);
 return Object.fromEntries(Object.keys(out).sort().map(k=>[k,out[k]]));
}
// Snake order across groups by seed: A B C D D C B A ...
export function snakeGroups(teams,count){
 const keys=GROUP_KEYS.slice(0,Math.max(1,Math.min(8,count)));
 return teams.map((t,i)=>{
  const row=Math.floor(i/keys.length),col=i%keys.length;
  return {...t,group:keys[row%2?keys.length-1-col:col],seed:i+1};
 });
}

// Why a format cannot be built from these teams, or ''.
export function formatProblem(format,teams){
 if(teams.length<2)return 'Pievieno vismaz 2 komandas.';
 if(format==='knockout')return teams.length>64?'Izslēgšanai līdz 64 komandām.':'';
 const groups=Object.values(groupsOf(teams));
 if(teams.some(t=>!t.group))return 'Katrai komandai izvēlies grupu.';
 if(groups.some(g=>g.length<2))return 'Katrā grupā jābūt vismaz 2 komandām.';
 if(format==='groups_places'){
  if(![2,4].includes(groups.length))return 'Spēlēm par vietām vajag 2 vai 4 grupas.';
  if(new Set(groups.map(g=>g.length)).size>1)return 'Spēlēm par vietām grupām jābūt vienāda lieluma.';
 }
 return '';
}

const ROUND_NAMES={2:'Fināls',4:'Pusfināls',8:'Ceturtdaļfināls',16:'1/8 fināla',32:'1/16 fināla',64:'1/32 fināla'};
function seedOrder(size){
 let order=[1];
 while(order.length<size){const n=order.length*2;order=order.flatMap(s=>[s,n+1-s]);}
 return order;
}
// Games of a format, before they have a time: {id, stage, group, round, home, away, label, place}.
// References to other games use the temporary id ("W:g12") until numbering.
export function buildGames(format,teams,{third=true}={}){
 const games=[];let id=0;
 const add=g=>{const game={id:'g'+(++id),label:'',place:null,group:'',round:1,...g};games.push(game);return game;};
 if(format==='knockout'){
  const seeded=[...teams].sort((a,b)=>(a.seed||0)-(b.seed||0));
  let size=2;while(size<seeded.length)size*=2;
  let current=seedOrder(size).map(s=>seeded[s-1]?teamRef(seeded[s-1].key):null);
  let round=1,lastPair=null;
  while(current.length>1){
   const next=[],name=ROUND_NAMES[current.length]||'Kārta '+round;
   const games2=[];
   for(let i=0;i<current.length;i+=2){
    const a=current[i],b=current[i+1];
    if(a&&b){const g=add({stage:'knockout',round,home:a,away:b,label:name});games2.push(g);next.push('W:'+g.id);}
    else next.push(a||b);
   }
   if(current.length===4)lastPair=games2;
   if(current.length===2&&games2[0])games2[0].place=1;
   current=next;round++;
  }
  if(third&&lastPair&&lastPair.length===2){
   const finalRound=games.find(g=>g.place===1)?.round||round;
   add({stage:'knockout',round:finalRound,home:'L:'+lastPair[0].id,away:'L:'+lastPair[1].id,label:'Par 3. vietu',place:3});
  }
  return games;
 }
 const groups=groupsOf(teams);
 for(const [key,list] of Object.entries(groups)){
  roundRobin(list.map(t=>teamRef(t.key))).forEach((pairs,r)=>pairs.forEach(([home,away])=>add({stage:'group',group:key,round:r+1,home,away})));
 }
 if(format!=='groups_places')return games;
 const keys=Object.keys(groups),size=groups[keys[0]].length;
 if(keys.length===2){
  for(let k=1;k<=size;k++)add({stage:'placement',round:1,home:keys[0]+k,away:keys[1]+k,label:'Par '+(2*k-1)+'. vietu',place:2*k-1});
 }else if(keys.length===4){
  const [a,b,c,d]=keys;
  for(let k=size;k>=1;k--){
   const band=4*(k-1)+1,label=band+'.–'+(band+3)+'. v.';
   const s1=add({stage:'placement',round:1,home:a+k,away:d+k,label});
   const s2=add({stage:'placement',round:1,home:b+k,away:c+k,label});
   add({stage:'placement',round:2,home:'L:'+s1.id,away:'L:'+s2.id,label:'Par '+(band+2)+'. vietu',place:band+2});
   add({stage:'placement',round:2,home:'W:'+s1.id,away:'W:'+s2.id,label:'Par '+band+'. vietu',place:band});
  }
 }
 return games;
}

// Times a game may start: from the start in steps of one slot, never inside a block.
export function slotTimes({start='10:00',slot=15,blocks=[]},count=200){
 const out=[];let t=toMin(start)??600;
 const bl=(blocks||[]).map(b=>({from:toMin(b.at),to:toMin(b.at)+(Number(b.minutes)||0)})).filter(b=>b.from!==null);
 while(out.length<count&&t<24*60){
  const hit=bl.find(b=>t<b.to&&t+slot>b.from);
  if(hit){t=hit.to;continue;}
  out.push(t);t+=slot;
 }
 return out;
}

function sourceIds(ref){const m=/^[WL]:(.+)$/.exec(ref);return m?[m[1]]:[];}
function groupOfRef(ref){const m=/^([A-H])\d$/.exec(ref);return m?m[1]:'';}

// Places games on courts and times. Hard rules: a court holds one game at a
// time, a team rests at least `rest` minutes between games, a coach's teams do
// not play at the same time, and a game waits for the games it depends on.
// Several random orders are tried; the one that ends earliest wins.
export function schedule(games,teams,settings,{tries=150,seed=1}={}){
 const slot=Number(settings.slot)||15,rest=Number(settings.rest??slot);
 const courts=(settings.courts||['A']).filter(Boolean);
 const times=slotTimes({...settings,slot});
 const coach=Object.fromEntries(teams.map(t=>[teamRef(t.key),String(t.coach||'').trim().toLocaleLowerCase('lv')]));
 let s=seed||1;const rand=()=>{s=(s*16807)%2147483647;return s/2147483647;};
 const phase=g=>g.stage==='group'?0:g.round;
 let best=null;
 for(let attempt=0;attempt<tries;attempt++){
  const order=[...games].map(g=>({g,r:rand()})).sort((x,y)=>phase(x.g)-phase(y.g)||x.g.round-y.g.round||x.r-y.r).map(x=>x.g);
  const placed={},busyCourt={},teamTimes={},coachTimes={};
  for(const g of order){
   // Earliest start: after the games this one waits for, plus rest.
   let earliest=-1;
   for(const ref of [g.home,g.away]){
    for(const src of sourceIds(ref))if(placed[src])earliest=Math.max(earliest,placed[src].at+slot+rest);
    const grp=groupOfRef(ref);
    if(grp)for(const x of games)if(x.stage==='group'&&x.group===grp&&placed[x.id])earliest=Math.max(earliest,placed[x.id].at+slot+rest);
   }
   const known=[g.home,g.away].filter(r=>r.startsWith('T:'));
   const coaches=known.map(r=>coach[r]).filter(Boolean);
   let chosen=null;
   for(const at of times){
    if(at<earliest)continue;
    if(known.some(r=>(teamTimes[r]||[]).some(t=>Math.abs(t-at)<slot+rest)))continue;
    if(coaches.some(c=>(coachTimes[c]||[]).includes(at)))continue;
    const court=courts.find(c=>!busyCourt[c+'@'+at]);
    if(court){chosen={at,court};break;}
   }
   if(!chosen)break;
   placed[g.id]=chosen;busyCourt[chosen.court+'@'+chosen.at]=true;
   for(const r of known)(teamTimes[r]=teamTimes[r]||[]).push(chosen.at);
   for(const c of coaches)(coachTimes[c]=coachTimes[c]||[]).push(chosen.at);
  }
  if(Object.keys(placed).length!==games.length)continue;
  const end=Math.max(...Object.values(placed).map(p=>p.at));
  if(!best||end<best.end)best={end,placed};
 }
 if(!best)return null;
 return numberGames(games.map(g=>({...g,starts_at:toTime(best.placed[g.id].at),court:best.placed[g.id].court})),courts);
}
// Numbers games by time, then court, and turns temporary ids into numbers.
export function numberGames(games,courts=[]){
 const sorted=[...games].sort((a,b)=>toMin(a.starts_at)-toMin(b.starts_at)||courts.indexOf(a.court)-courts.indexOf(b.court));
 const no=Object.fromEntries(sorted.map((g,i)=>[g.id,i+1]));
 const fix=ref=>ref.replace(/^([WL]):(g\d+)$/,(_,k,id)=>k+':'+no[id]);
 return sorted.map((g,i)=>({no:i+1,stage:g.stage,group:g.group||'',round:g.round||1,court:g.court,starts_at:g.starts_at,
  home:fix(g.home),away:fix(g.away),label:g.label||'',place:g.place??null,home_score:g.home_score??null,away_score:g.away_score??null,details:g.details||{}}));
}

// Problems with a schedule, for the organizer after manual changes.
export function scheduleProblems(games,teams,settings){
 const slot=Number(settings.slot)||15,rest=Number(settings.rest??slot);
 const out=[];
 const coach=Object.fromEntries(teams.map(t=>[teamRef(t.key),String(t.coach||'').trim().toLocaleLowerCase('lv')]));
 const byNo=Object.fromEntries(games.map(g=>[g.no,g]));
 const seen={};
 for(const g of games){
  const at=toMin(g.starts_at);
  if(at===null){out.push('Spēlei '+g.no+' nav laika.');continue;}
  const k=g.court+'@'+at;if(seen[k])out.push('Laukumā '+g.court+' '+g.starts_at+' ir divas spēles ('+seen[k]+' un '+g.no+').');seen[k]=g.no;
  for(const b of settings.blocks||[]){const f=toMin(b.at),t=f+(Number(b.minutes)||0);if(f!==null&&at<t&&at+slot>f)out.push('Spēle '+g.no+' pārklājas ar “'+b.title+'”.');}
  for(const ref of [g.home,g.away]){
   const m=/^[WL]:(\d+)$/.exec(ref);
   if(m&&byNo[m[1]]&&toMin(byNo[m[1]].starts_at)+slot+rest>at)out.push('Spēle '+g.no+' ir pārāk drīz pēc spēles '+m[1]+'.');
   const grp=/^([A-H])\d$/.exec(ref)?.[1];
   if(grp&&games.some(x=>x.stage==='group'&&x.group===grp&&toMin(x.starts_at)+slot+rest>at))out.push('Spēle '+g.no+' sākas pirms '+grp+' grupas spēles beidzas.');
  }
 }
 const teamGames={};
 for(const g of games)for(const r of [g.home,g.away])if(r.startsWith('T:'))(teamGames[r]=teamGames[r]||[]).push(g);
 const name=Object.fromEntries(teams.map(t=>[teamRef(t.key),t.name]));
 for(const [r,list] of Object.entries(teamGames)){
  const ts=list.map(g=>toMin(g.starts_at)).sort((a,b)=>a-b);
  for(let i=1;i<ts.length;i++)if(ts[i]-ts[i-1]<slot+rest){out.push((name[r]||r)+' spēlē bez atpūtas ('+toTime(ts[i-1])+', '+toTime(ts[i])+').');break;}
 }
 // A coach in two different games at once (a game between their own two teams is fine).
 const coachAt={},coachName={};
 for(const g of games)for(const r of [g.home,g.away])if(coach[r]){
  const k=coach[r]+'@'+g.starts_at;(coachAt[k]=coachAt[k]||new Set()).add(g.no);
  coachName[coach[r]]=coachName[coach[r]]||String(teams.find(t=>teamRef(t.key)===r)?.coach||'').trim();
 }
 for(const [k,set] of Object.entries(coachAt))if(set.size>1)out.push('Treneris '+coachName[k.split('@')[0]]+' vienlaikus divās spēlēs ('+k.split('@')[1]+').');
 return [...new Set(out)];
}

// Group table. Ties are settled first by the games among the tied teams, then
// by the sport's next criteria, then by seed.
export function standings(groupKey,teams,games,sportKey){
 const s=sportOf(sportKey);
 const list=teams.filter(t=>t.group===groupKey);
 const groupGames=games.filter(g=>g.stage==='group'&&g.group===groupKey);
 const table=(subset,gs)=>{
  const rows=Object.fromEntries(subset.map(t=>[teamRef(t.key),{key:t.key,ref:teamRef(t.key),name:t.name,coach:t.coach||'',seed:t.seed||0,gp:0,w:0,d:0,l:0,f:0,a:0,p:0}]));
  for(const g of gs){
   if(!hasScore(g)||!rows[g.home]||!rows[g.away])continue;
   const h=rows[g.home],a=rows[g.away],hs=g.home_score,as=g.away_score;
   h.gp++;a.gp++;h.f+=hs;h.a+=as;a.f+=as;a.a+=hs;
   if(hs>as){h.w++;a.l++;}else if(as>hs){a.w++;h.l++;}else{h.d++;a.d++;}
   h.p+=matchPoints(sportKey,hs,as,g.details);a.p+=matchPoints(sportKey,as,hs,g.details);
  }
  return Object.values(rows);
 };
 const primary=r=>s.rank==='wins'||s.rank==='sets'?r.w:r.p;
 const rest=(x,y)=>{
  if(s.rank==='wins')return (y.gp?y.f/y.gp:0)-(x.gp?x.f/x.gp:0);
  if(s.rank==='sets')return y.p-x.p||(y.a?y.f/y.a:y.f*100)-(x.a?x.f/x.a:x.f*100);
  return (y.f-y.a)-(x.f-x.a)||y.f-x.f;
 };
 const rows=table(list,groupGames);
 const clusters={};
 for(const r of rows)(clusters[primary(r)]=clusters[primary(r)]||[]).push(r);
 const ordered=[];
 for(const value of Object.keys(clusters).map(Number).sort((a,b)=>b-a)){
  const tied=clusters[value];
  if(tied.length===1){ordered.push(tied[0]);continue;}
  const refs=new Set(tied.map(r=>r.ref));
  const mini=Object.fromEntries(table(list.filter(t=>refs.has(teamRef(t.key))),groupGames.filter(g=>refs.has(g.home)&&refs.has(g.away))).map(r=>[r.ref,r]));
  tied.sort((x,y)=>primary(mini[y.ref])-primary(mini[x.ref])||rest(mini[x.ref],mini[y.ref])||rest(x,y)||x.seed-y.seed);
  ordered.push(...tied);
 }
 return {rows:ordered,complete:groupGames.length>0&&groupGames.every(hasScore)};
}

// Who won a game: 'home', 'away' or '' (no result yet, or a draw without a decider).
export function winnerSide(game){
 if(!hasScore(game))return '';
 if(game.home_score>game.away_score)return 'home';
 if(game.away_score>game.home_score)return 'away';
 return ['home','away'].includes(game.details?.winner)?game.details.winner:'';
}
// The team behind a reference, or null while it is not known yet.
export function resolveRef(ref,ctx,depth=0){
 if(depth>40)return null;
 const {teams,games,sport}=ctx;
 if(ref.startsWith('T:'))return teams.find(t=>teamRef(t.key)===ref)||null;
 const place=/^([A-H])(\d)$/.exec(ref);
 if(place){
  const st=standings(place[1],teams,games,sport);
  return st.complete?teams.find(t=>t.key===st.rows[Number(place[2])-1]?.key)||null:null;
 }
 const m=/^([WL]):(\d+)$/.exec(ref);
 if(!m)return null;
 const g=games.find(x=>x.no===Number(m[2]));
 const side=g&&winnerSide(g);
 if(!side)return null;
 const pick=m[1]==='W'?side:side==='home'?'away':'home';
 return resolveRef(g[pick],ctx,depth+1);
}
// How a reference reads before it is known.
export function refLabel(ref,teams){
 if(ref.startsWith('T:'))return teams.find(t=>teamRef(t.key)===ref)?.name||'—';
 const m=/^([WL]):(\d+)$/.exec(ref);
 if(m)return (m[1]==='W'?'Uzv. sp. ':'Zaud. sp. ')+m[2];
 return ref;
}
// The team name when it is known, otherwise the reference in words.
export function sideName(ref,ctx){
 const team=resolveRef(ref,ctx);
 return team?{name:team.name,known:true,key:team.key}:{name:refLabel(ref,ctx.teams),known:false,key:''};
}
// Does a game involve this team (directly or once its references are settled)?
export function playsIn(game,teamKey,ctx){
 if(!teamKey)return true;
 return [game.home,game.away].some(ref=>ref===teamRef(teamKey)||resolveRef(ref,ctx)?.key===teamKey);
}
// About when the last game ends, before the schedule is made.
export function estimateEnd(settings,gameCount){
 const courts=Math.max(1,(settings.courts||[]).filter(Boolean).length);
 const slot=Number(settings.slot)||15;
 const times=slotTimes({...settings,slot},Math.ceil(gameCount/courts));
 return times.length?toTime(times[times.length-1]+slot):settings.start;
}

// Teams from pasted lines: "Name", "Name, Coach", "Name<Tab>Coach" or "Name – Coach".
export function newTeamKey(used){
 let n=1;while(used.has('t'+n))n++;
 used.add('t'+n);return 't'+n;
}
export function parseTeamLines(text,existing=[]){
 const used=new Set(existing.map(t=>t.key));
 const names=new Set(existing.map(t=>String(t.name).toLocaleLowerCase('lv')));
 const out=[];
 for(const raw of String(text||'').split(/\r?\n/)){
  const line=raw.replace(/^\s*\d+[.)]\s+/,'').trim();
  if(!line)continue;
  const cut=/\t|\s*;\s*|\s+[–—-]\s+|\s*,\s+/.exec(line);
  const name=(cut?line.slice(0,cut.index):line).trim().slice(0,120);
  const coach=(cut?line.slice(cut.index+cut[0].length):'').trim().slice(0,120);
  const lower=name.toLocaleLowerCase('lv');
  if(!name||names.has(lower)||existing.length+out.length>=64)continue;
  names.add(lower);
  out.push({key:newTeamKey(used),name,coach,group:'',seed:existing.length+out.length+1});
 }
 return out;
}

// Final places 1..n from games that decide a place, or from a single group table.
export function finalPlaces(ctx,format){
 const places=[];
 for(const g of ctx.games.filter(x=>x.place)){
  const side=winnerSide(g);if(!side)continue;
  const w=resolveRef(g[side],ctx),l=resolveRef(g[side==='home'?'away':'home'],ctx);
  if(w)places[g.place-1]=w;if(l)places[g.place]=l;
 }
 if(format==='round_robin'){
  const groups=Object.keys(groupsOf(ctx.teams));
  if(groups.length===1){const st=standings(groups[0],ctx.teams,ctx.games,ctx.sport);if(st.complete)return st.rows.map(r=>ctx.teams.find(t=>t.key===r.key));}
 }
 return places;
}

// Check and tidy a tournament before saving (server and browser).
const TEAM_KEY=/^[a-z0-9-]{1,20}$/;
export function cleanTournament(input){
 const t=input||{};
 const title=String(t.title||'').trim();
 if(title.length<3||title.length>160)throw Error('Turnīra nosaukumam jābūt 3–160 rakstzīmes garam.');
 if(!SPORTS[t.sport])throw Error('Izvēlies sporta veidu.');
 if(!FORMATS[t.format])throw Error('Izvēlies turnīra formātu.');
 if(t.play_date&&!/^\d{4}-\d{2}-\d{2}$/.test(t.play_date))throw Error('Norādi derīgu datumu.');
 const s=t.settings||{};
 const courts=[...new Set((Array.isArray(s.courts)?s.courts:[]).map(c=>String(c||'').trim().slice(0,40)).filter(Boolean))].slice(0,12);
 if(!courts.length)throw Error('Norādi vismaz vienu laukumu.');
 if(toMin(s.start)===null)throw Error('Norādi sākuma laiku.');
 const slot=Math.round(Number(s.slot));if(!(slot>=5&&slot<=180))throw Error('Spēles laikam jābūt 5–180 min.');
 const rest=Math.round(Number(s.rest??slot));if(!(rest>=0&&rest<=240))throw Error('Atpūtas laikam jābūt 0–240 min.');
 const blocks=(Array.isArray(s.blocks)?s.blocks:[]).slice(0,12).map(b=>({title:String(b?.title||'').trim().slice(0,60),at:String(b?.at||''),minutes:Math.round(Number(b?.minutes)||0)}))
  .filter(b=>b.title&&toMin(b.at)!==null&&b.minutes>=0&&b.minutes<=240);
 const teams=(Array.isArray(input.teams)?input.teams:[]).slice(0,64).map((x,i)=>({key:String(x?.key||''),name:String(x?.name||'').trim().slice(0,120),coach:String(x?.coach||'').trim().slice(0,120),group:GROUP_KEYS.includes(x?.group)?x.group:'',seed:Number.isInteger(x?.seed)?x.seed:i+1}));
 if(teams.some(x=>!TEAM_KEY.test(x.key)||!x.name))throw Error('Katrai komandai vajag nosaukumu.');
 if(new Set(teams.map(x=>x.key)).size!==teams.length||new Set(teams.map(x=>x.name.toLocaleLowerCase('lv'))).size!==teams.length)throw Error('Komandu nosaukumi nedrīkst atkārtoties.');
 const games=(Array.isArray(input.games)?input.games:[]).slice(0,400).map(g=>{
  const score=v=>v===null||v===undefined||v===''?null:Math.max(0,Math.min(999,Math.round(Number(v))));
  const out={no:Math.round(Number(g?.no)),stage:['group','placement','knockout'].includes(g?.stage)?g.stage:'group',group:GROUP_KEYS.includes(g?.group)?g.group:'',
   round:Math.max(1,Math.min(20,Math.round(Number(g?.round)||1))),court:String(g?.court||'').slice(0,40),starts_at:toMin(g?.starts_at)===null?null:g.starts_at,
   home:String(g?.home||''),away:String(g?.away||''),label:String(g?.label||'').slice(0,60),place:Number.isInteger(g?.place)?g.place:null,
   home_score:score(g?.home_score),away_score:score(g?.away_score),details:cleanDetails(g?.details)};
  if(!(out.no>=1&&out.no<=400)||!isRef(out.home)||!isRef(out.away)||out.home===out.away)throw Error('Spēļu grafikā ir kļūda. Sastādi grafiku vēlreiz.');
  if(out.home_score===null||out.away_score===null){out.home_score=null;out.away_score=null;}
  return out;
 });
 if(new Set(games.map(g=>g.no)).size!==games.length)throw Error('Spēļu numuri atkārtojas. Sastādi grafiku vēlreiz.');
 // Every reference points at a team, a group place or an earlier game of this tournament.
 const keys=new Set(teams.map(x=>x.key)),numbers=new Set(games.map(g=>g.no));
 const groupSize={};for(const x of teams)if(x.group)groupSize[x.group]=(groupSize[x.group]||0)+1;
 const known=ref=>{
  if(ref.startsWith('T:'))return keys.has(ref.slice(2));
  const m=/^([WL]):(\d+)$/.exec(ref);if(m)return numbers.has(Number(m[2]));
  return Number(ref.slice(1))<=(groupSize[ref[0]]||0);
 };
 if(games.some(g=>!known(g.home)||!known(g.away)))throw Error('Grafikā ir komandas, kuru vairs nav. Sastādi grafiku vēlreiz.');
 return {
  title,sport:t.sport,format:t.format,play_date:t.play_date||null,venue:String(t.venue||'').trim().slice(0,200),
  submission_id:/^[0-9a-f-]{36}$/i.test(String(t.submission_id||''))?t.submission_id:null,
  youth:t.youth===true,status:t.status==='published'?'published':'draft',
  settings:{courts,start:s.start,slot,rest,blocks,third:s.third!==false},
  teams,games
 };
}
export function cleanDetails(details){
 const d=details&&typeof details==='object'?details:{};
 const out={};
 if(d.ot===true)out.ot=true;
 if(d.winner==='home'||d.winner==='away')out.winner=d.winner;
 return out;
}
