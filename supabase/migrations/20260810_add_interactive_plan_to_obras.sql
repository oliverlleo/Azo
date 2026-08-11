alter table public.obras
  add column if not exists interactive_plan jsonb not null default '{"enabled":false,"imageUrl":"","storagePath":"","alt":"","hotspots":[]}'::jsonb;

alter table public.obras
  drop constraint if exists obras_interactive_plan_object;

alter table public.obras
  add constraint obras_interactive_plan_object
  check (jsonb_typeof(interactive_plan) = 'object');
