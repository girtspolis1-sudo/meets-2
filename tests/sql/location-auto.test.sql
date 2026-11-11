-- Tests of the automatic map points (migrations 20261111084937 and 20261111110000).
-- Runs in a scratch database prepared with tests/sql/stub-schema.sql; everything is
-- rolled back at the end. A failed check stops the script with an exception.
\set ON_ERROR_STOP 1
begin;

create function pg_temp.eq(p_what text, p_got anyelement, p_want anyelement) returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then
    raise exception 'FAILED: % — got %, expected %',p_what,coalesce(p_got::text,'null'),coalesce(p_want::text,'null');
  end if;
end $$;

insert into public.municipalities(id,name) values
 (1,'Aizkraukles novads'),(5,'Bauskas novads'),(12,'Krāslavas novads'),(17,'Ogres novads'),
 (19,'Rīgas valstspilsēta'),(25,'Ventspils novads'),(27,'Vairākas pašvaldības');
insert into public.sources(id,domain,map_visible) values(1,'example.lv',true);

insert into meets_private.address_register(kods,std,house_key,places,latitude,longitude)
select k,s,meets_private.address_key(split_part(s,', ',1)),
       meets_private.plain_text(regexp_replace(substr(s,length(split_part(s,', ',1))+3),',?\s*LV-\d{4}\s*$','')),la,lo
  from (values
   (1,'Skolas iela 19, Asūne, Asūnes pag., Krāslavas nov., LV-5676',56.0300,27.6300),
   (2,'Skolas iela 19, Indra, Indras pag., Krāslavas nov., LV-5664',55.8700,27.5300),
   (3,'Kalēju iela 9/11, Rīga, LV-1050',56.9480,24.1120),
   (4,'Lāčplēša iela 1, Ogre, Ogres nov., LV-5001',56.8160,24.6000),
   (5,'Lāčplēša iela 1, Lielvārde, Ogres nov., LV-5070',56.7200,24.8100),
   (6,'Lāčplēša iela 1, Aizkraukle, Aizkraukles nov., LV-5101',56.6000,25.2500),
   (7,'Dārza iela 5, Bauska, Bauskas nov., LV-3901',56.4100,24.1900),
   (8,'Lielā Dārza iela 5, Bauska, Bauskas nov., LV-3901',56.4150,24.1800),
   (9,'Rīgas iela 18, Iecava, Bauskas nov., LV-3913',56.5970,24.2030),
   (10,'Brīvības iela 17, Bauska, Bauskas nov., LV-3901',56.4080,24.1850),
   (11,'Brīvības iela 17B, Bauska, Bauskas nov., LV-3901',56.4085,24.1870),
   (12,'Brīvības iela 75, Rīga, LV-1001',56.9570,24.1270),
   (13,'Dārza iela 5, Iecava, Bauskas nov., LV-3913',56.6000,24.2100),
   (14,'Skolas iela 2, Rīga, LV-1010',56.9558,24.1157),
   (15,'Gaujas iela 1, Bauska, Bauskas nov., LV-3901',56.4090,24.1910),
   (16,'Dakteru iela 27, Bauska, Bauskas nov., LV-3901',56.4095,24.1920),
   (17,'Iecavas iela 3, Bauska, Bauskas nov., LV-3901',56.4120,24.1930),
   (18,'Iecavas iela 3, Iecava, Bauskas nov., LV-3913',56.5990,24.2060),
   (19,'Iecavas iela 4, Bauska, Bauskas nov., LV-3901',56.4121,24.1931)
  ) v(k,s,la,lo);

-- ---------------------------------------------------------------------------
-- Names and official addresses
-- ---------------------------------------------------------------------------
select pg_temp.eq('stems: Talsi cases',meets_private.lv_stems('Talsi')=meets_private.lv_stems('Talsu')
       and meets_private.lv_stems('Talsu')=meets_private.lv_stems('Talsos'),true);
select pg_temp.eq('stems: Cēsis/Cēsu',meets_private.lv_stems('Cēsis'),meets_private.lv_stems('Cēsu'));
select pg_temp.eq('stems: Rīga/Rīgā/Rīgas',meets_private.lv_stems('Rīgā Rīgas'),meets_private.lv_stems('Rīga Rīga'));
select pg_temp.eq('stems: Tukums/Tukumā',meets_private.lv_stems('Tukums'),meets_private.lv_stems('Tukumā'));
select pg_temp.eq('place key: abbreviation and hall',meets_private.location_place_key('Iecavas KN, 2. zāle'),
       meets_private.location_place_key('iecavas kultūras nams'));
select pg_temp.eq('municipality of a rural address',meets_private.std_municipality_id('Skolas iela 19, Asūne, Asūnes pag., Krāslavas nov., LV-5676'),12::bigint);
select pg_temp.eq('municipality of a city address',meets_private.std_municipality_id('Kalēju iela 9/11, Rīga, LV-1050'),19::bigint);
select pg_temp.eq('municipality of an unknown address',meets_private.std_municipality_id('Brīvības gatve 372 (Tirdzniecības parks)'),null::bigint);
select pg_temp.eq('locality stems',meets_private.std_locality_stems('Skolas iela 19, Asūne, Asūnes pag., Krāslavas nov., LV-5676'),array['asun']);
select pg_temp.eq('locality stems of a house name','liepup'=any(meets_private.std_locality_stems('"Duntes muiža", Liepupes pag., Limbažu nov., LV-4023')),true);

select pg_temp.eq('Rīga is in Latvia',meets_private.point_in_country('LV',56.95,24.10),true);
select pg_temp.eq('Šiauliai is not',meets_private.point_in_country('LV',55.93,23.31),false);
select pg_temp.eq('Valga is not',meets_private.point_in_country('LV',57.7900,26.0500),false);
select pg_temp.eq('Minsk is not',meets_private.point_in_country('LV',53.9,27.56),false);
select pg_temp.eq('unknown country',meets_private.point_in_country('EE',59.43,24.75),false);

-- ---------------------------------------------------------------------------
-- Step 1: address register
-- ---------------------------------------------------------------------------
create function pg_temp.reg(p_text text, p_municipality bigint) returns text language sql as
  $$ select j->>'status'||coalesce(':'||(j->>'kods'),'') from meets_private.location_auto_register_match(p_text,p_municipality) j $$;

select pg_temp.eq('address with its village',pg_temp.reg('Asūnes Tautas nams, Skolas iela 19, Asūne',12),'match:1');
select pg_temp.eq('same street in two villages, none named',pg_temp.reg('Tautas nams, Skolas iela 19',12),'ambiguous');
select pg_temp.eq('town named before the street',pg_temp.reg('Aizkraukle, Lāčplēša iela 1',1),'match:6');
select pg_temp.eq('locative street form',pg_temp.reg('Aizkrauklē, Lāčplēša ielā 1',1),'match:6');
select pg_temp.eq('another municipality''s town does not confirm',pg_temp.reg('Aizkraukle, Lāčplēša iela 1',17),'ambiguous');
select pg_temp.eq('city municipality needs no town',pg_temp.reg('Kalēju iela 9/11',19),'match:3');
select pg_temp.eq('address of another municipality',pg_temp.reg('Kalēju iela 9/11, Rīga',5),'none');
select pg_temp.eq('only address in the municipality, town not named',pg_temp.reg('Kultūras nams, Rīgas iela 18',5),'unconfirmed:9');
select pg_temp.eq('town named in the venue name',pg_temp.reg('Iecavas kultūras nams, Rīgas iela 18',5),'match:9');
select pg_temp.eq('longest street name wins',pg_temp.reg('Lielā Dārza iela 5, Bauska',5),'match:8');
select pg_temp.eq('short street name',pg_temp.reg('Dārza iela 5, Bauska',5),'match:7');
select pg_temp.eq('name before the street without a comma',pg_temp.reg('Bibliotēka Dārza iela 5, Bauska',5),'match:7');
select pg_temp.eq('next word is not a house letter',pg_temp.reg('Brīvības iela 17 Bauska',5),'match:10');
select pg_temp.eq('house letter',pg_temp.reg('Brīvības iela 17B, Bauska',5),'match:11');
select pg_temp.eq('house letter after a space',pg_temp.reg('Brīvības iela 17 B, Bauska',5),'match:11');
select pg_temp.eq('two addresses in one text',pg_temp.reg('Dārza iela 5, Lielā Dārza iela 5, Bauska',5),'ambiguous');
select pg_temp.eq('two addresses in one phrase',pg_temp.reg('Bauskas bibliotēka, Gaujas iela 1 un Dakteru iela 27',5),'ambiguous');
select pg_temp.eq('municipality name, one such address in it',pg_temp.reg('Bauskas novads, Brīvības iela 17',5),'match:10');
select pg_temp.eq('municipality name does not pick the town',pg_temp.reg('Bauskas novads, Dārza iela 5',5),'ambiguous');
select pg_temp.eq('municipality name and the town',pg_temp.reg('Bauskas novads, Dārza iela 5, Iecava',5),'match:13');
select pg_temp.eq('the street name does not name the town',pg_temp.reg('Sporta nams, Iecavas iela 3',5),'ambiguous');
select pg_temp.eq('town named outside the street',pg_temp.reg('Bauska, Iecavas iela 3',5),'match:17');
select pg_temp.eq('town named before the street, no comma',pg_temp.reg('Bauska Iecavas iela 3',5),'match:17');
select pg_temp.eq('street called after a town, only one such address',pg_temp.reg('Sporta nams, Iecavas iela 4',5),'unconfirmed:19');
select pg_temp.eq('no municipality',pg_temp.reg('Kalēju iela 9/11, Rīga',null),'none');
select pg_temp.eq('not one municipality',pg_temp.reg('Kalēju iela 9/11, Rīga',27),'none');
select pg_temp.eq('no street address',pg_temp.reg('Iecavas kultūras nams',5),'none');

-- ---------------------------------------------------------------------------
-- Reference load, coordinate check
-- ---------------------------------------------------------------------------
select public.meets_place_reference_import('centroids',$j$[
 ["201","104","Iecava","Iecava, Bauskas nov.","56.5975","24.2040"],
 ["202","104","Bauska","Bauska, Bauskas nov.","56.4080","24.1900"],
 ["203","106","Skaistkalne","Skaistkalne, Skaistkalnes pag., Bauskas nov.","56.3800","24.6450"],
 ["204","106","Code","Code, Codes pag., Bauskas nov.","56.4500","24.2000"],
 ["205","106","Kalni","Kalni, Codes pag., Bauskas nov.","56.4600","24.2300"],
 ["206","106","Kalni","Kalni, Vecsaules pag., Bauskas nov.","56.4000","24.3500"],
 ["207","105","Codes pag.","Codes pag., Bauskas nov.","56.4550","24.2100"],
 ["208","105","Vecsaules pag.","Vecsaules pag., Bauskas nov.","56.3900","24.3600"],
 ["209","105","Iecavas pag.","Iecavas pag., Bauskas nov.","56.6200","24.2500"],
 ["210","106","Pope","Pope, Popes pag., Ventspils nov.","57.4000","21.8600"],
 ["211","105","Popes pag.","Popes pag., Ventspils nov.","57.3800","21.9000"],
 ["212","113","Bauskas nov.","Bauskas nov.","56.4500","24.3000"],
 ["213","104","Rīga","Rīga","56.9871","24.1292"],
 ["214","104","Salaspils","Salaspils, Salaspils nov.","56.8600","24.3500"]
]$j$::jsonb,true,false);
select pg_temp.eq('municipality rows are not loaded',(select count(*) from meets_private.place_centroids),13::bigint);
-- With the towns known: a city address is refused when the text names another town.
select pg_temp.eq('another town named in a city event',pg_temp.reg('Iecavas koncertzāle, Skolas iela 2 Iecava',19),'unconfirmed:14');
select pg_temp.eq('another town named before the street, no comma',pg_temp.reg('Iecavas koncertzāle Skolas iela 2',19),'unconfirmed:14');
select pg_temp.eq('a street named after a town is fine',pg_temp.reg('Skolas iela 2, Rīga',19),'match:14');
select pg_temp.eq('the city itself',pg_temp.reg('Rīgas koncertzāle, Skolas iela 2',19),'match:14');
select pg_temp.eq('parish stem',(select name_stem from meets_private.place_centroids where kods=207),'cod');
select pg_temp.eq('centroid municipality',(select municipality_id from meets_private.place_centroids where kods=210),25::bigint);

select public.meets_place_reference_import('institutions',$j$[
 ["LV-KN-1","Kultūras centri","Kultūras nams","Iecavas kultūras nams","Rīgas iela 18, Iecava, Bauskas nov., LV-3913","56.5971","24.2031","https://kulturasdati.lv/lv/a"],
 ["LV-KN-2","Kultūras centri","Tautas nams","Skaistkalnes tautas nams","\"Tautas nams\", Skaistkalne, Skaistkalnes pag., Bauskas nov., LV-3924","56.3810","24.6460",""],
 ["LV-KN-3","Kultūras centri","Tautas nams","Codes tautas nams","\"Tautas nams\", Code, Codes pag., Bauskas nov., LV-3910","56.9500","24.1000",""],
 ["LV-BIB-1","Bibliotēkas","Publiskā bibliotēka","Iecavas bibliotēka","Rīgas iela 18, Iecava, Bauskas nov., LV-3913","56.5972","24.2032",""],
 ["LV-KN-4","Kultūras centri","Klubs / saieta nams","Vecsaules saieta nams","Dārza iela 5, Bauska, Bauskas nov., LV-3901","56.4101","24.1901",""],
 ["LV-KN-5","Kultūras centri","Klubs / saieta nams","Vecsaules saieta nams","Lielā Dārza iela 5, Bauska, Bauskas nov., LV-3901","56.4151","24.1801",""],
 ["LV-T-1","Teātri","Valsts teātris","Dailes teātris","Brīvības iela 75, Rīga, LV-1001","56.9571","24.1271",""],
 ["LV-KN-6","Kultūras centri","Klubs / saieta nams","Dzirnavu klubs","Rīgas iela 18, Iecava, Bauskas nov., LV-3913","56.5971","24.2031",""],
 ["LV-KN-7","Kultūras centri","Kultūras nams","Bauskas Kultūras centrs","Brīvības iela 17, Bauska, Bauskas nov., LV-3901","56.9000","24.9000",""],
 ["LV-M-1","Muzeji","Muzejs","Mūsas muzejs","\"Muzejs\", Ceraukstes pag., Bauskas nov., LV-3908","56.3500","24.2500",""]
]$j$::jsonb,true,true);
select pg_temp.eq('institutions wait for the coordinate check',(select count(*) from meets_private.culture_institutions where coord_check is not null),0::bigint);
select pg_temp.eq('check in parts: some left',public.meets_place_reference_check(4),6);
select pg_temp.eq('check in parts: none left',public.meets_place_reference_check(300),0);
select pg_temp.eq('point agrees with the register address',(select coord_check from meets_private.culture_institutions where isil='LV-KN-1'),'register');
select pg_temp.eq('house name, point near the village centre',(select coord_check from meets_private.culture_institutions where isil='LV-KN-2'),'settlement');
select pg_temp.eq('point far from the village',(select coord_check from meets_private.culture_institutions where isil='LV-KN-3'),null);
select pg_temp.eq('point far from the register address',(select coord_check from meets_private.culture_institutions where isil='LV-KN-7'),null);
select pg_temp.eq('no town or village to check against',(select coord_check from meets_private.culture_institutions where isil='LV-M-1'),null);
select pg_temp.eq('load state',(select state from meets_private.place_reference_load where kind='institutions'),'done');

-- ---------------------------------------------------------------------------
-- Step 2: institutions
-- ---------------------------------------------------------------------------
create function pg_temp.inst(p_name text, p_municipality bigint) returns text language sql as
  $$ select j->>'status'||coalesce(':'||(j->>'isil'),'') from meets_private.location_auto_institution_match(p_name,p_name,p_municipality) j $$;

select pg_temp.eq('town, then the institution',pg_temp.inst('Iecava, Iecavas kultūras nams',5),'match:LV-KN-1');
select pg_temp.eq('abbreviation and hall',pg_temp.inst('Iecavas KN, lielā zāle',5),'match:LV-KN-1');
select pg_temp.eq('parish, then the institution',pg_temp.inst('Skaistkalnes pagasts, Skaistkalnes tautas nams',5),'match:LV-KN-2');
select pg_temp.eq('another institution of the town',pg_temp.inst('Iecavas bibliotēka',5),'match:LV-BIB-1');
select pg_temp.eq('generic name',pg_temp.inst('Kultūras nams',5),'none');
select pg_temp.eq('extra word in the event name',pg_temp.inst('Iecavas kultūras nama parks',5),'none');
select pg_temp.eq('institution with more words',pg_temp.inst('Iecavas nams',5),'none');
select pg_temp.eq('unchecked coordinates are not used',pg_temp.inst('Codes tautas nams',5),'none');
select pg_temp.eq('two institutions of one name',pg_temp.inst('Vecsaules saieta nams, Bauska',5),'ambiguous');
select pg_temp.eq('city municipality',pg_temp.inst('Dailes teātris',19),'match:LV-T-1');
select pg_temp.eq('other municipality',pg_temp.inst('Dailes teātris',5),'none');
select pg_temp.eq('town not named',pg_temp.inst('Dzirnavu klubs',5),'unconfirmed:LV-KN-6');
select pg_temp.eq('town named',pg_temp.inst('Dzirnavu klubs, Iecava',5),'match:LV-KN-6');

-- ---------------------------------------------------------------------------
-- Step 3: bare town, village or parish
-- ---------------------------------------------------------------------------
create function pg_temp.sett(p_name text, p_municipality bigint) returns text language sql as
  $$ select j->>'status'||coalesce(':'||(j->>'kods'),'') from meets_private.location_auto_settlement_match(p_name,p_municipality) j $$;

select pg_temp.eq('village',pg_temp.sett('Pope',25),'match:210');
select pg_temp.eq('village in the locative',pg_temp.sett('Popē',25),'match:210');
select pg_temp.eq('parish',pg_temp.sett('Popes pagasts',25),'match:211');
select pg_temp.eq('town twice',pg_temp.sett('Iecavas pilsēta, Iecava',5),'match:201');
select pg_temp.eq('parish of the town name',pg_temp.sett('Iecavas pagasts',5),'match:209');
select pg_temp.eq('town with its municipality',pg_temp.sett('Iecava, Bauskas novads',5),'match:201');
select pg_temp.eq('two villages of one name',pg_temp.sett('Kalni',5),'ambiguous');
select pg_temp.eq('the parish decides',pg_temp.sett('Kalni, Codes pagasts',5),'match:205');
select pg_temp.eq('municipality alone',pg_temp.sett('Bauskas novads',5),'none');
select pg_temp.eq('town and a venue',pg_temp.sett('Iecava, Iecavas jauniešu centrs',5),'none');
select pg_temp.eq('village of another municipality',pg_temp.sett('Pope',5),'none');
select pg_temp.eq('an address is not a settlement',pg_temp.sett('Iecava 5',5),'none');
select pg_temp.eq('two different towns',pg_temp.sett('Iecava, Bauska',5),'none');

-- ---------------------------------------------------------------------------
-- Plan, apply, later imports, revert
-- ---------------------------------------------------------------------------
create function pg_temp.event(p_name text, p_venue text, p_address text, p_municipality bigint, p_status text default 'pending_review',
  p_country text default 'LV') returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.events(title,status,import_key,date_from) values(p_name,'pending_review','k-'||p_name,current_date+30) returning id into v_id;
  insert into public.event_sources(event_id,source_id,source_url) values(v_id,1,'https://example.lv/'||p_name);
  insert into public.event_locations(event_id,venue_name,address_raw,municipality_id,country_code,location_precision)
  values(v_id,p_venue,p_address,p_municipality,p_country,'unresolved');
  update public.events set status=p_status where id=v_id;
  return v_id;
end $$;
create function pg_temp.loc(p_name text) returns public.event_locations language sql as
  $$ select l from public.event_locations l join public.events e on e.id=l.event_id where e.title=p_name $$;
create function pg_temp.status(p_name text) returns text language sql as $$ select status from public.events where title=p_name $$;

select pg_temp.event('e1','Asūnes Tautas nams, Skolas iela 19, Asūne',null,12);
select pg_temp.event('e2','Asūnes tautas nams, Skolas iela 19, Asūne','Asūnes tautas nams, Skolas iela 19, Asūne',12);
select pg_temp.event('e3','Iecava, Iecavas kultūras nams',null,5);
select pg_temp.event('e4','Pope',null,25);
select pg_temp.event('e5','Kultūras nams',null,5);
select pg_temp.event('e7','Dailes teātris',null,19);
select pg_temp.event('e8','Pope',null,25,'pending_review','EE');
select pg_temp.event('e9','Kalēju iela 9/11',null,null);
select pg_temp.event('e11','Sporta halle','Dārza iela 5, Bauska',5);
select pg_temp.event('e12','Sporta halle','Lielā Dārza iela 5, Bauska',5);
select pg_temp.event('e15','Bauskas novads',null,5);
select pg_temp.event('e16','Kultūras nams, Rīgas iela 18',null,5);
-- A verified row 1 km from where the institutions table puts the same theatre.
select pg_temp.event('e6','Dailes teātris',null,19);
update public.event_locations set venue_point=st_setsrid(st_makepoint(24.1400,56.9650),4326)::geography,
       location_precision='venue',verified_at=now() where event_id=(pg_temp.loc('e6')).event_id;
-- Published earlier with the municipality centre.
select pg_temp.event('e10','Popes pagasts',null,25);
update public.event_locations set fallback_point=st_setsrid(st_makepoint(21.5600,57.3900),4326)::geography,
       location_precision='municipality_center' where event_id=(pg_temp.loc('e10')).event_id;
update public.events set status='published' where title='e10';

create function pg_temp.plan(p_name text) returns text language sql as $$
  select p.decision||coalesce(':'||p.method,'')||coalesce(':'||p.source_ref,'')
    from meets_private.location_auto_plan() p
   where (select id from public.events where title=p_name)=any(p.event_ids) $$;

select pg_temp.eq('plan e1',pg_temp.plan('e1'),'apply:address_register:var:1');
select pg_temp.eq('plan e2 is the same place',pg_temp.plan('e2'),'apply:address_register:var:1');
select pg_temp.eq('one place for e1 and e2',(select count(*) from meets_private.location_auto_plan() where place_key like 'asunes%'),1::bigint);
select pg_temp.eq('plan e3',pg_temp.plan('e3'),'apply:culture_institution:kulturasdati:LV-KN-1');
select pg_temp.eq('plan e4',pg_temp.plan('e4'),'apply:settlement_center:vzd-centroid:210');
select pg_temp.eq('plan e5',pg_temp.plan('e5'),'manual');
select pg_temp.eq('plan e7: verified point elsewhere',pg_temp.plan('e7'),'manual');
select pg_temp.eq('plan e7 reason',(select reason from meets_private.location_auto_plan() where sample_name='Dailes teātris'),
       'Tai pašai vietai citā pasākumā ir pārbaudīts punkts citur');
select pg_temp.eq('other countries are not planned',pg_temp.plan('e8'),null);
select pg_temp.eq('verified rows are not planned',pg_temp.plan('e6'),null);
select pg_temp.eq('plan e9: no municipality',pg_temp.plan('e9'),'manual');
select pg_temp.eq('plan e10',pg_temp.plan('e10'),'apply:settlement_center:vzd-centroid:211');
select pg_temp.eq('plan e11: one name, two addresses',pg_temp.plan('e11'),'manual');
select pg_temp.eq('plan e15: municipality alone',pg_temp.plan('e15'),'manual');
select pg_temp.eq('plan e16: town not named',pg_temp.plan('e16'),'manual');
select pg_temp.eq('plan e16 reason',(select reason from meets_private.location_auto_plan() where sample_name like 'Kultūras nams, Rīgas%'),
       'Adrese ir vienīgā novadā, bet tekstā nav nosaukta apdzīvotā vieta');
select pg_temp.eq('only the asked steps',(select count(*) from meets_private.location_auto_plan(array['settlement_center']) where decision='apply'),2::bigint);

-- Dry run writes nothing.
select pg_temp.eq('dry run summary',(meets_private.location_auto_run(true)->'byMethod'->'address_register'->>'events')::int,2);
select pg_temp.eq('dry run saves no place',(select count(*) from meets_private.location_auto_places),0::bigint);
select pg_temp.eq('dry run leaves e1',(pg_temp.loc('e1')).location_quality,'missing_point');

select pg_temp.eq('run: new places',(meets_private.location_auto_run()->>'newPlaces')::int,4);

select pg_temp.eq('e1 quality',(pg_temp.loc('e1')).location_quality,'source_exact');
select pg_temp.eq('e1 precision',(pg_temp.loc('e1')).location_precision,'exact_address');
select pg_temp.eq('e1 source',(pg_temp.loc('e1')).location_source,'var:1');
select pg_temp.eq('e1 not marked verified',(pg_temp.loc('e1')).verified_at,null::timestamptz);
select pg_temp.eq('e1 point',st_astext((pg_temp.loc('e1')).venue_point::geometry),'POINT(27.63 56.03)');
select pg_temp.eq('e2 has the same point',st_astext((pg_temp.loc('e2')).map_point::geometry),st_astext((pg_temp.loc('e1')).map_point::geometry));
select pg_temp.eq('e1 published',pg_temp.status('e1'),'published');
select pg_temp.eq('e3 quality',(pg_temp.loc('e3')).location_quality,'source_exact');
select pg_temp.eq('e3 precision',(pg_temp.loc('e3')).location_precision,'venue');
select pg_temp.eq('e3 source',(pg_temp.loc('e3')).location_source,'kulturasdati:LV-KN-1');
select pg_temp.eq('e3 published',pg_temp.status('e3'),'published');
select pg_temp.eq('e4 quality',(pg_temp.loc('e4')).location_quality,'fallback_center');
select pg_temp.eq('e4 precision',(pg_temp.loc('e4')).location_precision,'settlement_center');
select pg_temp.eq('e4 has no venue point',(pg_temp.loc('e4')).venue_point is null and (pg_temp.loc('e4')).fallback_point is not null,true);
select pg_temp.eq('a town centre does not publish',pg_temp.status('e4'),'pending_review');
select pg_temp.eq('e4 not publishable',(meets_private.event_publishability((pg_temp.loc('e4')).event_id)->>'allowed')::boolean,false);
select pg_temp.eq('e10 moved to the parish centre',st_astext((pg_temp.loc('e10')).fallback_point::geometry),'POINT(21.9 57.38)');
select pg_temp.eq('e10 stays published',pg_temp.status('e10'),'published');
select pg_temp.eq('e5 untouched',(pg_temp.loc('e5')).location_quality,'missing_point');
select pg_temp.eq('e7 untouched',(pg_temp.loc('e7')).location_auto_place_id,null::bigint);
select pg_temp.eq('verified e6 untouched',st_astext((pg_temp.loc('e6')).venue_point::geometry),'POINT(24.14 56.965)');
select pg_temp.eq('other country untouched',(pg_temp.loc('e8')).location_quality,'missing_point');
select pg_temp.eq('log: one row per event',(select count(*) from meets_private.location_auto_log),5::bigint);
select pg_temp.eq('log keeps the earlier point',(select previous->>'fallback_longitude' from meets_private.location_auto_log
       where event_id=(pg_temp.loc('e10')).event_id),'21.56');
select pg_temp.eq('log keeps the earlier status',(select previous->>'event_status' from meets_private.location_auto_log
       where event_id=(pg_temp.loc('e1')).event_id),'pending_review');

-- A second run changes nothing.
select pg_temp.eq('second run: no new places',(meets_private.location_auto_run()->>'newPlaces')::int,0);
select pg_temp.eq('second run: no new log rows',(select count(*) from meets_private.location_auto_log),5::bigint);

-- A later import of the same place gets the point at once.
select pg_temp.event('e13','ASŪNES TAUTAS NAMS, Skolas iela 19, Asūne',null,12);
select pg_temp.eq('new import: same point',st_astext((pg_temp.loc('e13')).venue_point::geometry),'POINT(27.63 56.03)');
select pg_temp.eq('new import: logged',(select count(*) from meets_private.location_auto_log where event_id=(pg_temp.loc('e13')).event_id),1::bigint);
-- …but not when its own text gives another address.
select pg_temp.event('e14','Asūnes Tautas nams, Skolas iela 19, Asūne','Skolas iela 19, Indra',12);
select pg_temp.eq('conflicting address is left alone',(pg_temp.loc('e14')).location_quality,'missing_point');
-- …and not when the import brings its own venue point.
select pg_temp.event('e17','Pope',null,25);
select pg_temp.eq('settlement applies on insert',(pg_temp.loc('e17')).location_quality,'fallback_center');

-- The weekly import writes the row again without a point: the automatic one stays.
update public.event_locations set venue_point=null,fallback_point=null,location_precision='unresolved',location_source=null
 where event_id=(pg_temp.loc('e1')).event_id;
select pg_temp.eq('re-import keeps the point',(pg_temp.loc('e1')).location_quality,'source_exact');
select pg_temp.eq('re-import is not logged again',(select count(*) from meets_private.location_auto_log where event_id=(pg_temp.loc('e1')).event_id),1::bigint);
-- An import that brings its own point keeps it.
update public.event_locations set venue_point=st_setsrid(st_makepoint(27.7000,56.1000),4326)::geography,location_precision='venue'
 where event_id=(pg_temp.loc('e13')).event_id;
select pg_temp.eq('own point kept',st_astext((pg_temp.loc('e13')).venue_point::geometry),'POINT(27.7 56.1)');
select pg_temp.eq('own point: no longer automatic',(pg_temp.loc('e13')).location_auto_place_id,null::bigint);
-- The place name changes: the old automatic point must not stay.
update public.event_locations set venue_name='Pavisam cita vieta',address_raw=null where event_id=(pg_temp.loc('e2')).event_id;
select pg_temp.eq('renamed: point dropped',(pg_temp.loc('e2')).map_point is null,true);
select pg_temp.eq('renamed: quality',(pg_temp.loc('e2')).location_quality,'missing_point');
-- A person verifies the row: it stops being automatic.
update public.event_locations set verified_at=now(),location_precision='venue' where event_id=(pg_temp.loc('e3')).event_id;
select pg_temp.eq('verified: quality',(pg_temp.loc('e3')).location_quality,'verified_exact');
select pg_temp.eq('verified: not automatic',(pg_temp.loc('e3')).location_auto_place_id,null::bigint);

-- One place, one point.
select pg_temp.eq('no place with two points',(
  select count(*) from (
    select l.location_auto_place_id from public.event_locations l where l.location_auto_place_id is not null
     group by 1 having count(distinct st_astext(l.map_point::geometry))>1) x),0::bigint);
select pg_temp.eq('no automatic point outside Latvia',(
  select count(*) from public.event_locations l where l.location_auto_place_id is not null
     and not meets_private.point_in_country('LV',st_y(l.map_point::geometry),st_x(l.map_point::geometry))),0::bigint);

-- Revert one place.
select pg_temp.eq('revert',meets_private.location_auto_revert(p_place_id=>(pg_temp.loc('e1')).location_auto_place_id,p_note=>'test')->>'events','1');
select pg_temp.eq('reverted: no point',(pg_temp.loc('e1')).map_point is null,true);
select pg_temp.eq('reverted: quality',(pg_temp.loc('e1')).location_quality,'missing_point');
select pg_temp.eq('reverted: precision',(pg_temp.loc('e1')).location_precision,'unresolved');
select pg_temp.eq('reverted: back to review',pg_temp.status('e1'),'pending_review');
select pg_temp.eq('reverted: place blocked',(select active from meets_private.location_auto_places where source_ref='var:1'),false);
select pg_temp.eq('reverted: not resolved again',pg_temp.plan('e1'),'manual');
select pg_temp.eq('reverted: run leaves it',(meets_private.location_auto_run()->>'newPlaces')::int,0);
select pg_temp.eq('reverted: still no point',(pg_temp.loc('e1')).map_point is null,true);
-- Revert a method: the earlier fallback point comes back.
select meets_private.location_auto_revert(p_method=>'settlement_center');
select pg_temp.eq('method revert: earlier point back',st_astext((pg_temp.loc('e10')).fallback_point::geometry),'POINT(21.56 57.39)');
select pg_temp.eq('method revert: earlier precision back',(pg_temp.loc('e10')).location_precision,'municipality_center');
select pg_temp.eq('method revert: was published before, stays',pg_temp.status('e10'),'published');
select pg_temp.eq('the institution place is still active',(select count(*) from meets_private.location_auto_places where active),1::bigint);
do $$ begin
  perform meets_private.location_auto_revert();
  raise exception 'FAILED: revert without a target must be refused';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Step 4: source page addresses
-- ---------------------------------------------------------------------------
select pg_temp.event('p1','Iecavas jauniešu centrs',null,5);
select pg_temp.event('p2','Bauskas pils',null,5);
select pg_temp.event('p3','Vecsaules parks',null,5);
select pg_temp.eq('step 4 is off: nothing to read',public.meets_location_source_pages_next(10),'[]'::jsonb);
select pg_temp.eq('plan stored',meets_private.location_auto_plan_refresh()>0,true);
select pg_temp.eq('forced: pages offered',jsonb_array_length(public.meets_location_source_pages_next(50,true))>=3,true);
select public.meets_location_source_pages_store(jsonb_build_array(
  jsonb_build_object('event_id',(pg_temp.loc('p1')).event_id,'url','https://example.lv/p1','status','ok',
                     'addresses',jsonb_build_array('Rīgas iela 18, Iecava','Brīvības iela 17, Bauska')),
  jsonb_build_object('event_id',(pg_temp.loc('p2')).event_id,'url','https://example.lv/p2','status','ok',
                     'addresses',jsonb_build_array('Brīvības iela 17, Bauska')),
  jsonb_build_object('event_id',(pg_temp.loc('p3')).event_id,'url','https://example.lv/p3','status','ok',
                     'addresses',jsonb_build_array('Brīvības iela 17, Bauska'))));
select pg_temp.eq('the site''s own address is dropped',meets_private.location_source_page_addresses((pg_temp.loc('p1')).event_id),array['Rīgas iela 18, Iecava']);
select pg_temp.eq('step 4 off: p1 stays manual',pg_temp.plan('p1'),'manual');
update meets_private.app_settings set value='on' where key='location_auto_source_pages';
select pg_temp.eq('step 4 on: p1 from the page',pg_temp.plan('p1'),'apply:source_page_address:var:9');
select pg_temp.eq('step 4 on: p2 has only the site address',pg_temp.plan('p2'),'manual');
select meets_private.location_auto_run();
select pg_temp.eq('p1 has the register point',st_astext((pg_temp.loc('p1')).venue_point::geometry),'POINT(24.203 56.597)');
select pg_temp.eq('p1 quality',(pg_temp.loc('p1')).location_quality,'source_exact');
select pg_temp.eq('a page address does not publish',pg_temp.status('p1'),'pending_review');
select pg_temp.eq('p1 asks for a look',(pg_temp.loc('p1')).location_review_reason,'Adrese nolasīta no avota lapas; jāapstiprina.');

-- ---------------------------------------------------------------------------
-- Rights
-- ---------------------------------------------------------------------------
select pg_temp.eq('no function is open to visitors or signed-in users',(
  select string_agg(p.oid::regprocedure::text,', ')
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where ((n.nspname='meets_private' and p.proname ~ '^(location_auto|location_place_key|location_name|location_source|lv_stems|std_|point|culture_|apply_auto)')
       or (n.nspname='public' and p.proname ~ '^meets_(place_reference|location_source)'))
     and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))),null::text);
select pg_temp.eq('new functions are security definer with an empty search_path',(
  select string_agg(p.oid::regprocedure::text,', ')
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where ((n.nspname='meets_private' and p.proname ~ '^(location_auto|location_source|culture_|apply_auto|point_in)')
       or (n.nspname='public' and p.proname ~ '^meets_(place_reference|location_source)'))
     and (not p.prosecdef or not coalesce(p.proconfig,'{}') @> array['search_path=""'])),null::text);

rollback;
\echo location-auto tests passed
