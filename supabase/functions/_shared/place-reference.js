// Parsing of the two open data files behind the automatic map points:
// VZD "Vietu centroidi" (towns, villages, parishes) and "Latvijas kultūras
// institūcijas" (kulturasdati.lv). Plain functions, tested in tests/place-reference.test.js.

// RFC 4180 CSV: quoted fields may hold commas, doubled quotes and line breaks.
export function parseCsv(text){
 const rows=[];let row=[],field='',quoted=false;
 const s=String(text||'').replace(/^﻿/,'');
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(quoted){
   if(c==='"'){if(s[i+1]==='"'){field+='"';i++;}else quoted=false;}
   else field+=c;
  }else if(c==='"')quoted=true;
  else if(c===','){row.push(field);field='';}
  else if(c==='\n'||c==='\r'){
   if(c==='\r'&&s[i+1]==='\n')i++;
   row.push(field);field='';
   if(row.length>1||row[0]!=='')rows.push(row);
   row=[];
  }else field+=c;
 }
 if(field!==''||row.length){row.push(field);rows.push(row);}
 return rows;
}

// Rows as objects keyed by the header line.
export function csvObjects(text){
 const [header,...rows]=parseCsv(text);
 if(!header)return [];
 const names=header.map(h=>h.trim());
 return rows.map(r=>Object.fromEntries(names.map((n,i)=>[n,r[i]??''])));
}

const LATVIA={south:55.6,north:58.1,west:20.9,east:28.3};
function coordinate(value){
 const n=Number(String(value??'').trim().replace(',','.'));
 return Number.isFinite(n)&&n!==0?n:null;
}
function inLatviaBox(lat,lon){
 return lat!==null&&lon!==null&&lat>=LATVIA.south&&lat<=LATVIA.north&&lon>=LATVIA.west&&lon<=LATVIA.east;
}

// 104 town, 105 parish, 106 village; municipalities (113) are not places to put a point on.
const CENTROID_TYPES=new Set(['104','105','106']);
// -> [kods, type code, name, std, latitude, longitude]
export function centroidRow(o){
 const lat=coordinate(o.DD_N),lon=coordinate(o.DD_E),name=String(o.NOSAUKUMS||'').trim(),std=String(o.STD||'').trim();
 if(!/^\d+$/.test(o.KODS||'')||!CENTROID_TYPES.has(o.TIPS_CD)||!name||!std||!inLatviaBox(lat,lon))return null;
 return [o.KODS,o.TIPS_CD,name,std,lat,lon];
}

// Sectors whose entries are places an event can happen at. Collectives, artists,
// crafts, awards and administrations share an address with something else or have none.
const VENUE_SECTORS=new Set(['Bibliotēkas','Kultūras centri','Muzeji','Kultūrizglītības iestādes','Pasākumu norišu vietas',
 'Kino izrādīšanas vietas','Teātri','Mākslas saloni un galerijas','Arhīvi']);
// Of the heritage sites only buildings one can name as a venue.
const HERITAGE_KINDS=new Set(['Baznīca, kulta vieta','Pils, muiža']);
// -> [isil, sector, kind, name, address, latitude, longitude, url]
export function institutionRow(o){
 const sector=String(o['Nozare']||'').trim(),kind=String(o['Objekta veids']||'').trim().replace(/\s+/g,' ');
 const name=String(o['Objekta nosaukums']||'').trim().replace(/\s+/g,' '),address=String(o['Adrese']||'').trim();
 const isil=String(o['ISIL kods']||'').trim(),lat=coordinate(o.LAT),lon=coordinate(o.LON);
 if(!isil||!name||!address||!inLatviaBox(lat,lon))return null;
 if(!VENUE_SECTORS.has(sector)&&!(sector==='Kultūrvēsturiskās vietas'&&HERITAGE_KINDS.has(kind)))return null;
 const url=String(o['Objekta URL']||'').trim();
 return [isil,sector,kind,name,address,lat,lon,/^https:\/\/kulturasdati\.lv\//.test(url)?url:''];
}

export function chunks(list,size){
 const out=[];
 for(let i=0;i<list.length;i+=size)out.push(list.slice(i,i+size));
 return out;
}
