import test from 'node:test';
import assert from 'node:assert/strict';
import {whatFilterCount} from '../lib/map-search.js';
import {DEFAULT_LEVEL,LEVELS,ageGroupLevel,isSportEvent,levelKey,matchesLevel,sportLevel} from '../lib/sport-level.js';

const match=(competition_name,extra={})=>({event_type:'sports_match',primary_category:'Basketbols',sport_format:'basketball',competition_name,...extra});

test('the level choice defaults to adults and calls them Pieaugušie', ()=>{
 assert.equal(DEFAULT_LEVEL,'senior');
 assert.equal(levelKey(''),'senior');
 assert.equal(levelKey('nonsense'),'senior');
 assert.equal(levelKey('youth'),'youth');
 assert.equal(levelKey('all'),'all');
 assert.deepEqual(LEVELS,{all:'Visi',senior:'Pieaugušie',youth:'Jaunieši'});
});

test('a stored level wins over every other signal', ()=>{
 assert.equal(sportLevel(match('U14 Puiši',{sport_level:'senior',age_group:'U14'})),'senior');
 assert.equal(sportLevel(match('Latvijas Basketbola līga',{sport_level:'youth'})),'youth');
});

test('age groups', ()=>{
 for(const g of ['U8','U12','U-14','U 16','U19','U21','juniori','Jaunieši','jaunietes','zēni','U14 meitenes','bērni'])assert.equal(ageGroupLevel(g),'youth',g);
 for(const g of ['40+','50+','veterāni','seniori','vīrieši','sievietes'])assert.equal(ageGroupLevel(g),'senior',g);
 assert.equal(ageGroupLevel('U23'),null);
 assert.equal(ageGroupLevel(''),null);
 assert.equal(ageGroupLevel(null),null);
});

test('LJBL, volleyball, handball and hockey youth competitions are youth', ()=>{
 assert.equal(sportLevel(match('U12 Puiši',{age_group:'U12'})),'youth');
 assert.equal(sportLevel(match('U15 Meitenes, Nacionālā līga')),'youth');
 assert.equal(sportLevel(match('Kausa izcīņa U16 M',{primary_category:'Volejbols'})),'youth');
 assert.equal(sportLevel(match('Latvijas Jaunatnes čempionāts U14 Z',{primary_category:'Volejbols'})),'youth');
 assert.equal(sportLevel(match('Zēni U14 (2013)',{primary_category:'Handbols'})),'youth');
 assert.equal(sportLevel(match('Latvijas Bērnu un Jaunatnes čempionāts hokejā (U18)',{primary_category:'Hokejs'})),'youth');
});

test('adult leagues with junior team names stay adult', ()=>{
 assert.equal(sportLevel(match('Optibet Latvijas–Igaunijas Basketbola līga',{title:'Rigas Ekselences Juniori – BK Ogre',home_team:'Rigas Ekselences Juniori'})),'senior');
 assert.equal(sportLevel(match('Hokeja 1. līga',{title:'Zemgale Juniors – RĪGAS HS',primary_category:'Hokejs'})),'senior');
 assert.equal(sportLevel(match('Latvijas SynotTip vīriešu Virslīga',{title:'SK Latgols juniori – HK S&A',primary_category:'Handbols'})),'senior');
 assert.equal(sportLevel(match('Latvijas Čempionāts Nacionālā līga vīriešiem',{title:'Jēkabpils juniori / JSS – Aizpute',primary_category:'Volejbols'})),'senior');
 assert.equal(sportLevel(match('Veterānu čempionāts 40+',{age_group:'40+',primary_category:'Futbols'})),'senior');
});

test('athletics competitions are read from the title', ()=>{
 const athletics=title=>({event_type:'sports_competition',primary_category:'Vieglatlētika',title,sources:[{source:'athletics.lv'}]});
 assert.equal(sportLevel(athletics('LVS x Sportland Jaunatnes kauss U10')),'youth');
 assert.equal(sportLevel(athletics('LVS x Sportland kauss (U18, P) 2.posms')),'youth');
 assert.equal(sportLevel(athletics('Latvijas U18, U20, U23 čempionāts telpās')),'youth');
 assert.equal(sportLevel(athletics('Latvijas čempionāts telpās')),'senior');
 assert.equal(sportLevel(athletics('Latvijas U23 čempionāts')),'senior');
});

test('municipal youth competitions are youth only when the title names a competition', ()=>{
 const rss=(title,primary_category='Sports')=>({event_type:'other',primary_category,title,sources:[{source:'sigulda.lv'}]});
 assert.equal(sportLevel(rss('Latvijas jaunatnes florbola čempionāts U‑12: “Coyote”/Inčukalna pamatskola pret “Jēkabpils”','Pasākums')),'youth');
 assert.equal(sportLevel(rss('Latvijas Jaunatnes čempionāts basketbolā','Pasākums')),'youth');
 assert.equal(sportLevel(rss('Jūrmalas skolēnu sacensības volejbolā','Pasākums')),'youth');
 assert.equal(sportLevel(rss('Galda tenisa turnīrs bērniem un jauniešiem: 4. posms','Pasākums')),'youth');
 assert.equal(sportLevel(rss('Volejbols „Talsu kauss 2026” jauniešiem','Pasākums')),'youth');
 // A family sports day is not a youth competition.
 assert.equal(sportLevel(rss('Bērnu sporta svētki')),'senior');
 assert.equal(sportLevel(rss('Pilsētas volejbola turnīrs')),'senior');
});

test('events that are not sport have no level and are never filtered', ()=>{
 const concert={event_type:'concert',primary_category:'Koncerts',title:'Bērnu kora koncerts',sources:[{source:'riga.lv'}]};
 const seniors={event_type:'other',primary_category:'Senioriem',title:'Senioru pēcpusdiena',sources:[{source:'riga.lv'}]};
 assert.equal(isSportEvent(concert),false);
 assert.equal(sportLevel(concert),null);
 assert.equal(sportLevel(seniors),null);
 for(const level of ['all','senior','youth',''])assert.equal(matchesLevel(concert,level),true);
});

test('matchesLevel splits adults and youth', ()=>{
 const youth=match('U12 Puiši',{age_group:'U12'});
 const adult=match('Latvijas Basketbola līga');
 assert.equal(matchesLevel(youth),false);
 assert.equal(matchesLevel(adult),true);
 assert.equal(matchesLevel(youth,'youth'),true);
 assert.equal(matchesLevel(adult,'youth'),false);
 assert.equal(matchesLevel(youth,'all'),true);
 assert.equal(matchesLevel(adult,'all'),true);
});

test('a level other than the default counts on the Filtri badge', ()=>{
 assert.equal(whatFilterCount({showLong:true}),0);
 assert.equal(whatFilterCount({showLong:true,level:'senior'}),0);
 assert.equal(whatFilterCount({showLong:true,level:'youth'}),1);
 assert.equal(whatFilterCount({showLong:true,level:'all'}),1);
});

test('town and topic pages leave youth games out; a youth league page keeps them', async ()=>{
 const {listing,topLeagues}=await import('../lib/event-listings.js');
 const day='2026-12-01';
 const youth=Array.from({length:12},(_,i)=>match('U12 Puiši',{id:'y'+i,title:'A – B',date_from:day,date_to:day,age_group:'U12',municipality:'Rīga'}));
 const adult=match('Latvijas Basketbola līga',{id:'a1',title:'C – D',date_from:day,date_to:day,municipality:'Rīga'});
 const events=[...youth,adult];
 assert.deepEqual(listing(events,{municipality:'Rīga'},day).events.map(e=>e.id),['a1']);
 assert.equal(listing(events,{league:'u12-puisi'},day).events.length,12);
 assert.equal(topLeagues(events,day,6).some(l=>l.name==='U12 Puiši'),false);
});

test('a youth league in the competition list is told apart by its name', ()=>{
 const asEvent=name=>({event_type:'sports_match',competition_name:name});
 assert.equal(matchesLevel(asEvent('U12 Puiši')),false);
 assert.equal(matchesLevel(asEvent('U16, nacionālais līgas kauss')),false);
 assert.equal(matchesLevel(asEvent('Latvijas Basketbola līga')),true);
 assert.equal(matchesLevel(asEvent('U12 Puiši'),'youth'),true);
});
