-- Fotos dos produtos: pasta pública só para leitura das imagens; só o login da LP envia ou apaga.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "lp envia fotos" on storage.objects;
drop policy if exists "lp altera fotos" on storage.objects;
drop policy if exists "lp apaga fotos" on storage.objects;
create policy "lp envia fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos' and (select interno.eh_membro()));
create policy "lp altera fotos" on storage.objects for update to authenticated
  using (bucket_id = 'produtos' and (select interno.eh_membro()));
create policy "lp apaga fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'produtos' and (select interno.eh_membro()));
