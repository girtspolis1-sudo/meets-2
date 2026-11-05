import test from 'node:test';
import assert from 'node:assert/strict';
import {DOCK,dockItemX,dockOutline,dockPath} from '../lib/mobile-dock.js';

// Phone widths of the bar (viewport minus 12 px margins), up to its 480 px cap.
const WIDTHS=[296,320,351,366,406,480];
const COUNT=5;
const RN=DOCK.bubble/2+DOCK.gap;
const near=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;
const points=path=>path.filter(c=>c.op!=='Z');

test('items run from one edge offset to the other at equal steps',()=>{
 assert.equal(dockItemX(366,0,COUNT),DOCK.edge);
 assert.equal(dockItemX(366,COUNT-1,COUNT),366-DOCK.edge);
 assert.equal(dockItemX(366,2,COUNT),183);
 assert.equal(dockItemX(366,0,1),183);
});

test('without a notch the bar is a closed rounded rectangle inside its box',()=>{
 const path=dockOutline({width:366});
 assert.equal(path[0].op,'M');
 assert.equal(path.at(-1).op,'Z');
 assert.equal(path.filter(c=>c.op==='A').length,4);
 for(const c of points(path)){
  assert.ok(c.x>=0&&c.x<=366,`x ${c.x}`);
  assert.ok(c.y>=DOCK.top&&c.y<=DOCK.top+DOCK.height,`y ${c.y}`);
 }
});

test('every item gets one notch round its bubble, with a fillet on each side',()=>{
 for(const width of WIDTHS)for(let i=0;i<COUNT;i++){
  const x=dockItemX(width,i,COUNT),c={x,y:DOCK.top+DOCK.depth};
  const path=dockOutline({width,notch:{x}});
  const at=path.findIndex(cmd=>cmd.op==='A'&&cmd.sweep===0);
  const where=`${width} px, item ${i}`;
  assert.ok(at>1,where);
  assert.equal(path.filter(cmd=>cmd.op==='A'&&cmd.sweep===0).length,1,where);
  const start=path[at-1],end=path[at];
  // The notch keeps DOCK.gap px clear of the bubble at both of its ends.
  assert.equal(end.r,RN,where);
  assert.ok(near(Math.hypot(start.x-c.x,start.y-c.y),RN),where);
  assert.ok(near(Math.hypot(end.x-c.x,end.y-c.y),RN),where);
  assert.equal(path[at-1].op,'A',where);
  assert.equal(path[at-1].r,DOCK.fillet,where);
  assert.equal(path[at+1].r,DOCK.fillet,where);
  // The notch goes round the underside of the bubble.
  assert.ok(start.x<c.x&&end.x>c.x,where);
 }
});

test('the outline stays inside the bar box, also next to the corners',()=>{
 for(const width of WIDTHS)for(let i=0;i<COUNT;i++){
  const path=dockOutline({width,notch:{x:dockItemX(width,i,COUNT)}});
  for(const c of points(path)){
   assert.ok(c.x>=-1e-9&&c.x<=width+1e-9,`x ${c.x} at ${width} px, item ${i}`);
   assert.ok(c.y>=DOCK.top-1e-9&&c.y<=DOCK.top+DOCK.height+1e-9,`y ${c.y} at ${width} px, item ${i}`);
  }
 }
});

test('the middle item gives a mirror-symmetric outline',()=>{
 const width=366,path=points(dockOutline({width,notch:{x:width/2}}));
 for(const c of path){
  assert.ok(path.some(m=>near(m.x,width-c.x,1e-6)&&near(m.y,c.y,1e-6)),`no mirror for ${c.x},${c.y}`);
 }
});

test('the notch can slide anywhere between the first and last item',()=>{
 for(const width of WIDTHS){
  for(let x=DOCK.edge;x<=width-DOCK.edge;x+=0.5){
   const d=dockPath({width,notch:{x}});
   assert.ok(d.startsWith('M')&&d.endsWith('Z'),`${width} px at ${x}`);
   assert.ok(!d.includes('NaN'),`${width} px at ${x}`);
   assert.equal((d.match(/A[\d.]+ [\d.]+ 0 [01] 0 /g)||[]).length,1,`notch at ${width} px, x ${x}`);
  }
 }
});

test('a notch that does not fit leaves the bar plain',()=>{
 assert.equal(dockOutline({width:366,notch:{x:-200}}).filter(c=>c.op==='A').length,4);
 assert.equal(dockOutline({width:366,notch:{x:Number.NaN}}).filter(c=>c.op==='A').length,4);
});
