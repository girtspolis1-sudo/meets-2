'use client';
import {useEffect,useId,useState} from 'react';

const TYPE_LABELS={phone:'Telefons',email:'E-pasts',website:'Mājaslapa',facebook:'Facebook',instagram:'Instagram',person:'Kontaktpersona',other:'Cits'};
const TYPE_ICONS={phone:'☎',email:'✉',website:'↗',facebook:'f',instagram:'◎',person:'♙',other:'•'};
const blankContact=()=>({type:'email',label:'',value:'',public:false});
const dateLabel=value=>{
 if(!value)return 'Nav norādīts';
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'Nav norādīts':new Intl.DateTimeFormat('lv-LV',{day:'numeric',month:'short',year:'numeric'}).format(date);
};

function ContactEditor({contacts=[],onChange,disabled}){
 const list=Array.isArray(contacts)?contacts:[];
 const change=(index,patch)=>onChange(list.map((entry,i)=>i===index?{...entry,...patch}:entry));
 return <div className="org-v3-contacts">
  <div className="org-v3-contacts-head"><span>{list.length} {list.length===1?'kontakts':'kontakti'}</span>
   <button type="button" className="org-v3-add-contact" disabled={disabled||list.length>=25} onClick={()=>onChange([...list,blankContact()])}>+ Pievienot kontaktu</button>
  </div>
  <div className="org-v3-contact-list" aria-label="Organizatora kontakti">
   {list.map((item,i)=><div className="org-v3-contact" key={i}>
    <span className="org-v3-contact-icon" aria-hidden="true">{TYPE_ICONS[item.type]||'•'}</span>
    <select aria-label={'Kontakta veids '+(i+1)} value={item.type||'other'} disabled={disabled} onChange={e=>change(i,{type:e.target.value})}>
     {Object.entries(TYPE_LABELS).map(([key,label])=><option value={key} key={key}>{label}</option>)}
    </select>
    <input aria-label={'Kontakta vērtība '+(i+1)} type={item.type==='email'?'email':item.type==='phone'?'tel':'text'} disabled={disabled} maxLength={254}
     placeholder={item.type==='email'?'epasts@piemers.lv':item.type==='phone'?'+371 ...':item.type==='person'?'Vārds, uzvārds':'Ievadi kontaktu'}
     value={item.value||''} onChange={e=>change(i,{value:e.target.value})}/>
    <label className="org-v3-public-checkbox"><input type="checkbox" checked={item.public===true} disabled={disabled} onChange={e=>change(i,{public:e.target.checked})}/><span>Publisks</span></label>
    <button type="button" className="org-v3-remove-contact" disabled={disabled} aria-label={'Noņemt kontaktu '+(i+1)} title="Noņemt kontaktu" onClick={()=>onChange(list.filter((_,j)=>i!==j))}>×</button>
    <details className="org-v3-contact-label"><summary>Apzīmējums {item.label?'· '+item.label:''}</summary>
     <input aria-label={'Kontakta apzīmējums '+(i+1)} maxLength={80} disabled={disabled} value={item.label||''} onChange={e=>change(i,{label:e.target.value})} placeholder="Piemēram, treneris, administrācija"/>
    </details>
   </div>)}
   {!list.length&&<p className="org-v3-no-contacts">Kontakti vēl nav pievienoti. Pievieno tālruni, e-pastu vai citu saziņas veidu.</p>}
  </div>
 </div>;
}

export default function OrganizerProfileEditor({value={},onChange,onSubmit,onCancel,logoFile,onLogoChange,busy=false,canEdit=true,isNew=false,dirty=false,stats=null,lastModified=null}){
 const [selected,setSelected]=useState('management');
 const [preview,setPreview]=useState('');
 const fileId=useId();
 useEffect(()=>{
  if(!logoFile){setPreview('');return;}
  const url=URL.createObjectURL(logoFile);
  setPreview(url);
  return ()=>URL.revokeObjectURL(url);
 },[logoFile]);
 const update=(key,val)=>onChange({[key]:val});
 const openSection=id=>{
  setSelected(id);
  document.getElementById('org-v3-'+id)?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
 };
 const orgPublic=value.is_public===true;
 const contacts=value.contacts||[];
 const currentImage=preview||value.image_url||'';
 const publicCount=contacts.filter(c=>c.public===true).length;
 return <form className={'org-v3-editor'+(isNew?' org-v3-new':'')} onSubmit={onSubmit}>
  <div className="org-v3-toolbar">
   <div className="org-v3-section-links" role="group" aria-label="Profila sadaļas">
    {[[ 'management','Pārvaldība','⚙'],['contacts','Kontakti','♧'],['public','Publiskais profils','◎']].map(([id,label,symbol])=>
     <button type="button" key={id} aria-pressed={selected===id} className={selected===id?'is-active':''} onClick={()=>openSection(id)}>
      <span aria-hidden="true">{symbol}</span>{label}
     </button>)}
   </div>
   <label className="org-v3-publish"><input type="checkbox" checked={orgPublic} disabled={!canEdit||busy} onChange={e=>update('is_public',e.target.checked)}/>
    <span><strong>Publicēt organizāciju</strong><small>{orgPublic?'Organizācija ir redzama MEETS':'Organizācijas profils ir privāts'}</small></span>
   </label>
  </div>
  <div className="org-v3-columns">
   <section id="org-v3-management" className={'org-v3-column'+(selected==='management'?' is-selected':'')}>
    <div className="org-v3-heading"><span className="org-v3-heading-icon" aria-hidden="true">♙</span><div><h2>Pārvaldības informācija</h2><p>Pamata informācija par organizāciju.</p></div></div>
    <label className="org-v3-field"><span>Organizatora nosaukums <em>*</em></span>
     <input required minLength={2} maxLength={160} disabled={!canEdit||busy} value={value.name||''} onChange={e=>update('name',e.target.value)}/>
    </label>
    <label className="org-v3-field"><span>Galvenā adrese</span>
     <input maxLength={300} disabled={!canEdit||busy} placeholder="Pilsēta, iela un mājas numurs" value={value.address||''} onChange={e=>update('address',e.target.value)}/>
    </label>
    <label className="org-v3-checkbox-band"><span><strong>Rādīt adresi publiski</strong><small>Adrese būs redzama organizācijas profilā.</small></span>
     <input type="checkbox" checked={value.address_public===true} disabled={!canEdit||busy} onChange={e=>update('address_public',e.target.checked)}/>
    </label>
    <div className="org-v3-hint"><span aria-hidden="true">ⓘ</span> Organizācijas nosaukums tiks rādīts publiski tikai tad, ja publicēsi profilu. Adrese un kontakti ir privāti, kamēr tos neatzīmēsi.</div>
   </section>
   <section id="org-v3-contacts" className={'org-v3-column'+(selected==='contacts'?' is-selected':'')}>
    <div className="org-v3-heading"><span className="org-v3-heading-icon" aria-hidden="true">♧</span><div><h2>Kontaktinformācija</h2><p>Izvēlies, kuri kontakti būs publiski.</p></div></div>
    <ContactEditor contacts={contacts} onChange={list=>update('contacts',list)} disabled={!canEdit||busy}/>
    <div className="org-v3-hint org-v3-contacts-hint"><span aria-hidden="true">◉</span> {publicCount} publiski atzīmēti kontakti. Neatzīmētie kontakti paliek privāti.</div>
   </section>
   <section id="org-v3-public" className={'org-v3-column'+(selected==='public'?' is-selected':'')}>
    <div className="org-v3-heading"><span className="org-v3-heading-icon" aria-hidden="true">◎</span><div><h2>Publiskais profils</h2><p>Kā organizācija izskatīsies apmeklētājiem.</p></div></div>
    <div className="org-v3-logo-label">Logo attēls</div>
    <div className="org-v3-logo-row">
     <div className="org-v3-logo-preview">{currentImage?<img src={currentImage} alt="Organizatora logo priekšskatījums"/>:<span aria-hidden="true">◎</span>}</div>
     <div className="org-v3-logo-controls">
      <label htmlFor={fileId} className={'org-v3-upload'+(!canEdit?' is-disabled':'')}>↥ {currentImage?'Mainīt attēlu':'Pievienot logo'}</label>
      <input id={fileId} type="file" accept="image/png,image/jpeg,image/webp" disabled={!canEdit||busy} onChange={e=>onLogoChange(e.target.files?.[0]||null)}/>
      {currentImage&&<button className="org-v3-remove-logo" type="button" disabled={!canEdit||busy} onClick={()=>{onLogoChange(null);update('image_url','');}}>Noņemt logo</button>}
      <small>PNG, JPG vai WebP, līdz 2 MB.</small>
     </div>
    </div>
    <label className="org-v3-field org-v3-description"><span>Apraksts <small>{(value.description||'').length}/2000</small></span>
     <textarea rows={3} maxLength={2000} disabled={!canEdit||busy} placeholder="Īsumā par organizāciju un tās pasākumiem" value={value.description||''} onChange={e=>update('description',e.target.value)}/>
    </label>
    <label className="org-v3-field"><span>Mājaslapa</span>
     <input type="text" inputMode="url" disabled={!canEdit||busy} maxLength={1000} placeholder="https://piemers.lv" value={value.public_url||''} onChange={e=>update('public_url',e.target.value)}/>
    </label>
    <label className="org-v3-public-checkbox org-v3-website"><input type="checkbox" checked={value.website_public===true} disabled={!canEdit||busy} onChange={e=>update('website_public',e.target.checked)}/> Publiska mājaslapa</label>
    <div className="org-v3-hint"><span aria-hidden="true">◉</span> Publiskajā profilā redzams logo, apraksts, kā arī atzīmētā adrese, mājaslapa un kontakti.</div>
   </section>
  </div>
  <footer className="org-v3-footer">
   <div className="org-v3-statistics" aria-label="Organizatora reģistrs">
    {stats&&<><span><strong>{stats.addresses}</strong> {stats.addresses===1?'adrese':'adreses'} <small>({stats.publicAddresses} publiskas)</small></span>
     <span><strong>{stats.events}</strong> pasākumi <small>({stats.published} publicēti)</small></span></>}
    {!isNew&&<span className="org-v3-modified">Pēdējās izmaiņas: {dateLabel(lastModified)}</span>}
    {isNew&&<span className="org-v3-modified">Jauns profils sākotnēji ir privāts.</span>}
   </div>
   <div className="org-v3-actions">
    <button type="button" className="org-v3-cancel" disabled={!canEdit||busy} onClick={onCancel}>{isNew?'Atcelt':'Atcelt izmaiņas'}</button>
    <button className="org-v3-save" disabled={!canEdit||busy||(!isNew&&!dirty)} type="submit">{busy?'Saglabā…':isNew?'Izveidot organizatoru':'✓ Saglabāt izmaiņas'}</button>
   </div>
  </footer>
  {!isNew&&dirty&&<div className="org-v3-unsaved" role="status">Ir nesaglabātas izmaiņas</div>}
 </form>;
}
