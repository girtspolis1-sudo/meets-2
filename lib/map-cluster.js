// Groups nearby map markers into one bubble with a count. Points are in screen
// pixels; only points of the same layer (in or outside the filter) join.
export const CLUSTER_MAX_ZOOM=14;

export function clusterPoints(points,radiusPx=52){
 const order=[...points].sort((a,b)=>b.weight-a.weight);
 const taken=new Set(),clusters=[];
 for(const point of order){
  if(taken.has(point))continue;
  taken.add(point);
  const members=[point];
  for(const other of order){
   if(taken.has(other)||other.layer!==point.layer)continue;
   if(Math.hypot(other.x-point.x,other.y-point.y)<=radiusPx){taken.add(other);members.push(other);}
  }
  clusters.push({layer:point.layer,members});
 }
 return clusters;
}

// The soonest tone wins: a bubble with anything on today is shown as today.
const TONE_ORDER=['ended-today','today','tomorrow','future'];
export function clusterTone(tones){
 const rank=tone=>{const i=TONE_ORDER.indexOf(tone);return i<0?TONE_ORDER.length:i;};
 return [...tones].sort((a,b)=>rank(a)-rank(b))[0]||'future';
}

// Radius that covers the visible map: the nearest option not smaller than
// the distance from the centre to the closer edge.
export function radiusForView(halfKm,options=[5,10,30,50]){
 return options.find(km=>km>=halfKm)||options[options.length-1];
}
