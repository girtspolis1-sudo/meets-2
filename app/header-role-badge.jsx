'use client';

import {useAdminSession} from './use-admin-session.js';

export default function HeaderRoleBadge(){
 const {isAdmin}=useAdminSession();
 return <span className={isAdmin?'preview admin-role-badge':'preview'}>
  {isAdmin?'ADMIN loma':'Izstrādes versija'}
 </span>;
}
