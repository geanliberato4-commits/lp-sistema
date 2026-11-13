-- Move as funções de checagem de acesso para um esquema que não fica exposto na API.
create schema if not exists interno;
revoke all on schema interno from public, anon;
grant usage on schema interno to authenticated;
alter function public.eh_membro() set schema interno;
alter function public.nome_usuario() set schema interno;
-- (a função criar_pedido foi recriada usando interno.eh_membro(); ver 01_schema.sql com a troca abaixo)

create or replace function public.criar_pedido(p jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nome text := trim(coalesce(p->>'cliente_nome', ''));
  v_tel text := nullif(trim(coalesce(p->>'telefone', '')), '');
  v_cli uuid;
  v_id uuid;
  v_num integer;
  v_item jsonb;
  v_ordem integer := 0;
  v_sinal numeric := coalesce(nullif(p->>'sinal', '')::numeric, 0);
begin
  if not interno.eh_membro() then
    raise exception 'Seu usuário não tem acesso ao sistema.' using errcode = 'P0001';
  end if;
  if v_nome = '' then
    raise exception 'Informe o nome do cliente.' using errcode = 'P0001';
  end if;

  select c.id into v_cli from public.clientes c where lower(c.nome) = lower(v_nome) limit 1;
  if v_cli is null then
    insert into public.clientes (nome, telefone) values (v_nome, v_tel) returning id into v_cli;
  elsif v_tel is not null then
    update public.clientes set telefone = v_tel where id = v_cli and coalesce(telefone, '') = '';
  end if;

  insert into public.pedidos (cliente_id, cliente_nome, telefone, origem, numero_externo, status,
                              prazo_producao, prazo_entrega, frete, desconto, custo, taxa_shopee, observacoes)
  values (v_cli, v_nome, v_tel,
          coalesce(nullif(p->>'origem', ''), 'WhatsApp'),
          nullif(trim(coalesce(p->>'numero_externo', '')), ''),
          coalesce(nullif(p->>'status', ''), 'novo'),
          nullif(p->>'prazo_producao', '')::date,
          nullif(p->>'prazo_entrega', '')::date,
          coalesce(nullif(p->>'frete', '')::numeric, 0),
          coalesce(nullif(p->>'desconto', '')::numeric, 0),
          coalesce(nullif(p->>'custo', '')::numeric, 0),
          coalesce(nullif(p->>'taxa_shopee', '')::numeric, 0),
          nullif(trim(coalesce(p->>'observacoes', '')), ''))
  returning id, numero into v_id, v_num;

  for v_item in select * from jsonb_array_elements(coalesce(p->'itens', '[]'::jsonb)) loop
    v_ordem := v_ordem + 1;
    insert into public.pedido_itens (pedido_id, ordem, produto, quantidade, valor_unitario, personalizacao)
    values (v_id, v_ordem, trim(v_item->>'produto'),
            (v_item->>'quantidade')::numeric,
            coalesce(nullif(v_item->>'valor_unitario', '')::numeric, 0),
            nullif(trim(coalesce(v_item->>'personalizacao', '')), ''));
  end loop;
  if v_ordem = 0 then
    raise exception 'O pedido precisa de pelo menos um item.' using errcode = 'P0001';
  end if;

  if v_sinal > 0 then
    insert into public.caixa (tipo, categoria, descricao, valor, forma, pedido_id)
    values ('entrada', 'Recebimento de pedido', 'Pedido #' || lpad(v_num::text, 4, '0') || ' · sinal',
            v_sinal, coalesce(nullif(p->>'forma_sinal', ''), 'Pix'), v_id);
  end if;

  return v_num;
end;
$$;
revoke execute on function public.criar_pedido(jsonb) from anon, public;
grant execute on function public.criar_pedido(jsonb) to authenticated;
