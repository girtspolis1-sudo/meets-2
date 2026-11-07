'use client';
import {useState} from 'react';
import {rigaDate} from '../../lib/meets-personal.js';
import {quickEventHref} from '../../lib/organizer-workspace.js';

// Starts an event right in the organizer area: name, date and who sees it.
// Everything else (place, time, cover, price) is filled in the event editor,
// which opens with these values already in place.
export default function QuickEvent({organizations=[],orgId='',heading='Izveido pasākumu'}){
 const [title,setTitle]=useState('');
 const [date,setDate]=useState('');
 const [visibility,setVisibility]=useState('public');
 const [org,setOrg]=useState(orgId||organizations.find(o=>o.role!=='viewer')?.id||'');
 const [problem,setProblem]=useState('');
 const writable=organizations.filter(o=>o.role!=='viewer');
 const chooseOrg=!orgId&&writable.length>1;

 function start(event){
  event.preventDefault();
  if(title.trim().length<3){setProblem('Ieraksti nosaukumu — vismaz 3 rakstzīmes.');event.currentTarget.querySelector('input')?.focus();return;}
  window.location.assign(quickEventHref({orgId:orgId||org,title,date,visibility}));
 }

 return <section className="org-quick" aria-labelledby="org-quick-title">
  <div className="org-quick-head">
   <span className="org-quick-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg></span>
   <div><h2 id="org-quick-title">{heading}</h2><p>Sāc ar nosaukumu un datumu — vietu, laiku un attēlu pievienosi nākamajā solī.</p></div>
  </div>
  <form className="org-quick-form" noValidate onSubmit={start}>
   <label className={'org-quick-title'+(problem?' has-error':'')}><span>Pasākuma nosaukums</span>
    <input value={title} maxLength={200} autoComplete="off" placeholder="Piem., Rudens koncerts" aria-invalid={problem?'true':undefined}
     aria-describedby={problem?'org-quick-error':undefined} onChange={e=>{setTitle(e.target.value);setProblem('');}}/>
   </label>
   {problem&&<p className="org-quick-error" id="org-quick-error">{problem}</p>}
   <div className="org-quick-row">
    <label className="org-quick-date"><span>Datums</span><input type="date" min={rigaDate()} value={date} onChange={e=>setDate(e.target.value)}/></label>
    {chooseOrg&&<label className="org-quick-org"><span>Organizators</span>
     <select value={org} onChange={e=>setOrg(e.target.value)}>{writable.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
   </div>
   <fieldset className="org-quick-visibility"><legend>Kas redzēs?</legend>
    <label className={visibility==='public'?'active':''}><input type="radio" name="org-quick-visibility" value="public" checked={visibility==='public'} onChange={()=>setVisibility('public')}/>
     <strong>Publisks</strong><small>Kartē pēc MEETS pārbaudes</small></label>
    <label className={visibility==='private'?'active':''}><input type="radio" name="org-quick-visibility" value="private" checked={visibility==='private'} onChange={()=>setVisibility('private')}/>
     <strong>Privāts</strong><small>Tikai ar saiti</small></label>
   </fieldset>
   <button className="org-quick-submit" type="submit">Turpināt <span aria-hidden="true">→</span></button>
  </form>
 </section>;
}
