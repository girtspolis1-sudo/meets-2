import {ICONS,iconName} from '../../lib/icon-paths.js';

// One line icon from lib/icon-paths.js, drawn in currentColor. Decorative by
// default (aria-hidden); the button or link around it carries the name.
const camel=key=>key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());

export default function Icon({name,size=18,strokeWidth=1.8,className,fill='none'}){
 const shapes=ICONS[iconName(name)];
 return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
  strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
  {shapes.map(([Tag,attrs],i)=><Tag key={i} {...Object.fromEntries(Object.entries(attrs).map(([k,v])=>[camel(k),v]))}/>)}
 </svg>;
}
