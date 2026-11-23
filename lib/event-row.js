import {topicArt} from './topic-art.js';
import {cardLocation} from './discovery-card.js';
import {municipalityShortName} from './seo.js';

// Shared pieces of one event row (app/components/event-row.jsx), used on the
// listing pages, the map list, the profile, the organizer workspace and admin.
const MONTHS=['JAN','FEB','MAR','APR','MAI','JŪN','JŪL','AUG','SEP','OKT','NOV','DEC'];

// The date tile: day and month in the event's theme colour (the same palette as
// the card picture, topic-art.js).
export function rowTile(event){
 const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(event?.date_from||''));
 const art=topicArt(event||{});
 return {day:m?String(Number(m[3])):'—',month:m?MONTHS[Number(m[2])-1]||'':'',palette:art.palette,label:art.label};
}

// "Venue, Town" without repeating the town.
export function rowPlace(event){
 const town=event?.settlement||municipalityShortName(event?.municipality||'');
 const venue=cardLocation(event||{});
 return [venue,town&&town!==venue?town:''].filter(Boolean).join(', ');
}

// Organizer and admin status chips: one wording and one tone everywhere.
const STATUS={
 draft:['Melnraksts','muted'],
 pending_review:['Pārbaudē','wait'],
 rejected:['Jālabo','wait'],
 published:['Publicēts','ok'],
 auto_published:['Publicēts automātiski','ok'],
 private:['Privāts','muted'],
 declined:['Netika publicēts','bad'],
 cancelled:['Atcelts','bad']
};
export function statusChip(status){
 const [label,tone]=STATUS[status]||[status?String(status):'Nezināms','muted'];
 return {label,tone};
}
