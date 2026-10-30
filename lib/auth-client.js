'use client';
// Supabase Auth calls made directly from the visitor's browser.
let configPromise=null;
function authConfig(){
 configPromise??=fetch('/api/auth-config').then(async response=>{
  if(!response.ok)throw new Error('Kontu serviss šobrīd nav pieejams. Mēģini vēlāk.');
  return response.json();
 }).catch(error=>{configPromise=null;throw error;});
 return configPromise;
}

function friendlyError(status,info,fallback){
 const code=String(info.error_code||info.code||'');
 const message=String(info.msg||info.message||info.error_description||'');
 if(status===429||code.includes('rate_limit'))return 'Pārāk daudz mēģinājumu. Uzgaidi dažas minūtes un mēģini vēlreiz.';
 if(code==='invalid_credentials'||/invalid login credentials/i.test(message))return 'Nepareizs e-pasts vai parole.';
 if(code==='email_not_confirmed')return 'Vispirms apstiprini e-pastu: atver saiti, ko nosūtījām uz tavu e-pastu.';
 if(code==='email_exists'||code==='user_already_exists')return 'Šāds konts jau pastāv. Pieslēdzies vai atjauno paroli.';
 if(code==='email_address_invalid'||/email address.+invalid/i.test(message))return 'Šī e-pasta adrese netiek pieņemta. Pārbaudi to.';
 if(code==='weak_password')return 'Parole ir pārāk vāja. Izvēlies garāku paroli ar burtiem un cipariem.';
 if(code==='same_password')return 'Jaunajai parolei jāatšķiras no iepriekšējās.';
 if(code==='signup_disabled')return 'Jaunu kontu reģistrācija šobrīd ir atslēgta.';
 if(code==='otp_expired'||code==='flow_state_expired')return 'Saite ir novecojusi. Pieprasi jaunu.';
 return fallback;
}

async function auth(path,{method='POST',body,token,fallback='Darbība neizdevās. Mēģini vēlreiz.'}={}){
 const {url,key}=await authConfig();
 let response;
 try{
  response=await fetch(url+'/auth/v1/'+path,{method,cache:'no-store',
   headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
 }catch{throw new Error('Nav savienojuma. Pārbaudi internetu un mēģini vēlreiz.');}
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(friendlyError(response.status,data,fallback));error.status=response.status;throw error;}
 return data;
}

// Keep only what the app needs; user metadata must not bloat localStorage.
function toSession(value){
 return {access_token:value.access_token,refresh_token:value.refresh_token,expires_in:value.expires_in,
  expires_at:Date.now()+Math.max(60,value.expires_in||3600)*1000,user:{id:value.user?.id,email:value.user?.email}};
}
const cleanEmail=email=>String(email||'').trim().toLowerCase();
const redirect=path=>window.location.origin+path;

export async function signIn(email,password){
 return toSession(await auth('token?grant_type=password',{body:{email:cleanEmail(email),password},fallback:'Neizdevās pieslēgties.'}));
}
// Returns a session, or {requiresConfirmation:true} when the e-mail must be confirmed first.
export async function signUp(email,password){
 const value=await auth('signup?redirect_to='+encodeURIComponent(redirect('/profils')),{body:{email:cleanEmail(email),password},fallback:'Neizdevās izveidot kontu.'});
 return value.access_token?toSession(value):{requiresConfirmation:true};
}
export async function refreshSession(refreshToken){
 return toSession(await auth('token?grant_type=refresh_token',{body:{refresh_token:refreshToken},fallback:'Sesija beigusies.'}));
}
export async function requestPasswordReset(email){
 await auth('recover?redirect_to='+encodeURIComponent(redirect('/atjaunot-paroli')),{body:{email:cleanEmail(email)},fallback:'Neizdevās nosūtīt saiti.'});
}
export async function updatePassword(accessToken,password){
 await auth('user',{method:'PUT',token:accessToken,body:{password},fallback:'Paroli neizdevās nomainīt.'});
}
// Revokes the refresh token on the server; the local session is cleared by the caller.
export async function signOut(accessToken){
 await auth('logout?scope=local',{token:accessToken,fallback:'Neizdevās izrakstīties.'}).catch(()=>{});
}
export async function fetchUser(accessToken){
 return auth('user',{method:'GET',token:accessToken,fallback:'Sesija beigusies.'});
}

// Reads the tokens Supabase appends to confirmation and recovery links (#access_token=…).
export async function readAuthRedirect(){
 const hash=new URLSearchParams(window.location.hash.slice(1));
 const clear=()=>window.history.replaceState(null,'',window.location.pathname+window.location.search);
 if(hash.get('error')||hash.get('error_code')){
  clear();
  return {error:friendlyError(400,{error_code:hash.get('error_code')},'Saite nav derīga. Pieprasi jaunu.')};
 }
 const accessToken=hash.get('access_token');
 if(!accessToken)return null;
 clear();
 const user=await fetchUser(accessToken);
 return {type:hash.get('type')||'',session:toSession({access_token:accessToken,refresh_token:hash.get('refresh_token'),expires_in:Number(hash.get('expires_in'))||3600,user})};
}
