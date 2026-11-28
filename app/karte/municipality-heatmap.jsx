'use client';
import Icon from '../components/line-icon.jsx';
import {useState} from 'react';
import {MUNICIPALITIES,REGIONS,TILE_COLUMNS,TILE_ROWS,heatLevels} from '../../lib/lv-municipalities.js';
import {countLabel} from '../../lib/map-nearby.js';
import {LV_OUTLINE,LV_VIEWBOX,lvPoint} from '../../lib/lv-outline.js';

// "Kur" panel: where events are, as a heat map of local governments (schematic tiles) or a list by region.
// `wide` (desktop K1 layout): the tiles take the whole column and the top list runs below them; the
// card of the pointed local government is drawn by the panel (MunicipalityCard), so focus can be passed in.
export default function MunicipalityHeatmap({counts,topics,selected,onOpen,onToggle,tapFirst,compact=false,wide=false,focus:focusIn,onFocus}){
 const [view,setView]=useState('map');
 const [ownFocus,setOwnFocus]=useState(()=>selected[0]||'');
 const focus=focusIn??ownFocus;
 const setFocus=onFocus||setOwnFocus;
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
  {view==='map'&&compact?<LatviaMap counts={counts} levels={levels} selected={selected} focus={focus} onTap={tile} current={current} topics={topics} onOpen={onOpen} onToggle={onToggle}/>
  :view==='map'&&wide?<div className="mheat-wide">
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
   <div className="mheat-topwide"><h3>Visvairāk</h3><ol>{top.slice(0,6).map(m=><li key={m.name}><button type="button" className={isSelected(m.name)?'on':''} onClick={()=>onOpen(m.name)} onMouseEnter={()=>setFocus(m.name)}>
    <span>{m.name}</span><b>{counts.get(m.name)}</b></button></li>)}</ol></div>
  </div>
  :view==='map'?<div className="mheat-body">
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

// Phones: Latvia's outline with one circle per local government at its centre. A bigger and
// darker circle means more events. Rīga and its close neighbours overlap there, so they are a
// row of buttons under the map.
function LatviaMap({counts,levels,selected,focus,onTap,current,topics,onOpen,onToggle}){
 const {width:W,height:H}=LV_VIEWBOX;
 const outer=MUNICIPALITIES.filter(m=>!m.inset);
 const max=Math.max(1,...outer.map(m=>counts.get(m.name)||0));
 // Big circles first, so the small ones stay on top and can be tapped.
 const dots=[...outer].sort((a,b)=>(counts.get(b.name)||0)-(counts.get(a.name)||0));
 const riga=lvPoint(24.11,56.95);
 const inset=MUNICIPALITIES.filter(m=>m.inset).sort((a,b)=>(counts.get(b.name)||0)-(counts.get(a.name)||0)||a.name.localeCompare(b.name,'lv'));
 const isSelected=name=>selected.includes(name);
 return <div className="mlv">
  <div className="mlv-map" style={{aspectRatio:W+' / '+H}}>
   <svg viewBox={'0 0 '+W+' '+H} aria-hidden="true" preserveAspectRatio="none"><path d={LV_OUTLINE}/></svg>
   <span className="mlv-riga" style={{left:riga.x/W*100+'%',top:riga.y/H*100+'%'}} aria-hidden="true">Rīga ↓</span>
   {dots.map(m=>{
    const n=counts.get(m.name)||0,p=lvPoint(m.lon,m.lat);
    const size=n?Math.round(16+24*Math.sqrt(n/max)):9;
    return <button key={m.name} type="button" className={'mlv-dot lvl-'+levels.get(m.name)+(isSelected(m.name)?' on':'')+(focus===m.name?' focus':'')}
     style={{left:p.x/W*100+'%',top:p.y/H*100+'%',width:size,height:size}} aria-pressed={isSelected(m.name)}
     aria-label={m.name+', '+countLabel(n)} onClick={()=>onTap(m)}>{size>=26?n:''}</button>;
   })}
  </div>
  <div className="mlv-inset"><h3>Rīga un Pierīga</h3><div>
   {inset.map(m=>{const n=counts.get(m.name)||0;return <button key={m.name} type="button" className={(isSelected(m.name)?'on ':'')+(focus===m.name?'focus':'')}
    aria-label={m.name+', '+countLabel(n)} onClick={()=>onTap(m)}><span className={'lvl-'+levels.get(m.name)}>{n}</span>{m.short}</button>;})}
  </div></div>
  {current?<div className="mlv-card">
   <span><strong>{current.name}</strong><small>{countLabel(counts.get(current.name)||0)}{topics.get(current.name)?.length?' · '+topics.get(current.name).join(', '):''}</small></span>
   <button type="button" className="mlv-add" onClick={()=>onToggle(current.name)} aria-pressed={isSelected(current.name)} aria-label={(isSelected(current.name)?'Noņemt ':'Pievienot ')+current.name}>{isSelected(current.name)?'✓':'+'}</button>
   <button type="button" className="mlv-open" onClick={()=>onOpen(current.name)} disabled={!counts.get(current.name)}>Atvērt</button>
  </div>:<p className="mheat-hint">Pieskaries aplim. Jo lielāks un tumšāks aplis, jo vairāk pasākumu.</p>}
 </div>;
}

// The pointed local government with Atvērt and + (desktop K1: in the panel's left column).
export function MunicipalityCard({name,counts,topics,selected,onOpen,onToggle}){
 const m=MUNICIPALITIES.find(x=>x.name===name);
 if(!m)return <p className="mheat-hint">Izvēlies novadu kartē. Jo tumšāks lauciņš, jo vairāk pasākumu.</p>;
 const n=counts.get(m.name)||0,on=selected.includes(m.name);
 return <div className="mheat-card">
  <strong>{m.name}</strong>
  <span>{countLabel(n)}{topics.get(m.name)?.length?' · '+topics.get(m.name).join(', '):''}</span>
  <div className="mheat-card-actions">
   <button type="button" className="mheat-open" onClick={()=>onOpen(m.name)} disabled={!n}>Atvērt novadu</button>
   <button type="button" className="mheat-add" onClick={()=>onToggle(m.name)} aria-pressed={on} aria-label={(on?'Noņemt ':'Pievienot ')+m.name}>{on?<Icon name="check" size={15}/>:<Icon name="plus" size={15}/>}</button>
  </div>
 </div>;
}
