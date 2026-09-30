-- MEETS 2 municipality normalization for imported Latvian sports events.
-- Idempotent source-of-truth copy of the live database rule.

create or replace function meets_private.known_lv_municipality_name(p_locality text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case btrim(coalesce(p_locality,''))
    when 'Rīga' then 'Rīgas valstspilsēta'
    when 'Jelgava' then 'Jelgavas valstspilsēta'
    when 'Ventspils' then 'Ventspils valstspilsēta'
    when 'Valmiera' then 'Valmieras novads'
    when 'Rūjiena' then 'Valmieras novads'
    when 'Cēsis' then 'Cēsu novads'
    when 'Kandava' then 'Tukuma novads'
    when 'Jaunpils' then 'Tukuma novads'
    when 'Tukums' then 'Tukuma novads'
    when 'Bauska' then 'Bauskas novads'
    when 'Salaspils' then 'Salaspils novads'
    when 'Daugavpils' then 'Daugavpils valstspilsēta'
    when 'Grobiņa' then 'Dienvidkurzemes novads'
    when 'Nīca' then 'Dienvidkurzemes novads'
    when 'Priekule' then 'Dienvidkurzemes novads'
    when 'Jūrmala' then 'Jūrmalas valstspilsēta'
    when 'Liepāja' then 'Liepājas valstspilsēta'
    when 'Limbaži' then 'Limbažu novads'
    when 'Salacgrīva' then 'Limbažu novads'
    when 'Saldus' then 'Saldus novads'
    when 'Ādaži' then 'Ādažu novads'
    when 'Aizkraukle' then 'Aizkraukles novads'
    when 'Alūksne' then 'Alūksnes novads'
    when 'Gulbene' then 'Gulbenes novads'
    when 'Jēkabpils' then 'Jēkabpils novads'
    when 'Ķekava' then 'Ķekavas novads'
    when 'Līvāni' then 'Līvānu novads'
    when 'Madona' then 'Madonas novads'
    when 'Ogre' then 'Ogres novads'
    when 'Rēzekne' then 'Rēzeknes valstspilsēta'
    when 'Saulkrasti' then 'Saulkrastu novads'
    when 'Sigulda' then 'Siguldas novads'
    when 'Talsi' then 'Talsu novads'
    when 'Krāslava' then 'Krāslavas novads'
    when 'Valka' then 'Valkas novads'
    when 'Mārupe' then 'Mārupes novads'
    else null
  end
$$;

revoke all on function meets_private.known_lv_municipality_name(text)
from public, anon, authenticated;

create or replace function meets_private.assign_known_lv_municipality()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_name text;
  v_id bigint;
begin
  if new.municipality_id is null and new.country_code = 'LV' then
    v_name := meets_private.known_lv_municipality_name(new.locality_text);
    if v_name is not null then
      select id into v_id
      from public.municipalities
      where name=v_name
      limit 1;

      if v_id is not null then
        new.municipality_id := v_id;
        new.municipality_basis := 'Known Latvian locality mapping';
      end if;
    end if;
  end if;
  return new;
end
$$;

revoke all on function meets_private.assign_known_lv_municipality()
from public, anon, authenticated;

drop trigger if exists assign_known_lv_municipality_before_write
on public.event_locations;

create trigger assign_known_lv_municipality_before_write
before insert or update of country_code, locality_text, municipality_id
on public.event_locations
for each row execute function meets_private.assign_known_lv_municipality();

-- Safe idempotent backfill for existing basketball rows.
update public.event_locations l
set municipality_id=m.id,
    municipality_basis='Known Latvian locality mapping'
from public.municipalities m,
     public.event_sports_metadata sm
where sm.event_id=l.event_id
  and sm.sport_format='basketball'
  and l.country_code='LV'
  and l.municipality_id is null
  and m.name=meets_private.known_lv_municipality_name(l.locality_text);
