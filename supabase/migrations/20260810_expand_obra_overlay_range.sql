-- O AZO Studio usa slider de 0 a 100 para o overlay do hero.
alter table public.obras drop constraint if exists obras_hero_overlay_check;
alter table public.obras add constraint obras_hero_overlay_check check (hero_overlay between 0 and 100);
