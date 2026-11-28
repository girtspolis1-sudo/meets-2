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
