import test from 'node:test';
import assert from 'node:assert/strict';
import {LIST_FIELDS,LIST_DESCRIPTION_CHARS,calendarDescription,decodeCatalog,encodeCatalog,listEvent} from '../lib/catalog-wire.js';
import {publicEvent} from '../lib/catalog.js';

const longText='Vārds '.repeat(120).trim();
const full=publicEvent({
 id:'e1',title:'Basketbols: VEF Rīga — Ventspils',description:'<p>'+longText+'</p>',terms:'Ieeja ar biļetēm',
 location_note:'Ieeja no sētas',date_from:'2026-11-02',time_from:'19:00:00',status:'published',
 latitude:56.95,longitude:24.1,tags:['Sports'],sources:[{source:'LBL',url:'https://example.lv/spele'}]
});

test('list form keeps list fields, drops detail-only fields and shortens the description',()=>{
 const row=listEvent(full);
 assert.deepEqual(Object.keys(row).filter(k=>k!=='description_more').sort(),[...LIST_FIELDS].sort());
 assert.equal('terms' in row,false);
 assert.equal('location_note' in row,false);
 assert.equal(row.description_more,true);
 assert.ok(row.description.length<=LIST_DESCRIPTION_CHARS+1);
 assert.ok(row.description.endsWith('…'));
 assert.equal(row.description.includes('<p>'),false);
});

test('short descriptions are kept whole and not flagged',()=>{
 const row=listEvent({...full,description:'Īss apraksts.'});
 assert.equal(row.description,'Īss apraksts.');
 assert.equal(row.description_more,undefined);
});

test('encode → decode round-trips the list fields',()=>{
 const wire=encodeCatalog({events:[full,{...full,id:'e2',description:null,tags:null,sources:null}],competitions:[{competition_key:'lbl',name:'LBL'}],fetchedAt:'x',window:{from:'2026-11-02',to:'2027-02-02'}});
 assert.equal(wire.v,2);
 assert.equal(wire.rows.length,2);
 const back=decodeCatalog(JSON.parse(JSON.stringify(wire)));
 assert.equal(back.total,2);
 assert.equal(back.events[0].title,full.title);
 assert.equal(back.events[0].latitude,56.95);
 assert.deepEqual(back.events[0].sources,full.sources);
 assert.equal(back.events[0].description_more,true);
 assert.deepEqual(back.events[1].tags,[]);
 assert.deepEqual(back.events[1].sources,[]);
 assert.equal(back.events[1].description_more,false);
 assert.deepEqual(back.window,{from:'2026-11-02',to:'2027-02-02'});
});

test('list form is much smaller than the full records',()=>{
 const events=Array.from({length:200},(_,i)=>({...full,id:'e'+i}));
 const before=JSON.stringify({events}).length;
 const after=JSON.stringify(encodeCatalog({events})).length;
 assert.ok(after<before*0.5,`list ${after} vs full ${before}`);
});

test('decode accepts the old object form and rejects garbage',()=>{
 assert.deepEqual(decodeCatalog({events:[]}).events,[]);
 assert.equal(decodeCatalog({v:99,rows:[]}),null);
 assert.equal(decodeCatalog(null),null);
});

test('calendar description points to the event page when shortened',()=>{
 const row=listEvent(full);
 assert.match(calendarDescription(row,'https://meets.lv'),/Pilns apraksts: https:\/\/meets\.lv\/pasakumi\/e1$/);
 assert.equal(calendarDescription({id:'x',description:'Īss.'}),'Īss.');
});
