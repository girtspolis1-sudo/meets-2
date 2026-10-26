import test from 'node:test';
import assert from 'node:assert/strict';
import {agendaEvents,agendaDay,isPastEvent,occursOn,monthDays,personalSelectionAfter} from '../lib/personal-agenda.js';
const now=new Date('2026-10-26T10:00:00Z'); // 12:00 Riga, after DST change
const event=(id,date,time='13:00')=>({id,title:id,date_from:date,time_from:time});
test('agenda sorts date then time, deduplicates, and filters plans and query',()=>{
 const a=event('A','2026-10-27','19:00'),b=event('B','2026-10-27','09:00'),c=event('C','2026-10-28');
 assert.deepEqual(agendaEvents([c,a,b,a],{now}).map(e=>e.id),['B','A','C']);
 assert.deepEqual(agendaEvents([c,a,b],{now,plans:['A'],status:'planned',query:'a'}),[a]);
});
test('ongoing events group under today; end time and unknown end are respected',()=>{
 const ongoing={...event('ongoing','2023-10-26'),date_to:'2026-11-08'};
 assert.equal(agendaDay(ongoing,'2026-10-26'),'2026-10-26');
 assert.equal(isPastEvent({...event('ended','2026-10-26'),time_to:'11:59'},now),true);
 assert.equal(isPastEvent({...event('ends','2026-10-26'),time_to:'12:00'},now),true);
 assert.equal(isPastEvent(event('unknown end','2026-10-26','09:00'),now),false);
 assert.equal(isPastEvent({...event('all day','2026-10-26'),time_type:'all_day',time_to:'00:00'},now),false);
 assert.equal(isPastEvent(ongoing,now),false);
});
test('Riga midnight and summer time boundaries do not depend on host timezone',()=>{
 assert.equal(isPastEvent({...event('x','2026-07-01'),time_to:'01:00'},new Date('2026-06-30T22:01:00Z')),true);
 assert.equal(isPastEvent(event('x','2026-10-25'),new Date('2026-10-25T22:01:00Z')),true);
});
test('calendar starts Monday, includes leap day and handles year boundary',()=>{
 const days=monthDays('2028-02');assert.equal(new Date(days[0]+'T12:00Z').getUTCDay(),1);assert.ok(days.includes('2028-02-29'));assert.equal(days.length%7,0);
 assert.equal(monthDays('2027-01')[0],'2026-12-28');
});
test('multi-day intervals overlap; unexpanded recurring ranges do not invent daily sessions',()=>{
 const e={...event('range','2026-10-24'),date_to:'2026-10-28'};
 assert.equal(occursOn(e,'2026-10-26'),true);assert.equal(occursOn(e,'2026-10-29'),false);
 assert.equal(occursOn({...e,schedule_type:'recurring'},'2026-10-26'),false);
 assert.equal(occursOn({...event('occurrence','2026-10-26'),schedule_type:'recurring'},'2026-10-26'),true);
});
test('planning saves, unplanning retains, unsaving clears plan, legacy plans are preserved',()=>{
 let state=personalSelectionAfter({favorites:[],plans:[]},'a','plan');assert.deepEqual(state,{favorites:['a'],plans:['a']});
 state=personalSelectionAfter(state,'a','plan');assert.deepEqual(state,{favorites:['a'],plans:[]});
 assert.deepEqual(personalSelectionAfter({favorites:[],plans:['a']},'a','plan'),{favorites:['a'],plans:[]});
 assert.deepEqual(personalSelectionAfter({favorites:['a','b'],plans:['a']},'a','favorite'),{favorites:['b'],plans:[]});
});
test('account API authenticates and writes only current user, preserves save on unplan',async()=>{
 const {POST}=await import('../app/api/account/route.js');
 const original=global.fetch,oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_PUBLISHABLE_KEY;
 process.env.SUPABASE_URL='https://test.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='test';
 const calls=[],id='11111111-1111-1111-1111-111111111111';
 try{
  global.fetch=async(url,opts)=>{calls.push({url,opts});return url.endsWith('/auth/v1/user')?Response.json({id:'owner'}):new Response(null,{status:204});};
  const request=action=>new Request('http://localhost/api/account',{method:'POST',body:JSON.stringify({action,token:'token',eventId:id,user_id:'attacker'})});
  for(const action of ['plan','unplan']){
   calls.length=0;assert.equal((await POST(request(action))).status,200);assert.equal(calls.length,3);
   assert.ok(calls[1].url.endsWith('/meets_favorites'));assert.deepEqual(JSON.parse(calls[1].opts.body),{user_id:'owner',event_id:id});
   assert.equal(calls[2].opts.method,action==='plan'?'POST':'DELETE');assert.equal(calls[2].opts.headers.Authorization,'Bearer token');
  }
  calls.length=0;await POST(request('remove'));assert.ok(calls[1].url.includes('meets_event_plans?user_id=eq.owner&event_id=eq.'));assert.ok(calls[2].url.includes('meets_favorites?user_id=eq.owner&event_id=eq.'));
  calls.length=0;global.fetch=async()=>new Response(null,{status:401});assert.equal((await POST(request('plan'))).status,401);
 }finally{global.fetch=original;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=oldKey;}
});
