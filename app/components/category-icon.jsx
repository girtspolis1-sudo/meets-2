import {CATEGORY_ICONS} from '../../lib/category-icons.js';

// Line icons for the event groups in filters and category links, drawn in
// currentColor. The map markers use the same shapes (lib/category-icons.js).
const camel=key=>key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());

export default function CategoryIcon({name,size='1.15em',className='meets-category-icon'}){
 const shapes=CATEGORY_ICONS[name];
 if(!shapes)return null;
 return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
  strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
  {shapes.map(([Tag,attrs],i)=><Tag key={i} {...Object.fromEntries(Object.entries(attrs).map(([k,v])=>[camel(k),v]))}/>)}
 </svg>;
}
