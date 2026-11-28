import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {ICONS,iconSvg} from '../lib/icon-paths.js';

// Design rules that hold for the whole site (prompt_dizaina_audits_labojumi.md):
// one line-icon family and no emoji in the interface.
function files(dir,ext){
 return readdirSync(dir).flatMap(name=>{
  const path=join(dir,name);
  return statSync(path).isDirectory()?files(path,ext):ext.some(e=>name.endsWith(e))?[path]:[];
 });
}
// Comments may name an emoji when they explain what replaced it.
const code=text=>text.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"`])\/\/.*$/gm,'$1').replace(/\{\/\*[\s\S]*?\*\/\}/g,'');
const EMOJI=/\p{Extended_Pictographic}/u;

test('no emoji in the interface code',()=>{
 const found=[];
 for(const file of [...files('app',['.jsx','.js']),...files('lib',['.js'])]){
  code(readFileSync(file,'utf8')).split('\n').forEach((line,i)=>{
   // Arrows (→ ↗ ←), © ® and ™ are typography, not pictures.
   if(EMOJI.test(line.replace(/[\u2190-\u21ff©®™]/g,'')))found.push(file+':'+(i+1)+': '+line.trim().slice(0,80));
  });
 }
 assert.deepEqual(found,[]);
});

test('every icon renders as a line drawing',()=>{
 for(const name of Object.keys(ICONS)){
  const svg=iconSvg(name);
  assert.match(svg,/^<svg [^>]*fill="none" stroke="currentColor"/,name);
  assert.ok(ICONS[name].length>0,name);
 }
 assert.equal(iconSvg('nav-tada'),iconSvg('event'),'unknown names fall back to the event icon');
});

// Colours: the palette lives in app/meets-theme.css. Hex colours elsewhere may only
// go down from here (round 8 replaced those of the public stylesheets with tokens;
// globals.css and the admin follow step by step). Lower the number when you remove more.
const HEX_BASELINE=1481;
test('hex colours outside meets-theme.css do not grow',()=>{
 let count=0;
 for(const file of files('app',['.css'])){
  if(file.endsWith('meets-theme.css'))continue;
  count+=(readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').match(/#[0-9a-fA-F]{3,8}\b/g)||[]).length;
 }
 assert.ok(count<=HEX_BASELINE,'hex colours outside meets-theme.css: '+count+' (baseline '+HEX_BASELINE+'); use var(--…) from meets-theme.css');
});

// Text size: nothing below 12 px on public and personal pages. Admin rules may use
// 11 px; the printed tournament sheets (A4) keep their own sizes.
const ADMIN_SELECTOR=/admin|import-health|municipality-sources|source-channel|source-sync|mapping-|feed-format|quality-badge|geocode-result|kbd|table-subline/;
const PRINT_SELECTOR=/tn-sheet|tn-grid|tn-court|tn-repeat|tn-print/;
const toPx=value=>{const m=/^([0-9.]+)(px|rem)$/.exec(String(value).trim());return m?(m[2]==='rem'?parseFloat(m[1])*16:parseFloat(m[1])):null;};
// Rules with the at-rules they sit in: [{selector, body, context}].
function cssRules(text){
 const out=[],stack=[];let buf='';
 for(const ch of text.replace(/\/\*[\s\S]*?\*\//g,'')){
  if(ch==='{'){stack.push(buf.trim());buf='';}
  else if(ch==='}'){const head=stack.pop();if(head!==undefined&&!head.startsWith('@'))out.push({selector:head,body:buf,context:stack.join(' ')});buf='';}
  else buf+=ch;
 }
 return out;
}
test('no font smaller than 12 px outside the admin and the print sheets',()=>{
 const small=[];
 for(const file of files('app',['.css'])){
  for(const {selector,body,context} of cssRules(readFileSync(file,'utf8'))){
   if(/print/.test(context)||PRINT_SELECTOR.test(selector)||/keyframes/.test(context))continue;
   const min=ADMIN_SELECTOR.test(selector)?11:12;
   for(const d of body.matchAll(/(?:^|;)\s*font-size\s*:\s*([0-9.]+(?:px|rem))/g)){const px=toPx(d[1]);if(px!==null&&px<min)small.push(file+': '+selector.slice(0,60)+' '+d[1]);}
   for(const d of body.matchAll(/(?:^|;)\s*font\s*:[^;]*?(?:^|\s)([0-9.]+(?:px|rem))(?=\/|\s)/g)){const px=toPx(d[1]);if(px!==null&&px<min)small.push(file+': '+selector.slice(0,60)+' font '+d[1]);}
  }
 }
 assert.deepEqual(small,[]);
});
