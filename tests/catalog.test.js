import test from 'node:test';
import assert from 'node:assert/strict';
import {filterEvents,filterEventsByColumns,initialFilters,publicEvent,safeUrl,timeLabel,dateLabel} from '../lib/catalog.js';
import {eventDateRangeLabel,eventDateState,groupDateTone,hasEventEnded,rigaClockMinutes} from '../lib/event-date.js';
import {createWorkbook} from '../lib/excel.js';
import {requestedMapMode} from '../lib/leaflet-runtime.js';
import {readEvents} from '../lib/events-server.js';
import ExcelJS from 'exceljs';
const hasLiveSupabase=Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_PUBLISHABLE_KEY);
process.env.SUPABASE_URL ||= 'https://ci.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY ||= 'ci-test';
test('all dates and statuses included; intervals overlap; Latvian search; invalid date range',()=>{
 const rows=[{id:'1',title:'Mārupes koncerts',date_from:'2020-01-01',date_to:'2020-01-05',status:'pending_review'},{id:'2',title:'Nākamais',date_from:'2030-01-01',status:'cancelled'}];
 assert.equal(filterEvents(rows,initialFilters).length,2);
 assert.equal(filterEvents(rows,{...initialFilters,search:'marupes'}).length,1);
 assert.equal(filterEvents(rows,{...initialFilters,from:'2020-01-03',to:'2020-01-03'}).length,1);
 assert.equal(filterEvents(rows,{...initialFilters,from:'2030-01-01',to:'2020-01-01'}).length,0);
});
test('public projection excludes administrative data and unsafe URLs',()=>{
 const e=publicEvent({title:'A',comment:'private',notes:'private',import_key:'x',last_change_summary:'private',sources:[{url:'javascript:alert(1)',token:'secret'}]});
 assert(!('comment' in e));assert(!('notes' in e));assert(!('import_key' in e));assert(!('last_change_summary' in e));assert(!('token' in e.sources[0]));assert.equal(e.sources[0].url,'');assert.equal(safeUrl('https://example.com'),'https://example.com/');
});
test('live Supabase data and Excel round trip include every row; no formulas',{skip:!hasLiveSupabase},async()=>{
 const data=await readEvents(); assert(data.events.every(e=>e.status==='published'));assert.equal(new Set(data.events.map(e=>e.id)).size,data.total);
 const buf=await createWorkbook([...data.events,{id:'test',title:'=HYPERLINK("https://example.com")',sources:[],tags:[],date_from:'2026-09-28'}],data.fetchedAt);
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(buf);const sheet=wb.getWorksheet('Pasākumi');const details=wb.getWorksheet('Detaļas');
 assert.equal(sheet.rowCount,data.total+2);assert.equal(details.rowCount,data.total+2);assert.equal(sheet.getCell(`D${data.total+2}`).value,'=HYPERLINK("https://example.com")');assert.equal(sheet.getCell(`D${data.total+2}`).type,ExcelJS.ValueType.String);assert(sheet.getCell(`A${data.total+2}`).value instanceof Date);assert.equal(details.getCell(`A${data.total+2}`).value,'test');
 const publicRpc=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/meets_public_catalog',{method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({})});assert(publicRpc.ok);
 const publicPayload=await publicRpc.json();assert(Array.isArray(publicPayload.events));assert(publicPayload.events.every(e=>e.status==='published'));
 const table=await fetch(process.env.SUPABASE_URL+'/rest/v1/events?select=id&limit=1',{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY}});assert(!table.ok);
 const passwordReady=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/meets_admin_password_ready',{method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:'{}'});assert(passwordReady.ok);assert.equal(typeof await passwordReady.json(),'boolean');
 const mappingCatalog=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/meets_admin_location_mapping_catalog',{method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_session_token:'invalid-ci-session'})});assert(!mappingCatalog.ok);
 console.log(`Verified ${data.total} live rows, public published-only RPC, no direct anonymous table access, admin password readiness and protected mapping catalogue.`);
});

test('each shared filter matches, excludes, combines and resets',()=>{
 const row=publicEvent({id:'fixture',title:'Mārupes tests',date_from:'2026-09-29',status:'published',municipality:'Mārupes novads',primary_category:'Izglītība',price_status:'free'});
 const cases={search:['marupes','absent'],municipality:['Mārupes novads','Cits novads'],category:['Izglītība','Sports'],status:['published','draft'],price:['free','paid'],from:['2026-09-29','2026-09-30'],to:['2026-09-29','2026-09-28']};
 const combined={...initialFilters};
 for(const [key,[match,miss]] of Object.entries(cases)){
  assert.equal(filterEvents([row],{...initialFilters,[key]:match}).length,1,key);
  assert.equal(filterEvents([row],{...initialFilters,[key]:miss}).length,0,key);
  combined[key]=match;
 }
 assert.equal(filterEvents([row],combined).length,1);
 assert.equal(filterEvents([row],initialFilters).length,1);
 assert.equal(filterEvents([],initialFilters).length,0);
});

test('server enforces published, excludes internal fields and tolerates optional blanks',async()=>{
 const original=globalThis.fetch;
 try {
  const futureDate=new Date(Date.now()+86400000).toISOString().slice(0,10);
  globalThis.fetch=async()=>Response.json({fetchedAt:new Date().toISOString(),events:['published','draft','pending_review','cancelled','archived'].map(status=>({id:status,title:'Test',date_from:futureDate,status,review_status:'needs_review',notes:'private',sources:[]}))});
  const data=await readEvents();assert.equal(data.total,1);assert.equal(data.events[0].status,'published');assert(!('review_status' in data.events[0]));assert(!('notes' in data.events[0]));assert.equal(data.events[0].address_raw,null);
  const wb=new ExcelJS.Workbook();await wb.xlsx.load(await createWorkbook(data.events,data.fetchedAt));assert.equal(wb.getWorksheet('Pasākumi').rowCount,2);assert(!JSON.stringify(wb.model).includes('needs_review'));
  globalThis.fetch=async()=>Response.json({events:[],fetchedAt:'2026-09-28T10:00:00Z'});assert.equal((await readEvents()).total,0);
 } finally {globalThis.fetch=original;}
});

test('API sanitizes unavailable upstream, query errors and invalid payloads',async()=>{
 const {GET}=await import('../app/api/events/route.js');
 const {GET:health}=await import('../app/api/health/route.js');
 const original=globalThis.fetch;
 try {
  for(const mock of [async()=>{throw new Error('secret SQL stack SUPABASE_URL');},async()=>new Response('sensitive SQL',{status:500}),async()=>Response.json({events:null})]){
   globalThis.fetch=mock;
   const response=await GET();assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{error:'Pasākumu datus neizdevās ielādēt. Lūdzu, mēģini vēlreiz.'});
   const h=await health();assert.equal(h.status,503);assert.deepEqual(await h.json(),{application:'meets 2',status:'degraded',database:'unavailable'});
  }
 } finally {globalThis.fetch=original;}
});

test('dates and optional times preserve local event meaning',()=>{
 assert.equal(dateLabel('2026-09-29'),'29.09.2026');assert.equal(timeLabel({time_from:'18:30:00',time_to:'19:45:00'}),'18:30–19:45');assert.equal(timeLabel({time_type:'end_only',time_to:'19:45:00'}),'Līdz 19:45');assert.equal(timeLabel({}),'Nav norādīts');
});

test('client error reporting accepts only small same-site JSON payloads',async()=>{
 const {POST}=await import('../app/api/client-error/route.js');
 const originalError=console.error;
 const logs=[];
 console.error=(...args)=>logs.push(args.join(' '));
 try {
  const ok=await POST(new Request('http://localhost/api/client-error',{
   method:'POST',
   headers:{'Content-Type':'application/json','Sec-Fetch-Site':'same-origin'},
   body:JSON.stringify({message:'Render failed\nwith detail',digest:'abc123',path:'/karte'})
  }));
  assert.equal(ok.status,204);
  assert(logs.some(line=>line.includes('client_render_error')));
  assert(logs.every(line=>!line.includes('\nwith detail')));

  const crossSite=await POST(new Request('http://localhost/api/client-error',{
   method:'POST',
   headers:{'Content-Type':'application/json','Sec-Fetch-Site':'cross-site'},
   body:'{}'
  }));
  assert.equal(crossSite.status,403);

  const invalid=await POST(new Request('http://localhost/api/client-error',{
   method:'POST',
   headers:{'Content-Type':'application/json','Sec-Fetch-Site':'same-origin'},
   body:'not-json'
  }));
  assert.equal(invalid.status,400);
 } finally {
  console.error=originalError;
 }
});

test('map date badges distinguish today, tomorrow, future, ranges and ended events',()=>{
 const today='2026-10-03';
 assert.deepEqual(
  eventDateState({date_from:'2026-10-03'},today),
  {tone:'today',label:'Šodien',badge:'Šodien',days:0,isOpenToday:true}
 );
 assert.deepEqual(
  eventDateState({date_from:'2026-10-04'},today),
  {tone:'tomorrow',label:'Rīt',badge:'Rīt',days:1,isOpenToday:false}
 );
 assert.deepEqual(
  eventDateState({date_from:'2026-10-08'},today),
  {tone:'future',label:'5 dienas līdz pasākumam',badge:'5d',days:5,isOpenToday:false}
 );
 assert.deepEqual(
  eventDateState({date_from:'2026-09-28',date_to:'2026-09-30'},today),
  {tone:'past',label:'Pasākums beidzās pirms 3 dienām',badge:'-3d',days:-3,isOpenToday:false}
 );
 assert.equal(eventDateState({date_from:'2026-10-01',date_to:'2026-10-05'},today).tone,'today');

 const beforeEnd=new Date('2026-10-03T15:29:00Z');
 const afterEnd=new Date('2026-10-03T15:31:00Z');
 assert.equal(rigaClockMinutes(beforeEnd),18*60+29);
 assert.equal(
  eventDateState({date_from:'2026-10-03',time_to:'18:30:00'},today,beforeEnd).tone,
  'today'
 );
 assert.deepEqual(
  eventDateState({date_from:'2026-10-03',time_to:'18:30:00'},today,afterEnd),
  {tone:'ended-today',label:'Iespējams noslēdzies · beigu laiks 18:30',badge:'Noslēdzies?',days:0,isOpenToday:true,isPossiblyEnded:true}
 );
 assert.equal(
  eventDateState({date_from:'2026-10-02',date_to:'2026-10-04',time_to:'10:00:00'},today,afterEnd).tone,
  'today'
 );
 assert.equal(groupDateTone([
  {date_from:'2026-10-03',time_to:'18:00:00'},
  {date_from:'2026-10-03',time_to:'18:30:00'}
 ],today,afterEnd),'ended-today');

 assert.equal(eventDateRangeLabel({date_from:'2026-10-01',date_to:'2026-10-05'},value=>value),'2026-10-01–2026-10-05');
 assert.equal(groupDateTone([{date_from:'2026-10-08'},{date_from:'2026-10-04'}],today),'tomorrow');
 assert.equal(groupDateTone([{date_from:'2026-09-29'}],today),'');
 assert.equal(hasEventEnded({date_from:'2026-09-28',date_to:'2026-09-30'},today),true);
 assert.equal(hasEventEnded({date_from:'2026-10-01',date_to:'2026-10-05'},today),false);
});

test('column filters apply only to their own catalogue column',()=>{
 const rows=[
  publicEvent({id:'1',title:'Rudens koncerts',date_from:'2026-10-02',status:'published',municipality:'Mārupes novads',country_code:'LV',price_status:'free',venue_name:'Mārupes kultūras nams'}),
  publicEvent({id:'2',title:'Basketbola spēle',date_from:'2026-10-03',status:'published',municipality:'Rīgas valstspilsēta',country_code:'LV',price_status:'paid',venue_name:'Arēna'})
 ];
 assert.equal(filterEventsByColumns(rows,{title:'rudens'}).length,1);
 assert.equal(filterEventsByColumns(rows,{municipality:'Mārupes novads'}).length,1);
 assert.equal(filterEventsByColumns(rows,{date_from:'2026-10-03'}).length,1);
 assert.equal(filterEventsByColumns(rows,{venue_name:'arēna',price_status:'paid'}).length,1);
 assert.equal(filterEventsByColumns(rows,{title:'arēna'}).length,0);
});

test('admin logout endpoint is safe without a session token',async()=>{
 const {POST}=await import('../app/api/admin/logout/route.js');
 const response=await POST(new Request('http://localhost/api/admin/logout',{method:'POST'}));
 assert.equal(response.status,204);
 assert.equal(response.headers.get('cache-control'),'no-store');
});

test('admin session endpoint rejects missing tokens without upstream access',async()=>{
 const {POST}=await import('../app/api/admin/session/route.js');
 const response=await POST(new Request('http://localhost/api/admin/session',{method:'POST'}));
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{valid:false});
});




test('map diagnostics select raster and failure modes deterministically',()=>{
 assert.equal(requestedMapMode('?map=raster'),'raster');
 assert.equal(requestedMapMode('?map=fail'),'fail');
 assert.equal(requestedMapMode('?map=vector'),'auto');
 assert.equal(requestedMapMode(''),'auto');
});

test('event type labels stay user friendly',()=>{
 assert.equal(display({event_type:'sports_match'},'event_type'),'Sporta spēle');
 assert.equal(display({event_type:'concert'},'event_type'),'Koncerts');
 assert.equal(display({event_type:'custom'},'event_type'),'custom');
});
