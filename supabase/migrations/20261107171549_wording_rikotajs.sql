-- Wording: "rīkotājs" (pasākuma rīkotājs) instead of "organizators" in the
-- texts that database functions write: e-mails to organizers and admins,
-- review history, error messages and place-search labels. The site already
-- says "rīkotājs". Addresses (/organizators?...), the fallback slug in
-- meets_organizations_set_slug and all code names stay as they are.
do $migration$
declare
  f record;
  def text;
  forms text[] := array[
    'organizatoriem','rīkotājiem','organizatorus','rīkotājus','organizatoram','rīkotājam',
    'organizatora','rīkotāja','organizatoru','rīkotāju','organizatori','rīkotāji','organizators','rīkotājs'];
  i int;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','meets_private') and p.prokind='f'
      and p.proname <> 'meets_organizations_set_slug'
      and pg_get_functiondef(p.oid) ~* 'organizator'
  loop
    def := pg_get_functiondef(f.oid);
    for i in 1..array_length(forms,1) by 2 loop
      -- Whole words only, never part of a path such as /organizators.
      def := regexp_replace(def,'(?<![/[:alnum:]_])'||forms[i]||'(?![[:alnum:]_])',forms[i+1],'g');
      def := regexp_replace(def,'(?<![/[:alnum:]_])'||initcap(forms[i])||'(?![[:alnum:]_])',initcap(forms[i+1]),'g');
    end loop;
    execute def;
  end loop;
end
$migration$;
