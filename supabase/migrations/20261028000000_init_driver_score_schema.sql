-- OCTA Driver Score: schema (applied to Supabase project qjakepgeqioqrmsufaty "box-drive", region eu-central-1).
-- Summaries + events are the source of truth; raw traces are optional and short-lived.

create table public.drivers (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  lic_years numeric,
  exp_hours numeric not null default 0,
  exp_buckets jsonb not null default '{}'::jsonb,
  claims_3y int not null default 0,
  note jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index drivers_user_idx on public.drivers (user_id);

create table public.cars (
  id text primary key,
  name text not null,
  plate text,
  claims_3y int not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.driver_cars (
  driver_id text not null references public.drivers(id) on delete cascade,
  car_id text not null references public.cars(id) on delete cascade,
  primary key (driver_id, car_id)
);
create index driver_cars_car_idx on public.driver_cars (car_id);

create table public.trips (
  id text primary key,
  driver_id text not null references public.drivers(id) on delete cascade,
  car_id text references public.cars(id) on delete set null,
  start_at timestamptz not null,
  source text not null default 'phone' check (source in ('phone','synthetic','assetto-corsa')),
  mode text not null default 'car',
  mode_conf real, role_conf real, confirmed boolean,
  weather text, traffic text, road_type text,
  counted boolean not null default true,
  reason text,
  duration_s real not null, km real not null, dark_km real not null default 0,
  brake int not null default 0, accel int not null default 0, corner int not null default 0,
  over_lim_s real not null default 0, over_safe_s real not null default 0, severe_s real not null default 0,
  phone_ev int not null default 0, phone_s real not null default 0, max_g real,
  parkings int not null default 0, lot_cycles int not null default 0, lot_s real not null default 0, lot_over_s real not null default 0,
  lot_max int not null default 0, surge int not null default 0, bump int not null default 0,
  created_at timestamptz not null default now()
);
create index trips_driver_idx on public.trips (driver_id, start_at desc);
create index trips_car_idx on public.trips (car_id, start_at desc);

create table public.trip_events (
  id bigint generated always as identity primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  t_idx int not null,
  type text not null check (type in ('brake','accel','corner','phone','surge','bump','lot')),
  g real,
  data jsonb
);
create index trip_events_trip_idx on public.trip_events (trip_id);

create table public.trip_traces (
  trip_id text primary key references public.trips(id) on delete cascade,
  step int not null default 1,
  v jsonb not null,
  ay100 jsonb not null,
  lim_runs jsonb not null,
  phone_ranges jsonb not null default '[]'::jsonb
);

create table public.consents (
  id bigint generated always as identity primary key,
  driver_id text not null references public.drivers(id) on delete cascade,
  purpose text not null check (purpose in ('collect','share_with_insurer','share_in_car_score')),
  granted boolean not null,
  at timestamptz not null default now()
);
create index consents_driver_idx on public.consents (driver_id, at desc);

create table public.score_snapshots (
  id bigint generated always as identity primary key,
  subject_type text not null check (subject_type in ('driver','car')),
  subject_id text not null,
  computed_at timestamptz not null default now(),
  params_version text not null,
  total real not null, sigma real, band text,
  weights jsonb, kpis jsonb
);
create index score_snapshots_subject_idx on public.score_snapshots (subject_type, subject_id, computed_at desc);

-- Row level security: everything locked by default
alter table public.drivers enable row level security;
alter table public.cars enable row level security;
alter table public.driver_cars enable row level security;
alter table public.trips enable row level security;
alter table public.trip_events enable row level security;
alter table public.trip_traces enable row level security;
alter table public.consents enable row level security;
alter table public.score_snapshots enable row level security;   -- no policies: service role (insurer API / scoring job) only

-- 1) public read of SYNTHETIC demo rows only
create policy demo_read on public.drivers for select to anon, authenticated using (is_demo);
create policy demo_read on public.cars for select to anon, authenticated using (is_demo);
create policy demo_read on public.driver_cars for select to anon, authenticated
  using (exists (select 1 from public.drivers d where d.id = driver_id and d.is_demo));
create policy demo_read on public.trips for select to anon, authenticated using (source = 'synthetic');
create policy demo_read on public.trip_events for select to anon, authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and t.source = 'synthetic'));
create policy demo_read on public.trip_traces for select to anon, authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and t.source = 'synthetic'));

-- 2) a signed-in user owns their own driver profile, trips, events, traces and consents
create policy own_all on public.drivers for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_all on public.driver_cars for all to authenticated
  using (exists (select 1 from public.drivers d where d.id = driver_id and d.user_id = (select auth.uid())))
  with check (exists (select 1 from public.drivers d where d.id = driver_id and d.user_id = (select auth.uid())));
create policy own_read on public.cars for select to authenticated
  using (exists (select 1 from public.driver_cars dc join public.drivers d on d.id = dc.driver_id where dc.car_id = cars.id and d.user_id = (select auth.uid())));
create policy own_all on public.trips for all to authenticated
  using (exists (select 1 from public.drivers d where d.id = driver_id and d.user_id = (select auth.uid())))
  with check (exists (select 1 from public.drivers d where d.id = driver_id and d.user_id = (select auth.uid())));
create policy own_all on public.trip_events for all to authenticated
  using (exists (select 1 from public.trips t join public.drivers d on d.id = t.driver_id where t.id = trip_id and d.user_id = (select auth.uid())))
  with check (exists (select 1 from public.trips t join public.drivers d on d.id = t.driver_id where t.id = trip_id and d.user_id = (select auth.uid())));
create policy own_all on public.trip_traces for all to authenticated
  using (exists (select 1 from public.trips t join public.drivers d on d.id = t.driver_id where t.id = trip_id and d.user_id = (select auth.uid())))
  with check (exists (select 1 from public.trips t join public.drivers d on d.id = t.driver_id where t.id = trip_id and d.user_id = (select auth.uid())));
create policy own_all on public.consents for all to authenticated
  using (exists (select 1 from public.drivers d where d.id = driver_id and d.user_id = (select auth.uid())))
  with check (exists (select 1 from public.drivers d where d.id = driver_id and d.user_id = (select auth.uid())));
