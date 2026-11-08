'use client';

// Which sheets to print; the browser's print dialog also saves a PDF.
export default function PrintToolbar({backHref,choices,choice,onChoose}){
 function choose(value){
  if(onChoose)return onChoose(value);
  const url=new URL(window.location.href);
  if(value==='visas')url.searchParams.delete('lapa');else url.searchParams.set('lapa',value);
  window.location.assign(url.pathname+url.search);
 }
 return <div className="flyer-toolbar tn-print-toolbar" role="toolbar" aria-label="Drukāšana">
  <a className="button" href={backHref}>← Atpakaļ</a>
  <label>Lapas<select value={choice} onChange={e=>choose(e.target.value)}>{choices.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  <button type="button" className="button primary" onClick={()=>window.print()}>Drukāt</button>
  <small>A4 · Katrs laukums uz savas lapas. PDF: drukāšanas logā izvēlies “Saglabāt kā PDF”.</small>
 </div>;
}
