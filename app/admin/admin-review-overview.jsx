'use client';

function dateText(value){
 if(!value)return '—';
 const d=new Date(value+'T12:00:00');
 return new Intl.DateTimeFormat('lv-LV',{day:'2-digit',month:'2-digit'}).format(d);
}

export default function AdminReviewOverview({
 events,
 mappingGroups,
 mappingsCount,
 counts,
 onOpenMapping,
 onOpenAll,
 onEditEvent,
 onPublish
}){
 const pending=events
  .filter(event=>event.status==='pending_review')
  .sort((a,b)=>String(a.date_from||'').localeCompare(String(b.date_from||'')))
  .slice(0,8);

 const mappingTop=mappingGroups.slice(0,8);

 return <div className="admin-overview">
  <div className="admin-overview-kpis">
   <article><span>Visi pasākumi</span><strong>{events.length}</strong><button type="button" onClick={onOpenAll}>Atvērt</button></article>
   <article><span>Gaida apstiprināšanu</span><strong>{counts.byStatus.pending_review||0}</strong></article>
   <article className="attention"><span>Neatpazītas vietas</span><strong>{mappingGroups.length}</strong><button type="button" onClick={onOpenMapping}>Mapping</button></article>
   <article><span>Saglabāti mappingi</span><strong>{mappingsCount}</strong></article>
  </div>

  <div className="admin-overview-grid">
   <section className="admin-overview-panel">
    <div className="admin-overview-panel-head">
     <div><span>Apstiprināšana</span><h3>Gaida pārbaudi</h3></div>
     <button type="button" className="text-button" onClick={onOpenAll}>Visi pasākumi</button>
    </div>
    <div className="admin-review-list">
     {pending.length?pending.map(event=><div className="admin-review-row" key={event.id}>
      <div className="admin-review-date">{dateText(event.date_from)}</div>
      <div className="admin-review-main">
       <strong>{event.title}</strong>
       <span>{event.venue_name||event.address_raw||event.municipality||'Vieta nav noteikta'}</span>
      </div>
      <div className="admin-review-action">
       {event.location_quality==='verified_exact'
        ?<button type="button" className="button primary compact" onClick={()=>onPublish(event)}>Publicēt</button>
        :<button type="button" className="button compact" onClick={()=>onEditEvent(event)}>Labot vietu</button>}
      </div>
     </div>):<p className="admin-empty-inline">Nav pasākumu, kas gaida apstiprināšanu.</p>}
    </div>
   </section>

   <section className="admin-overview-panel">
    <div className="admin-overview-panel-head">
     <div><span>Adrešu kvalitāte</span><h3>Biežākie neatpazītie nosaukumi</h3></div>
     <button type="button" className="text-button" onClick={onOpenMapping}>Visi mappingi</button>
    </div>
    <div className="admin-review-list">
     {mappingTop.length?mappingTop.map(group=><div className="admin-review-row" key={group.key}>
      <div className="admin-review-count">{group.events.length}×</div>
      <div className="admin-review-main">
       <strong>{group.alias||'Nav vietas/adreses'}</strong>
       <span>{[group.municipality,group.countryCode].filter(Boolean).join(' · ')||'Konteksts nav noteikts'}</span>
      </div>
      <div className="admin-review-action">
       <button type="button" className="button compact" onClick={()=>group.alias?onOpenMapping(group):onEditEvent(group.events[0])}>
        {group.alias?'Mapping':'Labot'}
       </button>
      </div>
     </div>):<p className="admin-empty-inline">Visām vietām ir verificēta lokācija.</p>}
    </div>
   </section>
  </div>
 </div>;
}
