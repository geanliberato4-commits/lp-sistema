-- Arquivos da arte e anexos dos pedidos: pasta privada, só o login da LP vê, envia ou apaga.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos', 'anexos', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "lp ve anexos" on storage.objects;
drop policy if exists "lp envia anexos" on storage.objects;
drop policy if exists "lp apaga anexos" on storage.objects;
create policy "lp ve anexos" on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and (select interno.eh_membro()));
create policy "lp envia anexos" on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and (select interno.eh_membro()));
create policy "lp apaga anexos" on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and (select interno.eh_membro()));
