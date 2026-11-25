'use client';
import {useState} from 'react';
import {MUNICIPALITIES,REGIONS,TILE_COLUMNS,TILE_ROWS,heatLevels} from '../../lib/lv-municipalities.js';
import {countLabel} from '../../lib/map-nearby.js';

// "Kur" panel: where events are, as a heat map of local governments (schematic tiles) or a list by region.
export default function MunicipalityHeatmap({counts,topics,selected,onOpen,onToggle,tapFirst}){
 const [view,setView]=useState('map');
 const [focus,setFocus]=useState(()=>selected[0]||'');
 const levels=heatLevels(new Map(MUNICIPALITIES.map(m=>[m.name,counts.get(m.name)||0])));
 const top=[...MUNICIPALITIES].filter(m=>counts.get(m.name)).sort((a,b)=>counts.get(b.name)-counts.get(a.name)||a.name.localeCompare(b.name,'lv')).slice(0,7);
 const current=MUNICIPALITIES.find(m=>m.name===focus)||null;
 const isSelected=name=>selected.includes(name);
 function tile(m){
  // On touch screens the first tap shows the card; with a mouse a click opens the local government.
  if(tapFirst&&focus!==m.name){setFocus(m.name);return;}
  onOpen(m.name);
 }
 return <div className="mheat">
  <div className="mheat-head">
   <div role="tablist" aria-label="Skats" className="mheat-tabs">
    <button type="button" role="tab" aria-selected={view==='map'} onClick={()=>setView('map')}>Karte</button>
    <button type="button" role="tab" aria-selected={view==='list'} onClick={()=>setView('list')}>Saraksts</button>
   </div>
   <div className="mheat-legend" aria-hidden="true">mazāk {[1,2,3,4].map(l=><i key={l} className={'lvl-'+l}/>)} vairāk pasākumu</div>
  </div>
  {view==='map'?<div className="mheat-body">
   <div className="mheat-grid" style={{gridTemplateColumns:`repeat(${TILE_COLUMNS},minmax(0,1fr))`,gridTemplateRows:`repeat(${TILE_ROWS},auto)`}}>
    {MUNICIPALITIES.map(m=>{
     const n=counts.get(m.name)||0;
     return <button key={m.name} type="button" className={'mheat-tile lvl-'+levels.get(m.name)+(isSelected(m.name)?' on':'')+(focus===m.name?' focus':'')}
      style={{gridColumn:m.col+1,gridRow:m.row+1}} aria-pressed={isSelected(m.name)}
      aria-label={m.name+', '+countLabel(n)} title={m.name+' · '+countLabel(n)}
      onMouseEnter={()=>setFocus(m.name)} onFocus={()=>setFocus(m.name)} onClick={()=>tile(m)}>
      <span className="mheat-name">{m.short}</span><span className="mheat-n">{n||''}</span>
     </button>;
    })}
   </div>
   <aside className="mheat-side">
    {current?<div className="mheat-card">
     <strong>{current.name}</strong>
     <span>{countLabel(counts.get(current.name)||0)}{topics.get(current.name)?.length?' · '+topics.get(current.name).join(', '):''}</span>
     <div className="mheat-card-actions">
      <button type="button" className="mheat-open" onClick={()=>onOpen(current.name)} disabled={!counts.get(current.name)}>Atvērt novadu</button>
      <button type="button" className="mheat-add" onClick={()=>onToggle(current.name)} aria-pressed={isSelected(current.name)}>{isSelected(current.name)?'Noņemt':'+ Pievienot'}</button>
     </div>
    </div>:<p className="mheat-hint">Izvēlies novadu kartē. Jo tumšāks lauciņš, jo vairāk pasākumu.</p>}
    <h3>Visvairāk pasākumu</h3>
    <ol className="mheat-top">{top.map(m=><li key={m.name}><button type="button" className={isSelected(m.name)?'on':''} onClick={()=>onOpen(m.name)} onMouseEnter={()=>setFocus(m.name)}>
     <span>{m.name}</span><b>{counts.get(m.name)}</b></button></li>)}</ol>
   </aside>
  </div>:<div className="mheat-regions">
   {REGIONS.map(r=>{
    const items=MUNICIPALITIES.filter(m=>m.region===r.key).sort((a,b)=>(counts.get(b.name)||0)-(counts.get(a.name)||0)||a.name.localeCompare(b.name,'lv'));
    const total=items.reduce((s,m)=>s+(counts.get(m.name)||0),0);
    return <section key={r.key}><h3>{r.title} <small>{total}</small></h3><div className="mheat-chips">
     {items.map(m=><button key={m.name} type="button" className={isSelected(m.name)?'on':''} disabled={!counts.get(m.name)} onClick={()=>onOpen(m.name)}>
      {m.short}<small>{counts.get(m.name)||0}</small></button>)}
    </div></section>;
   })}
  </div>}
 </div>;
}
