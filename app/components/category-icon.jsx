import {CATEGORY_ICON_PATHS} from '../../lib/category-icons.js';

// Line icons for the event groups in filters and category links, drawn in
// currentColor. The map markers use the same paths (lib/category-icons.js).
export default function CategoryIcon({name,size='1.15em',className='meets-category-icon'}){
 const shape=CATEGORY_ICON_PATHS[name];
 if(!shape)return null;
 return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
  strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
  dangerouslySetInnerHTML={{__html:shape}}/>;
}
