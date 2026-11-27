import test from 'node:test';
import assert from 'node:assert/strict';
import {ageGroupOf,competitionKey,isYouthGroup,monthBlockUrl,monthsFrom,parseCalendar,parseVenue,seasonlessGroup,staleGames} from '../supabase/functions/_shared/volleyball.js';
import {sportLevel} from '../lib/sport-level.js';

const li=({id,date,group,home,away,time='11:00'})=>`<li data-kind="game" data-date="${date}" data-group="${group}" data-home="${home}" data-away="${away}">
 <a href="https://volejbols.lv/spele/${id}/"><span class="year-cal-item__time" >${time}</span></a></li>`;

test('the next three months are read from the month route', ()=>{
 assert.deepEqual(monthsFrom('2026-11-27'),[[2026,11],[2026,12],[2027,1]]);
 assert.deepEqual(monthsFrom('2026-12-03',2),[[2026,12],[2027,1]]);
 assert.equal(monthBlockUrl(2027,1),'https://volejbols.lv/wp-json/forget/v1/calendar/year-block/2027?month=1');
});

test('calendar games are parsed; beach tournaments without a game page are left out', ()=>{
 const html=li({id:6029,date:'2026-11-27',group:'Kausa izcīņa U14 Z 2026/2027',home:'Cēsu SS',away:'Limbažu SS'})
  +li({id:5900,date:'2026-12-02',group:'Latvijas Čempionāts Nacionālā līga vīriešiem 2026/2027',home:'RTU/Robežsardze 26/27',away:'Aizpute',time:'9:30'})
  +'<li data-kind="game" data-date="2026-11-28" data-group="U16 meitenes 1. posms"><a href="https://volejbols.lv/pludmale/turniri/u16-meitenes/">x</a></li>';
 const games=parseCalendar(html);
 assert.equal(games.length,2);
 assert.deepEqual(games[1],{id:'5900',date:'2026-12-02',time:'09:30',group:'Latvijas Čempionāts Nacionālā līga vīriešiem 2026/2027',
  home:'RTU/Robežsardze',away:'Aizpute',url:'https://volejbols.lv/spele/5900/'});
});

test('youth groups and their age group', ()=>{
 assert.equal(isYouthGroup('Kausa izcīņa U14 Z 2026/2027'),true);
 assert.equal(isYouthGroup('Latvijas Jaunatnes čempionāts U16 M'),true);
 assert.equal(isYouthGroup('Latvijas Čempionāts Nacionālā līga vīriešiem'),false);
 assert.equal(ageGroupOf('Kausa izcīņa U14 Z 2026/2027'),'U14 meitenes');
 assert.equal(ageGroupOf('Kausa izcīņa U16 M 2026/2027'),'U16 zēni');
 assert.equal(ageGroupOf('Latvijas Jaunatnes čempionāts U19'),'U19');
 assert.equal(ageGroupOf('Latvijas Čempionāts Nacionālā līga vīriešiem'),null);
 assert.equal(seasonlessGroup('Kausa izcīņa U14 Z 2026/2027'),'Kausa izcīņa U14 Z');
 assert.equal(competitionKey('Kausa izcīņa U14 Z'),'lvf-kausa-izcina-u14-z');
});

test('the site filter sees a youth volleyball game as youth, a junior team in an adult league as adult', ()=>{
 const game=(competition_name,title)=>({event_type:'sports_match',primary_category:'Volejbols',governing_body:'LVF',competition_name,title});
 assert.equal(sportLevel(game('Kausa izcīņa U14 Z','Cēsu SS – Limbažu SS')),'youth');
 assert.equal(sportLevel(game('Latvijas Čempionāts Nacionālā līga vīriešiem','Jēkabpils juniori / JSS – Aizpute')),'senior');
});

test('the hall is read without the played-game duration', ()=>{
 assert.deepEqual(parseVenue('<div class="game-card__venue" >Cēsu sporta nams, Cēsis · 39 min.          <span class="x">'),
  {venue:'Cēsu sporta nams',locality:'Cēsis',address:'Cēsu sporta nams, Cēsis'});
 assert.deepEqual(parseVenue('<div class="game-card__venue" >OC &quot;Limbaži&quot; sporta halle, Limbaži    <a href="#">'),
  {venue:'OC "Limbaži" sporta halle',locality:'Limbaži',address:'OC "Limbaži" sporta halle, Limbaži'});
 assert.equal(parseVenue('<div class="other">'),null);
});

test('games no longer in the calendar are found; a calendar that lost most games is not trusted', ()=>{
 const e=(id,date,status='published')=>({id:'e'+id,import_key:'volejbols.lv:'+id,date_from:date,status});
 const stored=[e(1,'2026-12-01'),e(2,'2026-12-02'),e(3,'2026-12-03',"archived"),e(4,'2027-03-01')];
 const r=staleGames(stored,['1'],{from:'2026-11-27',to:'2027-01-31'});
 assert.deepEqual(r.gone.map(x=>x.id),['e2']);
 assert.equal(r.trusted,true);
 const many=Array.from({length:20},(_,i)=>e(i+10,'2026-12-10'));
 assert.equal(staleGames(many,[],{from:'2026-11-27',to:'2027-01-31'}).trusted,false);
});
