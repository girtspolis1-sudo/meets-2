import test from 'node:test';
import assert from 'node:assert/strict';
import {filterEvents,initialFilters,publicEvent,safeUrl,timeLabel,dateLabel} from '../lib/catalog.js';
import {createWorkbook} from '../lib/excel.js';
import {readEvents} from '../lib/events-server.js';
import ExcelJS from 'exceljs';
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
test('live Supabase data and Excel round trip include every row; no formulas',async()=>{
 const data=await readEvents(); assert(data.events.every(e=>e.status==='published'));assert.equal(new Set(data.events.map(e=>e.id)).size,data.total);
 const buf=await createWorkbook([...data.events,{id:'test',title:'=HYPERLINK("https://example.com")',sources:[],tags:[],date_from:'2026-09-28'}],data.fetchedAt);
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(buf);const sheet=wb.getWorksheet('Pasākumi');
 assert.equal(sheet.rowCount,data.total+2);assert.equal(sheet.getCell(`D${data.total+2}`).value,'=HYPERLINK("https://example.com")');assert.equal(sheet.getCell(`D${data.total+2}`).type,ExcelJS.ValueType.String);assert(sheet.getCell(`A${data.total+2}`).value instanceof Date);
 const publicRpc=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/meets_public_catalog',{method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({})});assert(publicRpc.ok);
 const publicPayload=await publicRpc.json();assert(Array.isArray(publicPayload.events));assert(publicPayload.events.every(e=>e.status==='published'));
 const table=await fetch(process.env.SUPABASE_URL+'/rest/v1/events?select=id&limit=1',{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY}});assert(!table.ok);
 console.log(`Verified ${data.total} live rows, public published-only RPC, full XLSX export and no direct anonymous table access.`);
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
  globalThis.fetch=async()=>Response.json({fetchedAt:'2026-09-28T10:00:00Z',events:['published','draft','pending_review','cancelled','archived'].map(status=>({id:status,title:'Test',date_from:'2026-09-29',status,review_status:'needs_review',notes:'private',sources:[]}))});
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
