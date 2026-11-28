'use client';
import {useState} from 'react';

// Sport and age group for the youth games list. The rows are rendered on the
// server with data-sport and data-age; this only hides the others, so without
// JavaScript every game is shown.
export default function YouthFilter({sports,ages,total}){
 const [sport,setSport]=useState(''),[age,setAge]=useState('');
 const esc=v=>String(v).replace(/["\\]/g,'\\$&');
 const rules=[
  sport&&'.youth-games li[data-sport]:not([data-sport="'+esc(sport)+'"])',
  age&&'.youth-games li[data-age]:not([data-age="'+esc(age)+'"])'
 ].filter(Boolean);
 return <div className="youth-filter" role="group" aria-label="Atlasīt spēles">
  {rules.length>0&&<style>{rules.join(',')+'{display:none}'}</style>}
  <label><span>Sporta veids</span><select value={sport} onChange={e=>setSport(e.target.value)}>
   <option value="">Visi ({total})</option>{sports.map(s=><option key={s.label} value={s.label}>{s.label} ({s.count})</option>)}
  </select></label>
  <label><span>Vecuma grupa</span><select value={age} onChange={e=>setAge(e.target.value)}>
   <option value="">Visas</option>{ages.map(a=><option key={a} value={a}>{a}</option>)}
  </select></label>
 </div>;
}
