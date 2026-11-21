import {ImageResponse} from 'next/og';
import {OG_SIZE,ogCard} from '../../lib/og-card.jsx';

// Default share image for pages without their own picture.
export function GET(){
 return new ImageResponse(ogCard({kicker:'Pasākumi tuvumā',title:'Pasākumi tev blakus. Lai kur tu būtu.',
  line:'Koncerti, izrādes, izstādes un sports visā Latvijā'}),{...OG_SIZE,headers:{'Cache-Control':'public, max-age=86400, s-maxage=86400'}});
}
