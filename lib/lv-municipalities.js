// Latvia's 43 local governments (36 novadi + 7 valstspilsētas) as the map search uses them:
// the name exactly as events carry it in `municipality`, a short tile label, the region and a
// place on the schematic tile map (10 columns × 5 rows, west → east, north → south).

export const REGIONS=[
 {key:'pieriga',title:'Rīga un Pierīga'},
 {key:'vidzeme',title:'Vidzeme'},
 {key:'kurzeme',title:'Kurzeme'},
 {key:'zemgale',title:'Zemgale'},
 {key:'latgale',title:'Latgale'}
];

// [name, short, region, col, row]
const ROWS=[
 ['Ventspils valstspilsēta','Ventspils','kurzeme',0,0],
 ['Talsu novads','Talsi','kurzeme',1,0],
 ['Saulkrastu novads','Saulkrasti','pieriga',3,0],
 ['Ādažu novads','Ādaži','pieriga',4,0],
 ['Limbažu novads','Limbaži','vidzeme',5,0],
 ['Valmieras novads','Valmiera','vidzeme',6,0],
 ['Valkas novads','Valka','vidzeme',7,0],
 ['Alūksnes novads','Alūksne','vidzeme',8,0],
 ['Ventspils novads','Ventspils nov.','kurzeme',0,1],
 ['Tukuma novads','Tukums','kurzeme',1,1],
 ['Jūrmalas valstspilsēta','Jūrmala','pieriga',2,1],
 ['Rīgas valstspilsēta','Rīga','pieriga',3,1],
 ['Ropažu novads','Ropaži','pieriga',4,1],
 ['Siguldas novads','Sigulda','pieriga',5,1],
 ['Cēsu novads','Cēsis','vidzeme',6,1],
 ['Smiltenes novads','Smiltene','vidzeme',7,1],
 ['Gulbenes novads','Gulbene','vidzeme',8,1],
 ['Balvu novads','Balvi','latgale',9,1],
 ['Kuldīgas novads','Kuldīga','kurzeme',0,2],
 ['Saldus novads','Saldus','kurzeme',1,2],
 ['Mārupes novads','Mārupe','pieriga',2,2],
 ['Ķekavas novads','Ķekava','pieriga',3,2],
 ['Salaspils novads','Salaspils','pieriga',4,2],
 ['Ogres novads','Ogre','pieriga',5,2],
 ['Madonas novads','Madona','vidzeme',6,2],
 ['Varakļānu novads','Varakļāni','latgale',7,2],
 ['Rēzeknes valstspilsēta','Rēzekne','latgale',8,2],
 ['Ludzas novads','Ludza','latgale',9,2],
 ['Liepājas valstspilsēta','Liepāja','kurzeme',0,3],
 ['Dobeles novads','Dobele','zemgale',1,3],
 ['Olaines novads','Olaine','pieriga',2,3],
 ['Jelgavas valstspilsēta','Jelgava','zemgale',3,3],
 ['Bauskas novads','Bauska','zemgale',4,3],
 ['Aizkraukles novads','Aizkraukle','zemgale',5,3],
 ['Jēkabpils novads','Jēkabpils','zemgale',6,3],
 ['Līvānu novads','Līvāni','latgale',7,3],
 ['Rēzeknes novads','Rēzeknes nov.','latgale',8,3],
 ['Dienvidkurzemes novads','Dienvidkurzeme','kurzeme',0,4],
 ['Jelgavas novads','Jelgavas nov.','zemgale',3,4],
 ['Augšdaugavas novads','Augšdaugava','latgale',6,4],
 ['Preiļu novads','Preiļi','latgale',7,4],
 ['Daugavpils valstspilsēta','Daugavpils','latgale',8,4],
 ['Krāslavas novads','Krāslava','latgale',9,4]
];
export const TILE_COLUMNS=10,TILE_ROWS=5;

export function slugify(value){
 return String(value||'').toLocaleLowerCase('lv').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
export const MUNICIPALITIES=ROWS.map(([name,short,region,col,row])=>({name,short,region,col,row,slug:slugify(name),kind:name.endsWith('valstspilsēta')?'city':'novads'}));
const BY_NAME=new Map(MUNICIPALITIES.map(m=>[m.name,m]));
export function municipalityByName(name){return BY_NAME.get(String(name||'').trim())||null;}
export function regionTitle(key){return REGIONS.find(r=>r.key===key)?.title||'';}

// ?municipality= keeps one name or several separated by commas; old links with one name still work.
export function parseMunicipalityParam(value){
 return [...new Set(String(value||'').split(',').map(v=>v.trim()).filter(Boolean))];
}
export function municipalityParam(list){return [...new Set((list||[]).filter(Boolean))].join(',');}

// How many events each known local government has.
export function municipalityCounts(events){
 const counts=new Map();
 for(const e of events||[]){
  const m=municipalityByName(e?.municipality);
  if(m)counts.set(m.name,(counts.get(m.name)||0)+1);
 }
 return counts;
}

// Heat level 1–4 by rank among the local governments that have events (0 = none), so Rīga's
// large number does not make every other tile look empty.
export function heatLevels(counts){
 const levels=new Map();
 const values=[...counts.values()].filter(n=>n>0).sort((a,b)=>a-b);
 for(const [name,n] of counts){
  if(!(n>0)){levels.set(name,0);continue;}
  const below=values.filter(v=>v<n).length;
  levels.set(name,values.length<2?4:1+Math.min(3,Math.floor(below/values.length*4)));
 }
 return levels;
}

// The smaller place inside a local government an event belongs to: its settlement, else the
// parish (pagasts) or town written in the address just before the novads.
export function areaOf(event){
 const settlement=String(event?.settlement||'').trim();
 if(settlement)return settlement;
 const parts=String(event?.address_raw||'').split(',').map(p=>p.trim()).filter(Boolean);
 const parish=parts.find(p=>/ pagasts$/i.test(p));
 if(parish)return parish;
 const at=parts.findIndex(p=>/ (novads|nov\.)$/i.test(p)||/ valstspilsēta$/i.test(p));
 if(at>0){
  const before=parts[at-1];
  if(before&&!/\d/.test(before))return before;
 }
 return '';
}

// Events of one local government grouped by area, with a centre point for the map circle.
export function areaGroups(events){
 const groups=new Map();
 for(const e of events||[]){
  const name=areaOf(e)||'Citur';
  const lat=e.latitude==null||e.latitude===''?NaN:Number(e.latitude),lon=e.longitude==null||e.longitude===''?NaN:Number(e.longitude);
  const g=groups.get(name)||{name,count:0,latSum:0,lonSum:0,points:0};
  g.count++;
  if(Number.isFinite(lat)&&Number.isFinite(lon)){g.latSum+=lat;g.lonSum+=lon;g.points++;}
  groups.set(name,g);
 }
 return [...groups.values()].map(g=>({name:g.name,count:g.count,lat:g.points?g.latSum/g.points:null,lon:g.points?g.lonSum/g.points:null}))
  .sort((a,b)=>(a.name==='Citur')-(b.name==='Citur')||b.count-a.count||a.name.localeCompare(b.name,'lv'));
}
