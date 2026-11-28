import Link from 'next/link';
import {whenLabel} from '../../../lib/map-nearby.js';
import {sportLine} from '../../../lib/sport-line.js';

const gamesWord=n=>n+' '+(n%10===1&&n%100!==11?'spēle':'spēles');

// Leagues with their games: the name links to the league's page, then the number
// of games and the next one.
export default function LeagueList({leagues,today,label='Līgas'}){
 if(!leagues.length)return null;
 return <ul className="sport-leagues" aria-label={label}>{leagues.map(l=><li key={l.slug}>
  <Link href={l.path}><strong>{sportLine({...l.next,competition_stage:''})||l.name}</strong></Link>
  <small>{[l.sport,gamesWord(l.count)].filter(Boolean).join(' · ')}</small>
  <span>Nākamā: {whenLabel(l.next,today)} · {l.next.title}</span>
 </li>)}</ul>;
}
