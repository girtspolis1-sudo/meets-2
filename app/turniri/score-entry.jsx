'use client';
import {useEffect,useState} from 'react';
import {hasScore,sideName,sportOf} from '../../lib/tournament.js';
import {stageLabel} from './tournament-views.jsx';

const asText=v=>v===null||v===undefined?'':String(v);

// One game's result: two numbers, overtime for hockey, and the winner of a
// drawn game that must have one (penalties, shoot-out).
export function ScoreEntry({game,ctx,sport:sportKey,onSave,disabled=false,current=false}){
 const sport=sportOf(sportKey);
 const [home,setHome]=useState(asText(game.home_score));
 const [away,setAway]=useState(asText(game.away_score));
 const [ot,setOt]=useState(game.details?.ot===true);
 const [winner,setWinner]=useState(game.details?.winner||'');
 const [state,setState]=useState({kind:'',text:''});
 const savedKey=[game.home_score,game.away_score,game.details?.ot,game.details?.winner].join('|');
 useEffect(()=>{setHome(asText(game.home_score));setAway(asText(game.away_score));setOt(game.details?.ot===true);setWinner(game.details?.winner||'');},[savedKey]);

 const h=sideName(game.home,ctx),a=sideName(game.away,ctx);
 const level=home!==''&&home===away;
 const needsWinner=level&&sport.draw&&game.stage!=='group';
 const changed=[home,away,ot,winner].join('|')!==[asText(game.home_score),asText(game.away_score),game.details?.ot===true,game.details?.winner||''].join('|');
 const teamsKnown=h.known&&a.known;

 async function save(clear=false){
  const hs=clear?null:home===''?null:Number(home),as=clear?null:away===''?null:Number(away);
  if(!clear&&(hs===null||as===null)){setState({kind:'error',text:'Ievadi abu komandu rezultātu.'});return;}
  if(!clear&&level&&!sport.draw){setState({kind:'error',text:sport.name+': spēle nevar beigties neizšķirti.'});return;}
  if(!clear&&needsWinner&&!winner){setState({kind:'error',text:'Neizšķirts: atzīmē, kura komanda uzvarēja.'});return;}
  setState({kind:'busy',text:'Saglabā…'});
  try{
   await onSave(game.no,hs,as,clear?{}:{...(ot&&sport.overtime?{ot:true}:{}),...(needsWinner?{winner}:{})});
   setState({kind:'ok',text:clear?'Rezultāts notīrīts':'Saglabāts'});
  }catch(e){setState({kind:'error',text:e.message||'Neizdevās saglabāt.'});}
 }

 return <li className={'tn-entry'+(hasScore(game)?' is-done':'')+(current?' is-current':'')}>
  <div className="tn-entry-head"><strong>{game.starts_at||'—'}</strong><span>Nr. {game.no} · {stageLabel(game)}{game.court?' · '+game.court:''}</span>{current&&<em>Nākamā</em>}</div>
  <form className="tn-entry-form" onSubmit={e=>{e.preventDefault();save();}}>
   <label className={'tn-entry-team'+(h.known?'':' is-open')}><span>{h.name}</span>
    <input inputMode="numeric" pattern="[0-9]*" maxLength={3} value={home} disabled={disabled||!teamsKnown} aria-label={'Rezultāts: '+h.name} onChange={e=>setHome(e.target.value.replace(/\D/g,''))}/></label>
   <span className="tn-entry-colon" aria-hidden="true">:</span>
   <label className={'tn-entry-team tn-entry-away'+(a.known?'':' is-open')}><input inputMode="numeric" pattern="[0-9]*" maxLength={3} value={away} disabled={disabled||!teamsKnown} aria-label={'Rezultāts: '+a.name} onChange={e=>setAway(e.target.value.replace(/\D/g,''))}/>
    <span>{a.name}</span></label>
   {sport.overtime&&<label className="tn-entry-check"><input type="checkbox" checked={ot} disabled={disabled||!teamsKnown} onChange={e=>setOt(e.target.checked)}/> Papildlaikā / metienos</label>}
   {needsWinner&&<fieldset className="tn-entry-winner"><legend>Uzvarētājs pēc neizšķirta</legend>
    <label><input type="radio" name={'w'+game.no} checked={winner==='home'} onChange={()=>setWinner('home')}/> {h.name}</label>
    <label><input type="radio" name={'w'+game.no} checked={winner==='away'} onChange={()=>setWinner('away')}/> {a.name}</label>
   </fieldset>}
   <div className="tn-entry-actions">
    {!teamsKnown?<small>Komandas būs zināmas pēc iepriekšējām spēlēm.</small>:<>
     <button type="submit" className={'button compact'+(changed?' primary':'')} disabled={disabled||state.kind==='busy'||!changed}>Saglabāt</button>
     {hasScore(game)&&<button type="button" className="text-button" disabled={disabled||state.kind==='busy'} onClick={()=>{if(window.confirm('Notīrīt spēles '+game.no+' rezultātu?'))save(true);}}>Notīrīt</button>}
    </>}
    {state.text&&<small className={'tn-entry-state is-'+state.kind} role={state.kind==='error'?'alert':'status'}>{state.text}</small>}
   </div>
  </form>
 </li>;
}
