-- Talsu novads switched on its TVP RSS feed (confirmed 25.11.2026): RSS 2.0,
-- 20 latest items, same format as the eight feeds added in
-- 20261121075312_municipality_rss_feeds.sql. The source is the existing TVP
-- source for talsunovads.lv, so RSS and HTML events link by page address.
-- skip_types takes the column default (council and committee sittings).
insert into meets_private.calendar_feeds(url,label,municipality_id,source_id,default_category,active,feed_format,feed_format_locked)
select 'https://www.'||s.domain||'/lv/rss/events',m.name||' (RSS)',s.municipality_id,s.id,null,true,'rss',true
  from public.sources s
  join public.municipalities m on m.id=s.municipality_id
  join meets_private.source_registry r on r.source_id=s.id and r.source_format='tvp'
 where s.domain='talsunovads.lv'
on conflict(url) do nothing;
