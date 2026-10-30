'use client';
import {useEffect,useRef,useState} from 'react';
import {countLabel,distanceLabel,isApproximatePlace,liveBadge,priceLabel,whenLabel} from '../../lib/map-nearby.js';
import {display} from '../../lib/catalog.js';

const PAGE=40;

function NearbyItem({item,today,clock,saved,highlighted,onSelect,onHover,onFavorite}){
 const {event,km}=item;
 const place=[event.venue_name,event.settlement||event.municipality].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
 const category=event.primary_category||display(event,'event_type')||'';
 const price=priceLabel(event);
 const live=liveBadge(event,today,clock);
 const approximate=isApproximatePlace(event);
 return <li className={'nearby-item'+(highlighted?' is-highlighted':'')} data-event-id={event.id}
  onMouseEnter={()=>onHover(event)} onMouseLeave={()=>onHover(null)}>
  <button type="button" className="nearby-item-main" onClick={()=>onSelect(event)} onFocus={()=>onHover(event)} onBlur={()=>onHover(null)}>
   <span className="nearby-when">{whenLabel(event,today)}{live&&<em className={'nearby-live '+live}>{live==='now'?'Notiek tagad':'Drīz sāksies'}</em>}</span>
   <strong className="nearby-title">{event.title}</strong>
   <span className="nearby-place">{[distanceLabel(km),place].filter(Boolean).join(' · ')||'Vieta nav norādīta'}</span>
   {approximate&&<span className="nearby-approx">Precīza vieta nav zināma — kartē rādīts apdzīvotās vietas centrs</span>}
   {(category||price)&&<span className="nearby-tags">{category&&<span>{category}</span>}{price&&<span className={event.price_status==='free'?'free':''}>{price}</span>}</span>}
  </button>
  <button type="button" className={'nearby-save'+(saved?' saved':'')} aria-pressed={saved} onClick={()=>onFavorite(event.id)}
   aria-label={saved?'Noņemt no saglabātajiem: '+event.title:'Saglabāt: '+event.title} title={saved?'Saglabāts':'Saglabāt'}>
   <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>
  </button>
 </li>;
}

// Upcoming events near the chosen place, grouped Šodien → Rīt → Nedēļas nogalē → Vēlāk.
export default function NearbyList({groups,total,today,clock,summary,loading,favorites,highlightedId,onSelect,onHover,onFavorite,empty,listRef}){
 const [shown,setShown]=useState(PAGE);
 const scrollRef=useRef(null);
 useEffect(()=>{setShown(PAGE);scrollRef.current?.scrollTo?.({top:0});},[groups]);
 // Bring the event picked on the map into view.
 useEffect(()=>{
  if(!highlightedId)return;
  // Only inside the side panel; on phones the list is below the map and the page must not jump.
  const box=scrollRef.current,item=box?.querySelector('[data-event-id="'+CSS.escape(String(highlightedId))+'"]');
  if(!box||!item||box.scrollHeight<=box.clientHeight)return;
  const top=item.offsetTop-box.offsetTop-40;
  if(top<box.scrollTop||top+item.offsetHeight>box.scrollTop+box.clientHeight)box.scrollTo({top,behavior:'smooth'});
 },[highlightedId]);
 let left=shown;
 return <aside className="nearby-panel" aria-labelledby="nearby-title" ref={listRef}>
  <header className="nearby-head">
   <h2 id="nearby-title">{loading?'Ielādē pasākumus…':countLabel(total)}</h2>
   {summary&&<p>{summary}</p>}
  </header>
  <div className="nearby-scroll" ref={scrollRef}>
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
  </div>
 </aside>;
}
