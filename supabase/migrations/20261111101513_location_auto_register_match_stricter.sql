-- Three cases the dry run showed the address register match was too easy on:
-- 1. "Gaujas iela 1 un Dakteru iela 27": every street address of the text is now
--    read, so two addresses in one phrase are ambiguous, not the first one.
-- 2. "Mārupes novads, Bebru iela 10": the municipality's own name no longer says
--    which town is meant when the municipality has that address in several places.
-- 3. "Salaspils koncertzāle, Skolas iela 2 Salaspils" filed under Rīga: in a city
--    municipality the address is not accepted when the text names another town.

create or replace function meets_private.location_auto_register_match(p_text text, p_municipality_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_segment text;
  v_match text;
  v_words text[];
  v_city boolean;
  v_area text;
  -- Stems of the whole text, and of the text without "… novads" phrases.
  v_stems text := ' '||meets_private.lv_stems(p_text)||' ';
  v_stems_strict text := ' '||meets_private.lv_stems(regexp_replace(coalesce(p_text,''),'\S+\s+novad(s|a|ā|am|u)(?![[:alnum:]])',' ','gi'))||' ';
  v_rest text := coalesce(p_text,'');   -- the text without its street addresses
  v_other_town boolean := false;
  v_found jsonb;
  v_hits jsonb := '[]'::jsonb;
  v_total integer;
  v_strict integer;
  v_loose integer;
begin
  if p_municipality_id is null or btrim(coalesce(p_text,''))='' then return jsonb_build_object('status','none'); end if;
  select m.name ~ ' valstspilsēta$',meets_private.plain_text(regexp_replace(m.name,' novads$',' nov'))
    into v_city,v_area from public.municipalities m where m.id=p_municipality_id;
  if v_city is null then return jsonb_build_object('status','none'); end if;

  foreach v_segment in array regexp_split_to_array(p_text,'[,;()]') loop
    for v_match in
      select m[1] from regexp_matches(v_segment,'((?:\S+\s+){0,4}(?:iela|ielā|gatve|gatvē|bulvāris|bulvārī|prospekts|prospektā|laukums|laukumā|šoseja|šosejā|ceļš|ceļā|aleja|alejā|krastmala|krastmalā|līnija|līnijā|dambis|dambī)\s+\d+(?:\s?[A-Za-z](?![[:alnum:]]))?(?:\s?[/-]\s?\d+[A-Za-z]?(?![[:alnum:]]))?)','g') m
    loop
      v_rest := replace(v_rest,v_match,' ');
      -- "Bibliotēka Kalēju iela 9": the longest street name the register knows wins,
      -- so "Lielā Dārza iela 5" is never read as "Dārza iela 5".
      v_words := regexp_split_to_array(btrim(v_match),'\s+');
      for i in 1..greatest(1,cardinality(v_words)-2) loop
        select jsonb_agg(jsonb_build_object('kods',a.kods,'std',a.std,'latitude',a.latitude,'longitude',a.longitude,
                 'strict',exists(select 1 from unnest(meets_private.std_locality_stems(a.std)) s where position(' '||s||' ' in v_stems_strict)>0),
                 'loose',exists(select 1 from unnest(meets_private.std_locality_stems(a.std)) s where position(' '||s||' ' in v_stems)>0)))
          into v_found
          from meets_private.address_register a
         where a.house_key=meets_private.address_key(array_to_string(v_words[i:],' '))
           -- A cheap test on the stored text first: "… kraslavas nov", or no municipality at all for a city.
           and case when v_city then a.places !~ ' nov$' else right(a.places,length(v_area)+1)=' '||v_area or a.places=v_area end
           and meets_private.std_municipality_id(a.std)=p_municipality_id;
        if v_found is not null then
          v_hits := v_hits||v_found;
          exit;
        end if;
      end loop;
    end loop;
  end loop;

  select count(distinct h->>'kods'),
         count(distinct h->>'kods') filter (where (h->>'strict')::boolean),
         count(distinct h->>'kods') filter (where (h->>'loose')::boolean)
    into v_total,v_strict,v_loose from jsonb_array_elements(v_hits) h;
  if v_total=0 then return jsonb_build_object('status','none'); end if;

  if v_city then
    -- All addresses of a city municipality are in the city; another town in the text means the event is elsewhere.
    select exists (
      select 1 from meets_private.place_centroids c
       where c.kind='city' and c.municipality_id is distinct from p_municipality_id
         and position(' '||c.name_stem||' ' in ' '||meets_private.lv_stems(v_rest)||' ')>0) into v_other_town;
    if v_total>1 then return jsonb_build_object('status','ambiguous','count',v_total); end if;
    return ((v_hits->0)-'strict'-'loose')||jsonb_build_object('status',case when v_other_town then 'unconfirmed' else 'match' end);
  end if;

  if v_strict=1 then
    return (select (h-'strict'-'loose')||jsonb_build_object('status','match') from jsonb_array_elements(v_hits) h
             where (h->>'strict')::boolean limit 1);
  end if;
  if v_total=1 then
    return ((v_hits->0)-'strict'-'loose')||jsonb_build_object('status',case when v_loose=1 then 'match' else 'unconfirmed' end);
  end if;
  return jsonb_build_object('status','ambiguous','count',v_total);
end
$$;

revoke execute on function meets_private.location_auto_register_match(text,bigint) from public,anon,authenticated;
