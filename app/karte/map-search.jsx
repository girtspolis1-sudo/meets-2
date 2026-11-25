'use client';
import {useEffect,useRef,useState} from 'react';
import CategoryIcon from '../components/category-icon.jsx';
import {HOME_CATEGORY_FILTERS,HOME_GROUP_KEYS} from '../../lib/home-category-filters.js';
import {PERIODS,RADII,radiusLabel} from '../../lib/map-nearby.js';
import './map-search.css';

const I={
 search:<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>,
 map:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z"/><path d="M9 4v14M15 6v14"/></svg>,
 sliders:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h6M14 18h6"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="12" cy="18" r="2"/></svg>,
 locate:<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>,
 close:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>,
 pin:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>
};
export const SEARCH_ICONS=I;

// Closes a floating panel on Escape or a click outside it, then gives focus back to its opener.
export function usePanelDismiss(open,onClose,panelRef,openerRef){
 useEffect(()=>{
  if(!open)return;
  function key(e){if(e.key==='Escape'){onClose();openerRef.current?.focus();}}
  function down(e){
   if(panelRef.current?.contains(e.target)||openerRef.current?.contains(e.target))return;
   if(e.target.closest?.('.msearch-bar'))return;
   onClose();
  }
  document.addEventListener('keydown',key);
  document.addEventListener('pointerdown',down);
  return()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',down);};
 },[open,onClose,panelRef,openerRef]);
}

export function SearchBar({whereLabel,whereActive,onClearWhere,panel,setPanel,whatQuery,setWhatQuery,filterCount,onSubmit,whereRef,whatRef,suggestions,onPickEvent,formatWhen}){
 const [suggestOpen,setSuggestOpen]=useState(false);
 const barRef=useRef(null);
 useEffect(()=>{
  if(!suggestOpen)return;
  function down(e){if(!barRef.current?.contains(e.target))setSuggestOpen(false);}
  document.addEventListener('pointerdown',down);
  return()=>document.removeEventListener('pointerdown',down);
 },[suggestOpen]);
 const showSuggestions=suggestOpen&&!panel&&whatQuery.trim().length>=2&&suggestions.length>0;
 function submit(){setSuggestOpen(false);onSubmit();}
 return <div className="msearch-bar" ref={barRef}>
  <div className={'msearch-where'+(panel==='where'?' open':'')}>
   <button type="button" ref={whereRef} className="msearch-where-button" aria-expanded={panel==='where'} aria-controls="msearch-where-panel"
    onClick={()=>setPanel(panel==='where'?'':'where')}>
    <span className="msearch-label">Kur</span>
    <span className={'msearch-where-value'+(whereActive?' chosen':'')}>{whereActive&&I.pin}<span>{whereLabel}</span></span>
    <span className="msearch-where-icon">{I.map}</span>
   </button>
   {whereActive&&<button type="button" className="msearch-clear" onClick={onClearWhere} aria-label={'Noņemt vietu: '+whereLabel}>{I.close}</button>}
  </div>
  <div className={'msearch-what'+(panel==='what'?' open':'')}>
   <label className="msearch-what-field">
    <span className="msearch-label">Ko</span>
    <input type="search" value={whatQuery} onChange={e=>{setWhatQuery(e.target.value);setSuggestOpen(true);}} onFocus={()=>setSuggestOpen(true)}
     onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();submit();}if(e.key==='Escape')setSuggestOpen(false);}}
     placeholder="Pasākums, rīkotājs vai vieta" aria-label="Meklēt pasākumu pēc nosaukuma, rīkotāja vai vietas" autoComplete="off"/>
   </label>
   <button type="button" ref={whatRef} className="msearch-filters" aria-expanded={panel==='what'} aria-controls="msearch-what-panel"
    aria-label={'Filtri'+(filterCount?', ieslēgti '+filterCount:'')} onClick={()=>setPanel(panel==='what'?'':'what')}>
    {I.sliders}<span className="msearch-filters-text">Filtri</span>{filterCount>0&&<span className="msearch-count">{filterCount}</span>}
   </button>
  </div>
  <button type="button" className="msearch-go" onClick={submit} aria-label="Rādīt atrastos pasākumus">{I.search}</button>
  {showSuggestions&&<ul className="msearch-suggest" aria-label="Atrastie pasākumi">
   {suggestions.map(e=><li key={e.id}><button type="button" onClick={()=>{setSuggestOpen(false);onPickEvent(e);}}>
    <strong>{e.title}</strong><span>{[formatWhen(e),e.venue_name||e.settlement||e.municipality].filter(Boolean).join(' · ')}</span>
   </button></li>)}
  </ul>}
 </div>;
}

function Pills({label,children}){
 return <section className="msearch-section"><h3>{label}</h3><div className="msearch-pills">{children}</div></section>;
}
function Pill({on,onClick,children,title}){
 return <button type="button" className={'msearch-pill'+(on?' on':'')} aria-pressed={!!on} onClick={onClick} title={title}>{children}</button>;
}

export function WhatPanel({portal=false,panelRef,onClose,count,f,set,periodMode,changePeriod,from,to,today,publicTo,setFrom,setTo,setPeriodMode,audienceOptions,quickTypes,sourceCounts,singleEventType,competitionOptions,categories,countries,countryLabel,onReset,onlineCount}){
 return <div id="msearch-what-panel" ref={panelRef} className={'msearch-panel msearch-panel-what'+(portal?' msearch-portal':'')} role="dialog" aria-label="Ko meklēt">
  <div className="msearch-panel-head"><strong>Filtri</strong><button type="button" className="msearch-close" onClick={onClose} aria-label="Aizvērt filtrus">{I.close}</button></div>
  <div className="msearch-panel-body">
   <Pills label="Kad">
    {PERIODS.map(p=><Pill key={p.key} on={periodMode===p.key} onClick={()=>changePeriod(p.key)}>{p.label}</Pill>)}
   </Pills>
   {periodMode==='manual'&&<div className="msearch-dates">
    <input aria-label="Datums no" type="date" min={today} max={to||publicTo||undefined} value={from} onChange={e=>{const v=e.target.value;setPeriodMode('manual');setFrom(v);if(!to||v>to)setTo(v);}}/>
    <span aria-hidden="true">–</span>
    <input aria-label="Datums līdz" type="date" min={from||today} max={publicTo||undefined} value={to} onChange={e=>{setPeriodMode('manual');setTo(e.target.value);}}/>
   </div>}
   <Pills label="Tēma">
    {HOME_GROUP_KEYS.map(key=><Pill key={key} on={f.category===key} onClick={()=>set.category(f.category===key?'':key)}><CategoryIcon name={key}/>{HOME_CATEGORY_FILTERS[key].title}</Pill>)}
   </Pills>
   <div className="msearch-two">
    <Pills label="Maksa">
     {[['','Visi'],['free','Bezmaksas'],['paid','Maksas']].map(([v,t])=><Pill key={t} on={f.price===v} onClick={()=>set.price(v)}>{t}</Pill>)}
    </Pills>
    {audienceOptions.length>0&&<Pills label="Kam">
     {audienceOptions.map(([key,title])=><Pill key={key} on={f.audience===key} onClick={()=>set.audience(f.audience===key?'':key)}>{title}</Pill>)}
    </Pills>}
   </div>
   <Pills label="Citi">
    <Pill on={f.onlineOnly} onClick={()=>set.onlineOnly(!f.onlineOnly)} title="Pasākumi, kuros var piedalīties tiešsaistē">Tiešsaistē <small>{onlineCount}</small></Pill>
    <Pill on={f.showLong} onClick={()=>set.showLong(!f.showLong)} title="Izstādes un citi pasākumi, kas ilgst vairāk nekā 2 nedēļas">Izstādes un ilgstošie</Pill>
   </Pills>
   <Pills label="Sporta līgas un avoti">
    {quickTypes.map(t=><Pill key={t.value} on={f.eventTypes.includes(t.value)} onClick={()=>set.toggleType(t.value)}>{t.label} <small>{sourceCounts[t.value]||0}</small></Pill>)}
   </Pills>
   <div className="msearch-selects">
    {singleEventType&&competitionOptions.length>0&&<label><span>Turnīrs</span><select value={f.competition} onChange={e=>set.competition(e.target.value)}>
     <option value="">Visi turnīri</option>{competitionOptions.map(v=><option key={v.key} value={v.key}>{v.name} ({v.count})</option>)}
    </select></label>}
    <label><span>Sīkāka kategorija</span><select value={f.subcategory} onChange={e=>set.subcategory(e.target.value)}>
     <option value="">Visas kategorijas</option>{categories.map(v=><option key={v}>{v}</option>)}
    </select></label>
    {countries.length>1&&<label><span>Valsts</span><select value={f.country} onChange={e=>set.country(e.target.value)}>
     <option value="">Visas valstis</option>{countries.map(code=><option key={code} value={code}>{countryLabel(code)}</option>)}
    </select></label>}
   </div>
  </div>
  <div className="msearch-panel-foot">
   <button type="button" className="msearch-reset" onClick={onReset}>Notīrīt filtrus</button>
   <button type="button" className="msearch-show" onClick={onClose}>Rādīt {count}</button>
  </div>
 </div>;
}

export function WherePanel({portal=false,panelRef,onClose,query,setQuery,onSearch,searching,places,results,onPick,message,onLocate,onWholeCountry,origin,radiusKm,setRadius,count,children}){
 const list=results.length?results:places;
 return <div id="msearch-where-panel" ref={panelRef} className={'msearch-panel msearch-panel-where'+(portal?' msearch-portal':'')} role="dialog" aria-label="Kur meklēt">
  <div className="msearch-panel-head"><strong>Kur meklēt</strong><button type="button" className="msearch-close" onClick={onClose} aria-label="Aizvērt vietas izvēli">{I.close}</button></div>
  <div className="msearch-panel-body">
   <div className="msearch-where-tools">
    <label className="msearch-place-field">{I.search}
     <input type="search" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onSearch();}}}
      placeholder="Pilsēta, novads, pagasts vai adrese" aria-label="Meklēt vietu" autoComplete="off"/>
     <button type="button" onClick={onSearch} disabled={searching} aria-label="Meklēt vietu">{searching?'…':I.search}</button>
    </label>
    <button type="button" className="msearch-near" onClick={onLocate}>{I.locate}Tuvumā man</button>
    <button type="button" className="msearch-all" onClick={onWholeCountry}>Visa Latvija</button>
   </div>
   {list.length>0&&<ul className="msearch-places" aria-label="Atrastās vietas">
    {list.map(place=><li key={place.id||place.displayName||place.label}><button type="button" onClick={()=>onPick(place)}>
     {I.pin}<span><strong>{place.label||place.displayName}</strong>{place.displayName&&place.displayName!==place.label&&<small>{place.displayName}</small>}</span>
    </button></li>)}
   </ul>}
   {message&&<p className="msearch-message" role="status">{message}</p>}
   {origin&&<section className="msearch-section"><h3>Cik tālu no: {origin.label}</h3><div className="msearch-pills" role="group" aria-label="Cik tālu">
    {RADII.map(km=><Pill key={km} on={radiusKm===km} onClick={()=>setRadius(km)} title={radiusLabel(km)}>{km?km+' km':'Visa Latvija'}</Pill>)}
   </div></section>}
   {children}
  </div>
  <div className="msearch-panel-foot"><span/><button type="button" className="msearch-show" onClick={onClose}>Rādīt {count}</button></div>
 </div>;
}

// The chosen local government: where it is, how many events, and its towns and parishes.
export function NovadsCard({name,region,count,areas,area,onArea,onBack,onClear}){
 return <section className="mnovads" aria-label={'Izvēlētais novads: '+name}>
  <button type="button" className="mnovads-back" onClick={onBack} aria-label="Atpakaļ uz novadu karti" title="Novadu karte">{I.map}</button>
  <div className="mnovads-title"><small>Latvija{region?' › '+region:''}</small><strong>{name}</strong><span>{count}</span></div>
  <AreaChips areas={areas} area={area} onArea={onArea}/>
  <button type="button" className="mnovads-clear" onClick={onClear} aria-label={'Noņemt novadu: '+name}>{I.close}</button>
 </section>;
}

// Town and parish chips of the chosen local government ("Visur" = all of it).
export function AreaChips({areas,area,onArea}){
 if(areas.length<2)return null;
 return <div className="mnovads-areas" role="group" aria-label="Pilsēta vai pagasts">
  <button type="button" className={!area?'on':''} aria-pressed={!area} onClick={()=>area&&onArea(area)}>Visur</button>
  {areas.map(g=><button key={g.name} type="button" className={area===g.name?'on':''} aria-pressed={area===g.name} onClick={()=>onArea(g.name)}>
   {g.name.replace(/ pagasts$/,' pag.')}<small>{g.count}</small></button>)}
 </div>;
}

// Phones with a local government open: Kur, Ko, Kad and filters folded into one line, so the map
// keeps the screen. The place opens the Kur panel, the magnifier the full bar, the sliders Ko.
export function CompactBar({label,meta,filterCount,onWhere,onSearch,onFilters}){
 return <div className="mcompact">
  <button type="button" className="mcompact-main" onClick={onWhere} aria-label={'Mainīt vietu: '+label}>
   {I.pin}<span><strong>{label}</strong><small>{meta}</small></span>
  </button>
  <button type="button" className="mcompact-icon" onClick={onSearch} aria-label="Meklēt pasākumu">{I.search}</button>
  <button type="button" className="mcompact-icon" onClick={onFilters} aria-label={'Filtri'+(filterCount?', ieslēgti '+filterCount:'')}>
   {I.sliders}{filterCount>0&&<span className="msearch-count">{filterCount}</span>}
  </button>
 </div>;
}
