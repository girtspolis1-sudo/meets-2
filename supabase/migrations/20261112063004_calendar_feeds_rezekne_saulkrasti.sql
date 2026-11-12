-- Rēzekne and Saulkrasti publish their event calendars as iCalendar feeds
-- (WordPress "The Events Calendar" and "Events Manager"), with the venue and
-- street address of each event. They are read by sync-calendar-feeds every
-- night like the feeds added in Admin → Avoti. Their municipalities use their
-- own sites, not the state platform the weekly municipality import reads.
insert into meets_private.calendar_feeds(url,label,municipality_id,default_category,active)
select v.url,v.label,m.id,v.category,true
  from (values
    ('https://rezekne.lv/events/?ical=1','Rēzeknes valstspilsēta','Rēzeknes valstspilsēta','Kultūra'),
    ('https://saulkrasti.lv/events/?ical=1','Saulkrastu novads','Saulkrastu novads','Kultūra')
  ) v(url,label,municipality,category)
  join public.municipalities m on m.name=v.municipality
on conflict(url) do nothing;
