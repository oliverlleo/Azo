create index if not exists content_posts_created_by_idx on public.content_posts(created_by);
create index if not exists content_posts_updated_by_idx on public.content_posts(updated_by);
create index if not exists content_revisions_created_by_idx on public.content_revisions(created_by);
create index if not exists content_redirects_created_by_idx on public.content_redirects(created_by);

drop policy if exists content_categories_admin_write on public.content_categories;
create policy content_categories_admin_insert on public.content_categories for insert to authenticated with check (public.is_azo_admin());
create policy content_categories_admin_update on public.content_categories for update to authenticated using (public.is_azo_admin()) with check (public.is_azo_admin());
create policy content_categories_admin_delete on public.content_categories for delete to authenticated using (public.is_azo_admin());

drop policy if exists content_posts_admin_write on public.content_posts;
create policy content_posts_admin_insert on public.content_posts for insert to authenticated with check (public.is_azo_admin());
create policy content_posts_admin_update on public.content_posts for update to authenticated using (public.is_azo_admin()) with check (public.is_azo_admin());
create policy content_posts_admin_delete on public.content_posts for delete to authenticated using (public.is_azo_admin());

drop policy if exists content_blocks_admin_write on public.content_blocks;
create policy content_blocks_admin_insert on public.content_blocks for insert to authenticated with check (public.is_azo_admin());
create policy content_blocks_admin_update on public.content_blocks for update to authenticated using (public.is_azo_admin()) with check (public.is_azo_admin());
create policy content_blocks_admin_delete on public.content_blocks for delete to authenticated using (public.is_azo_admin());
