import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
const BASE=()=>process.env.SUPABASE_URL;
const KEY=()=>process.env.SUPABASE_PUBLISHABLE_KEY;
export async function POST(request){
 try{
  const {action,email,token,password,eventId}=await request.json();
  if(!BASE()||!KEY())return NextResponse.json({error:'Kontu serviss nav konfigurēts.'},{status:503});
  const authUrl=BASE()+'/auth/v1/';
  const head={apikey:KEY(),'Content-Type':'application/json'};
  if(action==='register'||action==='login'){
   if(typeof email!=='string'||email.length>254||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return NextResponse.json({error:'Ievadi korektu e-pastu.'},{status:400});
   if(typeof password!=='string'||password.length<8||password.length>128)return NextResponse.json({error:'Parolei jābūt vismaz 8 rakstzīmes garai.'},{status:400});
   const endpoint=action==='register'?'signup':'token?grant_type=password';
   const res=await fetch(authUrl+endpoint,{method:'POST',headers:head,body:JSON.stringify({email:email.trim().toLowerCase(),password}),cache:'no-store'});
   if(!res.ok){
    const info=await res.json().catch(()=>({}));
    const code=String(info.error_code||info.code||'');
    const message=String(info.msg||info.message||info.error_description||'');
    let error=action==='register'?'Neizdevās izveidot kontu.':'Nepareizs e-pasts vai parole, vai konts nav apstiprināts.';
    if(res.status===429||code.includes('rate_limit'))error='Sasniegts reģistrācijas vai e-pasta sūtīšanas limits. Uzgaidi un mēģini vēlāk.';
    else if(code==='email_address_invalid'||/email address.+invalid/i.test(message))error='Šī e-pasta adrese nav pieņemta. Pārbaudi adresi un izmanto derīgu e-pastu.';
    else if(code==='email_exists'||code==='user_already_exists')error='Šāds konts jau pastāv. Izvēlies “Man jau ir konts”.';
    else if(code==='email_not_confirmed')error='Kontam nepieciešams e-pasta apstiprinājums. Tas šobrīd ir ieslēgts Supabase Auth iestatījumos.';
    else if(code==='weak_password')error='Parole neatbilst drošības prasībām. Izvēlies garāku un drošāku paroli.';
    else if(code==='signup_disabled')error='Jaunu lietotāju reģistrācija šobrīd ir atspējota.';
    return NextResponse.json({error},{status:res.status===429?429:action==='register'?400:401});
   }
   const value=await res.json();
   if(!value.access_token){
    if(action==='register'){
     const login=await fetch(authUrl+'token?grant_type=password',{method:'POST',headers:head,body:JSON.stringify({email:email.trim().toLowerCase(),password}),cache:'no-store'});
     if(login.ok){
      const account=await login.json();
      if(account.access_token)return NextResponse.json({access_token:account.access_token,refresh_token:account.refresh_token,expires_in:account.expires_in,user:{id:account.user?.id,email:account.user?.email}});
     }
    }
    return NextResponse.json({ok:true,requiresConfirmation:true});
   }
   return NextResponse.json({access_token:value.access_token,refresh_token:value.refresh_token,expires_in:value.expires_in,user:{id:value.user?.id,email:value.user?.email}});
  }
  if(action==='refresh'){
   if(typeof token!=='string'||!token)return NextResponse.json({error:'Nav sesijas.'},{status:401});
   const res=await fetch(authUrl+'token?grant_type=refresh_token',{method:'POST',headers:head,body:JSON.stringify({refresh_token:token}),cache:'no-store'});
   if(!res.ok)return NextResponse.json({error:'Sesija beigusies.'},{status:401});
   const value=await res.json();return NextResponse.json({access_token:value.access_token,refresh_token:value.refresh_token,user:{id:value.user?.id,email:value.user?.email}});
  }
  if(!['list','add','remove','plan','unplan'].includes(action)||typeof token!=='string')return NextResponse.json({error:'Nederīgs pieprasījums.'},{status:400});
  const me=await fetch(authUrl+'user',{headers:{...head,Authorization:'Bearer '+token},cache:'no-store'});
  if(!me.ok)return NextResponse.json({error:'Jāpiesakās atkārtoti.'},{status:401});
  const user=await me.json();if(!user.id)return NextResponse.json({error:'Nav lietotāja.'},{status:401});
  const headers={...head,Authorization:'Bearer '+token,Prefer:'return=minimal'};
  if(action==='list'){
   const [fav,plans]=await Promise.all(['meets_favorites','meets_event_plans'].map(table=>fetch(BASE()+'/rest/v1/'+table+'?select=event_id&user_id=eq.'+encodeURIComponent(user.id),{headers,cache:'no-store'})));
   if(!fav.ok||!plans.ok)return NextResponse.json({error:'Neizdevās nolasīt saglabātos pasākumus.'},{status:502});
   return NextResponse.json({favorites:(await fav.json()).map(x=>x.event_id),plans:(await plans.json()).map(x=>x.event_id),email:user.email});
  }
  if(typeof eventId!=='string'||! /^[0-9a-f-]{36}$/i.test(eventId))return NextResponse.json({error:'Nederīgs pasākums.'},{status:400});
  const table=action==='plan'||action==='unplan'?'meets_event_plans':'meets_favorites';
  const adding=action==='add'||action==='plan';
  const res=await fetch(BASE()+'/rest/v1/'+table+(adding?'':'?user_id=eq.'+user.id+'&event_id=eq.'+eventId),{method:adding?'POST':'DELETE',headers:{...headers,...(adding?{Prefer:'resolution=ignore-duplicates,return=minimal'}:{})},...(adding?{body:JSON.stringify({user_id:user.id,event_id:eventId})}:{}) ,cache:'no-store'});
  if(!res.ok)return NextResponse.json({error:'Saglabāšana neizdevās.'},{status:400});
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Pieprasījums neizdevās.'},{status:500});}
}
