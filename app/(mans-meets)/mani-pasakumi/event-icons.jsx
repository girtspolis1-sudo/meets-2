import Icon from '../../components/line-icon.jsx';

// The personal pages' icons: names for the shared line icons (lib/icon-paths.js).
const I=name=>function PersonalIcon(){return <Icon name={name} size={16} strokeWidth={1.75}/>;};
export const PlanIcon=I('calendar-check');
export const HeartIcon=I('heart');
export const CheckIcon=I('check');
export const CalendarIcon=I('calendar-add');
export const RouteIcon=I('route');
export const ExternalIcon=I('external');
export const BellIcon=I('bell');
