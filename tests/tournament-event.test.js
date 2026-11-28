import test from 'node:test';
import assert from 'node:assert/strict';
import {tournamentEvent,tournamentHours} from '../lib/tournament-event.js';
import {topicArt} from '../lib/topic-art.js';
import {icsContent,navigationLinks} from '../lib/meets-personal.js';

const tournament={title:'Rudens kauss',sport:'football',format:'round_robin',play_date:'2026-12-05',venue:'Valmieras Olimpiskais centrs',
 games:[{no:1,starts_at:'10:00'},{no:2,starts_at:'10:20'},{no:3,starts_at:'11:40'},{no:4,starts_at:null}]};

test('the theme picture follows the sport',()=>{
 assert.equal(topicArt(tournamentEvent(tournament,'abc')).scene,'futbols');
 assert.equal(topicArt(tournamentEvent({...tournament,sport:'basket3x3'},'abc')).scene,'basketbols');
 assert.equal(topicArt(tournamentEvent({...tournament,sport:'hockey'},'abc')).scene,'hokejs');
 assert.equal(topicArt(tournamentEvent({...tournament,sport:'floorball'},'abc')).label,'Florbols');
 assert.equal(topicArt(tournamentEvent({...tournament,sport:'other'},'abc')).scene,'kalendars');
});

test('hours run from the first game to the end of the last one',()=>{
 assert.deepEqual(tournamentHours(tournament),{from:'10:00',to:'12:00'});
 assert.deepEqual(tournamentHours({...tournament,games:[]}),{from:'',to:''});
 assert.deepEqual(tournamentHours({sport:'volleyball',games:[{starts_at:'23:50'}]}),{from:'23:50',to:'23:59'});
});

test('the calendar entry has the play date, the hours, the venue and the link',()=>{
 const ics=icsContent(tournamentEvent(tournament,'abc','https://meets.lv/turniri/abc'));
 assert.match(ics,/DTSTART;TZID=Europe\/Riga:20261205T100000/);
 assert.match(ics,/DTEND;TZID=Europe\/Riga:20261205T120000/);
 assert.match(ics,/SUMMARY:Rudens kauss/);
 assert.match(ics,/LOCATION:Valmieras Olimpiskais centrs/);
 assert.match(ics,/https:\/\/meets.lv\/turniri\/abc/);
 assert.equal(icsContent(tournamentEvent({...tournament,play_date:null},'abc')),'');
});

test('directions search for the venue',()=>{
 const links=navigationLinks(tournamentEvent(tournament,'abc'));
 assert.match(links.google,/query=Valmieras%20Olimpiskais%20centrs/);
 assert.equal(links.waze,null);
 assert.equal(navigationLinks(tournamentEvent({...tournament,venue:''},'abc')).google,null);
});
