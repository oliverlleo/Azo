-- AZO Studio — módulo independente de Obras + SEO + QR
-- Não possui vínculo com public.projects nem public.project_settings.

create table if not exists public.obras (
  id uuid primary key default gen_random_uuid(),
  internal_name text not null,
  slug text not null unique,
  title text not null,
  eyebrow text not null default 'Obra AZO',
  excerpt text not null default '',
  location_public text not null default '',
  work_type text not null default '',
  area_label text not null default '',
  year_label text not null default '',
  status_label text not null default '',
  scope_label text not null default '',
  intro_title text not null default 'A obra',
  intro_body text not null default '',
  challenge_title text not null default 'O desafio',
  challenge_body text not null default '',
  solution_title text not null default 'A solução',
  solution_body text not null default '',
  highlights jsonb not null default '[]'::jsonb,
  services jsonb not null default '[]'::jsonb,
  related_obra_ids jsonb not null default '[]'::jsonb,
  gallery jsonb not null default '[]'::jsonb,
  hero_media_type text not null default 'image' check (hero_media_type in ('image','video')),
  hero_image_url text not null default '',
  hero_image_storage_path text not null default '',
  hero_image_alt text not null default '',
  hero_video_url text not null default '',
  hero_video_storage_path text not null default '',
  hero_video_poster_url text not null default '',
  hero_video_poster_storage_path text not null default '',
  hero_media_position_x smallint not null default 50 check (hero_media_position_x between 0 and 100),
  hero_media_position_y smallint not null default 50 check (hero_media_position_y between 0 and 100),
  hero_overlay smallint not null default 34 check (hero_overlay between 0 and 80),
  cta_title text not null default 'Planejando uma obra?',
  cta_text text not null default 'Converse com a AZO sobre o seu terreno, imóvel ou obra.',
  cta_label text not null default 'Solicitar uma conversa',
  cta_url text not null default '/contato.html',
  seo_title text not null default '',
  meta_description text not null default '',
  og_image_url text not null default '',
  allow_index boolean not null default true,
  published boolean not null default false,
  published_at timestamptz,
  archived boolean not null default false,
  show_in_menu boolean not null default false,
  menu_label text not null default '',
  show_in_obras_index boolean not null default true,
  show_related boolean not null default true,
  qr_enabled boolean not null default true,
  qr_campaign text not null default '',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.obra_redirects (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  from_slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists obras_public_idx on public.obras (published, show_in_obras_index, sort_order);
create index if not exists obras_menu_idx on public.obras (published, show_in_menu, sort_order);
create index if not exists obras_indexable_idx on public.obras (published, allow_index, updated_at desc);
create index if not exists obras_archived_idx on public.obras (archived, published, sort_order);
create index if not exists obras_created_by_idx on public.obras (created_by);
create index if not exists obras_updated_by_idx on public.obras (updated_by);
create index if not exists obra_redirects_lookup_idx on public.obra_redirects (from_slug) where active = true;
create index if not exists obra_redirects_obra_id_idx on public.obra_redirects (obra_id);

alter table public.obras enable row level security;
alter table public.obra_redirects enable row level security;

drop policy if exists "Public can read published obras" on public.obras;
create policy "Public can read published obras"
on public.obras for select
to anon
using (published = true and archived = false);

drop policy if exists "Admins manage obras" on public.obras;
create policy "Admins manage obras"
on public.obras for all
to authenticated
using ((select public.is_azo_admin()))
with check ((select public.is_azo_admin()));

drop policy if exists "Public can read active obra redirects" on public.obra_redirects;
create policy "Public can read active obra redirects"
on public.obra_redirects for select
to anon
using (active = true);

drop policy if exists "Admins manage obra redirects" on public.obra_redirects;
create policy "Admins manage obra redirects"
on public.obra_redirects for all
to authenticated
using ((select public.is_azo_admin()))
with check ((select public.is_azo_admin()));

-- O bucket já existe. Amplia apenas a capacidade/mimes para loops curtos de obra.
update storage.buckets
set file_size_limit = 83886080,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/avif','image/gif',
      'video/mp4','video/webm'
    ]::text[]
where id = 'azo-media';
