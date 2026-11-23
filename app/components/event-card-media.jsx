'use client';
import {useEffect,useRef,useState} from 'react';
import EventQuickActions from './event-quick-actions.jsx';
import TopicScene from './topic-scenes.jsx';
import {cardImage,isPaidEvent} from '../../lib/discovery-card.js';
import {topicArt} from '../../lib/topic-art.js';
import WhenChip from './when-chip.jsx';
import {priceLabel} from '../../lib/map-nearby.js';
import './event-card.css';

// The top of an event card: the event's picture, or its theme picture
// (topic-art.js, topic-scenes.jsx) drawn in the safe zone between the chip row
// and the band, with the theme or category, the heart, the date chips and the
// title on a dark band. Shared by the grid cards and the map cards. `saved`/`onSave` make the
// heart controlled (the map keeps its own favourites).
export default function EventCardMedia({event,today,title,saved,onSave,className='',heading='h3',noFavorite=false}){
 const Heading=heading;
 const [broken,setBroken]=useState(false),imgRef=useRef(null);
 // An image that failed before hydration never fires onError: check it once mounted.
 useEffect(()=>{const img=imgRef.current;if(img&&img.complete&&!img.naturalWidth)setBroken(true);},[]);
 const image=broken?'':cardImage(event),art=topicArt(event);
 const paid=isPaidEvent(event),price=priceLabel(event);
 return <div className={'ec-media'+(image?' has-photo':' ec-art ec-art-'+art.palette)+(className?' '+className:'')}>
  {image?<img ref={imgRef} src={image} alt="" loading="lazy" decoding="async" onError={()=>setBroken(true)}/>
   :<div className="ec-scene"><TopicScene scene={art.scene} variant={art.variant}/></div>}
  <div className="ec-top">
   <span className="ec-category">{art.label}</span>
   {!noFavorite&&<EventQuickActions event={event} favoriteOnly saved={saved} onSave={onSave}/>}
  </div>
  <div className="ec-band">
   <div className="ec-chips">
    <WhenChip event={event} today={today} className="ec-when"/>
    {paid&&<span className="ec-price" title={price?'Maksas pasākums: '+price:'Maksas pasākums'}>{price||'€'}</span>}
    {event.price_status==='free'&&<span className="ec-price free">Bezmaksas</span>}
   </div>
   <Heading className="ec-title">{title}</Heading>
  </div>
 </div>;
}
