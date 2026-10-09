'use client';

function sourceGroup(source){
 if(source.municipality_id)return 'municipality';
 const domain=String(source.domain||'').toLowerCase();
 if(domain.includes('basket'))return 'basketball';
 if(domain==='lff.lv')return 'football';
 if(domain==='athletics.lv')return 'athletics';
 return 'other';
}

function groupLabel(key){
 return ({
  municipality:'Pašvaldību avoti',
  basketball:'Basketbols',
  football:'Futbols',
  athletics:'Vieglatlētika',
  other:'Citi avoti'
 })[key]||'Citi avoti';
}

export default function AdminSourceChannels({sources,onToggle,busySourceId}){
 const rows=Array.isArray(sources)?sources:[];
 const enabled=rows.filter(source=>source.map_visible!==false).length;
 const groups=['municipality','basketball','football','athletics','other']
  .map(key=>({key,label:groupLabel(key),items:rows.filter(source=>sourceGroup(source)===key)}))
  .filter(group=>group.items.length);

 return <section className="admin-source-channels">
  <div className="admin-overview-panel-head">
   <div>
    <span>Publiskā karte</span>
    <h2>Datu avoti / ielādes kanāli</h2>
    <p>Katru mājaslapu var atsevišķi ieslēgt vai izslēgt kartes rādīšanai. Izslēgšana neizdzēš importētos pasākumus un neaptur pašu importu.</p>
   </div>
   <span className="quality-badge ok">{enabled} no {rows.length} ieslēgti</span>
  </div>

  {groups.map(group=><div className="source-channel-group" key={group.key}>
   <div className="source-channel-group-head">
    <h3>{group.label}</h3>
    <span>{group.items.filter(source=>source.map_visible!==false).length}/{group.items.length} ieslēgti</span>
   </div>
   <div className="source-channel-grid">
    {group.items.map(source=>{
     const active=source.map_visible!==false;
     const busy=String(busySourceId)===String(source.id);
     return <article className={'source-channel-card '+(active?'is-enabled':'is-disabled')} key={source.id}>
      <div className="source-channel-copy">
       <div className="source-channel-title">
        <strong>{source.label||source.domain}</strong>
        <span className={'quality-badge '+(active?'ok':'bad')}>{active?'Kartē redzams':'Kartē paslēpts'}</span>
       </div>
       <a href={source.calendar_url||('https://'+source.domain)} target="_blank" rel="noreferrer">{source.domain} ↗</a>
       <small>Aktuāli: {source.current_event_count??0} · publicēti: {source.published_event_count??0} · kopā sasaistīti: {source.event_count??0}</small>
      </div>
      <label className="source-channel-switch">
       <input
        type="checkbox"
        checked={active}
        disabled={busy}
        onChange={()=>onToggle(source)}
        aria-label={(active?'Atslēgt ':'Ieslēgt ')+(source.label||source.domain)+' kartes rādīšanai'}
       />
       <span aria-hidden="true"></span>
       <b>{busy?'Saglabā…':active?'Ieslēgts':'Izslēgts'}</b>
      </label>
     </article>;
    })}
   </div>
  </div>)}

  {!rows.length&&<p className="sync-text">Nav atrasts neviens konfigurēts datu avots.</p>}
 </section>;
}
