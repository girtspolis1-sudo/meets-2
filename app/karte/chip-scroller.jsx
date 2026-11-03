'use client';
import {useEffect,useRef,useState} from 'react';

// A row of filter chips that may be wider than the panel. Arrows appear on the side
// that has more, the mouse wheel and a drag move it sideways, and tabbing still works.
export default function ChipScroller({label,className='',children}){
 const ref=useRef(null),drag=useRef(null);
 const [edges,setEdges]=useState({left:false,right:false});
 useEffect(()=>{
  const row=ref.current;if(!row)return;
  const update=()=>setEdges({left:row.scrollLeft>2,right:row.scrollLeft+row.clientWidth<row.scrollWidth-2});
  update();
  const wheel=e=>{
   if(row.scrollWidth<=row.clientWidth||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
   e.preventDefault();row.scrollLeft+=e.deltaY;
  };
  row.addEventListener('scroll',update,{passive:true});
  row.addEventListener('wheel',wheel,{passive:false});
  const observer=new ResizeObserver(update);observer.observe(row);
  return()=>{row.removeEventListener('scroll',update);row.removeEventListener('wheel',wheel);observer.disconnect();};
 },[]);
 function move(direction){
  const row=ref.current;if(!row)return;
  row.scrollBy({left:direction*Math.max(160,row.clientWidth*.7),behavior:'smooth'});
 }
 // Mouse drag; touch scrolls natively.
 function down(e){if(e.pointerType!=='mouse'||e.button!==0)return;drag.current={x:e.clientX,left:ref.current.scrollLeft,moved:false};}
 function moveDrag(e){
  const d=drag.current;if(!d)return;
  const dx=e.clientX-d.x;if(Math.abs(dx)>4)d.moved=true;
  if(d.moved)ref.current.scrollLeft=d.left-dx;
 }
 function up(){setTimeout(()=>{drag.current=null;},0);}
 // A click that ended a drag must not toggle the chip under the pointer.
 function clickCapture(e){if(drag.current?.moved){e.preventDefault();e.stopPropagation();drag.current=null;}}
 return <div className={'chip-scroller'+(edges.left?' more-left':'')+(edges.right?' more-right':'')+(className?' '+className:'')}>
  <button type="button" className="chip-scroller-arrow left" tabIndex={-1} aria-hidden="true" onClick={()=>move(-1)}>‹</button>
  <div className="chip-scroller-row" role="group" aria-label={label} ref={ref}
   onPointerDown={down} onPointerMove={moveDrag} onPointerUp={up} onPointerLeave={up} onClickCapture={clickCapture}>
   {children}
  </div>
  <button type="button" className="chip-scroller-arrow right" tabIndex={-1} aria-hidden="true" onClick={()=>move(1)}>›</button>
 </div>;
}
