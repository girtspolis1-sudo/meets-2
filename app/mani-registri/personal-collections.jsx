'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
// Old personal collections remain stored for data preservation.
// The user-facing experience is now a single saved-events list.
export default function PersonalCollections(){
 const router=useRouter();
 useEffect(()=>{router.replace('/mani-pasakumi');},[router]);
 return <p role="status">Atver saglabātos pasākumus…</p>;
}
