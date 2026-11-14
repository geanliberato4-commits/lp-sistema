-- =====================================================================
-- Produtos com ficha técnica, taxas da Shopee, baixa automática pela ficha,
-- edição/exclusão de pedidos e orçamentos.
-- =====================================================================

-- ---------- Configurações ----------
alter table public.configuracoes
  add column if not exists shopee_percentual numeric(6,2) not null default 0 check (shopee_percentual >= 0 and shopee_percentual < 100),
  add column if not exists shopee_fixo numeric(12,2) not null default 0 check (shopee_fixo >= 0),
  add column if not exists shopee_fixo_por text not null default 'pedido' check (shopee_fixo_por in ('pedido','item')),
  add column if not exists outras_despesas_percentual numeric(6,2) not null default 0 check (outras_despesas_percentual >= 0 and outras_despesas_percentual < 100),
  add column if not exists status_baixa text not null default 'em_producao'
    check (status_baixa in ('novo','aguardando_pagamento','aguardando_arte','em_producao','pronto_envio','enviado','finalizado'));

alter table public.materiais add column if not exists descricao text;

-- ---------- Produtos e ficha técnica ----------
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  nome text not null,
  categoria text,
  descricao text,
  variacoes text,
  foto_url text,
  preco_venda numeric(12,2) not null default 0 check (preco_venda >= 0),
  mao_obra numeric(12,2) not null default 0 check (mao_obra >= 0),
  custo_embalagem numeric(12,2) not null default 0 check (custo_embalagem >= 0),
  outros_custos numeric(12,2) not null default 0 check (outros_custos >= 0),
  acrescimo_percentual numeric(8,2),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.produto_insumos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  material_id uuid not null references public.materiais(id) on delete restrict,
  quantidade numeric(12,3) not null check (quantidade > 0),
  unique (produto_id, material_id)
);
create index produto_insumos_produto_idx on public.produto_insumos (produto_id);
create index produto_insumos_material_idx on public.produto_insumos (material_id);

create or replace function public.produto_atualizado()
returns trigger language plpgsql set search_path = '' as $$
begin new.atualizado_em := now(); return new; end; $$;
create trigger produtos_atualizado before update on public.produtos
  for each row execute function public.produto_atualizado();

-- ---------- Itens de pedido ligados a produtos (com cópia da ficha no momento) ----------
alter table public.pedido_itens
  add column if not exists produto_id uuid references public.produtos(id) on delete set null,
  add column if not exists variacao text,
  add column if not exists custo_materiais_unit numeric(12,4) not null default 0,
  add column if not exists custo_extra_unit numeric(12,4) not null default 0,
  add column if not exists insumos jsonb not null default '[]'::jsonb;

-- ---------- Exclusão lógica de pedidos ----------
alter table public.pedidos
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por text,
  add column if not exists motivo_exclusao text,
  add column if not exists orcamento_id uuid;

-- ---------- Movimentos: origem (manual ou ficha) e estorno ----------
alter table public.movimentos_estoque
  add column if not exists origem text not null default 'manual' check (origem in ('manual','ficha'));
alter table public.movimentos_estoque drop constraint if exists movimentos_estoque_tipo_check;
alter table public.movimentos_estoque add constraint movimentos_estoque_tipo_check
  check (tipo in ('entrada','consumo','perda','ajuste','estorno'));

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
  if new.tipo <> 'estorno' or coalesce(new.custo_unitario, 0) = 0 then
    new.custo_unitario := coalesce(v_mat.custo_unitario, 0);
  end if;
  if new.tipo = 'entrada' then
    update public.materiais set quantidade = quantidade + new.quantidade, ultima_compra = current_date
     where id = new.material_id;
  elsif new.tipo = 'estorno' then
    update public.materiais set quantidade = quantidade + new.quantidade where id = new.material_id;
    if new.pedido_id is not null then
      insert into public.pedido_historico (pedido_id, texto)
      values (new.pedido_id, 'Devolvido ao estoque: ' || trim(to_char(new.quantidade, 'FM999999990.###')) || ' ' || v_mat.unidade || ' de ' || v_mat.nome);
    end if;
  elsif new.tipo = 'ajuste' then
    update public.materiais set quantidade = new.quantidade where id = new.material_id;
  else
    if v_mat.quantidade < new.quantidade then
      raise exception 'Não há % % de % em estoque (tem %).',
        trim(to_char(new.quantidade, 'FM999999990.###')), v_mat.unidade, v_mat.nome,
        trim(to_char(v_mat.quantidade, 'FM999999990.###')) using errcode = 'P0001';
    end if;
    update public.materiais set quantidade = quantidade - new.quantidade where id = new.material_id;
    if new.pedido_id is not null then
      v_txt := case when new.tipo = 'perda' then 'Perda de material: '
                    when new.origem = 'ficha' then 'Baixa pela ficha: '
                    else 'Material usado: ' end
            || trim(to_char(new.quantidade, 'FM999999990.###')) || ' ' || v_mat.unidade || ' de ' || v_mat.nome
            || ' (R$ ' || replace(to_char(round(new.quantidade * new.custo_unitario, 2), 'FM999999990.00'), '.', ',') || ')';
      insert into public.pedido_historico (pedido_id, texto) values (new.pedido_id, v_txt);
    end if;
  end if;
  return new;
end;
$$;

-- Só lançamentos manuais de consumo/perda podem ser removidos à mão
drop policy if exists "membro desfaz movimentos" on public.movimentos_estoque;
create policy "membro desfaz movimentos" on public.movimentos_estoque
  for delete to authenticated using ((select interno.eh_membro()) and tipo in ('consumo','perda') and origem = 'manual');

-- ---------- Ordem das situações ----------
create or replace function interno.ordem_status(s text)
returns integer language sql immutable set search_path = '' as $$
  select case s
    when 'orcamento' then 0 when 'novo' then 1 when 'aguardando_pagamento' then 2
    when 'aguardando_arte' then 3 when 'em_producao' then 4 when 'pronto_envio' then 5
    when 'enviado' then 6 when 'finalizado' then 7 else -1 end;
$$;
grant execute on function interno.ordem_status(text) to authenticated;

-- ---------- Baixa automática pela ficha: lança só a diferença ----------
create or replace function public.sincronizar_baixa(p_pedido uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ped record;
  v_etapa text;
  r record;
  v_falta text := '';
  v_lista jsonb := '[]'::jsonb;
begin
  select p.id, p.status, p.excluido_em into v_ped from public.pedidos p where p.id = p_pedido for update;
  if not found or v_ped.excluido_em is not null or v_ped.status in ('cancelado','orcamento') then return; end if;
  select c.status_baixa into v_etapa from public.configuracoes c where c.id = 1;
  if interno.ordem_status(v_ped.status) < interno.ordem_status(coalesce(v_etapa, 'em_producao')) then return; end if;

  for r in
    with nec as (
      select (x->>'material_id')::uuid as material_id, sum(i.quantidade * (x->>'quantidade')::numeric) as q
        from public.pedido_itens i, jsonb_array_elements(i.insumos) x
       where i.pedido_id = p_pedido
       group by 1),
    feito as (
      select m.material_id, sum(case when m.tipo = 'estorno' then -m.quantidade else m.quantidade end) as q
        from public.movimentos_estoque m
       where m.pedido_id = p_pedido and m.origem = 'ficha' and m.tipo in ('consumo','estorno')
       group by 1),
    dif as (
      select coalesce(n.material_id, f.material_id) as material_id, coalesce(n.q, 0) - coalesce(f.q, 0) as dif
        from nec n full join feito f on f.material_id = n.material_id)
    select d.material_id, d.dif, m.nome, m.unidade, m.quantidade
      from dif d join public.materiais m on m.id = d.material_id
     where abs(d.dif) > 0.0001
  loop
    v_lista := v_lista || jsonb_build_object('material_id', r.material_id, 'dif', r.dif);
    if r.dif > 0 and r.quantidade < r.dif then
      v_falta := v_falta || chr(10) || '• ' || r.nome || ': precisa ' || trim(to_char(r.dif, 'FM999999990.###')) || ' ' || r.unidade
              || ', tem ' || trim(to_char(r.quantidade, 'FM999999990.###'))
              || ', comprar ' || trim(to_char(r.dif - r.quantidade, 'FM999999990.###'));
    end if;
  end loop;
  if v_falta <> '' then
    raise exception 'Estoque insuficiente para este pedido:%', v_falta using errcode = 'P0001';
  end if;

  insert into public.movimentos_estoque (material_id, tipo, quantidade, pedido_id, origem, observacao)
  select (x->>'material_id')::uuid, case when (x->>'dif')::numeric > 0 then 'consumo' else 'estorno' end,
         abs((x->>'dif')::numeric), p_pedido, 'ficha', 'Baixa automática pela ficha técnica'
    from jsonb_array_elements(v_lista) x;
end;
$$;

create or replace function public.pedido_baixa_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and coalesce(current_setting('lp.sem_baixa', true), '') <> '1' then
    perform public.sincronizar_baixa(new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists pedidos_baixa on public.pedidos;
create trigger pedidos_baixa
  after update on public.pedidos
  for each row execute function public.pedido_baixa_status();

-- ---------- Salvar pedido (novo ou edição), itens com cópia da ficha ----------
create or replace function public.salvar_pedido(p jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_nome text := trim(coalesce(p->>'cliente_nome', ''));
  v_tel text := nullif(trim(coalesce(p->>'telefone', '')), '');
  v_cli uuid;
  v_num integer;
  v_ant record;
  v_edicao boolean := false;
  v_item jsonb;
  v_ordem integer := 0;
  v_prod_id uuid;
  v_prod_nome text;
  v_ins jsonb;
  v_cmat numeric;
  v_cext numeric;
  v_sinal numeric := coalesce(nullif(p->>'sinal', '')::numeric, 0);
  v_total_ant numeric;
  v_total_novo numeric;
begin
  if not interno.eh_membro() then
    raise exception 'Seu usuário não tem acesso ao sistema.' using errcode = 'P0001';
  end if;
  if v_nome = '' then
    raise exception 'Informe o nome do cliente.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p->'itens', '[]'::jsonb)) = 0 then
    raise exception 'O pedido precisa de pelo menos um item.' using errcode = 'P0001';
  end if;
  perform set_config('lp.sem_baixa', '1', true);

  select c.id into v_cli from public.clientes c where lower(c.nome) = lower(v_nome) limit 1;
  if v_cli is null then
    insert into public.clientes (nome, telefone) values (v_nome, v_tel) returning id into v_cli;
  elsif v_tel is not null then
    update public.clientes set telefone = v_tel where id = v_cli and coalesce(telefone, '') = '';
  end if;

  if v_id is null then
    insert into public.pedidos (cliente_id, cliente_nome, telefone, origem, numero_externo, status,
                                prazo_producao, prazo_entrega, frete, desconto, custo, taxa_shopee, observacoes, orcamento_id)
    values (v_cli, v_nome, v_tel,
            coalesce(nullif(p->>'origem', ''), 'WhatsApp'),
            nullif(trim(coalesce(p->>'numero_externo', '')), ''),
            coalesce(nullif(p->>'status', ''), 'novo'),
            nullif(p->>'prazo_producao', '')::date, nullif(p->>'prazo_entrega', '')::date,
            coalesce(nullif(p->>'frete', '')::numeric, 0), coalesce(nullif(p->>'desconto', '')::numeric, 0),
            coalesce(nullif(p->>'custo', '')::numeric, 0), coalesce(nullif(p->>'taxa_shopee', '')::numeric, 0),
            nullif(trim(coalesce(p->>'observacoes', '')), ''),
            nullif(p->>'orcamento_id', '')::uuid)
    returning id, numero into v_id, v_num;
  else
    select * into v_ant from public.pedidos where id = v_id for update;
    if not found then raise exception 'Pedido não encontrado.' using errcode = 'P0001'; end if;
    v_edicao := true;
    if v_ant.excluido_em is not null then
      raise exception 'Este pedido foi excluído e não pode ser editado.' using errcode = 'P0001';
    end if;
    v_total_ant := public.total_pedido(v_id);
    update public.pedidos set
      cliente_id = v_cli, cliente_nome = v_nome, telefone = v_tel,
      origem = coalesce(nullif(p->>'origem', ''), origem),
      numero_externo = nullif(trim(coalesce(p->>'numero_externo', '')), ''),
      status = coalesce(nullif(p->>'status', ''), status),
      prazo_producao = nullif(p->>'prazo_producao', '')::date,
      prazo_entrega = nullif(p->>'prazo_entrega', '')::date,
      frete = coalesce(nullif(p->>'frete', '')::numeric, 0),
      desconto = coalesce(nullif(p->>'desconto', '')::numeric, 0),
      custo = coalesce(nullif(p->>'custo', '')::numeric, 0),
      taxa_shopee = coalesce(nullif(p->>'taxa_shopee', '')::numeric, 0),
      observacoes = nullif(trim(coalesce(p->>'observacoes', '')), ''),
      transportadora = coalesce(nullif(trim(coalesce(p->>'transportadora', '')), ''), transportadora),
      rastreio = coalesce(nullif(trim(coalesce(p->>'rastreio', '')), ''), rastreio)
    where id = v_id
    returning numero into v_num;
    delete from public.pedido_itens where pedido_id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(p->'itens') loop
    v_ordem := v_ordem + 1;
    v_prod_id := null; v_prod_nome := null; v_cext := 0;
    if nullif(v_item->>'produto_id', '') is not null then
      select pr.id, pr.nome, pr.mao_obra + pr.custo_embalagem + pr.outros_custos
        into v_prod_id, v_prod_nome, v_cext
        from public.produtos pr where pr.id = (v_item->>'produto_id')::uuid;
    end if;
    if v_prod_id is not null then
      select coalesce(jsonb_agg(jsonb_build_object('material_id', pi.material_id, 'quantidade', pi.quantidade)), '[]'::jsonb),
             coalesce(sum(pi.quantidade * m.custo_unitario), 0)
        into v_ins, v_cmat
        from public.produto_insumos pi join public.materiais m on m.id = pi.material_id
       where pi.produto_id = v_prod_id;
    else
      v_ins := coalesce(v_item->'insumos', '[]'::jsonb);
      select coalesce(sum((x->>'quantidade')::numeric * m.custo_unitario), 0) into v_cmat
        from jsonb_array_elements(v_ins) x join public.materiais m on m.id = (x->>'material_id')::uuid;
      v_cext := greatest(coalesce(nullif(v_item->>'custo_unitario', '')::numeric, 0) - v_cmat, 0);
    end if;
    insert into public.pedido_itens (pedido_id, ordem, produto_id, produto, variacao, quantidade, valor_unitario,
                                     personalizacao, custo_materiais_unit, custo_extra_unit, insumos)
    values (v_id, v_ordem, v_prod_id,
            coalesce(nullif(trim(coalesce(v_item->>'produto', '')), ''), v_prod_nome, 'Item'),
            nullif(trim(coalesce(v_item->>'variacao', '')), ''),
            (v_item->>'quantidade')::numeric,
            coalesce(nullif(v_item->>'valor_unitario', '')::numeric, 0),
            nullif(trim(coalesce(v_item->>'personalizacao', '')), ''),
            v_cmat, v_cext, v_ins);
  end loop;

  if not v_edicao then
    if v_sinal > 0 then
      insert into public.caixa (tipo, categoria, descricao, valor, forma, pedido_id)
      values ('entrada', 'Recebimento de pedido', 'Pedido #' || lpad(v_num::text, 4, '0') || ' · sinal',
              v_sinal, coalesce(nullif(p->>'forma_sinal', ''), 'Pix'), v_id);
    end if;
  else
    v_total_novo := public.total_pedido(v_id);
    insert into public.pedido_historico (pedido_id, texto)
    values (v_id, 'Pedido editado' ||
      case when round(v_total_ant, 2) <> round(v_total_novo, 2)
           then ': total de R$ ' || replace(to_char(v_total_ant, 'FM999999990.00'), '.', ',') || ' para R$ ' || replace(to_char(v_total_novo, 'FM999999990.00'), '.', ',')
           else '' end);
  end if;

  perform set_config('lp.sem_baixa', '', true);
  perform public.sincronizar_baixa(v_id);
  return v_num;
end;
$$;

-- ---------- Cancelar ou excluir pedido (exclusão lógica, com auditoria) ----------
create or replace function public.cancelar_pedido(p_pedido uuid, p_devolver boolean, p_motivo text, p_excluir boolean, p_devolucao numeric default 0, p_forma text default 'Pix')
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ped record;
  r record;
begin
  if not interno.eh_membro() then
    raise exception 'Seu usuário não tem acesso ao sistema.' using errcode = 'P0001';
  end if;
  select * into v_ped from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido não encontrado.' using errcode = 'P0001'; end if;
  if v_ped.excluido_em is not null then raise exception 'Este pedido já foi excluído.' using errcode = 'P0001'; end if;

  perform set_config('lp.sem_baixa', '1', true);
  update public.pedidos set status = 'cancelado' where id = p_pedido and status <> 'cancelado';

  if p_devolver then
    for r in
      select m.material_id, m.origem,
             sum(case when m.tipo = 'estorno' then -m.quantidade else m.quantidade end) as q
        from public.movimentos_estoque m
       where m.pedido_id = p_pedido and m.tipo in ('consumo','estorno')
       group by m.material_id, m.origem
      having sum(case when m.tipo = 'estorno' then -m.quantidade else m.quantidade end) > 0.0001
    loop
      insert into public.movimentos_estoque (material_id, tipo, quantidade, pedido_id, origem, observacao)
      values (r.material_id, 'estorno', r.q, p_pedido, r.origem, 'Devolução por cancelamento');
    end loop;
  elsif exists (select 1 from public.movimentos_estoque m where m.pedido_id = p_pedido and m.tipo = 'consumo') then
    insert into public.pedido_historico (pedido_id, texto)
    values (p_pedido, 'Materiais já utilizados: mantidos como consumo, sem devolução ao estoque');
  end if;

  if coalesce(p_devolucao, 0) > 0 then
    insert into public.caixa (tipo, categoria, descricao, valor, forma, pedido_id)
    values ('saida', 'Devolução ao cliente', 'Pedido #' || lpad(v_ped.numero::text, 4, '0') || ' · devolução ao cliente',
            p_devolucao, coalesce(nullif(p_forma, ''), 'Pix'), p_pedido);
  end if;

  if p_excluir then
    update public.pedidos set excluido_em = now(), excluido_por = interno.nome_usuario(),
           motivo_exclusao = nullif(trim(coalesce(p_motivo, '')), '')
     where id = p_pedido;
    insert into public.pedido_historico (pedido_id, texto)
    values (p_pedido, 'Pedido excluído' || coalesce(': ' || nullif(trim(coalesce(p_motivo, '')), ''), ''));
  else
    insert into public.pedido_historico (pedido_id, texto)
    values (p_pedido, 'Pedido cancelado' || coalesce(': ' || nullif(trim(coalesce(p_motivo, '')), ''), ''));
  end if;
  perform set_config('lp.sem_baixa', '', true);
end;
$$;

-- ---------- Orçamentos ----------
create table public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  numero integer generated by default as identity (start with 1) unique,
  cliente_nome text not null,
  contato text,
  data date not null default current_date,
  validade date,
  prazo text,
  canal text not null default 'WhatsApp' check (canal in ('Shopee','WhatsApp','Instagram','Outros')),
  status text not null default 'elaboracao' check (status in ('elaboracao','enviado','aprovado','recusado')),
  desconto numeric(12,2) not null default 0 check (desconto >= 0),
  frete numeric(12,2) not null default 0 check (frete >= 0),
  observacoes text,
  pedido_id uuid references public.pedidos(id) on delete set null,
  criado_por text default interno.nome_usuario(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  ordem integer not null default 0,
  produto_id uuid references public.produtos(id) on delete set null,
  descricao text not null,
  variacao text,
  quantidade numeric(12,2) not null check (quantidade > 0),
  custo_unitario numeric(12,4) not null default 0 check (custo_unitario >= 0),
  acrescimo_percentual numeric(8,2),
  preco_unitario numeric(12,2) not null default 0 check (preco_unitario >= 0),
  insumos jsonb not null default '[]'::jsonb
);
create index orcamento_itens_orc_idx on public.orcamento_itens (orcamento_id);

alter table public.pedidos drop constraint if exists pedidos_orcamento_fk;
alter table public.pedidos add constraint pedidos_orcamento_fk foreign key (orcamento_id) references public.orcamentos(id) on delete set null;

create or replace function public.salvar_orcamento(p jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_num integer;
  v_item jsonb;
  v_ordem integer := 0;
begin
  if not interno.eh_membro() then
    raise exception 'Seu usuário não tem acesso ao sistema.' using errcode = 'P0001';
  end if;
  if trim(coalesce(p->>'cliente_nome', '')) = '' then
    raise exception 'Informe o nome do cliente.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p->'itens', '[]'::jsonb)) = 0 then
    raise exception 'O orçamento precisa de pelo menos um item.' using errcode = 'P0001';
  end if;
  if v_id is null then
    insert into public.orcamentos (cliente_nome, contato, data, validade, prazo, canal, status, desconto, frete, observacoes)
    values (trim(p->>'cliente_nome'), nullif(trim(coalesce(p->>'contato', '')), ''),
            coalesce(nullif(p->>'data', '')::date, current_date), nullif(p->>'validade', '')::date,
            nullif(trim(coalesce(p->>'prazo', '')), ''), coalesce(nullif(p->>'canal', ''), 'WhatsApp'),
            coalesce(nullif(p->>'status', ''), 'elaboracao'),
            coalesce(nullif(p->>'desconto', '')::numeric, 0), coalesce(nullif(p->>'frete', '')::numeric, 0),
            nullif(trim(coalesce(p->>'observacoes', '')), ''))
    returning id, numero into v_id, v_num;
  else
    update public.orcamentos set
      cliente_nome = trim(p->>'cliente_nome'), contato = nullif(trim(coalesce(p->>'contato', '')), ''),
      data = coalesce(nullif(p->>'data', '')::date, data), validade = nullif(p->>'validade', '')::date,
      prazo = nullif(trim(coalesce(p->>'prazo', '')), ''), canal = coalesce(nullif(p->>'canal', ''), canal),
      status = coalesce(nullif(p->>'status', ''), status),
      desconto = coalesce(nullif(p->>'desconto', '')::numeric, 0), frete = coalesce(nullif(p->>'frete', '')::numeric, 0),
      observacoes = nullif(trim(coalesce(p->>'observacoes', '')), ''), atualizado_em = now()
    where id = v_id returning numero into v_num;
    if v_num is null then raise exception 'Orçamento não encontrado.' using errcode = 'P0001'; end if;
    delete from public.orcamento_itens where orcamento_id = v_id;
  end if;
  for v_item in select * from jsonb_array_elements(p->'itens') loop
    v_ordem := v_ordem + 1;
    insert into public.orcamento_itens (orcamento_id, ordem, produto_id, descricao, variacao, quantidade,
                                        custo_unitario, acrescimo_percentual, preco_unitario, insumos)
    values (v_id, v_ordem, nullif(v_item->>'produto_id', '')::uuid, trim(v_item->>'descricao'),
            nullif(trim(coalesce(v_item->>'variacao', '')), ''), (v_item->>'quantidade')::numeric,
            coalesce(nullif(v_item->>'custo_unitario', '')::numeric, 0), nullif(v_item->>'acrescimo_percentual', '')::numeric,
            coalesce(nullif(v_item->>'preco_unitario', '')::numeric, 0), coalesce(v_item->'insumos', '[]'::jsonb));
  end loop;
  return v_num;
end;
$$;

create or replace function public.converter_orcamento(p_orcamento uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_o record;
  v_num integer;
  v_pid uuid;
  v_itens jsonb;
begin
  select * into v_o from public.orcamentos where id = p_orcamento for update;
  if not found then raise exception 'Orçamento não encontrado.' using errcode = 'P0001'; end if;
  if v_o.pedido_id is not null then
    raise exception 'Este orçamento já virou pedido.' using errcode = 'P0001';
  end if;
  select jsonb_agg(jsonb_build_object(
           'produto_id', i.produto_id, 'produto', i.descricao, 'variacao', i.variacao,
           'quantidade', i.quantidade, 'valor_unitario', i.preco_unitario,
           'custo_unitario', i.custo_unitario, 'insumos', i.insumos) order by i.ordem)
    into v_itens from public.orcamento_itens i where i.orcamento_id = p_orcamento;
  v_num := public.salvar_pedido(jsonb_build_object(
    'cliente_nome', v_o.cliente_nome, 'telefone', v_o.contato, 'origem', v_o.canal, 'status', 'novo',
    'frete', v_o.frete, 'desconto', v_o.desconto, 'orcamento_id', v_o.id,
    'observacoes', concat_ws(E'\n', 'Criado a partir do orçamento #' || lpad(v_o.numero::text, 4, '0'),
                             case when v_o.prazo is not null then 'Prazo combinado: ' || v_o.prazo end, v_o.observacoes),
    'itens', v_itens));
  select id into v_pid from public.pedidos where numero = v_num;
  update public.orcamentos set pedido_id = v_pid, status = 'aprovado', atualizado_em = now() where id = p_orcamento;
  return v_num;
end;
$$;

-- ---------- Segurança ----------
alter table public.produtos enable row level security;
alter table public.produto_insumos enable row level security;
alter table public.orcamentos enable row level security;
alter table public.orcamento_itens enable row level security;

create policy "membro acessa produtos" on public.produtos
  for all to authenticated using ((select interno.eh_membro())) with check ((select interno.eh_membro()));
create policy "membro acessa ficha" on public.produto_insumos
  for all to authenticated using ((select interno.eh_membro())) with check ((select interno.eh_membro()));
create policy "membro acessa orcamentos" on public.orcamentos
  for all to authenticated using ((select interno.eh_membro())) with check ((select interno.eh_membro()));
create policy "membro acessa itens orcamento" on public.orcamento_itens
  for all to authenticated using ((select interno.eh_membro())) with check ((select interno.eh_membro()));

-- pedidos não são apagados de verdade: só exclusão lógica
drop policy if exists "membro acessa pedidos" on public.pedidos;
create policy "membro le pedidos" on public.pedidos for select to authenticated using ((select interno.eh_membro()));
create policy "membro cria pedidos" on public.pedidos for insert to authenticated with check ((select interno.eh_membro()));
create policy "membro altera pedidos" on public.pedidos for update to authenticated using ((select interno.eh_membro())) with check ((select interno.eh_membro()));

revoke execute on function public.produto_atualizado() from anon, authenticated, public;
revoke execute on function public.pedido_baixa_status() from anon, authenticated, public;
revoke execute on function public.aplicar_movimento() from anon, authenticated, public;
revoke execute on function public.sincronizar_baixa(uuid) from anon, public;
revoke execute on function public.salvar_pedido(jsonb) from anon, public;
revoke execute on function public.cancelar_pedido(uuid, boolean, text, boolean, numeric, text) from anon, public;
revoke execute on function public.salvar_orcamento(jsonb) from anon, public;
revoke execute on function public.converter_orcamento(uuid) from anon, public;
grant execute on function public.sincronizar_baixa(uuid) to authenticated;
grant execute on function public.salvar_pedido(jsonb) to authenticated;
grant execute on function public.cancelar_pedido(uuid, boolean, text, boolean, numeric, text) to authenticated;
grant execute on function public.salvar_orcamento(jsonb) to authenticated;
grant execute on function public.converter_orcamento(uuid) to authenticated;
