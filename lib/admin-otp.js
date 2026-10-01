export function normalizeAdminOtp(value){
 return String(value||'').replace(/\D/g,'').slice(0,6);
}

export function isValidAdminOtp(value){
 return normalizeAdminOtp(value).length===6;
}
