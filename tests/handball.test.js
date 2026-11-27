import test from 'node:test';
import assert from 'node:assert/strict';
import {ABROAD_COUNTRY,competitionsOf,dateFor,leagueInfo,parseCalendar,seasonOf,youthUrl} from '../supabase/functions/_shared/handball.js';
import {sportLevel} from '../lib/sport-level.js';

const row=(id,league,leagueName,info,home,away,stage='Regulārā sezona')=>`
 <div class="row calendar-row"><div class="col-md-4"><div class="calendar-first-column"><div>
  <a href="https://handball.lv/league/${league}" class="d-block">${leagueName}</a>
  <div style="font-size: 80%"><span>${stage}</span><div>${info}</div></div></div></div></div>
  <a href="https://handball.lv/calendar/${id}" class="col-md-3"><div class="calendar-teams">
   <div class="calendar-team"><div>${home}</div><div class="calendar-team-result"></div></div>
   <div class="calendar-team"><div>${away}</div><div class="calendar-team-result"></div></div>
  </div></a></div>`;
const page=(day,rows)=>`<div class="calendar-day"><div><div>Saturday,</div><div>${day}</div></div></div>${rows}`;

test('league names give the level and age group', ()=>{
 assert.deepEqual(leagueInfo('Zēni U17 (2010)'),{level:'youth',age_group:'U17 zēni'});
 assert.deepEqual(leagueInfo('Meitenes U19 (2008/2009)'),{level:'youth',age_group:'U19 meitenes'});
 assert.deepEqual(leagueInfo('Latvijas atklātās sacensības mini handbolā'),{level:'youth',age_group:null});
 assert.deepEqual(leagueInfo('Latvijas SynotTip vīriešu Virslīga'),{level:'senior',age_group:null});
 assert.deepEqual(leagueInfo('Latvijas SynotTip kauss sievietēm 2027'),{level:'senior',age_group:null});
 assert.deepEqual(leagueInfo('Estonian - Latvian Women´s Handball League'),{level:'senior',age_group:null});
});

test('the youth calendar is parsed like the adult one, without results', ()=>{
 const html=page('28. November',
  row(25495,1068,'Zēni U17 (2010)','12:45 · Ludzas 2.vidusskola P. Miglinīka 27','ANSS/Skrīveri','Ludzas NSS')+
  row(25496,1071,'Latvijas SynotTip vīriešu Virslīga','9:30 · Rīgas Sporta manēža, Kr. Barona iela 107, Rīga','Rīga','Dobele','Regular Season')+
  row(25497,1056,'Meitenes U12 (2015)','· Sporta halle, Ogre','Ogre','Tukums'));
 const g=parseCalendar(html,'2026-11-27');
 assert.equal(g.length,3);
 assert.deepEqual({...g[0]},{id:'25495',date:'2026-11-28',time:'12:45',competition_key:'handball-1068',competition:'Zēni U17 (2010)',
  level:'youth',age_group:'U17 zēni',stage:'Regulārā sezona',home:'ANSS/Skrīveri',away:'Ludzas NSS',
  venue:'Ludzas 2.vidusskola P. Miglinīka 27',address:'Ludzas 2.vidusskola P. Miglinīka 27',url:'https://handball.lv/calendar/25495'});
 assert.equal(g[1].time,'09:30');
 assert.equal(g[1].venue,'Rīgas Sporta manēža');
 assert.equal(g[1].level,'senior');
 assert.equal(g[2].time,null);
 const c=competitionsOf(g);
 assert.equal(c.length,3);
 assert.deepEqual(c[0],{key:'handball-1068',name:'Zēni U17 (2010)',url:'https://handball.lv/league/1068',level:'youth',age_group:'U17 zēni'});
});

test('youth games are youth on the public map, adult games adult', ()=>{
 const youth={event_type:'sports_match',primary_category:'Handbols',competition_name:'Zēni U14 (2013)',sport_level:'youth'};
 assert.equal(sportLevel(youth),'youth');
 assert.equal(sportLevel({...youth,sport_level:null}),'youth');
 assert.equal(sportLevel({event_type:'sports_match',primary_category:'Handbols',competition_name:'Latvijas SynotTip vīriešu Virslīga'}),'senior');
});

test('season id, youth calendar address, dates and games abroad', ()=>{
 assert.equal(seasonOf('<a href="https://handball.lv/calendar?season=206&amp;league=1071">'),'206');
 assert.equal(seasonOf('<p>none</p>'),null);
 assert.equal(youthUrl('206'),'https://handball.lv/calendar?season=206&league=&youth_league=1&date=upcoming&order=asc');
 assert.equal(dateFor(3,1,'2026-11-27'),'2027-01-03');
 assert.equal(dateFor(20,10,'2026-11-27'),'2026-10-20');
 assert.ok(ABROAD_COUNTRY.test('Hala, Opole, Polija'));
 assert.ok(!ABROAD_COUNTRY.test('Sporta halle, Ogre'));
});
