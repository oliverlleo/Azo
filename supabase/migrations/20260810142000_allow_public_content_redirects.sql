drop policy if exists content_redirects_public_read on public.content_redirects;
create policy content_redirects_public_read on public.content_redirects for select to anon using (true);
grant select on public.content_redirects to anon;
