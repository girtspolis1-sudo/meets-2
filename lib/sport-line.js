import {sportLevel} from './sport-level.js';

// The league line of a sports event, shown on cards, rows and the event page:
// "Latvijas–Igaunijas līga", "LJBL · U16 puiši, Superlīga", "LHF jaunatne · U14".
// Empty for events that are not sports or have no competition. Pure; tests in
// tests/sport-line.test.js (the names there are real ones from the database).

const MAX=38;

// Official names that are too long for a card: what fans call them.
const SHORT=[
 [/^(?:\S+\s+)?latvijas\s*[–-]\s*igaunijas\s+basketbola\s+līga/i,'Latvijas–Igaunijas līga'],
 [/^(?:\S+\s+)?reģionālā\s+basketbola\s+līga/i,'Reģionālā basketbola līga'],
 [/^(?:\S+\s+)?nacionālā\s+basketbola\s+līga/i,'Nacionālā basketbola līga'],
 [/^sieviešu\s+baltijas\s+basketbola\s+līga/i,'Sieviešu Baltijas līga'],
 [/^latvijas\s+sieviešu\s+basketbola\s+līga/i,'Sieviešu basketbola līga'],
 [/^estonian\s*-\s*latvian\s+women\S*\s+handball\s+league/i,'Igaunijas–Latvijas sieviešu līga'],
 [/^baltijas\s+un\s+latvijas\s+čempionāts/i,'Baltijas un Latvijas čemp.'],
 [/^(?:latvijas\s+čempionāts|lč)\s+/i,'']
];
// Youth championships: the federation and the age group say it all.
const YOUTH=[
 [/bērnu\s+un\s+jaunatnes\s+čempionāts\s+hokejā/i,'LHF jaunatne',''],
 [/jaunatnes\s+čempionāts\s+telpu\s+futbolā/i,'LFF jaunatne','telpu futbols'],
 [/jaunatnes\s+čempionāts\s+futbolā/i,'LFF jaunatne',''],
 [/jaunatnes\s+čempionāts\s+volejbolā/i,'LVF jaunatne','']
];
// Stages that say nothing about a single game.
const PLAIN_STAGE=/^(?:regulārā sezona|regular season|pamatturnīrs|regulārais čempionāts)$/i;
const AGE=/(?<![a-zā-ž])u\s?-?\s?(\d{1,2})/i;

const clean=v=>String(v||'').replace(/\s+/g,' ').trim();

// A youth age group as a label: "U-15" → "U15", "U14 zēni", "U12 meitenes".
// Empty for anything else ("40+", "Vīrieši"): those say nothing a league name doesn't.
export function ageLabel(value){
 const text=clean(value);
 const age=AGE.exec(text);
 if(!age||Number(age[1])>21)return '';
 const rest=text.replace(AGE,'').replace(/\(\s*\d{4}\s*\)|\d{4}(?:\/\d{2,4})?/g,'').replace(/[(),\s]+/g,' ').trim().toLocaleLowerCase('lv');
 const gender=/^(?:zēni|meitenes|puiši|jaunieši|juniori|junior[eē]s)$/.test(rest)?' '+rest:'';
 return 'U'+age[1]+gender;
}

function shorten(text){
 if(text.length<=MAX)return text;
 let out='';
 for(const w of text.split(' ')){if((out+' '+w).trim().length>MAX-1)break;out=(out+' '+w).trim();}
 return (out||text.slice(0,MAX-1)).replace(/[,:;–-]+$/,'')+'…';
}

function leagueName(raw,ageGroup){
 let name=clean(raw)
  .replace(/\s+\d{4}(?:\/\d{2,4})?$/,'') // "… 2027", "… 2026/27": the season is obvious
  .replace(/[,:\s]+$/,'');
 for(const [re,to] of SHORT)name=clean(name.replace(re,to));
 const age=ageLabel(ageGroup);
 // "Zēni U14 (2013)", "Meitenes U12 (2015)" → "U14 zēni".
 if(/^(?:zēni|meitenes|puiši|jaunieši|juniori)\s+u\s?-?\s?\d/i.test(name))return {name:ageLabel(name)||age,age:''};
 // "U16 Puiši, Superlīga" → "U16 puiši, Superlīga".
 const lead=/^(u\s?-?\s?\d{1,2})\s+(puiši|meitenes|zēni)\b/i.exec(name);
 if(lead)return {name:ageLabel(lead[1])+' '+lead[2].toLocaleLowerCase('lv')+name.slice(lead[0].length),age:''};
 // "Kausa izcīņa U14 M" (age group "U14 zēni") → "Kausa izcīņa" + "U14 zēni".
 const tail=/^(.+?)\s+u\s?-?\s?\d{1,2}\s+[a-zā-ž]$/i.exec(name);
 if(tail&&age)return {name:tail[1],age};
 return {name,age:AGE.test(name)?'':age};
}

export function sportLine(event){
 if(!event||!sportLevel(event))return '';
 const raw=clean(event.competition_name);
 const parts=[];
 const youth=raw&&YOUTH.find(([re])=>re.test(raw));
 if(youth){
  const age=ageLabel(event.age_group)||ageLabel(raw);
  parts.push(youth[1]);
  const rest=[age,youth[2]].filter(Boolean).join(' ');
  if(rest)parts.push(rest);
 }else if(raw){
  const {name,age}=leagueName(raw,event.age_group);
  if(/ljbl/i.test(String(event.governing_body||''))&&!/ljbl/i.test(name))parts.push('LJBL');
  parts.push(shorten(name));
  if(age)parts.push(age);
 }else{
  const age=ageLabel(event.age_group);
  if(age)parts.push(age);
 }
 const stage=clean(event.competition_stage);
 if(stage&&!PLAIN_STAGE.test(stage)&&parts.length<3)parts.push(stage);
 return parts.filter(Boolean).join(' · ');
}

// Youth games carry a small "Jaunieši" mark next to the league line.
export const isYouthSport=event=>sportLevel(event)==='youth';
