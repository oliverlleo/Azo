-- Garante que QR codes já impressos nunca sejam sequestrados por outra obra.

create or replace function public.guard_obra_slug_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.obra_redirects r
    where r.from_slug = new.slug
      and r.obra_id <> new.id
  ) then
    raise exception 'slug reservado por histórico de QR: %', new.slug using errcode = '23505';
  end if;
  return new;
end;
$$;

create or replace function public.preserve_obra_slug_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.slug is distinct from new.slug then
    insert into public.obra_redirects (obra_id, from_slug, active)
    values (new.id, old.slug, true)
    on conflict (from_slug) do update
      set obra_id = excluded.obra_id,
          active = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_obras_guard_slug_history on public.obras;
create trigger trg_obras_guard_slug_history
before insert or update of slug on public.obras
for each row execute function public.guard_obra_slug_history();

drop trigger if exists trg_obras_preserve_slug_history on public.obras;
create trigger trg_obras_preserve_slug_history
after update of slug on public.obras
for each row execute function public.preserve_obra_slug_history();
