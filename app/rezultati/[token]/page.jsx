import {notFound} from 'next/navigation';
import ScorerBoard from './scorer-board.jsx';
import {readScorerTournament} from '../../../lib/tournament-server.js';

export const dynamic='force-dynamic';
export const metadata={title:'Rezultātu ievade',robots:{index:false,follow:false}};

// A court secretary's page, opened by the court link the organizer gave out.
export default async function ScorerPage({params}){
 const {token}=await params;
 let data=null;
 try{data=await readScorerTournament(token);}catch{}
 if(!data)notFound();
 return <ScorerBoard token={token} initial={data}/>;
}
