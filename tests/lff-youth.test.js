import test from 'node:test';
import assert from 'node:assert/strict';
import {SECTIONS,ageGroupOf,competitionOptions,currentOptions,labelYear,parseGames} from '../supabase/functions/_shared/lff-youth.js';
import {sportLevel} from '../lib/sport-level.js';

const futsal=SECTIONS.find(s=>s.slug==='telpu-futbols/jaunatnes-cempionati');
const girls=SECTIONS.find(s=>s.slug==='sievietes/meitenu-cempionats');

const select=`<div class="pageSelect"><h3>Izvēlies sacensības:</h3><select class="pageParams">
<option value="/sacensibas/telpu-futbols/jaunatnes-cempionati/">Jaunatnes U-19 čempionāts 2026/27</option>
<option value="/sacensibas/telpu-futbols/jaunatnes-cempionati/?p=26165161">Jaunatnes U-17 čempionāts 2026/27</option>
<option value="/sacensibas/telpu-futbols/jaunatnes-cempionati/?p=23213515">Jaunatnes U-19 čempionāts 2025/26</option>
</select></div>`;

const row=(id,date,home,away,stadium,score='-')=>`<div class="tr match " data-id="${id}"><div>${date}</div><div><div class="clubs">
<div class="club"><div class="title"><span><a href="/klubi/a/?cid=1">${home}</a></span></div><div class="logo"><img alt="" src="x.png" /></div><div class="result"><span class="res1">${score}</span></div></div>
<div class="club"><div class="title"><span><a href="/klubi/b/?cid=1">${away}</a></span></div><div class="logo"><img alt="" src="y.png" /></div><div class="result"><span class="res2">${score}</span></div></div>
</div><div class="stadium">${stadium}</div></div><div><span></span></div></div>`;
const dateBlock=(wd,d,m,t,y)=>`<div class="date"><h4>${wd}</h4><h5>${d}</h5><h6>${m}</h6><div class="h7">${t}</div><div class="h8">${y}</div></div>`;

test('competition options and the current season', ()=>{
 const opts=competitionOptions(select,futsal);
 assert.deepEqual(opts.map(o=>o.id),['main','26165161','23213515']);
 assert.equal(opts[1].url,'https://lff.lv/sacensibas/telpu-futbols/jaunatnes-cempionati/?p=26165161');
 assert.equal(labelYear('Jaunatnes U-19 čempionāts 2026/27'),2027);
 assert.equal(labelYear('U-10 grupa 2026/2027'),2027);
 assert.equal(labelYear('U16 grupa 2026'),2026);
 assert.equal(labelYear('U-17 Rietumu grupa'),null);
 assert.deepEqual(currentOptions(opts,'2026-11-27').map(o=>o.id),['main','26165161']);
 assert.deepEqual(currentOptions([{id:'1',label:'U16 grupa 2026'},{id:'2',label:'U16 grupa 2025'},{id:'3',label:'Izspēles kārtība'}],'2026-11-27').map(o=>o.id),['1']);
});

test('age groups from option labels', ()=>{
 assert.equal(ageGroupOf('Jaunatnes U-19 čempionāts 2026/27',futsal),'U19');
 assert.equal(ageGroupOf('U14 Elites grupa 2024',futsal),'U14');
 assert.equal(ageGroupOf('U16 grupa 2026',girls),'U16 meitenes');
 assert.equal(ageGroupOf('Finālsacensības jaunietēm',SECTIONS[4]),'jaunietes');
 assert.equal(ageGroupOf('Finālsacensības jauniešiem',SECTIONS[4]),'jaunieši');
});

test('games are read from dated rows, without scores, strip rows skipped', ()=>{
 const opt={id:'main',label:'Jaunatnes U-19 čempionāts 2026/27',url:futsal.url};
 const strip=`<div class="tr match " data-id="1"><div><div class="matchday"><h4>19:00</h4><h5>1</h5><h6>kārta</h6></div></div><div><div class="clubs"><div class="club"><div class="title"><span>A</span></div></div><div class="club"><div class="title"><span>B</span></div></div></div><div class="stadium">Halle</div></div></div>`;
 const html=strip+
  row(26074279,dateBlock('trešdiena','2','dec','19:00','2026'),'FK Nīca/OtankiMill','FS Jūrmala','Nīcas sporta halle')+
  row(26074278,dateBlock('svētdiena','22','nov','15:00','2026'),'AVClub','FC Talsi','Daugavpils Olimpiskais centrs','6')+
  row(26074290,dateBlock('svētdiena','3','jan','','2027'),'FS Jūrmala','AVClub','Jūrmalas Aspazijas Pamatskola');
 const g=parseGames(html,futsal,opt);
 assert.equal(g.length,3);
 assert.deepEqual(g[0],{id:'26074279',date:'2026-12-02',time:'19:00',home:'FK Nīca/OtankiMill',away:'FS Jūrmala',venue:'Nīcas sporta halle',
  competition_key:'lff-youth-jaunatnes-cempionati-main',competition:'Jaunatnes čempionāts telpu futbolā: U-19 čempionāts 2026/27',
  age_group:'U19',sport_format:'futsal',url:futsal.url});
 assert.ok(!('score' in g[1])&&!JSON.stringify(g[1]).includes('"6"'));
 assert.equal(g[2].date,'2027-01-03');
 assert.equal(g[2].time,null);
});

test('youth futsal games count as youth on the public map', ()=>{
 assert.equal(sportLevel({event_type:'sports_match',primary_category:'Futbols',competition_name:'Jaunatnes čempionāts telpu futbolā: U-19 čempionāts 2026/27',sport_level:'youth'}),'youth');
 assert.equal(sportLevel({event_type:'sports_match',primary_category:'Futbols',competition_name:'Jaunatnes čempionāts telpu futbolā: U-19 čempionāts 2026/27'}),'youth');
});

test('a winter season stays current until its spring ends', ()=>{
 const o=[{id:'a',label:'U-19 čempionāts 2025/26'},{id:'b',label:'U16 grupa 2026'}];
 assert.deepEqual(currentOptions(o,'2026-03-01').map(x=>x.id),['a','b']);
 assert.deepEqual(currentOptions(o,'2026-09-01').map(x=>x.id),['b']);
});
