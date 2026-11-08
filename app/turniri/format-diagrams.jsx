// Small pictures of each tournament format, for the format choice.
const INK='#1b2430',SOFT='#eef1f5',LINE='#9aa5b4',OFF='#b8c1cc',GOLD='#e0a526';

export default function FormatDiagram({format,width=112}){
 const props={width,height:Math.round(width*76/120),viewBox:'0 0 120 76',fill:'none','aria-hidden':true,className:'tn-format-diagram'};
 if(format==='round_robin')return <svg {...props}>
  <rect x="10" y="4" width="100" height="68" rx="8" fill={SOFT}/>
  {[0,1,2,3].map(i=><g key={i}>
   <circle cx="24" cy={17+i*14} r="4.5" fill={i===0?GOLD:INK}/>
   <path d={'M34 '+(17+i*14)+'H'+(80-i*10)} stroke={i===0?INK:LINE} strokeWidth="3" strokeLinecap="round"/>
   <text x="100" y={20+i*14} fontSize="9" fontWeight="800" textAnchor="end" fill={INK} fontFamily="Manrope, sans-serif">{9-i*3}</text>
  </g>)}
 </svg>;
 if(format==='groups_places')return <svg {...props}>
  <rect x="2" y="2" width="22" height="72" rx="6" fill={SOFT}/><rect x="28" y="2" width="22" height="72" rx="6" fill={SOFT}/>
  {[14,30,46,62].map(y=><g key={y}><circle cx="13" cy={y} r="4.5" fill={INK}/><circle cx="39" cy={y} r="4.5" fill={INK}/><path d={'M50 '+y+'H64'} stroke={LINE} strokeWidth="1.6"/></g>)}
  {['1.–2.','3.–4.','5.–6.','7.–8.'].map((t,i)=><g key={t}>
   <rect x="64" y={7+i*16} width="52" height="14" rx="7" fill={i?'#fff':'#fbefd0'} stroke={i?'#d8dee6':GOLD}/>
   <text x="90" y={17+i*16} fontSize="8.5" fontWeight="700" textAnchor="middle" fill={INK} fontFamily="Manrope, sans-serif">{t}</text>
  </g>)}
 </svg>;
 if(format==='groups_final')return <svg {...props}>
  {[2,22,42].map(x=><g key={x}><rect x={x} y="10" width="17" height="56" rx="5" fill={SOFT}/>
   <circle cx={x+8.5} cy="22" r="4.5" fill={GOLD}/><circle cx={x+8.5} cy="38" r="4" fill={OFF}/><circle cx={x+8.5} cy="54" r="4" fill={OFF}/></g>)}
  <path d="M10.5 17V5H70V24M30.5 17V8H70M50.5 17V11H70" stroke={LINE} strokeWidth="1.6"/>
  <rect x="70" y="14" width="46" height="52" rx="9" fill={INK}/>
  {[28,42,56].map(y=><g key={y}><circle cx="86" cy={y} r="5" fill={GOLD}/><path d={'M96 '+y+'H108'} stroke="#fff" strokeWidth="2" strokeLinecap="round"/></g>)}
 </svg>;
 if(format==='groups_knockout')return <svg {...props}>
  <rect x="2" y="2" width="20" height="72" rx="6" fill={SOFT}/><rect x="26" y="2" width="20" height="72" rx="6" fill={SOFT}/>
  {[14,30,46,62].map((y,i)=><g key={y}><circle cx="12" cy={y} r={i<2?4.5:4} fill={i<2?INK:OFF}/><circle cx="36" cy={y} r={i<2?4.5:4} fill={i<2?INK:OFF}/></g>)}
  <path d="M50 14H62V30H50M50 46H62V62H50M62 22H80V54H62M80 38H98" stroke={INK} strokeWidth="1.6"/>
  <circle cx="106" cy="38" r="7" fill={GOLD}/>
 </svg>;
 if(format==='custom')return <svg {...props}>
  <rect x="4" y="4" width="70" height="18" rx="6" fill={SOFT}/>
  <rect x="4" y="29" width="70" height="18" rx="6" fill={INK}/>
  <rect x="4" y="54" width="70" height="18" rx="6" fill={SOFT} stroke={LINE} strokeDasharray="3 3"/>
  <path d="M12 13H40M12 63H34" stroke={LINE} strokeWidth="2" strokeLinecap="round"/>
  <path d="M12 38H48" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
  <circle cx="100" cy="63" r="11" fill="#fff" stroke={INK} strokeWidth="1.6"/>
  <path d="M100 57V69M94 63H106" stroke={INK} strokeWidth="1.8" strokeLinecap="round"/>
 </svg>;
 return <svg {...props}>
  <path d="M4 6H22V15H4M4 24H22V33H4M4 43H22V52H4M4 61H22V70H4M22 10.5H44V28.5H22M22 47.5H44V65.5H22M44 19.5H68V56.5H44M68 38H90" stroke={INK} strokeWidth="1.6"/>
  <circle cx="99" cy="38" r="8" fill={GOLD}/>
 </svg>;
}
