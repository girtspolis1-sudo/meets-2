import test from 'node:test';
import assert from 'node:assert/strict';
import {ADULT,TOURNAMENTS,YOUTH,staleGames} from '../supabase/functions/_shared/hockey.js';
import {sportLevel} from '../lib/sport-level.js';

test('the youth championship is read per age group, adult leagues as before', ()=>{
 assert.equal(ADULT.length,3);
 assert.ok(ADULT.every(t=>t.level==='senior'&&t.url.endsWith('/speles')));
 assert.equal(YOUTH.length,11);
 const u16=YOUTH.find(t=>t.key==='lhf-ljc-u16');
 assert.equal(u16.url,'https://www.lhf.lv/lv/turniri/latvijas-bernu-un-jaunatnes-cempionats-hokeja/u16/speles');
 assert.equal(u16.age_group,'U16');
 assert.equal(u16.level,'youth');
 assert.equal(YOUTH.find(t=>t.key==='lhf-ljc-u18m').age_group,'U18');
 assert.equal(new Set(TOURNAMENTS.map(t=>t.key)).size,TOURNAMENTS.length);
});

test('the site filter sees youth hockey as youth and the adult 1. līga with "Juniors" as adult', ()=>{
 const game=(t,title)=>({event_type:'sports_match',primary_category:'Hokejs',governing_body:'LHF',competition_name:t.name,age_group:t.age_group,title});
 for(const t of YOUTH)assert.equal(sportLevel(game(t,'A – B')),'youth',t.key);
 assert.equal(sportLevel(game(ADULT[1],'Zemgale Juniors – RĪGAS HS')),'senior');
});

test('coming games no longer listed are found; most of them gone is not trusted', ()=>{
 const e=(id,date,status='published')=>({id:'e'+id,import_key:'lhf.lv:'+id,date_from:date,status});
 const r=staleGames([e(1,'2026-12-01'),e(2,'2026-12-02'),e(3,'2026-11-01'),e(4,'2026-12-03','archived')],['1'],{from:'2026-11-27'});
 assert.deepEqual(r.gone.map(x=>x.id),['e2']);
 assert.equal(r.trusted,true);
 const many=Array.from({length:30},(_,i)=>e(i+10,'2026-12-10'));
 assert.equal(staleGames(many,['10'],{from:'2026-11-27'}).trusted,false);
});
