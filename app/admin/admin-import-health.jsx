'use client';

function when(value){
 if(!value)return 'Nav datu';
 try{return new Date(value).toLocaleString('lv-LV',{timeZone:'Europe/Riga'});}catch{return String(value);}
}

function statusTone(item){
 if(item.stale||['failed','error','unsupported'].includes(String(item.last_status||'').toLowerCase()))return 'bad';
 if(['complete','completed','imported'].includes(String(item.last_status||'').toLowerCase()))return 'ok';
 return 'warn';
}

export default function AdminImportHealth({health}){
 const sports=Array.isArray(health?.sports)?health.sports:[];
 const municipalities=Array.isArray(health?.municipalities)?health.municipalities:[];
 const staleMunicipalities=municipalities.filter(item=>item.stale||!item.automated);
 const problemSports=sports.filter(item=>item.stale||!item.cron_active||!['complete','completed'].includes(String(item.last_status||'').toLowerCase()));

 return <section className="admin-import-health">
  <div className="admin-overview-panel-head">
   <div><span>Datu avoti</span><h3>Importu veselība</h3></div>
   <span className={'quality-badge '+(problemSports.length||staleMunicipalities.length?'bad':'ok')}>
    {problemSports.length+staleMunicipalities.length} jāpārbauda
   </span>
  </div>

  <div className="import-health-grid">
   <div>
    <h4>Automatizētie sporta avoti</h4>
    <div className="import-health-list">
     {sports.map(item=><article key={item.key}>
      <div><strong>{item.label}</strong><span>{item.cron_active?'Cron aktīvs':'Cron nav aktīvs'}{item.schedule?' · '+item.schedule:''}</span></div>
      <span className={'quality-badge '+statusTone(item)}>{item.stale?'Novecojis':item.last_status||'Nav statusa'}</span>
      <small>Pēdējais mēģinājums: {when(item.last_attempt_at)}<br/>Pēdējā veiksmīgā izpilde: {when(item.last_success_at)}</small>
      <small>Ielādēti: {item.imported_count??'—'} · jauni: {item.added_count??'—'} · mainīti: {item.updated_count??'—'} · izlaisti: {item.skipped_count??'—'}</small>
      {item.error&&<small className="import-error">{item.error}</small>}
     </article>)}
    </div>
   </div>

   <div>
    <h4>Pašvaldību TVP avoti</h4>
    <p className="sync-text">Pašreiz nav regulāra TVP Cron/importētāja pirmkoda. Šie avoti tiek rādīti kā neautomatizēti, lai vēsturisko importu nevarētu sajaukt ar dzīvu sinhronizāciju.</p>
    <div className="import-health-list municipality-health">
     {municipalities.slice(0,8).map(item=><article key={item.source_id}>
      <div><strong>{item.label}</strong><span>{item.domain}</span></div>
      <span className="quality-badge bad">Nav automatizēts</span>
      <small>Pēdējā zināmā veiksmīgā nolasīšana: {when(item.last_success_at)}</small>
     </article>)}
    </div>
    {municipalities.length>8&&<details><summary>Rādīt visus {municipalities.length} TVP avotus</summary>
     <div className="import-health-list municipality-health expanded">
      {municipalities.slice(8).map(item=><article key={item.source_id}>
       <div><strong>{item.label}</strong><span>{item.domain}</span></div>
       <span className="quality-badge bad">Nav automatizēts</span>
       <small>Pēdējā zināmā veiksmīgā nolasīšana: {when(item.last_success_at)}</small>
      </article>)}
     </div>
    </details>}
   </div>
  </div>
 </section>;
}
