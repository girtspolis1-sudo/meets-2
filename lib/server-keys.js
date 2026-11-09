// Headers for Supabase calls that only the site's server may make.
// The catalogue (meets_public_catalog) is read with the server's secret key:
// the function is not open to the public key, so nobody can run the heavy
// query straight against Supabase. A new secret key (sb_secret_…) goes in
// `apikey` only; a legacy service_role JWT also needs the Authorization header.
// Until the key is set, the public key is used (it works while the function is
// still open to it).
export function catalogHeaders(env=process.env){
 const secret=String(env.SUPABASE_SECRET_KEY||'').trim();
 if(!secret)return {apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'};
 return {apikey:secret,...(secret.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+secret}),'Content-Type':'application/json'};
}
