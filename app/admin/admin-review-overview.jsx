'use client';
import {BUCKETS,BUCKET_ORDER,CHECKS,reasonList} from '../../lib/admin-checks.js';

const THIS_YEAR=String(new Date().getFullYear());
function dateText(value){
 if(!value)return '—';
 const v=String(value);
 return v.slice(8,10)+'.'+v.slice(5,7)+'.'+(v.slice(0,4)!==THIS_YEAR?v.slice(0,4):'');
}
function dateRangeText(event){
 const from=dateText(event.date_from);
 const to=event.date_to&&event.date_to!==event.date_from?dateText(event.date_to):'';
 return to?from+'–'+to:from;
}
function percent(part,total){return total?Math.round(100*part/total):0;}
function plural(n,one,many){return n%10===1&&n%100!==11?one:many;}

// One block of the status board: count, share, the reasons behind it.
function BucketCard({bucket,count,total,reasons,onOpen,action}){
 const meta=BUCKETS[bucket];
 const list=reasonList(reasons).slice(0,5);
 return <article className={'admin-bucket admin-bucket-'+bucket}>
  <button type="button" className="admin-bucket-head" onClick={()=>onOpen(bucket,'')} aria-label={meta.label+': '+count+', atvērt sarakstu'}>
   <span className="admin-bucket-label">{meta.label}</span>
   <strong>{count.toLocaleString('lv-LV')}</strong>
   <span className="admin-bucket-share" aria-hidden="true"><i style={{width:percent(count,total)+'%'}}/></span>
   <small>{percent(count,total)}% no aktuālajiem</small>
  </button>
  <p>{meta.hint}</p>
  {list.length>0&&<ul className="admin-bucket-reasons" aria-label="Iemesli">
   {list.map(reason=><li key={reason.code}>
    <button type="button" className={'reason-'+reason.level} onClick={()=>onOpen(bucket,reason.code)}>
     <span>{reason.label}</span><b>{reason.count}</b>
    </button>
   </li>)}
  </ul>}
  {action}
 </article>;
}

function IssueRow({row,onEdit,onPublish,onArchive,queue}){
 const {event,issues}=row;
 const location=issues.some(code=>CHECKS[code]?.fix==='location');
 const duplicate=issues.includes('duplicate');
 const source=(event.sources||[]).find(s=>s?.url);
 return <div className="admin-review-row">
  <div className="admin-review-date">{dateRangeText(event)}</div>
  <div className="admin-review-main">
   <strong>{event.title||'Bez nosaukuma'}</strong>
   <span>{event.venue_name||event.address_raw||event.municipality||'Vieta nav noteikta'}</span>
   {issues.length>0&&<span className="admin-issue-tags">{issues.map(code=><em key={code} className={'issue-'+(CHECKS[code]?.level||'warn')}>{CHECKS[code]?.label||code}</em>)}</span>}
  </div>
  <div className="admin-review-action">
   {onPublish&&<button type="button" className="button primary compact" onClick={()=>onPublish(event)}>Publicēt</button>}
   {location&&<button type="button" className={'button compact'+(onPublish?'':' primary')} onClick={()=>onEdit(event,queue)}>Labot vietu</button>}
   {duplicate&&onArchive&&<button type="button" className="button compact" onClick={()=>onArchive(event)}>Arhivēt dublikātu</button>}
   {!location&&source&&<a className="button compact" href={source.url} target="_blank" rel="noreferrer">Avots ↗</a>}
  </div>
 </div>;
}

function Priorities({items,onOpenView,emailStatus}){
 return <section className="admin-priorities" aria-labelledby="admin-priorities-title">
  <div className="admin-overview-panel-head">
   <div><span>Darba kārtība</span><h3 id="admin-priorities-title">Ko darīt vispirms</h3></div>
   {emailStatus&&<span className={'admin-email-status'+(emailStatus.failed?' bad':'')} title={emailStatus.last_error||''}>
    E-pasti: {emailStatus.sent_7d} nosūtīti 7 dienās{emailStatus.waiting?' · '+emailStatus.waiting+' rindā':''}{emailStatus.held?' · '+emailStatus.held+' gaida dienas kopsavilkumu':''}{emailStatus.failed?' · '+emailStatus.failed+' neizdevās':''}</span>}
  </div>
  {items.length?<ol>
   {items.map((item,index)=><li key={item.key} className={'priority-'+item.tone}>
    <span className="admin-priority-rank" aria-hidden="true">{index+1}</span>
    <div><strong>{item.title} <em>{item.count}</em></strong><span>{item.detail}</span></div>
    <button type="button" className={item.tone==='info'?'button compact':'button primary compact'} onClick={()=>onOpenView(item.view,item.filter)}>{item.action}</button>
   </li>)}
  </ol>:<p className="admin-empty-inline">Viss sakārtots — nav steidzamu darbu.</p>}
 </section>;
}

function RecentActions({actions,onUndo}){
 if(!actions.length)return null;
 return <section className="admin-overview-panel admin-recent" aria-labelledby="admin-recent-title">
  <div className="admin-overview-panel-head"><div><span>Šī sesija</span><h3 id="admin-recent-title">Pēdējās darbības</h3></div></div>
  <ol>{actions.slice(0,12).map(action=><li key={action.id} className={action.undone?'undone':''}>
   <time>{new Date(action.at).toLocaleTimeString('lv-LV',{hour:'2-digit',minute:'2-digit'})}</time>
   <span>{action.text}{action.undone?' — atsaukts':''}</span>
   {action.undo&&!action.undone&&<button type="button" className="text-button" onClick={()=>onUndo(action)}>Atsaukt</button>}
  </li>)}</ol>
 </section>;
}

export default function AdminReviewOverview({
 audit,priorities=[],emailStatus=null,onOpenView=()=>{},onOpenBucket=()=>{},
 mappingGroups=[],mappingsCount=0,onOpenMapping=()=>{},onEditEvent=()=>{},onPublish=()=>{},onPublishMany=()=>{},onArchive=()=>{},
 actions=[],onUndo=()=>{},doneToday=0,loadedAt=null,onReload=()=>{},busy=false,today=''
}){
 const {rows,counts,reasons}=audit;
 const total=BUCKET_ORDER.reduce((sum,key)=>sum+counts[key],0);
 const byBucket=key=>rows.filter(row=>row.bucket===key).sort((a,b)=>String(a.event.date_from).localeCompare(String(b.event.date_from)));
 const critical=byBucket('critical'),ready=byBucket('ready'),review=byBucket('review');
 const week=new Date(Date.parse((today||new Date().toISOString().slice(0,10))+'T12:00:00Z')+7*864e5).toISOString().slice(0,10);
 const criticalSoon=critical.filter(row=>String(row.event.date_from)<=week);
 const locationQueue=list=>list.filter(row=>row.issues.some(code=>CHECKS[code]?.fix==='location')).map(row=>row.event.id);
 const firstLocation=list=>list.find(row=>row.issues.some(code=>CHECKS[code]?.fix==='location'));
 const mappingTop=mappingGroups.slice(0,6);
 const healthy=percent(counts.ok,counts.ok+counts.review);

 return <div className="admin-overview">
  <section className="admin-status-board" aria-labelledby="admin-status-title">
   <div className="admin-status-head">
    <div><span>Datu stāvoklis</span><h2 id="admin-status-title">{total.toLocaleString('lv-LV')} aktuāli pasākumi</h2>
     <p>{healthy}% publicēto ir pilnā kārtībā{doneToday?` · šajā sesijā sakārtoti ${doneToday}`:''}{loadedAt?` · dati ielādēti ${new Date(loadedAt).toLocaleTimeString('lv-LV',{hour:'2-digit',minute:'2-digit'})}`:''}</p></div>
    <button type="button" className="button" onClick={onReload} disabled={busy}>{busy?'Ielādē…':'Pārlasīt'}</button>
   </div>
   <div className="admin-bucket-grid">
    <BucketCard bucket="critical" count={counts.critical} total={total} reasons={reasons.critical} onOpen={onOpenBucket}
     action={firstLocation(critical)&&<button type="button" className="button primary compact" onClick={()=>onEditEvent(firstLocation(critical).event,locationQueue(critical))}>Sākt labot pēc kārtas →</button>}/>
    <BucketCard bucket="ready" count={counts.ready} total={total} reasons={reasons.ready} onOpen={onOpenBucket}
     action={ready.length>0&&<button type="button" className="button primary compact" onClick={()=>onPublishMany(ready.map(row=>row.event))}>Publicēt visus ({ready.length})</button>}/>
    <BucketCard bucket="review" count={counts.review} total={total} reasons={reasons.review} onOpen={onOpenBucket}
     action={firstLocation(review)&&<button type="button" className="button compact" onClick={()=>onEditEvent(firstLocation(review).event,locationQueue(review))}>Precizēt vietas pēc kārtas →</button>}/>
    <BucketCard bucket="ok" count={counts.ok} total={total} reasons={reasons.ok} onOpen={onOpenBucket}/>
   </div>
  </section>

  <Priorities items={priorities} onOpenView={onOpenView} emailStatus={emailStatus}/>

  <div className="admin-overview-grid">
   <section className="admin-overview-panel admin-overview-panel-danger">
    <div className="admin-overview-panel-head">
     <div><span>Kritiski · tuvākās 7 dienas</span><h3>Jālabo, lai publicētu laikā</h3></div>
     <button type="button" className="text-button" onClick={()=>onOpenBucket('critical','')}>Visi ({critical.length})</button>
    </div>
    <div className="admin-review-list">
     {criticalSoon.length?criticalSoon.slice(0,8).map(row=><IssueRow key={row.event.id} row={row} onEdit={onEditEvent} onArchive={onArchive} queue={locationQueue(criticalSoon)}/>)
      :<p className="admin-empty-inline">Tuvāko 7 dienu pasākumiem nekas nebloķē publicēšanu.</p>}
    </div>
   </section>
   <section className="admin-overview-panel" id="admin-ready-list">
    <div className="admin-overview-panel-head">
     <div><span>Publicēšanas rinda</span><h3>Gatavi publicēšanai</h3></div>
     <button type="button" className="text-button" onClick={()=>onOpenBucket('ready','')}>Visi ({ready.length})</button>
    </div>
    <div className="admin-review-list">
     {ready.length?ready.slice(0,8).map(row=><IssueRow key={row.event.id} row={row} onEdit={onEditEvent} onPublish={onPublish} onArchive={onArchive}/>)
      :<p className="admin-empty-inline">Nav pasākumu, kas gaida tikai publicēšanu.</p>}
    </div>
   </section>
  </div>

  <section className="admin-overview-panel admin-overview-panel-wide">
   <div className="admin-overview-panel-head">
    <div><span>Publicēto datu kontrole</span><h3>Publicēti, bet jāprecizē</h3></div>
    <button type="button" className="text-button" onClick={()=>onOpenBucket('review','')}>Visi ({review.length})</button>
   </div>
   <div className="admin-review-list">
    {review.length?review.slice(0,8).map(row=><IssueRow key={row.event.id} row={row} onEdit={onEditEvent} onArchive={onArchive} queue={locationQueue(review)}/>)
     :<p className="admin-empty-inline">Visi publicētie pasākumi atbilst prasībām.</p>}
   </div>
  </section>

  <section className="admin-overview-panel admin-overview-panel-wide">
   <div className="admin-overview-panel-head">
    <div><span>Lokāciju kvalitāte</span><h3>Neatpazītās vietas</h3></div>
    <button type="button" className="text-button" onClick={()=>onOpenMapping()}>Atvērt vietu sasaisti ({mappingsCount} saglabātas)</button>
   </div>
   <div className="admin-review-list admin-review-list-compact">
    {mappingTop.length?mappingTop.map(group=><div className="admin-review-row" key={group.key}>
     <div className="admin-review-count">{group.events.length}×</div>
     <div className="admin-review-main">
      <strong>{group.alias||'Nav vietas/adreses'}</strong>
      <span>{[group.municipality,group.countryCode].filter(Boolean).join(' · ')||'Konteksts nav noteikts'} · {group.events.length} {plural(group.events.length,'pasākums','pasākumi')}</span>
     </div>
     <div className="admin-review-action">
      <button type="button" className="button compact" onClick={()=>group.alias?onOpenMapping(group):onEditEvent(group.events[0])}>
       {group.alias?'Norādīt vietu':'Labot ierakstu'}
      </button>
     </div>
    </div>):<p className="admin-empty-inline">Aktuālajiem pasākumiem nav neatpazītu vietu.</p>}
   </div>
  </section>

  <RecentActions actions={actions} onUndo={onUndo}/>
 </div>;
}

