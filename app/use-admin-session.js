'use client';

import {useEffect,useState} from 'react';

const SESSION_KEY='meets_admin_access_token';

export function useAdminSession(){
 const [isAdmin,setIsAdmin]=useState(false);
 const [checked,setChecked]=useState(false);

 useEffect(()=>{
  let cancelled=false;

  const sync=async()=>{
   const token=sessionStorage.getItem(SESSION_KEY)||'';
   if(!token){
    if(!cancelled){setIsAdmin(false);setChecked(true);}
    return;
   }

   try{
    const response=await fetch('/api/admin/session',{
     method:'POST',
     headers:{Authorization:'Bearer '+token},
     cache:'no-store'
    });
    const data=await response.json();

    if(cancelled)return;

    if(data?.valid===true){
     setIsAdmin(true);
    }else{
     sessionStorage.removeItem(SESSION_KEY);
     setIsAdmin(false);
    }
   }catch{
    if(!cancelled)setIsAdmin(false);
   }finally{
    if(!cancelled)setChecked(true);
   }
  };

  sync();
  window.addEventListener('storage',sync);
  window.addEventListener('meets-admin-session-change',sync);

  return()=>{
   cancelled=true;
   window.removeEventListener('storage',sync);
   window.removeEventListener('meets-admin-session-change',sync);
  };
 },[]);

 return {isAdmin,checked};
}
