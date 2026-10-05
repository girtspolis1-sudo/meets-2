'use client';

import {useEffect} from 'react';

export default function AdminEnvironment(){
 useEffect(()=>{
  document.body.classList.add('admin-environment');
  return()=>document.body.classList.remove('admin-environment');
 },[]);

 return null;
}
