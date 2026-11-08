'use client';
import {useEffect} from 'react';
import {track} from '../../lib/analytics.js';

// Sends one measurement event when a page opens (only with consent).
export default function TrackView({name,params}){
 const key=JSON.stringify(params||{});
 useEffect(()=>{track(name,params);},[name,key]);
 return null;
}
