// Public address of an organizer page: the name (/organizatori/balvu-sporta-zale), or the id until a name link exists.
export function organizerPath(org){return '/organizatori/'+encodeURIComponent(org?.slug||org?.id||'');}
