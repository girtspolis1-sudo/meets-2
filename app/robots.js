import {SITE_URL,indexingAllowed} from '../lib/seo.js';

// Static: the indexing switch is read at build time.

// https://meets.lv/robots.txt. Private pages are not blocked here: they answer
// with "X-Robots-Tag: noindex" (next.config.mjs), which a crawler can only see
// when it is allowed to fetch them.
export default function robots(){
 if(!indexingAllowed())return {rules:[{userAgent:'*',disallow:'/'}]};
 return {
  rules:[{userAgent:'*',allow:'/',disallow:['/api/','/admin']}],
  sitemap:SITE_URL+'/sitemap.xml',
  host:SITE_URL
 };
}
