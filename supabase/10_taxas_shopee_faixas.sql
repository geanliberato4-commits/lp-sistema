-- Taxas da Shopee por faixa de preço do item (política em vigor desde 01/10/2026).
alter table public.configuracoes
  add column if not exists shopee_faixas jsonb not null default
    '[{"ate":79.99,"pct":20,"fixo":4.5},{"ate":99.99,"pct":14,"fixo":16},{"ate":199.99,"pct":14,"fixo":20},{"ate":null,"pct":14,"fixo":26}]'::jsonb,
  add column if not exists shopee_adicional_item numeric(12,2) not null default 0 check (shopee_adicional_item >= 0);
