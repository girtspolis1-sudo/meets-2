'use client';
import {useEffect} from 'react';

function report(error){
 const payload={
  message:error?.message||'Client render error',
  digest:error?.digest||null,
  path:typeof window==='undefined'?null:window.location.pathname
 };
 console.error('client_render_error',error);
 fetch('/api/client-error',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify(payload),
  keepalive:true
 }).catch(()=>{});
}

export default function Error({error,reset}){
 useEffect(()=>{report(error);},[error]);
 return <section className="section empty" role="alert">
  <span className="symbol" aria-hidden="true">!</span>
  <h1>Kaut kas nogāja greizi</h1>
  <p>Neizdevās ielādēt šo MEETS sadaļu. Vari mēģināt vēlreiz.</p>
  <button className="button primary" type="button" onClick={()=>reset()}>Mēģināt vēlreiz</button>
 </section>;
}
