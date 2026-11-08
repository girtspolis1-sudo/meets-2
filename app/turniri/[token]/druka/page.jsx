import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {cache} from 'react';
import PrintToolbar from '../../print-toolbar.jsx';
import {PrintSheets,sheetChoices} from '../../print-sheets.jsx';
import {readSharedTournament} from '../../../../lib/tournament-server.js';
import {requestOrigin} from '../../../../lib/shared-event-server.js';
import {qrPath} from '../../../../lib/qr-path.js';

export const dynamic='force-dynamic';

const findTournament=cache(async token=>{try{return await readSharedTournament(token);}catch{return null;}});

export async function generateMetadata({params}){
 const {token}=await params;
 const t=await findTournament(token);
 return {title:t?'Drukai: '+t.title:'Turnīrs nav pieejams',robots:{index:false,follow:false}};
}

export default async function TournamentPrintPage({params,searchParams}){
 const {token}=await params;
 const {lapa=''}=await searchParams;
 const data=await findTournament(token);
 if(!data)notFound();
 const link=requestOrigin(await headers())+'/turniri/'+token;
 const choices=sheetChoices(data);
 const choice=choices.some(([key])=>key===lapa)?lapa:'visas';
 return <div className="tn-print-screen">
  <PrintToolbar backHref={'/turniri/'+token} choices={choices} choice={choice}/>
  <PrintSheets data={data} link={link} qr={qrPath(link)} choice={choice} showScores={!data.youth}/>
 </div>;
}
