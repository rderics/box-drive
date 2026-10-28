-- real road-weather inputs per trip (Open-Meteo model data; not a road sensor)
alter table public.trips
  add column temp_c real, add column precip_mm real, add column snow_cm real, add column visibility_m real,
  add column wmo_code int, add column weather_src text, add column ice_risk boolean;

-- users (incl. device-bound anonymous users) may register their own cars; LTAB/insurer-verified cars come later
alter table public.cars add column created_by uuid default auth.uid();
create policy cars_insert_own on public.cars for insert to authenticated
  with check (created_by = (select auth.uid()) and not is_demo);
create policy cars_select_created on public.cars for select to authenticated
  using (created_by = (select auth.uid()));

-- insurer / admin API keys: only a hash is stored; no RLS policies = service role only
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  key_hash text not null unique,
  role text not null check (role in ('insurer','admin')),
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.api_keys enable row level security;

-- abuse guard for device registration
create table public.device_registrations (id bigint generated always as identity primary key, at timestamptz not null default now());
alter table public.device_registrations enable row level security;
create index device_registrations_at_idx on public.device_registrations (at desc);