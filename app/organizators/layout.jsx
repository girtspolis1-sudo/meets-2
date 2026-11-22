import {pageMeta} from '../../lib/page-meta.js';

const TITLE='Pasākumu rīkošana: pievieno savu pasākumu';
const DESCRIPTION='Reģistrē pasākumus, turnīrus un vietas meets.lv: tie parādās kartē, pasākumu sarakstā un meklētājos rīkotāja vārdā.';

// The page itself is a client component, so its metadata lives here.
// The template keeps "| MEETS" on the pages below (a plain title would drop it).
export const metadata={title:{default:TITLE,template:'%s | MEETS'},description:DESCRIPTION,...pageMeta('/organizators',{title:TITLE,description:DESCRIPTION})};

export default function OrganizerLayout({children}){return children;}
