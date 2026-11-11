// Street addresses in the text of an event's source page (step 4 of the automatic
// map points). The text is only searched with a fixed pattern; whether an address
// is real, where it is and whether it fits the event is decided in the database
// against the State Address Register. Tested in tests/source-address.test.js.

const ENTITIES={amp:'&',nbsp:' ',quot:'"',apos:"'",lt:'<',gt:'>',ndash:'–',mdash:'—'};
export function pageText(html){
 return String(html||'')
  // Parts that repeat on every page of a site or are not text.
  .replace(/<(script|style|noscript|template|svg|nav|header|footer|form|select|iframe)\b[\s\S]*?<\/\1\s*>/gi,' ')
  .replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/td|\/dd|\/dt|\/address)\b[^>]*>/gi,'\n')
  .replace(/<[^>]+>/g,' ')
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
  .replace(/&([a-z]+);/gi,(m,n)=>ENTITIES[n.toLowerCase()]??' ')
  .replace(/[ \t ]+/g,' ')
  .replace(/\s*\n\s*/g,'\n')
  .trim();
}

const STREET='iela|ielā|gatve|gatvē|bulvāris|bulvārī|prospekts|prospektā|laukums|laukumā|šoseja|šosejā|aleja|alejā|krastmala|krastmalā';
const WORD="[A-ZĀČĒĢĪĶĻŅŠŪŽ0-9][A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9.'’-]*";
// Up to three capitalised words, the street word, the house number, and up to two
// following comma-separated parts on the same line (they usually name the town).
const ADDRESS=new RegExp('((?:'+WORD+' ){1,3}(?:'+STREET+') \\d+(?: ?[A-Za-z](?![A-Za-zĀ-ž0-9]))?(?: ?[/-] ?\\d+[A-Za-z]?(?![A-Za-zĀ-ž0-9]))?)((?:, ?[^,\\n]{2,40}){0,2})','g');

export function extractAddresses(html,limit=8){
 const found=[],seen=new Set();
 for(const m of pageText(html).matchAll(ADDRESS)){
  const tail=m[2].split(',').map(x=>x.trim()).filter(x=>x&&x.length<=40&&!/[.!?:;()@]|https?/i.test(x)&&!/^\d/.test(x)&&!/^LV-?\d{4}$/i.test(x));
  const address=[m[1].trim(),...tail].join(', ');
  const key=m[1].toLocaleLowerCase('lv').replace(/\s+/g,' ');
  if(seen.has(key))continue;
  seen.add(key);found.push(address);
  if(found.length>=limit)break;
 }
 return found;
}

// Only ordinary public web pages are fetched.
export function fetchableUrl(value){
 let url;
 try{url=new URL(String(value||''));}catch{return null;}
 if(url.protocol!=='https:'&&url.protocol!=='http:')return null;
 const host=url.hostname.toLowerCase();
 if(!host.includes('.')||/^[\d.]+$/.test(host)||host.includes(':')||/(^|\.)(localhost|local|internal|lan)$/.test(host))return null;
 if(url.username||url.password||(url.port&&!['80','443'].includes(url.port)))return null;
 return url.href;
}
