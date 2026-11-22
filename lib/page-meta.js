// Canonical address and Open Graph for one page. Next.js replaces the layout's openGraph
// as a whole, so the site name, locale and default picture are repeated here.
export const SITE_NAME='MEETS';
export const DEFAULT_OG_IMAGE={url:'/og',width:1200,height:630};

export function pageMeta(path,{title,description,images,type='website'}={}){
 const openGraph={type,siteName:SITE_NAME,locale:'lv_LV',url:path,images:images||[DEFAULT_OG_IMAGE]};
 if(title)openGraph.title=title;
 if(description)openGraph.description=description;
 return {alternates:{canonical:path},openGraph};
}
