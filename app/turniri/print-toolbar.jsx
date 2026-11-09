'use client';

// Which sheets to print; the browser's print dialog also saves a PDF.
export default function PrintToolbar({backHref,choices,choice,onChoose}){
 function choose(value){
  if(onChoose)return onChoose(value);
  const url=new URL(window.location.href);
  if(value==='visas')url.searchParams.delete('lapa');else url.searchParams.set('lapa',value);
  window.location.assign(url.pathname+url.search);
 }
 return <>
  <div className="flyer-toolbar tn-print-toolbar" role="toolbar" aria-label="Drukāšana">
   <a className="button tn-print-back" href={backHref}><span aria-hidden="true">←</span><span className="tn-print-back-text">Atpakaļ</span></a>
   <label><span>Lapas</span><select value={choice} onChange={e=>choose(e.target.value)}>{choices.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <button type="button" className="button primary" onClick={()=>window.print()}>Drukāt</button>
  </div>
  <p className="tn-print-hint">A4 · katrs laukums uz savas lapas; garš grafiks turpinās nākamajā lapā ar virsrakstu. PDF: drukāšanas logā izvēlies “Saglabāt kā PDF”.</p>
 </>;
}
