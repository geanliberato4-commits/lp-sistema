-- Melhorias no estoque: edição, custo por unidade a partir da embalagem
-- e custo dos materiais usados em cada pedido.

-- O login já foi criado: a função de primeiro acesso não precisa mais ficar aberta.
revoke execute on function public.primeiro_acesso(text, text, text) from anon, authenticated, public;

-- Embalagem e custo por unidade com 4 casas (ex.: R$ 0,0500 por folha)
alter table public.materiais
  add column if not exists embalagem text,
  add column if not exists unidades_embalagem numeric(12,2) check (unidades_embalagem is null or unidades_embalagem > 0),
  add column if not exists valor_embalagem numeric(12,2) check (valor_embalagem is null or valor_embalagem >= 0),
  add column if not exists atualizado_em timestamptz not null default now();
alter table public.materiais alter column custo_unitario type numeric(12,4);

create or replace function public.material_custo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.valor_embalagem is not null and coalesce(new.unidades_embalagem, 0) > 0 then
    new.custo_unitario := round(new.valor_embalagem / new.unidades_embalagem, 4);
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;
drop trigger if exists materiais_custo on public.materiais;
create trigger materiais_custo
  before insert or update on public.materiais
  for each row execute function public.material_custo();

-- Movimentos guardam o custo da unidade no momento do uso (o histórico não muda se o preço mudar)
alter table public.movimentos_estoque add column if not exists custo_unitario numeric(12,4) not null default 0;
alter table public.movimentos_estoque drop constraint if exists movimentos_estoque_quantidade_check;
alter table public.movimentos_estoque add constraint movimentos_estoque_quantidade_check
  check (quantidade > 0 or (tipo = 'ajuste' and quantidade >= 0));

create or replace function public.aplicar_movimento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_mat record;
  v_txt text;
begin
  select m.quantidade, m.custo_unitario, m.nome, m.unidade into v_mat
    from public.materiais m where m.id = new.material_id for update;
  new.custo_unitario := coalesce(v_mat.custo_unitario, 0);
  if new.tipo = 'entrada' then
    update public.materiais set quantidade = quantidade + new.quantidade, ultima_compra = current_date
     where id = new.material_id;
  elsif new.tipo = 'ajuste' then
    update public.materiais set quantidade = new.quantidade where id = new.material_id;
  else
    if v_mat.quantidade < new.quantidade then
      raise exception 'Não há % % de % em estoque (tem %).',
        trim(to_char(new.quantidade, 'FM999999990.##')), v_mat.unidade, v_mat.nome,
        trim(to_char(v_mat.quantidade, 'FM999999990.##')) using errcode = 'P0001';
    end if;
    update public.materiais set quantidade = quantidade - new.quantidade where id = new.material_id;
    if new.pedido_id is not null then
      v_txt := case when new.tipo = 'perda' then 'Perda de material: ' else 'Material usado: ' end
            || trim(to_char(new.quantidade, 'FM999999990.##')) || ' ' || v_mat.unidade || ' de ' || v_mat.nome
            || ' (R$ ' || replace(to_char(round(new.quantidade * new.custo_unitario, 2), 'FM999999990.00'), '.', ',') || ')';
      insert into public.pedido_historico (pedido_id, texto) values (new.pedido_id, v_txt);
    end if;
  end if;
  return new;
end;
$$;

-- Desfazer um consumo ou perda devolve a quantidade ao estoque
create or replace function public.desfazer_movimento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_nome text;
  v_unid text;
begin
  if old.tipo not in ('consumo', 'perda') then
    raise exception 'Só dá para desfazer consumo ou perda.' using errcode = 'P0001';
  end if;
  update public.materiais set quantidade = quantidade + old.quantidade where id = old.material_id
  returning nome, unidade into v_nome, v_unid;
  if old.pedido_id is not null then
    insert into public.pedido_historico (pedido_id, texto)
    values (old.pedido_id, 'Material devolvido ao estoque: ' || trim(to_char(old.quantidade, 'FM999999990.##')) || ' ' || coalesce(v_unid, '') || ' de ' || coalesce(v_nome, 'material'));
  end if;
  return old;
end;
$$;
drop trigger if exists movimentos_desfazer on public.movimentos_estoque;
create trigger movimentos_desfazer
  before delete on public.movimentos_estoque
  for each row execute function public.desfazer_movimento();

drop policy if exists "membro desfaz movimentos" on public.movimentos_estoque;
create policy "membro desfaz movimentos" on public.movimentos_estoque
  for delete to authenticated using ((select interno.eh_membro()) and tipo in ('consumo', 'perda'));

revoke execute on function public.material_custo() from anon, authenticated, public;
revoke execute on function public.aplicar_movimento() from anon, authenticated, public;
revoke execute on function public.desfazer_movimento() from anon, authenticated, public;
