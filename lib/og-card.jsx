// Share card (1200×630) drawn by next/og: the meets.lv name, a title, and a
// date and place line. Default font (Geist) carries all Latvian letters.
export const OG_SIZE={width:1200,height:630};
const PURPLE='#5b2a86',CARMINE='#a3122f',INK='#1d1b22';

export function ogCard({kicker='',title='',line=''}){
 const size=title.length>70?56:title.length>40?66:78;
 return <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',
  padding:'64px 72px',background:'#faf7f2',color:INK,fontFamily:'Geist'}}>
  <div style={{display:'flex',alignItems:'center',fontSize:40,fontWeight:700,color:PURPLE}}>
   meets<span style={{color:CARMINE}}>.</span>lv
  </div>
  <div style={{display:'flex',flexDirection:'column'}}>
   {kicker&&<div style={{fontSize:30,color:CARMINE,marginBottom:18,textTransform:'uppercase',letterSpacing:2}}>{kicker}</div>}
   <div style={{fontSize:size,lineHeight:1.1,fontWeight:700}}>{title.length>110?title.slice(0,109)+'…':title}</div>
  </div>
  <div style={{fontSize:32,color:'#57525f'}}>{line}</div>
 </div>;
}
