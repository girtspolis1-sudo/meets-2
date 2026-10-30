'use client';

import Link from 'next/link';
import {useState} from 'react';
import {useAdminSession} from './use-admin-session.js';
import {signOutAccount} from '../lib/admin-auth.js';

export default function AdminFooterControl(){
 const {isAdmin}=useAdminSession();
 const [loggingOut,setLoggingOut]=useState(false);

 async function logout(){
  setLoggingOut(true);
  await signOutAccount();
  setLoggingOut(false);
  if(window.location.pathname.startsWith('/admin'))window.location.assign('/admin');
 }

 return <div className="admin-footer-control" aria-label="Admin piekļuve">
  {isAdmin?<>
   <Link className="admin-footer-link active" href="/admin">Admin vide</Link>
   <button type="button" className="admin-footer-link logout" onClick={logout} disabled={loggingOut}>{loggingOut?'Izrakstās…':'Izrakstīties'}</button>
  </>:<Link className="admin-footer-link" href="/admin">Admin ielogoties</Link>}
 </div>;
}
