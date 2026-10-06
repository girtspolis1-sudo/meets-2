import {columns,detailColumns,display} from './catalog.js';

function styleSheet(sheet){
 sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
 sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF203D2A'}};
 sheet.getRow(1).height=32;
 sheet.eachRow(row=>{row.alignment={vertical:'top',wrapText:true};});
}

function dateValue(event,key){
 const value=event[key];
 return value&&/^\d{4}-\d{2}-\d{2}$/.test(String(value))
  ?new Date(`${value}T00:00:00Z`)
  :display(event,key);
}

export async function createWorkbook(events,fetchedAt){
 const {default:ExcelJS}=await import('exceljs');
 const workbook=new ExcelJS.Workbook();
 workbook.creator='MEETS 2';

 // Stable, decision-friendly base sheet. Extended metadata is intentionally kept separate.
 const sheet=workbook.addWorksheet('Pasākumi',{views:[{state:'frozen',ySplit:1}]});
 sheet.columns=columns.map(([key,header,width])=>({key,header,width}));
 for(const event of events){
  sheet.addRow(Object.fromEntries(columns.map(([key])=>[
   key,
   key==='date_from'||key==='date_to'?dateValue(event,key):display(event,key)
  ])));
 }
 for(const key of ['date_from','date_to'])sheet.getColumn(key).numFmt='dd.mm.yyyy';
 sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,events.length+1),column:columns.length}};
 styleSheet(sheet);

 const details=workbook.addWorksheet('Detaļas',{views:[{state:'frozen',ySplit:1}]});
 const detailSheetColumns=[
  ['event_id','Event ID',38],
  ['event_title','Pasākums',55],
  ...detailColumns
 ];
 details.columns=detailSheetColumns.map(([key,header,width])=>({key,header,width}));
 for(const event of events){
  const row={event_id:String(event.id||''),event_title:String(event.title||'')};
  for(const [key] of detailColumns)row[key]=display(event,key);
  details.addRow(row);
 }
 details.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,events.length+1),column:detailSheetColumns.length}};
 styleSheet(details);

 // Values are always plain strings/dates, never formula objects, including strings beginning with =,+,-,@.
 const info=workbook.addWorksheet('Informācija');
 info.columns=[{width:30},{width:90}];
 info.addRows([
  ['Avots','MEETS 2 / Supabase'],
  ['Dati ielādēti',fetchedAt],
  ['Eksportēti ieraksti',events.length],
  ['Atlase','Visi atlasītie ieraksti, ne tikai pašreizējā tabulas lapa.'],
  ['Pasākumi','Stabila pamatkolonnu kopa ikdienas atlasei un analīzei.'],
  ['Detaļas','Papildu apraksts, turnīra metadati, koordinātas un tehniskā informācija; sasaisti pēc Event ID.'],
  ['Statuss','Eksportā iekļauti publiskajā katalogā pieejamie ieraksti. Pārbaudi būtisku informāciju norādītajā avotā.']
 ]);
 return workbook.xlsx.writeBuffer();
}
