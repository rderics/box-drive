-- Assetto Corsa (game) trips are uploaded with source='simulator'. They contain no personal data, so the public live page may read them
-- (real phone trips stay private to their owner / the insurer API).
alter table public.trips drop constraint trips_source_check;
alter table public.trips add constraint trips_source_check check (source in ('synthetic','phone','simulator'));
create policy sim_read on public.trips for select using (source = 'simulator');
create policy sim_read on public.trip_events for select using (exists (select 1 from public.trips t where t.id = trip_events.trip_id and t.source = 'simulator'));
create policy sim_read on public.trip_traces for select using (exists (select 1 from public.trips t where t.id = trip_traces.trip_id and t.source = 'simulator'));
create policy sim_read on public.cars for select using (exists (select 1 from public.trips t where t.car_id = cars.id and t.source = 'simulator'));
create index if not exists trips_source_created_idx on public.trips (source, created_at desc);
