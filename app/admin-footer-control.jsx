'use client';

import Link from 'next/link';
import {useState} from 'react';
import {useAdminSession} from './use-admin-session.js';
import {signOutAccount} from '../lib/admin-auth.js';

// Shown only to a signed-in account that already has admin rights; visitors
// see no admin entry point at all.
export default function AdminFooterControl(){
 const {isAdmin}=useAdminSession();
 const [loggingOut,setLoggingOut]=useState(false);
 if(!isAdmin)return null;

 async function logout(){
  setLoggingOut(true);
  await signOutAccount();
  setLoggingOut(false);
  if(window.location.pathname.startsWith('/admin'))window.location.assign('/');
 }

 return <div className="admin-footer-control" aria-label="Admin piekļuve">
  <Link className="admin-footer-link active" href="/admin">Pārslēgties uz admin paneli</Link>
  <button type="button" className="admin-footer-link logout" onClick={logout} disabled={loggingOut}>{loggingOut?'Izrakstās…':'Izrakstīties'}</button>
 </div>;
}
