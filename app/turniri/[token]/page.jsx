import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {cache} from 'react';
import TournamentLive from './tournament-live.jsx';
import {readSharedTournament} from '../../../lib/tournament-server.js';
import {requestOrigin} from '../../../lib/shared-event-server.js';
import {qrPath} from '../../../lib/qr-path.js';
import {sportOf} from '../../../lib/tournament.js';
import {playDateLabel} from '../tournament-views.jsx';

export const dynamic='force-dynamic';

const findTournament=cache(async token=>{try{return await readSharedTournament(token);}catch{return null;}});

export async function generateMetadata({params}){
 const {token}=await params;
 const t=await findTournament(token);
 if(!t)return {title:'Turnīrs nav pieejams',robots:{index:false,follow:false}};
 const when=playDateLabel(t.play_date);
 return {
  title:t.title+' — grafiks un rezultāti',
  description:[sportOf(t.sport).name,when,t.venue].filter(Boolean).join(' · '),
  robots:{index:false,follow:false},
  openGraph:{title:t.title,description:'Spēļu grafiks, rezultāti un tabulas'}
 };
}

export default async function TournamentPage({params}){
 const {token}=await params;
 const tournament=await findTournament(token);
 if(!tournament)notFound();
 const link=requestOrigin(await headers())+'/turniri/'+token;
 return <TournamentLive token={token} initial={tournament} link={link} qr={qrPath(link)}/>;
}
