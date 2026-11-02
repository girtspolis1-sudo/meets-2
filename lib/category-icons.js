// Line icons for event groups (24px grid, stroke = currentColor). One source
// for the filter chips, category tiles and the C3 map markers, so a marker
// shows exactly the icon of the filter it belongs to.
export const CATEGORY_ICON_PATHS={
 music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
 stage:'<path d="M3 5c3 1.3 8 1.3 11 0v6a5.5 5.5 0 0 1-11 0z"/><path d="M7 9h.01M10.5 9h.01M7.2 12.4c.9.8 2.2.8 3.1 0"/><path d="M16 9.5c1.7-.2 3.4-.7 5-1.5v5a5.5 5.5 0 0 1-6.5 5.4"/>',
 culture:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
 sport:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.8 2.8-1.5 4.4h-4.6l-1.5-4.4z"/><path d="M12 3v4.5M15.8 10.3l4.6-1.6M14.3 14.7l2.8 3.9M9.7 14.7l-2.8 3.9M8.2 10.3 3.6 8.7"/>',
 active:'<path d="m3 20 6.5-11 4 6.5 2.5-3.5L21 20z"/><circle cx="17" cy="6" r="2"/>',
 markets:'<path d="M4 4h16l1 6H3z"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 13v7h14v-7"/>',
 learning:'<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
 community:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M21 20c0-2.5-1.5-4-3.5-4.7"/>',
 family:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
 civic:'<path d="M3 21h18M3 10h18M12 3 3 8v2h18V8z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/>',
 event:'<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2.5"/>'
};

export function categoryIconName(group){return Object.hasOwn(CATEGORY_ICON_PATHS,group||'')?group:'event';}

// Markup for places that build HTML strings (Leaflet markers).
export function categoryIconSvg(group,size=22,strokeWidth=1.9){
 return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+strokeWidth+
  '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+CATEGORY_ICON_PATHS[categoryIconName(group)]+'</svg>';
}
