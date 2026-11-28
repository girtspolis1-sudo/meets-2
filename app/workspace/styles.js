// The styles of the account and organizer pages (profile, saved events, organizer
// workspace, event/venue/tournament forms, admin), split from the root layout so
// public pages do not load them. Imported by those routes' layouts, in the same
// order as the root stylesheets they came from. Rules that also style public
// components stayed in app/*.css.
import './quick-flow.css';
import './profile-dashboard.css';
import './organizer-workspace.css';
import './tournament.css';
import './event-create.css';
