export function adminRecoveryRedirect(origin){
 const base=String(origin||'').trim();
 if(!/^https?:\/\//i.test(base))throw new Error('Invalid recovery origin');
 const url=new URL('/admin/password',base);
 return url.toString();
}
