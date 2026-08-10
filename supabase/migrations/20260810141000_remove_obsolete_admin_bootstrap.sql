-- O primeiro administrador já existe. Remove o fluxo de bootstrap de uso único.
drop function if exists public.claim_first_azo_admin(text,text);
drop function if exists public.azo_setup_available();
drop table if exists public.azo_bootstrap;
