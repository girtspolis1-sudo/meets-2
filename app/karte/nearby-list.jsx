'use client';
import {useEffect,useRef,useState} from 'react';
import {countLabel} from '../../lib/map-nearby.js';
import EventFacts from '../components/event-facts.jsx';
import EventDetailCard from '../components/event-detail-card.jsx';
import EventVenueFavorite from '../components/event-venue-favorite.jsx';

const PAGE=40;
// Phone sheet heights: the header only, half of the map, nearly all of it.
const SHEET_STATES=['peek','half','full'];

function NearbyItem({item,today,clock,saved,highlighted,onSelect,onHover,onFavorite}){
 const {event,km}=item;
 return <li className={'nearby-item'+(highlighted?' is-highlighted':'')} data-event-id={event.id}
  onMouseEnter={()=>onHover(event)} onMouseLeave={()=>onHover(null)}>
  <button type="button" className="nearby-item-main" onClick={()=>onSelect(event)} onFocus={()=>onHover(event)} onBlur={()=>onHover(null)}>
   <EventFacts event={event} today={today} clock={clock} km={km} compact title={<strong className="nearby-title">{event.title}</strong>}/>
  </button>
  <button type="button" className={'nearby-save'+(saved?' saved':'')} aria-pressed={saved} onClick={()=>onFavorite(event.id)}
   aria-label={saved?'Noņemt no saglabātajiem: '+event.title:'Saglabāt: '+event.title} title={saved?'Saglabāts':'Saglabāt'}>
   <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>
  </button>
 </li>;
}

// The events at one map place, shown in the side panel instead of a map popup.
function PlaceView({place,today,clock,distance,activeIds,favorites,onFavorite,onCalendar,onClose,isAdmin,highlightedId}){
 const events=[...place.events].sort((a,b)=>Number(activeIds.has(b.id))-Number(activeIds.has(a.id))||
  String(a.date_from).localeCompare(String(b.date_from))||String(a.time_from||'').localeCompare(String(b.time_from||'')));
 const selected=events.filter(e=>activeIds.has(e.id)).length;
 return <div className="nearby-place" aria-label={'Pasākumi vietā '+place.label}>
  <div className="nearby-place-head">
   <button type="button" className="text-button" onClick={onClose}>← Atpakaļ uz sarakstu</button>
   <div className="nearby-place-title"><h3>{place.label}</h3>{events[0]&&<EventVenueFavorite event={events[0]} compact/>}</div>
   <small>{countLabel(selected)} atbilst filtriem{events.length>selected?' · '+(events.length-selected)+' citi šajā vietā':''}</small>
  </div>
  {events.map(event=><EventDetailCard key={event.id} event={event} today={today} clock={clock} km={distance(event)}
   highlighted={String(event.id)===String(highlightedId)} outside={!activeIds.has(event.id)} isAdmin={isAdmin}
   saved={favorites.has(String(event.id))} onSave={onFavorite} onCalendar={onCalendar}/>)}
 </div>;
}

// Upcoming events near the chosen place, grouped Šodien → Rīt → Nedēļas nogalē → Vēlāk.
// On phones the panel is a sheet over the map that can be dragged between three heights.
export default function NearbyList({groups,total,today,clock,summary,loading,favorites,highlightedId,onSelect,onHover,onFavorite,
 onCalendar,empty,listRef,place=null,onClosePlace,activeIds,distance,isAdmin=false,collapsed=false}){
 const [shown,setShown]=useState(PAGE);
 const [sheet,setSheet]=useState('peek');
 const scrollRef=useRef(null),panelRef=useRef(null),drag=useRef(null);
 useEffect(()=>{setShown(PAGE);scrollRef.current?.scrollTo?.({top:0});},[groups]);
 useEffect(()=>{if(collapsed)setSheet('peek');},[collapsed]);
 useEffect(()=>{scrollRef.current?.scrollTo?.({top:0});},[place?.key]);
 // Bring the event picked on the map into view.
 useEffect(()=>{
  if(!highlightedId||place)return;
  // Only inside a scrolling panel, so the page itself never jumps.
  const box=scrollRef.current,item=box?.querySelector('[data-event-id="'+CSS.escape(String(highlightedId))+'"]');
  if(!box||!item||box.scrollHeight<=box.clientHeight)return;
  const top=item.offsetTop-box.offsetTop-40;
  if(top<box.scrollTop||top+item.offsetHeight>box.scrollTop+box.clientHeight)box.scrollTo({top,behavior:'smooth'});
 },[highlightedId,place]);

 function startDrag(e){
  if(!window.matchMedia('(max-width:1000px)').matches||e.target.closest('button:not(.nearby-handle),a'))return;
  drag.current={y:e.clientY,height:panelRef.current.offsetHeight,target:panelRef.current.offsetHeight,moved:false};
  panelRef.current.classList.add('dragging');
  e.currentTarget.setPointerCapture?.(e.pointerId);
 }
 function moveDrag(e){
  const d=drag.current;if(!d)return;
  const dy=e.clientY-d.y;if(Math.abs(dy)>4)d.moved=true;
  const max=panelRef.current.parentElement.offsetHeight-8;
  d.target=Math.max(72,Math.min(max,d.height-dy));
  panelRef.current.style.height=d.target+'px';
 }
 function endDrag(){
  const d=drag.current;drag.current=null;if(!d)return;
  const panel=panelRef.current;
  panel.classList.remove('dragging');
  if(!d.moved){panel.style.height='';setSheet(s=>s==='peek'?'half':'peek');return;}
  // The intended height, not offsetHeight, which lags behind while the height animates.
  const share=d.target/panel.parentElement.offsetHeight;
  panel.style.height='';
  setSheet(share<.3?'peek':share<.72?'half':'full');
 }
 function step(){setSheet(s=>SHEET_STATES[(SHEET_STATES.indexOf(s)+1)%SHEET_STATES.length]);}

 let left=shown;
 const setRefs=node=>{panelRef.current=node;if(listRef)listRef.current=node;};
 return <aside className={'nearby-panel sheet-'+sheet+(place?' has-place':'')} aria-labelledby="nearby-title" ref={setRefs}>
  <header className="nearby-head" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
   <button type="button" className="nearby-handle" onClick={step} aria-label={sheet==='full'?'Samazināt sarakstu':'Paplašināt sarakstu'}><span aria-hidden="true"/></button>
   <h2 id="nearby-title">{loading?'Ielādē pasākumus…':countLabel(total)}</h2>
   {summary&&<p>{summary}</p>}
  </header>
  <div className="nearby-scroll" ref={scrollRef}>
   {place?<PlaceView place={place} today={today} clock={clock} distance={distance} activeIds={activeIds} favorites={favorites}
     onFavorite={onFavorite} onCalendar={onCalendar} onClose={onClosePlace} isAdmin={isAdmin} highlightedId={highlightedId}/>:<>
    {!loading&&!total&&empty}
    {groups.map(group=>{
     if(left<=0)return null;
     const items=group.items.slice(0,left);left-=items.length;
     return <section key={group.key} className="nearby-group" aria-label={group.label}>
      <h3>{group.label} <span>{group.items.length}</span></h3>
      <ol>{items.map(item=><NearbyItem key={item.event.id} item={item} today={today} clock={clock}
       saved={favorites.has(String(item.event.id))} highlighted={String(item.event.id)===String(highlightedId)}
       onSelect={onSelect} onHover={onHover} onFavorite={onFavorite}/>)}</ol>
     </section>;
    })}
    {total>shown&&<button type="button" className="button nearby-more" onClick={()=>setShown(v=>v+PAGE)}>Rādīt vēl {Math.min(PAGE,total-shown)}</button>}
   </>}
  </div>
 </aside>;
}
