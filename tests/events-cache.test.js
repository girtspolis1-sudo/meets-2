import test from 'node:test';
import assert from 'node:assert/strict';

test('the public catalogue is read once a minute and served stale while refreshing',async()=>{
 process.env.SUPABASE_URL='https://ci.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='ci-test';
 const original=globalThis.fetch,realNow=Date.now;
 let calls=0,now=realNow();
 const day=new Date(now+86400000).toISOString().slice(0,10);
 globalThis.fetch=async()=>{calls++;return Response.json({fetchedAt:'x',events:[{id:'e'+calls,title:'T',date_from:day,status:'published'}]});};
 Date.now=()=>now;
 try{
  const {readEventsCached}=await import('../lib/events-server.js');
  assert.equal((await readEventsCached()).events[0].id,'e1');
  assert.equal((await readEventsCached()).events[0].id,'e1');
  assert.equal(calls,1);
  now+=61*1000;
  assert.equal((await readEventsCached()).events[0].id,'e1','stale copy while the refresh runs');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(calls,2);
  assert.equal((await readEventsCached()).events[0].id,'e2');
 }finally{globalThis.fetch=original;Date.now=realNow;}
});
