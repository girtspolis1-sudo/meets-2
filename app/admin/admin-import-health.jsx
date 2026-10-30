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

function municipalityTone(item){
 if(!item.automated||item.stale||item.last_status==='partial')return 'bad';
 return item.last_status==='success'?'ok':'warn';
}
function municipalityLabel(item){
 if(!item.automated)return 'Nav automatizēts';
 if(item.stale)return 'Novecojis';
 if(item.last_status==='partial')return 'Neizdevās, rāda iepriekšējo';
 return item.last_status==='success'?'Ielādēts':'Nav statusa';
}

export default function AdminImportHealth({health}){
 const sports=Array.isArray(health?.sports)?health.sports:[];
 const municipalities=Array.isArray(health?.municipalities)?health.municipalities:[];
 const staleMunicipalities=municipalities.filter(item=>item.stale||!item.automated||item.last_status==='partial');
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
    <h4>Pašvaldību kalendāri</h4>
    <p className="sync-text">Ielādē katru trešdienu; lapas, kas neatbild, tiek pieprasītas atkārtoti. Ja avots neizdodas, paliek iepriekšējā kopija.</p>
    <div className="import-health-list municipality-health">
     {[...municipalities].sort((a,b)=>Number(municipalityTone(a)==='ok')-Number(municipalityTone(b)==='ok')).map(item=><article key={item.source_id}>
      <div><strong>{item.label}</strong><span>{item.domain}</span></div>
      <span className={'quality-badge '+municipalityTone(item)}>{municipalityLabel(item)}</span>
      <small>Pēdējā veiksmīgā ielāde: {when(item.last_success_at)}</small>
      {item.last_status==='partial'&&item.last_error&&<small className="import-error">{item.last_error}</small>}
     </article>)}
    </div>
   </div>
  </div>
 </section>;
}
