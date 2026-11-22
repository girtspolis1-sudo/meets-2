import test from 'node:test';
import assert from 'node:assert/strict';
import {byDay,eventMoreLinks,indexableListings,leagues,listing,listingHeading,listingPath,listingTail,municipalities,teamGames,timeWindow,topLeagues} from '../lib/event-listings.js';

test('time windows in Riga dates',()=>{
 // 2026-11-18 is a Wednesday, 2026-11-21 Saturday, 2026-11-22 Sunday.
 assert.deepEqual(timeWindow('sodien','2026-11-18'),{from:'2026-11-18',to:'2026-11-18'});
 assert.deepEqual(timeWindow('rit','2026-11-18'),{from:'2026-11-19',to:'2026-11-19'});
 assert.deepEqual(timeWindow('sonedel','2026-11-18'),{from:'2026-11-18',to:'2026-11-22'});
 assert.deepEqual(timeWindow('sonedel','2026-11-22'),{from:'2026-11-22',to:'2026-11-22'});
 assert.deepEqual(timeWindow('brivdienas','2026-11-18'),{from:'2026-11-21',to:'2026-11-22'});
 assert.deepEqual(timeWindow('brivdienas','2026-11-21'),{from:'2026-11-21',to:'2026-11-22'});
 assert.deepEqual(timeWindow('brivdienas','2026-11-22'),{from:'2026-11-22',to:'2026-11-22'});
 assert.deepEqual(timeWindow('rit','2026-12-31'),{from:'2027-01-01',to:'2027-01-01'},'across the new year');
 assert.deepEqual(timeWindow('brivdienas','2026-12-30'),{from:'2027-01-02',to:'2027-01-03'});
 assert.equal(timeWindow('cits','2026-11-18'),null);
});

const ev=(id,date,extra={})=>({id:String(id),title:'Pasākums '+id,date_from:date,date_to:date,municipality:'Rīgas valstspilsēta',primary_category:'Koncerts',...extra});
const events=[
 ev(1,'2026-11-18'),ev(2,'2026-11-21'),ev(3,'2026-11-22'),ev(4,'2026-11-25'),ev(5,'2026-11-26'),ev(6,'2026-11-27'),
 ev(7,'2026-11-21',{municipality:'Ādažu novads'}),
 ev(8,'2026-11-21',{title:'Domes sēde',primary_category:'Domes sēde'}),
 ev(9,'2026-11-10',{date_to:'2026-12-20',primary_category:'Izstāde',title:'Izstāde'}),
 ev(10,'2026-11-28',{home_team:'A',away_team:'B',competition_name:'Optibet LBL',primary_category:'Basketbols',event_type:'sports_match'})
];

test('listings filter by municipality, time, category and league; sittings left out',()=>{
 const r=listing(events,{municipality:'Rīgas valstspilsēta'},'2026-11-18');
 assert.equal(r.events.length,8);
 assert.ok(!r.events.some(e=>e.title==='Domes sēde'));
 assert.equal(r.indexable,true);
 const week=listing(events,{municipality:'Rīgas valstspilsēta',time:'brivdienas'},'2026-11-18');
 assert.deepEqual(week.events.map(e=>e.id),['9','2','3'],'running exhibition included, sorted by start');
 assert.equal(week.indexable,false,'fewer than 5: not indexed');
 assert.deepEqual(listing(events,{category:'music'},'2026-11-18').events.length,7);
 assert.deepEqual(listing(events,{league:'optibet-lbl'},'2026-11-18').events.map(e=>e.id),['10']);
});

test('municipalities, leagues, headings and paths',()=>{
 assert.deepEqual(municipalities(events).map(m=>[m.slug,m.count]),[['riga',8],['adazu-novads',1]]);
 assert.deepEqual(leagues(events),[{slug:'optibet-lbl',name:'Optibet LBL',count:1}]);
 assert.equal(listingHeading({municipalityName:'Rīgas valstspilsēta',time:'sonedel'}),'Pasākumi Rīgā šonedēļ');
 assert.equal(listingHeading({municipalityName:'Ādažu novads',category:'music'}),'Mūzika un dejas Ādažu novadā');
 assert.equal(listingHeading({category:'culture'}),'Izstādes un kultūra Latvijā');
 assert.equal(listingHeading({leagueName:'Optibet LBL'}),'Optibet LBL spēles');
 assert.equal(listingPath({municipalitySlug:'riga',time:'sodien'}),'/pasakumi/riga/sodien');
 assert.equal(listingPath({category:'music',municipalitySlug:'riga'}),'/pasakumi/k/muzika/riga');
 assert.equal(listingPath({league:'optibet-lbl'}),'/pasakumi/sports/optibet-lbl');
});

test('only listings with enough events go to the sitemap',()=>{
 const paths=indexableListings(events,'2026-11-18').map(l=>l.path);
 assert.ok(paths.includes('/pasakumi/riga'));
 assert.ok(paths.includes('/pasakumi/k/muzika'));
 assert.ok(!paths.includes('/pasakumi/adazu-novads'));
 assert.ok(!paths.includes('/pasakumi/sports/optibet-lbl'));
});

test('events grouped by day; running ones under the first day shown',()=>{
 const groups=byDay(listing(events,{municipality:'Rīgas valstspilsēta',time:'brivdienas'},'2026-11-18').events,'2026-11-21');
 assert.deepEqual(groups.map(g=>[g.date,g.events.map(e=>e.id)]),[['2026-11-21',['9','2']],['2026-11-22',['3']]]);
});

test('description tails fit the page',()=>{
 assert.match(listingTail({category:'music'}),/Koncerti, balles/);
 assert.match(listingTail({category:'sport'}),/Spēles, sacensības/);
 assert.match(listingTail({league:'optibet-lbl'}),/Spēļu datumi/);
 assert.match(listingTail({}),/Koncerti, izrādes, izstādes, sports/);
});

const games=[1,2,3,4,5,6].map(i=>ev(100+i,'2026-11-2'+i,{home_team:i%2?'A':'C',away_team:i%2?'B':'A',competition_name:'Optibet LBL',primary_category:'Basketbols',event_type:'sports_match'}));
games.push(ev(120,'2026-11-24',{home_team:'X',away_team:'Y',competition_name:'Optibet LBL',primary_category:'Basketbols',event_type:'sports_match'}));
games.push(ev(121,'2026-11-01',{home_team:'A',away_team:'Y',competition_name:'Optibet LBL',primary_category:'Basketbols',event_type:'sports_match'}));

test('an event links to its league and its interest pages, only when they are indexable',()=>{
 const all=[...events,...games];
 const concert=events[1];
 assert.deepEqual(eventMoreLinks(concert,all,'2026-11-18').map(l=>l.path),['/pasakumi/k/muzika/riga'],'6 concerts in Riga');
 const ada=events[6];
 assert.deepEqual(eventMoreLinks(ada,all,'2026-11-18').map(l=>l.path),['/pasakumi/k/muzika'],'Ādaži too thin: Latvia-wide');
 const match=games[0];
 const links=eventMoreLinks(match,all,'2026-11-18');
 assert.equal(links[0].path,'/pasakumi/sports/optibet-lbl');
 assert.equal(links[0].label,'Optibet LBL spēles');
 assert.deepEqual(eventMoreLinks(events[0],[events[0]],'2026-11-18'),[],'nothing indexable, no links');
});

test('team games: either team, coming, nearest first',()=>{
 const all=[...events,...games];
 const list=teamGames(games[0],all,'2026-11-18');
 assert.ok(list.every(e=>[e.home_team,e.away_team].some(t=>t==='A'||t==='B')));
 assert.ok(!list.some(e=>e.id===games[0].id));
 assert.ok(!list.some(e=>e.id==='121'),'past game left out');
 assert.ok(!list.some(e=>e.id==='120'),'other teams left out');
 assert.ok(list.length<=5);
 assert.deepEqual(list.map(e=>e.date_from),[...list.map(e=>e.date_from)].sort());
 assert.deepEqual(teamGames(events[1],all,'2026-11-18'),[]);
});

test('top leagues: indexable only, most games first',()=>{
 const all=[...events,...games];
 const top=topLeagues(all,'2026-11-18');
 assert.deepEqual(top.map(l=>l.path),['/pasakumi/sports/optibet-lbl']);
 assert.deepEqual(topLeagues(events,'2026-11-18'),[],'one game is not enough');
});
