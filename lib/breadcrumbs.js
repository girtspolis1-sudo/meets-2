// Navigation trails for event and listing pages, and their schema.org BreadcrumbList.
import {HOME_CATEGORY_FILTERS} from './home-category-filters.js';
import {listingPath} from './event-listings.js';
import {SITE_URL,eventPath,municipalityShortName,municipalitySlug} from './seo.js';

const START=[{name:'Sākums',path:'/'},{name:'Pasākumi',path:'/pasakumi'}];

// Sākums › Pasākumi › Rīga › <event>
export function eventCrumbs(event){
 const items=[...START];
 const slug=municipalitySlug(event?.municipality);
 if(slug)items.push({name:municipalityShortName(event.municipality),path:'/pasakumi/'+slug});
 items.push({name:String(event?.title||'Pasākums'),path:eventPath(event)});
 return items;
}

// Sākums › Pasākumi › [Sports | Mūzika un dejas | Rīga] › <this listing>
export function listingCrumbs({municipality=null,category='',time='',league=null,heading,path}){
 const items=[...START];
 // A league page sits under the sports page (/pasakumi/sports).
 if(league)items.push({name:HOME_CATEGORY_FILTERS.sport.title,path:'/pasakumi/sports'});
 else if(category&&municipality)items.push({name:HOME_CATEGORY_FILTERS[category]?.title||category,path:listingPath({category})});
 else if(municipality&&time)items.push({name:municipalityShortName(municipality.name),path:listingPath({municipalitySlug:municipality.slug})});
 items.push({name:heading,path});
 return items;
}

export function breadcrumbJsonLd(items){
 return {'@context':'https://schema.org','@type':'BreadcrumbList',
  itemListElement:items.map((item,i)=>({'@type':'ListItem',position:i+1,name:item.name,item:SITE_URL+item.path}))};
}
