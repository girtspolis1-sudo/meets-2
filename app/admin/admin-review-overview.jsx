'use client';

function dateText(value){
 if(!value)return '—';
 const d=new Date(value+'T12:00:00');
 return new Intl.DateTimeFormat('lv-LV',{day:'2-digit',month:'2-digit'}).format(d);
}
function dateRangeText(event){
 const from=dateText(event.date_from);
 const to=event.date_to&&event.date_to!==event.date_from?dateText(event.date_to):'';
 return to?from+'–'+to:from;
}

function EventRow({event,actionLabel,onAction,tone='default'}){
 return <div className={'admin-review-row '+(tone==='ok'?'review-ok':tone==='bad'?'review-bad':'')}>
  <div className="admin-review-date">{dateRangeText(event)}</div>
  <div className="admin-review-main">
   <strong>{event.title}</strong>
   <span>{event.venue_name||event.address_raw||event.municipality||'Vieta nav noteikta'}</span>
  </div>
  <div className="admin-review-action">
   <button type="button" className={tone==='ok'?'button compact':'button primary compact'} onClick={()=>onAction(event)}>{actionLabel}</button>
  </div>
 </div>;
}

export default function AdminReviewOverview({
 events,
 readyToPublish,
 publishedNeedsReview,
 publishedOk,
 mappingGroups,
 mappingsCount,
 onOpenMapping,
 onOpenAll,
 onEditEvent,
 onPublish
}){
 const ready=readyToPublish.slice(0,8);
 const problems=publishedNeedsReview.slice(0,8);
 const mappingTop=mappingGroups.slice(0,6);

 return <div className="admin-overview">
  <div className="admin-overview-kpis admin-overview-kpis-five">
   <article><span>Aktuālie pasākumi</span><strong>{events.length}</strong><button type="button" onClick={onOpenAll}>Atvērt</button></article>
   <article className={readyToPublish.length?'attention':''}><span>Gatavi publicēšanai</span><strong>{readyToPublish.length}</strong><button type="button" onClick={onOpenAll}>Pārbaudīt</button></article>
   <article className="success"><span>Publicēti korekti</span><strong>{publishedOk.length}</strong></article>
   <article className={publishedNeedsReview.length?'danger':''}><span>Publicēti · jāpārbauda</span><strong>{publishedNeedsReview.length}</strong><button type="button" onClick={onOpenAll}>Labot</button></article>
   <article className={mappingGroups.length?'attention':''}><span>Lokācijas jālabo</span><strong>{mappingGroups.length}</strong><button type="button" onClick={onOpenMapping}>Mapping</button></article>
  </div>

  <div className="admin-overview-grid">
   <section className="admin-overview-panel">
    <div className="admin-overview-panel-head">
     <div><span>Publicēšanas rinda</span><h3>Gatavi publicēšanai</h3></div>
     <button type="button" className="text-button" onClick={onOpenAll}>Visi aktuālie</button>
    </div>
    <div className="admin-review-list">
     {ready.length?ready.map(event=><EventRow key={event.id} event={event} actionLabel="Publicēt" onAction={onPublish}/>):<p className="admin-empty-inline">Nav aktuālu pasākumu, kas gaida tikai publicēšanu.</p>}
    </div>
   </section>

   <section className="admin-overview-panel admin-overview-panel-danger">
    <div className="admin-overview-panel-head">
     <div><span>Publicēto datu kontrole</span><h3>Publicēti, bet lokācija jāpārbauda</h3></div>
     <button type="button" className="text-button" onClick={onOpenAll}>Atvērt sarakstu</button>
    </div>
    <div className="admin-review-list">
     {problems.length?problems.map(event=><EventRow key={event.id} event={event} actionLabel="Labot" onAction={onEditEvent} tone="bad"/>):<p className="admin-empty-inline">Visiem aktuālajiem publicētajiem pasākumiem lokācija ir korekta.</p>}
    </div>
   </section>
  </div>

  <section className="admin-overview-panel admin-overview-panel-wide">
   <div className="admin-overview-panel-head">
    <div><span>Lokāciju kvalitāte</span><h3>Neatpazītās vietas un atkārtotie nosaukumi</h3></div>
    <button type="button" className="text-button" onClick={onOpenMapping}>Atvērt Mapping ({mappingsCount} saglabāti)</button>
   </div>
   <div className="admin-review-list admin-review-list-compact">
    {mappingTop.length?mappingTop.map(group=><div className="admin-review-row" key={group.key}>
     <div className="admin-review-count">{group.events.length}×</div>
     <div className="admin-review-main">
      <strong>{group.alias||'Nav vietas/adreses'}</strong>
      <span>{[group.municipality,group.countryCode].filter(Boolean).join(' · ')||'Konteksts nav noteikts'}</span>
     </div>
     <div className="admin-review-action">
      <button type="button" className="button compact" onClick={()=>group.alias?onOpenMapping(group):onEditEvent(group.events[0])}>
       {group.alias?'Izveidot mappingu':'Labot ierakstu'}
      </button>
     </div>
    </div>):<p className="admin-empty-inline">Aktuālajiem pasākumiem nav neatpazītu lokāciju.</p>}
   </div>
  </section>
 </div>;
}
