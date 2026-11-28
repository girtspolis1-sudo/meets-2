// The one line-icon family of meets.lv: 24px grid, stroke = currentColor,
// no fills. Shapes are element lists ([tag, attributes]) so React renders real
// elements (app/components/icon.jsx) and HTML strings (map markers, admin
// popups) get the same markup from iconSvg(). The event groups come from
// lib/category-icons.js, so a filter chip, a tile and a map pin share a shape.
import {CATEGORY_ICONS} from './category-icons.js';

const P=d=>['path',{d}];
const C=(cx,cy,r)=>['circle',{cx:String(cx),cy:String(cy),r:String(r)}];
const R=(x,y,width,height,rx)=>['rect',{x:String(x),y:String(y),width:String(width),height:String(height),...(rx?{rx:String(rx)}:{})}];

// Interface: actions, navigation and small marks.
const UI={
 heart:[P('M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z')],
 calendar:[R(3,5,18,16,2),P('M7 3v4M17 3v4M3 10h18')],
 'calendar-check':[R(3,5,18,16,2),P('M7 3v4M17 3v4M3 10h18m-12 6 2 2 4-5')],
 route:[P('m5 18 2.5-7 12-7-5.7 15-3.8-5-5 4Z'),P('m10 14 9.5-10')],
 'calendar-add':[R(3,5,18,16,2),P('M7 3v4M17 3v4M3 10h18M12 13v5M9.5 15.5h5')],
 pin:[P('M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z'),C(12,10,2.8)],
 external:[P('M13 5h6v6M19 5l-9 9'),P('M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5')],
 list:[R(3,4,18,16,2),P('M8 9h10M8 14h10M5 9h.01M5 14h.01')],
 share:[C(18,5,2.2),C(6,12,2.2),C(18,19,2.2),P('m8 11 8-5m-8 8 8 4')],
 search:[C(11,11,6),P('m16 16 4 4')],
 map:[P('M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z'),P('M9 4v14M15 6v14')],
 sliders:[P('M4 6h10M18 6h2M4 12h2M10 12h10M4 18h6M14 18h6'),C(16,6,2),C(8,12,2),C(12,18,2)],
 locate:[C(12,12,4),C(12,12,8),P('M12 2v2M12 20v2M2 12h2M20 12h2')],
 close:[P('M6 6l12 12M18 6 6 18')],
 check:[P('m5 12.5 4.5 4.5L19 7')],
 plus:[P('M12 5v14M5 12h14')],
 'chevron-down':[P('m6 9 6 6 6-6')],
 edit:[P('M4 20h4L19 9l-4-4L4 16Z'),P('m13.5 6.5 4 4')],
 home:[P('M4 10.2 12 4l8 6.2V19a1.5 1.5 0 0 1-1.5 1.5H15v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5H5.5A1.5 1.5 0 0 1 4 19Z')],
 user:[C(12,8,4),P('M4.5 20.5c.6-3.8 3.4-5.8 7.5-5.8s6.9 2 7.5 5.8')],
 bell:[P('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9'),P('M10.3 21a1.9 1.9 0 0 0 3.4 0')],
 grid:[R(3,3,7,7,1.5),R(14,3,7,7,1.5),R(3,14,7,7,1.5),R(14,14,7,7,1.5)],
 spark:[P('M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z')],
 lock:[R(5,11,14,10,2),P('M8 11V8a4 4 0 0 1 8 0v3')],
 globe:[C(12,12,9),P('M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z')],
 eye:[P('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z'),C(12,12,3)],
 copy:[R(8,8,12,12,2),P('M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2')],
 phone:[P('M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2')],
 mail:[R(3,5,18,14,2),P('m3 7 9 6 9-6')],
 alert:[P('M12 3 2 20h20Z'),P('M12 10v4M12 17h.01')],
 text:[R(4,4,16,16,3),P('M8 9h8M8 13h8M8 17h5')],
 tag:[P('M3 12V4h8l9 9-8 8-9-9Z'),C(7.5,8.5,1.3)],
 ticket:[P('M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Z'),['path',{d:'M14 7v10','stroke-dasharray':'2 2'}]],
 repeat:[P('M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3')],
 image:[R(3,5,18,14,3),C(9,10,1.8),P('m21 16-5-5-8 8')],
 flyer:[P('M6 3h9l4 4v14H6Z'),P('M14 3v5h5M9 13h7M9 17h5')]
};

// Sports: the federations meets.lv imports first, then other named activities.
const SPORT={
 basketball:[C(12,12,9),P('M3 12h18M12 3v18'),P('M5.6 5.6c3.4 3.4 3.4 9.4 0 12.8M18.4 5.6c-3.4 3.4-3.4 9.4 0 12.8')],
 football:CATEGORY_ICONS.sport,
 volleyball:[C(12,12,9),P('M12 12c0-4 1.6-7 4.3-8.5'),P('M12 12c3.5 2 6.8 2.3 8.8 1'),P('M12 12c-3.5 2-5.6 5.2-5.8 8.3'),P('M7.3 4.4c1.5 3.4 4.7 5.6 4.7 7.6')],
 handball:[C(15,4,2),P('m14 7.5-3 5.5 3.5 3-1.5 5'),P('m14 8 4.5-2.5'),P('m11 13-5 1'),P('m14.5 16 3 3'),C(20.5,4,1.6)],
 hockey:[P('M5 3l7.2 14.5H17'),P('M19 3l-7.2 14.5H7'),P('M8.5 20.5c0 .9 1.6 1.5 3.5 1.5s3.5-.6 3.5-1.5S13.9 19 12 19s-3.5.6-3.5 1.5Z')],
 floorball:[P('M8 3l6 14h6'),C(7,18,3),P('M6 17h.01M8 19h.01M7.5 16.5h.01')],
 tennis:[P('M15.5 3a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z'),P('M11.6 12.4 4 20'),P('M12.5 6.5l6 6M18.5 6.5l-6 6'),C(5.5,6,1.8)],
 'table-tennis':[C(14,10,6),P('M9.8 14.2 5 19'),C(19.5,19.5,1.5)],
 swimming:[C(17,6,2),P('M3 13l5-4 3 3 4-2'),P('M2 18c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5')],
 running:[C(15,4,2),P('M13.5 8 10 12l4 3-2 6'),P('M10 12l-4.5 1'),P('M13.5 8l3.5 2.5 3-1'),P('m14 15 4.5 1.5')],
 cycling:[C(6,17,3.5),C(18,17,3.5),P('M6 17l4-7h6l2 7'),P('M10 10l3 7H6'),P('M14.5 7H17')],
 skiing:[C(14,4,2),P('M3 18.5 21 14'),P('m13 8-2.5 5 4 2-1 2.5'),P('M10.5 13 8 9'),P('M8 9.5 6 17')],
 skating:[P('M5 4h5v6l7 2.2a3 3 0 0 1 2.5 3V17H5Z'),P('M4 20.5h16')],
 boxing:[P('M7 9a5 5 0 0 1 10 0v4a4 4 0 0 1-4 4H9a2 2 0 0 1-2-2Z'),P('M7 12h5'),P('M8 17v3.5h7V17')],
 martial:[C(12,4,2),P('M5 9h14'),P('M12 6.5V14l-4 7M12 14l4 7'),P('M10 12h4')],
 gymnastics:[C(12,4,2),P('M5 4l7 4 7-4'),P('M12 8v6l-4 7M12 14l4 7')],
 weightlifting:[P('M3 12h18'),P('M6 8v8M18 8v8M4 10v4M20 10v4')],
 rowing:[P('M2 16c3 2.2 17 2.2 20 0'),P('M5 5l13 13'),P('M3.5 3.5 6 6.5M17 17l3 3')],
 sailing:[P('M12 3v14'),P('M12 4l7 11h-7'),P('M11 7l-6 8h6'),P('M3 18c3 2.2 15 2.2 18 0')],
 golf:[P('M12 18V3l7 3-7 3'),P('M6 19c0 1.1 2.7 2 6 2s6-.9 6-2-2.7-2-6-2')],
 chess:[P('M7 21h10'),P('M8 21c0-3 1.2-5 3.2-6.4-1.6 0-3.2.3-4-1.1 0-2.2 2.3-4.3 4.6-6.8L12.5 4c3.2 1.2 4.8 4.2 4.8 8V21')],
 darts:[C(12,12,9),C(12,12,5),C(12,12,1)],
 motorsport:[P('M5 21V4'),P('M5 4h14v9H5'),P('M9 4v9M13 4v9M5 8.5h14')],
 baseball:[C(12,12,9),P('M6.2 5.5c2 2.2 2 10.8 0 13M17.8 5.5c-2 2.2-2 10.8 0 13')],
 rugby:[P('M4.5 19.5c-2-2-1.5-8 3-12.5S18 2.5 20 4.5s1.5 8-3 12.5-10.5 4.5-12.5 2.5Z'),P('m8.5 15.5 7-7M10 11l3 3M12 9l3 3')],
 badminton:[P('M8 16 4 20'),P('M8 16l2.5-7.5L20 4l-4.5 9.5Z'),P('M10.5 8.5 15.5 13')]
};

// Topics read from a category or title (lib/event-map-icons.js eventTopicIcon).
const TOPIC={
 event:CATEGORY_ICONS.event,
 flag:[P('M5 21V4'),P('M5 4h14v4H5M5 8h14v4H5')],
 candle:[R(9,10,6,11,1),P('M12 10V8'),P('M12 3c1.2 1.4 1.5 2.6.8 3.6-.6.8-2 .6-2.2-.6-.2-1 .4-2 1.4-3Z')],
 tree:[P('M12 3 6 11h3l-4 6h14l-4-6h3Z'),P('M12 17v4')],
 church:[P('M12 2v4M10 4h4'),P('M7 21V11l5-4 5 4v10'),P('M4 21h16'),P('M10 21v-4a2 2 0 0 1 4 0v4')],
 drop:[P('M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z')],
 book:[P('M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z'),P('M4 21h15')],
 film:[R(3,5,18,14,2),P('M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4')],
 trophy:[P('M8 4h8v5a4 4 0 0 1-8 0Z'),P('M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4'),P('M12 13v4M8 21h8M9 17h6')]
};

export const ICONS={...UI,...SPORT,...TOPIC,...CATEGORY_ICONS};
export const SPORT_ICON_NAMES=Object.keys(SPORT);

export function iconName(name){return Object.hasOwn(ICONS,name||'')?name:'event';}

const attr=v=>String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
// Markup for places that build HTML strings (Leaflet markers, admin popups).
export function iconSvg(name,size=22,strokeWidth=1.9){
 const shapes=ICONS[iconName(name)];
 return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+strokeWidth+
  '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+
  shapes.map(([tag,attrs])=>'<'+tag+Object.entries(attrs).map(([k,v])=>' '+k+'="'+attr(v)+'"').join('')+'></'+tag+'>').join('')+'</svg>';
}
