'use client';
import {useEffect,useRef} from 'react';

// The sheets are A4 wide (794 px). On a narrower screen the preview is scaled
// down to fit, so it looks as the paper will; printing is never scaled.
export default function PrintFit(){
 const ref=useRef(null);
 useEffect(()=>{
  const box=ref.current?.parentElement;
  if(!box)return;
  const fit=()=>box.style.setProperty('--tn-zoom',String(Math.max(.3,Math.min(1,(box.clientWidth-16)/794))));
  fit();
  window.addEventListener('resize',fit);
  return()=>window.removeEventListener('resize',fit);
 },[]);
 return <span ref={ref} hidden/>;
}
