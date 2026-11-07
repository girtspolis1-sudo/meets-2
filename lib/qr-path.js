import {encode} from 'uqr';

// A QR code as one SVG path (dark modules, rows merged into runs) and its size
// in modules. Medium error correction survives a crease or a smudge on paper.
export function qrPath(text){
 const {size,data}=encode(String(text||''),{ecc:'M',border:0});
 let d='';
 data.forEach((row,y)=>{
  for(let x=0;x<size;x++){
   if(!row[x])continue;
   let run=1;
   while(x+run<size&&row[x+run])run++;
   d+='M'+x+' '+y+'h'+run+'v1h-'+run+'z';
   x+=run-1;
  }
 });
 return {size,d};
}
