// Social profiles of an organizer: the organizer types a link or just
// "@name"; we keep a clean https link per network.
export const SOCIAL_NETWORKS=[
 {key:'facebook',label:'Facebook',host:'facebook.com',placeholder:'facebook.com/jusu-lapa vai @jusu-lapa'},
 {key:'instagram',label:'Instagram',host:'instagram.com',placeholder:'@jusu_konts'},
 {key:'tiktok',label:'TikTok',host:'tiktok.com',placeholder:'@jusu_konts',at:true},
 {key:'youtube',label:'YouTube',host:'youtube.com',placeholder:'@jusu_kanals',at:true},
 {key:'x',label:'X (Twitter)',host:'x.com',placeholder:'@jusu_konts'},
 {key:'linkedin',label:'LinkedIn',host:'linkedin.com',placeholder:'linkedin.com/company/…'}
];
const HOSTS={facebook:['facebook.com','fb.com','m.facebook.com'],instagram:['instagram.com'],tiktok:['tiktok.com'],
 youtube:['youtube.com','youtu.be','m.youtube.com'],x:['x.com','twitter.com'],linkedin:['linkedin.com']};

// "@name", "name", "instagram.com/name" or a full link → "https://instagram.com/name"; '' when unusable.
export function normalizeSocialLink(network,value){
 const def=SOCIAL_NETWORKS.find(n=>n.key===network);
 const raw=String(value||'').trim();
 if(!def||!raw)return '';
 if(/^https?:\/\//i.test(raw)||/^(www\.)?[a-z0-9-]+\.[a-z]{2,}\//i.test(raw)){
  let url;
  try{url=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);}catch{return '';}
  const host=url.hostname.replace(/^www\./,'').toLowerCase();
  if(!HOSTS[network].some(h=>host===h||host.endsWith('.'+h)))return '';
  url.protocol='https:';url.hash='';
  return url.toString().replace(/\/$/,'');
 }
 const handle=raw.replace(/^@/,'');
 if(!/^[A-Za-z0-9._-]{1,80}$/.test(handle))return '';
 return 'https://'+def.host+'/'+(def.at?'@':'')+handle;
}

// [{network,url}] for the networks that have a usable link, in the fixed order.
export function cleanSocialLinks(values){
 const map=Array.isArray(values)?Object.fromEntries(values.map(v=>[v?.network,v?.url])):(values||{});
 return SOCIAL_NETWORKS.map(n=>({network:n.key,url:normalizeSocialLink(n.key,map[n.key])})).filter(x=>x.url);
}

export function socialLabel(network){return SOCIAL_NETWORKS.find(n=>n.key===network)?.label||network;}
