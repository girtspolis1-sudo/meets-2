'use client';
import {useEffect} from 'react';

export default function GlobalError({error,reset}){
 useEffect(()=>{
  const payload={
   message:error?.message||'Global client render error',
   digest:error?.digest||null,
   path:typeof window==='undefined'?null:window.location.pathname
  };
  console.error('global_client_render_error',error);
  fetch('/api/client-error',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify(payload),
   keepalive:true
  }).catch(()=>{});
 },[error]);

 return <html lang="lv"><body style={{fontFamily:'Arial, sans-serif',margin:0,background:'#fbfafc',color:'#241d28'}}>
  <main style={{maxWidth:680,margin:'12vh auto',padding:24,textAlign:'center'}}>
   <div style={{fontSize:44,fontWeight:900,color:'#7f00ff'}}>MEETS</div>
   <h1>MEETS šobrīd nevar ielādēt lapu</h1>
   <p>Reģistrējām kļūdu. Pamēģini ielādēt lapu vēlreiz.</p>
   <button type="button" onClick={()=>reset()} style={{border:0,borderRadius:12,padding:'12px 18px',background:'#7f00ff',color:'#fff',fontWeight:800,cursor:'pointer'}}>Mēģināt vēlreiz</button>
  </main>
 </body></html>;
}
