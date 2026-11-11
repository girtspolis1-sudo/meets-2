-- The address register match looked up the municipality of every house with the
-- same street name and number in the country (hundreds for "Skolas iela 1"), which
-- made the institutions' coordinate check run into the statement timeout. The
-- stored address text now narrows the houses down first; the result is the same.

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
  v_stems text := ' '||meets_private.lv_stems(p_text)||' ';
  v_found jsonb;
  v_hits jsonb := '[]'::jsonb;
  v_total integer;
  v_confirmed integer;
begin
  if p_municipality_id is null or btrim(coalesce(p_text,''))='' then return jsonb_build_object('status','none'); end if;
  select m.name ~ ' valstspilsēta$',meets_private.plain_text(regexp_replace(m.name,' novads$',' nov'))
    into v_city,v_area from public.municipalities m where m.id=p_municipality_id;
  if v_city is null then return jsonb_build_object('status','none'); end if;

  foreach v_segment in array regexp_split_to_array(p_text,'[,;()]') loop
    v_match := substring(v_segment from '((?:\S+\s+){0,4}(?:iela|ielā|gatve|gatvē|bulvāris|bulvārī|prospekts|prospektā|laukums|laukumā|šoseja|šosejā|ceļš|ceļā|aleja|alejā|krastmala|krastmalā|līnija|līnijā|dambis|dambī)\s+\d+(?:\s?[A-Za-z](?![[:alnum:]]))?(?:\s?[/-]\s?\d+[A-Za-z]?(?![[:alnum:]]))?)');
    continue when v_match is null;
    -- "Bibliotēka Kalēju iela 9": the longest street name the register knows wins,
    -- so "Lielā Dārza iela 5" is never read as "Dārza iela 5".
    v_words := regexp_split_to_array(btrim(v_match),'\s+');
    for i in 1..greatest(1,cardinality(v_words)-2) loop
      select jsonb_agg(jsonb_build_object('kods',a.kods,'std',a.std,'latitude',a.latitude,'longitude',a.longitude,
               'confirmed',v_city or exists(
                  select 1 from unnest(meets_private.std_locality_stems(a.std)) s where position(' '||s||' ' in v_stems)>0)))
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

  select count(distinct h->>'kods'),count(distinct h->>'kods') filter (where (h->>'confirmed')::boolean)
    into v_total,v_confirmed from jsonb_array_elements(v_hits) h;
  if v_total=0 then return jsonb_build_object('status','none'); end if;
  if v_confirmed=1 then
    return (select (h-'confirmed')||jsonb_build_object('status','match') from jsonb_array_elements(v_hits) h
             where (h->>'confirmed')::boolean limit 1);
  end if;
  if v_confirmed=0 and v_total=1 then
    return (v_hits->0)-'confirmed'||jsonb_build_object('status','unconfirmed');
  end if;
  return jsonb_build_object('status','ambiguous','count',v_total);
end
$$;

revoke execute on function meets_private.location_auto_register_match(text,bigint) from public,anon,authenticated;
