import {Suspense} from 'react';
import ClaimEvent from './claim-event.jsx';

export const metadata={title:'Pieteikt savu pasākumu',robots:{index:false,follow:false}};

export default function ClaimEventPage(){
 return <Suspense fallback={<section className="meets-claim-page"><p role="status">Ielādē…</p></section>}><ClaimEvent/></Suspense>;
}
