'use client';

// The browser prints the sheet as one A4 page; its print dialog also saves PDF.
export default function FlyerToolbar({backHref}){
 return <div className="flyer-toolbar" role="toolbar" aria-label="Sludinājuma darbības">
  <a className="button" href={backHref}>← Uz pasākumu</a>
  <button type="button" className="button primary" onClick={()=>window.print()}>Drukāt</button>
  <button type="button" className="button" onClick={()=>window.print()}>Saglabāt PDF</button>
  <small>A4 · Lai saglabātu failu, drukāšanas logā kā printeri izvēlies “Saglabāt kā PDF”.</small>
 </div>;
}
