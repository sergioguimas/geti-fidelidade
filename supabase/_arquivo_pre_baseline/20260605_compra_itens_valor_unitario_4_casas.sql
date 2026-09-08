alter table public.compra_itens
alter column valor_unitario type numeric(12,4)
using valor_unitario::numeric(12,4);