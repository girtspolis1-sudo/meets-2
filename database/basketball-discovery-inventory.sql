create table if not exists public.basketball_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_family text not null default 'basket.lv',
  section text not null,
  competition_group text,
  competition text not null,
  division text,
  age_group text,
  gender text,
  basketball_level text not null default 'unknown'
    check (basketball_level in ('youth','professional','regional','amateur','national_team','3x3','unknown')),
  domain text not null,
  calendar_url text not null,
  website_id text,
  parser_type text not null default 'sportradar',
  active boolean not null default true,
  discovery_status text not null default 'pending'
    check (discovery_status in ('pending','resolved','unresolved','error')),
  last_discovered_at timestamptz,
  last_fixture_count integer,
  last_window_count integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.basketball_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  window_from date not null,
  window_to date not null,
  status text not null default 'running'
    check (status in ('running','complete','partial','failed')),
  sources_total integer not null default 0,
  sources_resolved integer not null default 0,
  sources_ok integer not null default 0,
  sources_failed integer not null default 0,
  games_raw integer not null default 0,
  games_in_window integer not null default 0,
  games_unique integer not null default 0,
  games_existing integer not null default 0,
  games_new integer not null default 0,
  games_duplicate integer not null default 0,
  missing_location integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  error_text text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.basketball_discovery_items (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.basketball_discovery_runs(id) on delete cascade,
  source_key text not null,
  website_id text,
  source_match_id text,
  import_key text,
  date_from date,
  time_from time,
  home_team text,
  away_team text,
  venue_name text,
  source_url text,
  already_in_meets boolean not null default false,
  duplicate_in_discovery boolean not null default false,
  dedupe_key text,
  raw_data jsonb not null default '{}'::jsonb
);

create index if not exists basketball_sources_section_idx on public.basketball_sources(section);
create index if not exists basketball_sources_website_id_idx on public.basketball_sources(website_id);
create index if not exists basketball_discovery_items_run_idx on public.basketball_discovery_items(run_id);
create index if not exists basketball_discovery_items_dedupe_idx on public.basketball_discovery_items(dedupe_key);

alter table public.basketball_sources enable row level security;
alter table public.basketball_discovery_runs enable row level security;
alter table public.basketball_discovery_items enable row level security;
