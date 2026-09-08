alter table public.compra_itens
add column if not exists subtotal_bruto numeric(12,2);

alter table public.compra_itens
add column if not exists desconto numeric(12,2) not null default 0;

update public.compra_itens
set subtotal_bruto = coalesce(subtotal_bruto, subtotal + coalesce(desconto, 0))
where subtotal_bruto is null;

alter table public.compra_itens
alter column subtotal_bruto set not null;

alter table public.compra_itens
add constraint compra_itens_desconto_nao_negativo
check (desconto >= 0);

alter table public.compra_itens
add constraint compra_itens_subtotal_bruto_nao_negativo
check (subtotal_bruto >= 0);

alter table public.compra_itens
add constraint compra_itens_desconto_menor_igual_subtotal_bruto
check (desconto <= subtotal_bruto);

alter table public.compras
add column if not exists subtotal_bruto numeric(12,2) not null default 0;

alter table public.compras
add column if not exists desconto_total numeric(12,2) not null default 0;

update public.compras
set subtotal_bruto = valor_total
where subtotal_bruto = 0;

alter table public.compras
add constraint compras_subtotal_bruto_nao_negativo
check (subtotal_bruto >= 0);

alter table public.compras
add constraint compras_desconto_total_nao_negativo
check (desconto_total >= 0);

alter table public.compras
add constraint compras_desconto_total_menor_igual_subtotal_bruto
check (desconto_total <= subtotal_bruto);