-- AZO Conteúdos — schema aplicado no projeto ProjectAZO (jjrsbbgnqfiezhokxbqz)
-- Mantido no repositório para que o backend tenha fonte versionada junto da PR.

create table if not exists public.content_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  slug text not null unique,
  excerpt text not null default '',
  status text not null default 'draft' check (status in ('draft','review','scheduled','published','archived')),
  category_id uuid references public.content_categories(id) on delete set null,
  cover_url text,
  cover_storage_path text,
  cover_alt text not null default '',
  cover_width integer,
  cover_height integer,
  cover_focal_x numeric(5,2) not null default 50,
  cover_focal_y numeric(5,2) not null default 50,
  seo_title text not null default '',
  seo_description text not null default '',
  canonical_url text,
  social_image_url text,
  author_name text not null default 'AZO Criação & Construção',
  content_goal text check (content_goal is null or content_goal in ('inform','compare','answer','support_service')),
  primary_topic text not null default '',
  related_project_keys text[] not null default '{}',
  related_service_keys text[] not null default '{}',
  published_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint content_posts_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.content_blocks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.content_posts(id) on delete cascade,
  block_type text not null check (block_type in ('paragraph','h2','h3','image','gallery','list','quote','highlight','faq','cta','table','related_projects','related_service','separator')),
  sort_order integer not null default 100,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.content_posts(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.content_redirects (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique,
  destination_path text not null,
  status_code integer not null default 301 check (status_code in (301,302,307,308)),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists content_posts_status_published_idx on public.content_posts(status, published_at desc);
create index if not exists content_posts_category_idx on public.content_posts(category_id, published_at desc);
create index if not exists content_posts_updated_idx on public.content_posts(updated_at desc);
create index if not exists content_blocks_post_order_idx on public.content_blocks(post_id, sort_order, created_at);
create index if not exists content_revisions_post_created_idx on public.content_revisions(post_id, created_at desc);

create or replace function public.content_is_public(post_status text, post_published_at timestamptz, post_scheduled_at timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when post_status = 'published' then coalesce(post_published_at, now()) <= now()
    when post_status = 'scheduled' then coalesce(post_scheduled_at, post_published_at) is not null and coalesce(post_scheduled_at, post_published_at) <= now()
    else false
  end;
$$;
revoke all on function public.content_is_public(text,timestamptz,timestamptz) from public;
grant execute on function public.content_is_public(text,timestamptz,timestamptz) to anon, authenticated;

create or replace function public.content_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.content_touch_updated_at() from public;

drop trigger if exists content_categories_touch on public.content_categories;
create trigger content_categories_touch before update on public.content_categories for each row execute function public.content_touch_updated_at();
drop trigger if exists content_posts_touch on public.content_posts;
create trigger content_posts_touch before update on public.content_posts for each row execute function public.content_touch_updated_at();
drop trigger if exists content_blocks_touch on public.content_blocks;
create trigger content_blocks_touch before update on public.content_blocks for each row execute function public.content_touch_updated_at();

alter table public.content_categories enable row level security;
alter table public.content_posts enable row level security;
alter table public.content_blocks enable row level security;
alter table public.content_revisions enable row level security;
alter table public.content_redirects enable row level security;

drop policy if exists content_categories_public_read on public.content_categories;
create policy content_categories_public_read on public.content_categories for select to anon, authenticated using (true);
drop policy if exists content_categories_admin_write on public.content_categories;
create policy content_categories_admin_write on public.content_categories for all to authenticated using (public.is_azo_admin()) with check (public.is_azo_admin());

drop policy if exists content_posts_public_read on public.content_posts;
create policy content_posts_public_read on public.content_posts for select to anon using (public.content_is_public(status,published_at,scheduled_at));
drop policy if exists content_posts_authenticated_read on public.content_posts;
create policy content_posts_authenticated_read on public.content_posts for select to authenticated using (public.content_is_public(status,published_at,scheduled_at) or public.is_azo_admin());
drop policy if exists content_posts_admin_write on public.content_posts;
create policy content_posts_admin_write on public.content_posts for all to authenticated using (public.is_azo_admin()) with check (public.is_azo_admin());

drop policy if exists content_blocks_public_read on public.content_blocks;
create policy content_blocks_public_read on public.content_blocks for select to anon using (
  exists (
    select 1 from public.content_posts p
    where p.id = content_blocks.post_id
      and public.content_is_public(p.status,p.published_at,p.scheduled_at)
  )
);
drop policy if exists content_blocks_authenticated_read on public.content_blocks;
create policy content_blocks_authenticated_read on public.content_blocks for select to authenticated using (
  public.is_azo_admin() or exists (
    select 1 from public.content_posts p
    where p.id = content_blocks.post_id
      and public.content_is_public(p.status,p.published_at,p.scheduled_at)
  )
);
drop policy if exists content_blocks_admin_write on public.content_blocks;
create policy content_blocks_admin_write on public.content_blocks for all to authenticated using (public.is_azo_admin()) with check (public.is_azo_admin());

drop policy if exists content_revisions_admin_all on public.content_revisions;
create policy content_revisions_admin_all on public.content_revisions for all to authenticated using (public.is_azo_admin()) with check (public.is_azo_admin());
drop policy if exists content_redirects_admin_all on public.content_redirects;
create policy content_redirects_admin_all on public.content_redirects for all to authenticated using (public.is_azo_admin()) with check (public.is_azo_admin());

grant select on public.content_categories to anon, authenticated;
grant select on public.content_posts to anon, authenticated;
grant select on public.content_blocks to anon, authenticated;
grant select,insert,update,delete on public.content_categories, public.content_posts, public.content_blocks, public.content_revisions, public.content_redirects to authenticated;

insert into public.content_categories(name,slug,description,sort_order)
values
 ('Arquitetura','arquitetura','Projeto arquitetônico, implantação, programa e decisões de arquitetura.',10),
 ('Interiores','interiores','Layout, materiais, iluminação, mobiliário e experiência dos ambientes.',20),
 ('Obra','obra','Execução, gestão, planejamento, fornecedores e acompanhamento técnico.',30),
 ('Planejamento','planejamento','Orçamento, cronograma, escolhas e preparação antes de construir.',40),
 ('Materiais','materiais','Materiais, acabamentos, desempenho e escolhas para a residência.',50),
 ('Sorocaba','sorocaba','Conteúdo local sobre arquitetura, construção e residências em Sorocaba.',60)
on conflict (slug) do update set name=excluded.name, description=excluded.description, sort_order=excluded.sort_order;

drop policy if exists azo_content_public_read on storage.objects;
create policy azo_content_public_read on storage.objects for select to anon, authenticated using (bucket_id='azo-media' and name like 'content/%');
drop policy if exists azo_content_admin_insert on storage.objects;
create policy azo_content_admin_insert on storage.objects for insert to authenticated with check (bucket_id='azo-media' and name like 'content/%' and public.is_azo_admin());
drop policy if exists azo_content_admin_update on storage.objects;
create policy azo_content_admin_update on storage.objects for update to authenticated using (bucket_id='azo-media' and name like 'content/%' and public.is_azo_admin()) with check (bucket_id='azo-media' and name like 'content/%' and public.is_azo_admin());
drop policy if exists azo_content_admin_delete on storage.objects;
create policy azo_content_admin_delete on storage.objects for delete to authenticated using (bucket_id='azo-media' and name like 'content/%' and public.is_azo_admin());
