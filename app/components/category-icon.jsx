import {CATEGORY_ICONS} from '../../lib/category-icons.js';
import Icon from './line-icon.jsx';

// Line icons for the event groups in filters and category links, drawn in
// currentColor: the shared icon set (lib/icon-paths.js), limited to the groups.
// The map markers use the same shapes.
export default function CategoryIcon({name,size='1.15em',className='meets-category-icon'}){
 if(!CATEGORY_ICONS[name])return null;
 return <Icon name={name} size={size} strokeWidth={1.9} className={className}/>;
}
