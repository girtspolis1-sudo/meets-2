// The meets.lv sun mark, as on the site icon (app/icon.svg), in the current colour.
export default function MeetsSunMark({className}){
 return <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <path d="M32 7v7M19 11l5 6M45 11l-5 6" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round"/>
  <text x="32" y="45" textAnchor="middle" fill="currentColor" fontSize="33" fontWeight="900" letterSpacing="-3" style={{fontFamily:'var(--font-display)'}}>ee</text>
 </svg>;
}
