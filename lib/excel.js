import { columns, detailColumns, display } from './catalog.js';
export async function createWorkbook(events, fetchedAt) {
 const {default:ExcelJS} = await import('exceljs');
 const workbook = new ExcelJS.Workbook();
 workbook.creator='MEETS 2';
 const sheet=workbook.addWorksheet('Pasākumi',{views:[{state:'frozen',ySplit:1}]});
 const all=[...columns,...detailColumns];
 sheet.columns=all.map(([key,header,width])=>({key,header,width}));
 for(const e of events) sheet.addRow(Object.fromEntries(all.map(([key])=>{
   const date=(key==='date_from'||key==='date_to')&&e[key];
   return [key,date ? new Date(`${date}T00:00:00Z`) : display(e,key)];
 })));
 for(const key of ['date_from','date_to']) sheet.getColumn(key).numFmt='dd.mm.yyyy';
 sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,events.length+1),column:all.length}};
 sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
 sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF203D2A'}};
 sheet.getRow(1).height=32;
 sheet.eachRow(row=>{row.alignment={vertical:'top',wrapText:true};});
 // Values are strings, never formula objects, including strings beginning with =,+,-,@.
 const info=workbook.addWorksheet('Informācija');
 info.columns=[{width:30},{width:90}];
 info.addRows([['Avots','MEETS 2 / Supabase'],['Dati ielādēti',fetchedAt],['Eksportēti ieraksti',events.length],['Atlase','Visi atlasītie ieraksti, ne tikai pašreizējā tabulas lapa.'],['Statuss','Jāpārbauda: dati vēl nav apstiprināti. Pārbaudi informāciju pasākuma avotā.']]);
 return workbook.xlsx.writeBuffer();
}
