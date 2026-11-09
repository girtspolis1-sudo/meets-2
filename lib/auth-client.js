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
 if(code==='identity_already_exists')return 'Šis Google konts jau ir piesaistīts citam MEETS kontam.';
 if(code==='manual_linking_disabled'||/manual linking is disabled/i.test(message))return 'Google konta pievienošana šobrīd nav ieslēgta. Mēģini vēlāk.';
 if(code==='single_identity_not_deletable')return 'Šis ir vienīgais pieslēgšanās veids, to nevar atvienot.';
 if(code==='access_denied'||/access_denied/.test(String(info.error||'')))return 'Google pieslēgšanās tika atcelta.';
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

// Google, through Supabase: sign in, or with a session add Google to that
// account (manual identity linking). Supabase returns to `returnTo` with the
// session in the URL hash; readAuthRedirect() takes it from there. The note in
// sessionStorage makes sure a returned session was asked for in this tab, so a
// link with someone else's tokens cannot sign a visitor in.
const OAUTH_KEY='meets_oauth_pending',OAUTH_MS=15*60*1000;
export async function startGoogle({accessToken='',returnTo='/profils'}={}){
 const {url}=await authConfig();
 const back=encodeURIComponent(redirect(returnTo));
 let target=url+'/auth/v1/authorize?provider=google&redirect_to='+back;
 if(accessToken){
  const data=await auth('user/identities/authorize?provider=google&skip_http_redirect=true&redirect_to='+back,{method:'GET',token:accessToken,fallback:'Google kontu neizdevās pievienot.'});
  if(!data?.url)throw new Error('Google kontu neizdevās pievienot.');
  target=data.url;
 }
 try{sessionStorage.setItem(OAUTH_KEY,JSON.stringify({at:Date.now(),mode:accessToken?'link':'signin'}));}catch{}
 window.location.assign(target);
}
function takeOAuthPending(){
 try{
  const value=JSON.parse(sessionStorage.getItem(OAUTH_KEY)||'null');
  sessionStorage.removeItem(OAUTH_KEY);
  return value&&Date.now()-value.at<OAUTH_MS?value:null;
 }catch{return null;}
}
// Removes a sign-in method (the account keeps at least one).
export async function unlinkIdentity(accessToken,identityId){
 await auth('user/identities/'+encodeURIComponent(identityId),{method:'DELETE',token:accessToken,fallback:'Neizdevās atvienot.'});
}

// Reads the tokens Supabase appends to confirmation, recovery and Google
// returns (#access_token=…), or the error it sends back instead.
// type: 'google' for a Google return (linked: Google was added to the account),
// else Supabase's own type (signup, recovery, …).
export async function readAuthRedirect(){
 const hash=new URLSearchParams(window.location.hash.slice(1));
 const query=new URLSearchParams(window.location.search);
 const errorCode=hash.get('error_code')||query.get('error_code')||'';
 const failed=Boolean(hash.get('error')||errorCode||query.get('error')&&query.get('error_description'));
 const accessToken=hash.get('access_token');
 if(!failed&&!accessToken)return null;
 const pending=takeOAuthPending();
 const clean=new URLSearchParams(window.location.search);
 for(const key of ['error','error_code','error_description'])clean.delete(key);
 window.history.replaceState(null,'',window.location.pathname+(clean.toString()?'?'+clean:''));
 if(failed){
  const error=hash.get('error')||query.get('error')||'';
  return {type:pending?'google':'',error:friendlyError(400,{error_code:errorCode,error},pending?'Google pieslēgšanās neizdevās. Mēģini vēlreiz.':'Saite nav derīga. Pieprasi jaunu.')};
 }
 const type=hash.get('type')||'';
 // A Google return has no type; one this tab did not start is not used.
 if(!type&&!pending)return {type:'google',error:'Pieslēgšanās netika sākta šajā logā. Mēģini vēlreiz ar “Turpināt ar Google”.'};
 const user=await fetchUser(accessToken);
 return {type:type||'google',linked:!type&&pending?.mode==='link',
  session:toSession({access_token:accessToken,refresh_token:hash.get('refresh_token'),expires_in:Number(hash.get('expires_in'))||3600,user})};
}
