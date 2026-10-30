import test from 'node:test';
import assert from 'node:assert/strict';
import {clusterPoints,clusterTone,radiusForView} from '../lib/map-cluster.js';
import {markerLabel} from '../lib/map-nearby.js';

test('close points of the same layer form one bubble',()=>{
 const pts=[{id:1,x:0,y:0,weight:5,layer:'a'},{id:2,x:30,y:10,weight:1,layer:'a'},{id:3,x:20,y:0,weight:9,layer:'b'},{id:4,x:300,y:0,weight:1,layer:'a'}];
 const clusters=clusterPoints(pts,52);
 const ids=clusters.map(c=>c.members.map(m=>m.id).sort().join(',')).sort();
 assert.deepEqual(ids,['1,2','3','4']);
});

test('a bubble takes the soonest date colour; view radius rounds up',()=>{
 assert.equal(clusterTone(['future','tomorrow','today']),'today');
 assert.equal(clusterTone(['future','tomorrow']),'tomorrow');
 assert.equal(radiusForView(7),10);
 assert.equal(radiusForView(120),50);
});

test('marker labels say the weekday within a week, then the date',()=>{
 const today='2026-10-28'; // Wednesday
 assert.equal(markerLabel({date_from:'2026-10-28'},today),'ŠODIEN');
 assert.equal(markerLabel({date_from:'2026-10-29'},today),'RĪT');
 assert.equal(markerLabel({date_from:'2026-11-01'},today),'SV');
 assert.equal(markerLabel({date_from:'2026-11-10'},today),'10.11.');
});
