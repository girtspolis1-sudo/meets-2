// Shape of the mobile bottom dock: a rounded glass bar whose top edge dips into
// a round notch under the raised bubble of the active item. CSS pixels, y down
// (as in SVG). The same outline clips the glass and draws its rim.
export const DOCK={
 top:30,    // room above the bar for the raised bubble and its shadow
 height:64, // bar height
 radius:30, // bar corner radius
 edge:56,   // centre of the first and last item, from the ends of the bar
 bubble:52, // diameter of the raised bubble
 gap:5,     // space between the bubble and the notch
 depth:4,   // bubble centre below the top edge of the bar
 fillet:11  // rounding where the notch meets the bar
};

// Centre of item `index` of `count` in a bar `width` px wide.
export function dockItemX(width,index,count,edge=DOCK.edge){
 return count<2?width/2:edge+index*(width-2*edge)/(count-1);
}

export const easeOutCubic=t=>1-(1-t)**3;

const TAU=2*Math.PI;
const onCircle=(c,r,angle)=>({x:c.x+r*Math.cos(angle),y:c.y+r*Math.sin(angle)});
const angleTo=(from,to)=>Math.atan2(to.y-from.y,to.x-from.x);
// Clockwise turn (y down) from angle a to angle b, in [0, 2π).
const turn=(a,b)=>((b-a)%TAU+TAU)%TAU;

// The outline is traced clockwise. Its upper part is five pieces (left side,
// top-left corner, top edge, top-right corner, right side), each moved `inset`
// px into the bar. The notch circle, made `inset` px larger, is cut from this
// inset outline; offsetting the result back out by `inset` turns every sharp
// corner of the cut into an arc of radius `inset` (the fillet).
function upperPieces(w,top,h,r,inset){
 return [
  {line:true,a:{x:inset,y:top+h-r},b:{x:inset,y:top+r},n:{x:-1,y:0}},
  {k:{x:r,y:top+r},r:r-inset,from:Math.PI},
  {line:true,a:{x:r,y:top+inset},b:{x:w-r,y:top+inset},n:{x:0,y:-1}},
  {k:{x:w-r,y:top+r},r:r-inset,from:1.5*Math.PI},
  {line:true,a:{x:w-inset,y:top+r},b:{x:w-inset,y:top+h-r},n:{x:1,y:0}}
 ];
}
// Lines run over t in [0, 1]; corner arcs over angles [from, from + π/2].
const startOf=p=>p.line?0:p.from;
const endOf=p=>p.line?1:p.from+Math.PI/2;
const along=(p,t)=>p.line?{x:p.a.x+(p.b.x-p.a.x)*t,y:p.a.y+(p.b.y-p.a.y)*t}:onCircle(p.k,p.r,t);
const normalAt=(p,t)=>p.line?p.n:{x:Math.cos(t),y:Math.sin(t)};

// Where piece p crosses the circle (c, rc), in increasing order along p.
function crossings(p,c,rc){
 if(p.line){
  const dx=p.b.x-p.a.x,dy=p.b.y-p.a.y,fx=p.a.x-c.x,fy=p.a.y-c.y;
  const qa=dx*dx+dy*dy,qb=2*(fx*dx+fy*dy),qc=fx*fx+fy*fy-rc*rc,disc=qb*qb-4*qa*qc;
  if(!qa||disc<0)return [];
  const root=Math.sqrt(disc);
  return [(-qb-root)/(2*qa),(-qb+root)/(2*qa)].filter(t=>t>=0&&t<=1);
 }
 const d=Math.hypot(c.x-p.k.x,c.y-p.k.y);
 if(!d||d>p.r+rc||d<Math.abs(p.r-rc))return [];
 const a=(p.r*p.r-rc*rc+d*d)/(2*d),h=Math.sqrt(Math.max(0,p.r*p.r-a*a));
 const ux=(c.x-p.k.x)/d,uy=(c.y-p.k.y)/d,mx=p.k.x+a*ux,my=p.k.y+a*uy;
 return [{x:mx-h*uy,y:my+h*ux},{x:mx+h*uy,y:my-h*ux}]
  .map(q=>p.from+turn(p.from,angleTo(p.k,q)))
  .filter(t=>t<=p.from+Math.PI/2+1e-9)
  .sort((x,y)=>x-y);
}

// Outline of the bar as path commands. `notch` = {x, radius?, depth?} or null;
// a notch that does not fit leaves the bar plain.
export function dockOutline({width,top=DOCK.top,height=DOCK.height,radius=DOCK.radius,fillet=DOCK.fillet,notch=null}){
 const w=width,h=height,r=Math.min(radius,h/2,w/2),s=Math.max(.5,Math.min(fillet,r-1));
 const pieces=upperPieces(w,top,h,r,s);
 const outer=(p,t)=>{const q=along(p,t),n=normalAt(p,t);return {x:q.x+s*n.x,y:q.y+s*n.y};};
 const path=[];
 const lineTo=q=>path.push({op:'L',x:q.x,y:q.y});
 const arcTo=(radius,q,clockwise,large)=>path.push({op:'A',r:radius,large:large?1:0,sweep:clockwise?1:0,x:q.x,y:q.y});
 const trace=(p,t)=>p.line?lineTo(outer(p,t)):arcTo(r,outer(p,t),true,false);

 let cut=null;
 if(notch&&Number.isFinite(notch.x)){
  const c={x:notch.x,y:top+(notch.depth??DOCK.depth)};
  const rn=notch.radius??DOCK.bubble/2+DOCK.gap,rc=rn+s;
  const outside=q=>Math.hypot(q.x-c.x,q.y-c.y)>rc;
  if(outside(pieces[0].a)&&outside(pieces[4].b)){
   const found=pieces.map(p=>crossings(p,c,rc));
   const i=found.findIndex(list=>list.length);
   const j=found.length-1-[...found].reverse().findIndex(list=>list.length);
   if(i>=0&&(i<j||found[i].length>1))cut={c,rn,i,ti:found[i][0],j,tj:found[j].at(-1)};
  }
 }

 path.push({op:'M',...outer(pieces[0],0)});
 pieces.forEach((p,k)=>{
  if(!cut||k<cut.i||k>cut.j){trace(p,endOf(p));return;}
  if(k===cut.i){
   const {c,rn}=cut,q=pieces[cut.j];
   const vin=along(p,cut.ti),vout=along(q,cut.tj);
   const uin=angleTo(vin,c),uout=angleTo(vout,c);
   const nin=normalAt(p,cut.ti),nout=normalAt(q,cut.tj);
   const pin=onCircle(vin,s,uin),pout=onCircle(vout,s,uout);
   trace(p,cut.ti);
   // Fillet into the notch, the notch itself (round the bubble's underside),
   // and the fillet back out.
   arcTo(s,pin,true,turn(Math.atan2(nin.y,nin.x),uin)>Math.PI);
   arcTo(rn,pout,false,turn(angleTo(c,pout),angleTo(c,pin))>Math.PI);
   arcTo(s,outer(q,cut.tj),true,turn(uout,Math.atan2(nout.y,nout.x))>Math.PI);
  }
  if(k===cut.j)trace(p,endOf(p));
 });
 const bottom=top+h;
 arcTo(r,{x:w-r,y:bottom},true,false);
 lineTo({x:r,y:bottom});
 arcTo(r,{x:0,y:bottom-r},true,false);
 path.push({op:'Z'});
 return path;
}

const fixed=v=>String(Math.round(v*100)/100);
// The outline as an SVG / CSS path() string.
export function dockPath(options){
 return dockOutline(options).map(c=>c.op==='Z'?'Z':c.op==='A'?
  `A${fixed(c.r)} ${fixed(c.r)} 0 ${c.large} ${c.sweep} ${fixed(c.x)} ${fixed(c.y)}`:
  `${c.op}${fixed(c.x)} ${fixed(c.y)}`).join('');
}
