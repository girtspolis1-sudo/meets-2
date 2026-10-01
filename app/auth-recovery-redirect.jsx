'use client';

import {useEffect} from 'react';

export default function AuthRecoveryRedirect(){
 useEffect(()=>{
  if(!window.location.hash)return;
  const params=new URLSearchParams(window.location.hash.slice(1));
  if(params.get('type')!=='recovery'||!params.get('access_token'))return;
  if(window.location.pathname==='/admin/password')return;
  window.location.replace('/admin/password'+window.location.hash);
 },[]);
 return null;
}
