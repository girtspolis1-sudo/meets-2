import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGames,cleanTournament,finalPlaces,formatProblem,matchPoints,numberGames,parseTeamLines,resolveRef,roundRobin,schedule,scheduleProblems,slotTimes,snakeGroups,standings,toMin} from '../lib/tournament.js';

// Mārupes Kauss 2026, 2018. g. dz. zēni (the organizer's PDF).
const GROUPS={
 A:[['RBS Centrs 1','Jānis Melngailis'],['Ventspils Spars','Ričards Vitoļskis'],['Basketbola klase VZS 1','Andris Kliests'],['Ogres Lāči','Nauris Bajārs']],
 B:[['Rūjiena BALTA',''],['A.K.VEF 1',''],['Ogres Lauvas',''],['Cēsis','']],
 C:[['RBS Centrs 2','Jānis Melngailis'],['Ventspils Spars 2','Ričards Vitoļskis'],['Basketbola klase 2','Andris Kliests'],['Ogres Lūši','Nauris Bajārs']],
 D:[['Rūjiena Zila','Alberts Leska'],['A.K.VEF 2','Edgars Burkevics'],['Basketbola klase RKV','Kristaps Kozlovskis'],['Iecavas sporta skola Dartija','Dainis Čapkovskis']]
};
const teams=Object.entries(GROUPS).flatMap(([group,list],g)=>list.map(([name,coach],i)=>({key:'t'+(g*4+i+1),name,coach,group,seed:i+1})));
const settings={courts:['A','B','C'],start:'10:00',slot:15,rest:15,blocks:[{title:'Tehnikas stafete',at:'11:00',minutes:15},{title:'Metienu konkurss',at:'12:15',minutes:25}],third:true};

test('round robin: every pair once, every team once per round',()=>{
 const rounds=roundRobin(['a','b','c','d']);
 assert.equal(rounds.length,3);
 assert.equal(rounds.flat().length,6);
 for(const r of rounds)assert.equal(new Set(r.flat()).size,4);
 assert.equal(roundRobin(['a','b','c']).flat().length,3);
});

test('slots skip the breaks',()=>{
 const times=slotTimes(settings,12).map(t=>Math.floor(t/60)+':'+String(t%60).padStart(2,'0'));
 assert.deepEqual(times,['10:00','10:15','10:30','10:45','11:15','11:30','11:45','12:00','12:40','12:55','13:10','13:25']);
});

test('Mārupes Kauss: 24 group games and 16 for places, a valid schedule on 3 courts',()=>{
 assert.equal(formatProblem('groups_places',teams),'');
 const games=buildGames('groups_places',teams);
 assert.equal(games.filter(g=>g.stage==='group').length,24);
 assert.equal(games.filter(g=>g.stage==='placement').length,16);
 const planned=schedule(games,teams,settings,{tries:120,seed:7});
 assert.ok(planned,'schedule found');
 assert.equal(planned.length,40);
 assert.deepEqual(scheduleProblems(planned,teams,settings),[]);
 // Within the day, as in the PDF (last games around 13:40–13:55).
 assert.ok(Math.max(...planned.map(g=>toMin(g.starts_at)))<=toMin('14:10'));
 // References use game numbers, and every place 1..16 is decided by one game.
 assert.ok(planned.every(g=>!/g\d/.test(g.home+g.away)));
 assert.deepEqual(planned.filter(g=>g.place).map(g=>g.place).sort((a,b)=>a-b),[1,3,5,7,9,11,13,15]);
});

test('results fill the tables, the pairs and all 16 places',()=>{
 const planned=schedule(buildGames('groups_places',teams),teams,settings,{tries:60,seed:3});
 const ctx={teams,games:planned,sport:'basket3x3'};
 assert.equal(resolveRef('A1',ctx),null);
 // Better seed always wins by 21:10.
 const seedOf=ref=>resolveRef(ref,ctx)?.seed??9;
 for(const stage of ['group','placement'])for(const round of [1,2])for(const g of planned.filter(x=>x.stage===stage&&(stage==='group'||x.round===round))){
  const home=resolveRef(g.home,ctx),away=resolveRef(g.away,ctx);
  if(!home||!away)continue;
  const homeWins=home.seed<away.seed||(home.seed===away.seed&&home.key<away.key);
  g.home_score=homeWins?21:10;g.away_score=homeWins?10:21;
 }
 const a=standings('A',teams,planned,'basket3x3');
 assert.equal(a.complete,true);
 assert.deepEqual(a.rows.map(r=>r.name),['RBS Centrs 1','Ventspils Spars','Basketbola klase VZS 1','Ogres Lāči']);
 assert.equal(resolveRef('A1',ctx).name,'RBS Centrs 1');
 const places=finalPlaces(ctx,'groups_places');
 assert.equal(places.filter(Boolean).length,16);
 assert.equal(places[0].seed,1);
 assert.equal(places[15].seed,4);
});

test('tie-breaks: games among the tied teams first, then the sport rules',()=>{
 const tm=[{key:'a',name:'A',group:'A',seed:1},{key:'b',name:'B',group:'A',seed:2},{key:'c',name:'C',group:'A',seed:3}];
 const g=(no,h,a,hs,as)=>({no,stage:'group',group:'A',home:'T:'+h,away:'T:'+a,home_score:hs,away_score:as});
 // Football: everyone 3 points and 1 win each; goal difference decides (C +1, B 0, A −1).
 const games=[g(1,'a','b',1,0),g(2,'b','c',2,1),g(3,'c','a',3,1)];
 assert.deepEqual(standings('A',tm,games,'football').rows.map(r=>r.key),['c','b','a']);
 // Two teams level on points: the game between them decides before goal difference.
 const four=[...tm,{key:'d',name:'D',group:'A',seed:4}];
 const two=[g(1,'a','b',0,1),g(2,'a','c',5,0),g(3,'a','d',5,0),g(4,'b','c',0,2),g(5,'b','d',1,0),g(6,'c','d',0,0)];
 assert.deepEqual(standings('A',four,two,'football').rows.map(r=>r.key),['b','a','c','d']);
 // Volleyball points: 2:0 → 3, 2:1 → 2, 1:2 → 1, 0:2 → 0. Hockey overtime 2/1.
 assert.deepEqual([matchPoints('volleyball',2,0),matchPoints('volleyball',2,1),matchPoints('volleyball',1,2),matchPoints('volleyball',0,2)],[3,2,1,0]);
 assert.deepEqual([matchPoints('hockey',3,2),matchPoints('hockey',3,2,{ot:true}),matchPoints('hockey',2,3,{ot:true})],[3,2,1]);
 assert.deepEqual([matchPoints('basket5x5',70,60),matchPoints('basket5x5',60,70)],[2,1]);
});

test('knockout: byes for top seeds, a final and a third-place game',()=>{
 const six=Array.from({length:6},(_,i)=>({key:'k'+(i+1),name:'Komanda '+(i+1),seed:i+1}));
 const games=buildGames('knockout',six,{third:true});
 // 6 teams in an 8-bracket: 2 first-round games, 2 semis, final, third place.
 assert.equal(games.length,6);
 const planned=schedule(games,six,{courts:['1'],start:'09:00',slot:20,rest:20},{tries:20});
 assert.deepEqual(scheduleProblems(planned,six,{courts:['1'],start:'09:00',slot:20,rest:20}),[]);
 const final=planned.find(g=>g.place===1),third=planned.find(g=>g.place===3);
 assert.ok(final&&third);
 assert.match(final.home,/^W:\d+$/);assert.match(third.home,/^L:\d+$/);
 // A draw decided by penalties still gives a winner.
 const ctx={teams:six,games:planned.map(g=>({...g,home_score:1,away_score:1,details:{winner:'home'}})),sport:'football'};
 assert.ok(resolveRef(final.home,ctx));
 assert.equal(finalPlaces(ctx,'knockout').filter(Boolean).length,4);
});

test('a coach may lead both teams of one game, but not two games at once',()=>{
 const tm=[{key:'a',name:'A',group:'A',coach:'Anna Ozola'},{key:'b',name:'B',group:'A',coach:'anna ozola'},{key:'c',name:'C',group:'A',coach:'Pēteris'},{key:'d',name:'D',group:'A',coach:'Anna Ozola'}];
 const set={courts:['1','2'],start:'10:00',slot:20,rest:0};
 const own=[{no:1,stage:'group',group:'A',court:'1',starts_at:'10:00',home:'T:a',away:'T:b'}];
 assert.deepEqual(scheduleProblems(own,tm,set),[]);
 const clash=[{no:1,stage:'group',group:'A',court:'1',starts_at:'10:00',home:'T:a',away:'T:c'},{no:2,stage:'group',group:'A',court:'2',starts_at:'10:00',home:'T:d',away:'T:b'}];
 assert.deepEqual(scheduleProblems(clash,tm,set),['Treneris Anna Ozola vienlaikus divās spēlēs (10:00).']);
 const planned=schedule(buildGames('round_robin',tm),tm,set,{tries:40});
 assert.deepEqual(scheduleProblems(planned,tm,set),[]);
});

test('pasted team lists',()=>{
 const added=parseTeamLines('1. Rīgas Lūši, Anna Ozola\nTukuma Vilki\tPēteris Kalns\nA.K.VEF 1 - Edgars\n\nrīgas lūši\nOgres Lāči',[{key:'t1',name:'Cēsis'}]);
 assert.deepEqual(added.map(t=>[t.key,t.name,t.coach]),[['t2','Rīgas Lūši','Anna Ozola'],['t3','Tukuma Vilki','Pēteris Kalns'],['t4','A.K.VEF 1','Edgars'],['t5','Ogres Lāči','']]);
});

test('snake groups and format problems',()=>{
 const eight=Array.from({length:8},(_,i)=>({key:'s'+i,name:'S'+i}));
 assert.deepEqual(snakeGroups(eight,4).map(t=>t.group),['A','B','C','D','D','C','B','A']);
 assert.match(formatProblem('groups_places',snakeGroups(eight.slice(0,6),3)),/2 vai 4 grupas/);
 assert.match(formatProblem('round_robin',[eight[0]]),/vismaz 2/);
});

test('saving: tidy input, reject broken references',()=>{
 const planned=numberGames(buildGames('round_robin',teams.slice(0,4)).map((g,i)=>({...g,court:'A',starts_at:'10:'+String(i*10).padStart(2,'0')})));
 const clean=cleanTournament({title:'  Mārupes Kauss 2026 ',sport:'basket3x3',format:'round_robin',settings,teams:teams.slice(0,4),games:planned});
 assert.equal(clean.title,'Mārupes Kauss 2026');
 assert.equal(clean.games.length,6);
 assert.equal(clean.settings.third,true);
 assert.throws(()=>cleanTournament({title:'Kauss',sport:'basket3x3',format:'round_robin',settings,teams:teams.slice(0,4),games:[{...planned[0],home:'drop table'}]}),/grafikā/);
 assert.throws(()=>cleanTournament({title:'Kauss',sport:'basket3x3',format:'round_robin',settings,teams:teams.slice(0,3),games:planned}),/vairs nav/);
 assert.throws(()=>cleanTournament({title:'Kauss',sport:'chess',format:'round_robin',settings,teams:[],games:[]}),/sporta veidu/);
});
