export function normalizeAdminOtp(value){
 return String(value||'').replace(/\D/g,'').slice(0,6);
}

export function isValidAdminOtp(value){
 return normalizeAdminOtp(value).length===6;
}

export function normalizeRecoveryCode(value){
 return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,24);
}

export function formatRecoveryCode(value){
 const normalized=normalizeRecoveryCode(value);
 return normalized.match(/.{1,6}/g)?.join('-')||'';
}

export function isValidRecoveryCode(value){
 return normalizeRecoveryCode(value).length===24;
}

