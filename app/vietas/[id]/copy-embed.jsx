'use client';
import Icon from '../../components/line-icon.jsx';
import {useEffect,useState} from 'react';
export default function CopyVenueEmbed({id,title}){
 const [base,setBase]=useState('https://meets.lv'),[copied,setCopied]=useState(false);
 useEffect(()=>{setBase(window.location.origin);},[]);
 const code='<iframe src="'+base+'/iegult-vietu/'+id+'" title="'+title.replaceAll('"','&quot;')+'" width="100%" height="700" loading="lazy" style="border:0;border-radius:12px"></iframe>\n<p style="font-size:13px;margin:6px 0 0"><a href="'+base+'/vietas/'+id+'">Pasākumi: meets.lv</a></p>';
 return <div style={{display:'grid',gap:8}}>
  <strong>Iegult šo kalendāru savā mājaslapā</strong>
  <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:12,background:'#f3f6f9',padding:12,borderRadius:10}}>{code}</pre>
  <button className="button" type="button" onClick={async()=>{try{await navigator.clipboard.writeText(code);setCopied(true);}catch{setCopied(false);}}}>{copied?<><Icon name="check" size={16}/> iframe kods nokopēts</>:'Kopēt iframe kodu'}</button>
 </div>;
}
