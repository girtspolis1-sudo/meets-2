import {statusChip} from '../../lib/event-row.js';

// One status chip for the organizer workspace and admin (lib/event-row.js).
export default function StatusChip({status,label}){
 const s=statusChip(status);
 return <span className={'status-chip status-'+s.tone}>{label||s.label}</span>;
}
