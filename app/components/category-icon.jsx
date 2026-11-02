// Line icons for the event groups in filters and category links: one stroke
// width, 24px grid, drawn in currentColor so they follow the chip's text color.
// Map markers keep their emoji glyphs from lib/event-map-icons.js, because a
// sport-specific symbol on a pin carries more information than a line icon.
const PATHS={
 music:<><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>,
 stage:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></>,
 culture:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></>,
 sport:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
 active:<><path d="M11 20a7 7 0 0 1-1.2-13.9C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.4 5.2-6.1 2.4-.6 4.6-1.4 6.8-3.9"/></>,
 markets:<><path d="M4 4h16l1 6H3z"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 13v7h14v-7"/></>,
 learning:<><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/></>,
 community:<><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M21 20c0-2.5-1.5-4-3.5-4.7"/></>,
 family:<><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></>,
 civic:<><path d="M3 21h18M3 10h18M12 3 3 8v2h18V8z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/></>
};

export default function CategoryIcon({name,size='1.15em',className='meets-category-icon'}){
 const shape=PATHS[name];
 if(!shape)return null;
 return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
  strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shape}</svg>;
}
