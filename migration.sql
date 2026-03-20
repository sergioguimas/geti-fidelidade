create extension if not exists "pgcrypto";

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.lojistas_usuarios (
  id uuid primary key default gen_random_uuid(),
  lojista_id uuid not null references public.lojistas(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  papel varchar(30) not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lojista_id, auth_user_id),
  unique (auth_user_id)
);

create index if not exists idx_lojistas_usuarios_lojista_id
  on public.lojistas_usuarios(lojista_id);

create index if not exists idx_lojistas_usuarios_auth_user_id
  on public.lojistas_usuarios(auth_user_id);

drop trigger if exists update_lojistas_usuarios_updated_at on public.lojistas_usuarios;

create trigger update_lojistas_usuarios_updated_at
before update on public.lojistas_usuarios
for each row
execute procedure public.update_updated_at_column();

create table if not exists public.clientes_usuarios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, auth_user_id),
  unique (auth_user_id)
);

create index if not exists idx_clientes_usuarios_cliente_id
  on public.clientes_usuarios(cliente_id);

create index if not exists idx_clientes_usuarios_auth_user_id
  on public.clientes_usuarios(auth_user_id);

drop trigger if exists update_clientes_usuarios_updated_at on public.clientes_usuarios;

create trigger update_clientes_usuarios_updated_at
before update on public.clientes_usuarios
for each row
execute procedure public.update_updated_at_column();

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  lojista_id uuid not null references public.lojistas(id) on delete cascade,
  descricao varchar(200) not null,
  teto_percentual numeric(5,2) not null
    check (teto_percentual >= 0 and teto_percentual <= 100),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_produtos_lojista_id
  on public.produtos(lojista_id);

create index if not exists idx_produtos_descricao
  on public.produtos(descricao);

create unique index if not exists uq_produtos_lojista_descricao
  on public.produtos(lojista_id, lower(descricao));

drop trigger if exists update_produtos_updated_at on public.produtos;

create trigger update_produtos_updated_at
before update on public.produtos
for each row
execute procedure public.update_updated_at_column();

alter table public.compras
  add column if not exists lojista_id uuid,
  add column if not exists cliente_id uuid,
  add column if not exists pontos_total numeric(12,2) not null default 0,
  add column if not exists origem varchar(30) not null default 'manual',
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_compras_lojista_id
  on public.compras(lojista_id);

create index if not exists idx_compras_cliente_id
  on public.compras(cliente_id);

drop trigger if exists update_compras_updated_at on public.compras;

create trigger update_compras_updated_at
before update on public.compras
for each row
execute procedure public.update_updated_at_column();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'compras_lojista_id_fkey'
  ) then
    alter table public.compras
      add constraint compras_lojista_id_fkey
      foreign key (lojista_id) references public.lojistas(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'compras_cliente_id_fkey'
  ) then
    alter table public.compras
      add constraint compras_cliente_id_fkey
      foreign key (cliente_id) references public.clientes(id) on delete restrict;
  end if;
end $$;

create table if not exists public.compra_itens (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  descricao_produto varchar(200) not null,
  quantidade numeric(10,3) not null check (quantidade > 0),
  valor_unitario numeric(12,2) not null check (valor_unitario >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  teto_percentual_produto numeric(5,2) not null
    check (teto_percentual_produto >= 0 and teto_percentual_produto <= 100),
  teto_percentual_nivel numeric(5,2) not null
    check (teto_percentual_nivel >= 0 and teto_percentual_nivel <= 100),
  percentual_aplicado numeric(5,2) not null
    check (percentual_aplicado >= 0 and percentual_aplicado <= 100),
  pontos_gerados numeric(12,2) not null check (pontos_gerados >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_compra_itens_compra_id
  on public.compra_itens(compra_id);

create index if not exists idx_compra_itens_produto_id
  on public.compra_itens(produto_id);

alter table public.lojistas_usuarios enable row level security;
alter table public.clientes_usuarios enable row level security;
alter table public.produtos enable row level security;
alter table public.compras enable row level security;
alter table public.compra_itens enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lojistas_usuarios'
      and policyname = 'lojistas_usuarios_select_own'
  ) then
    create policy lojistas_usuarios_select_own
    on public.lojistas_usuarios
    for select
    using (auth_user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clientes_usuarios'
      and policyname = 'clientes_usuarios_select_own'
  ) then
    create policy clientes_usuarios_select_own
    on public.clientes_usuarios
    for select
    using (auth_user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'produtos'
      and policyname = 'produtos_select_own_lojista'
  ) then
    create policy produtos_select_own_lojista
    on public.produtos
    for select
    using (
      exists (
        select 1
        from public.lojistas_usuarios lu
        where lu.lojista_id = produtos.lojista_id
          and lu.auth_user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'produtos'
      and policyname = 'produtos_insert_own_lojista'
  ) then
    create policy produtos_insert_own_lojista
    on public.produtos
    for insert
    with check (
      exists (
        select 1
        from public.lojistas_usuarios lu
        where lu.lojista_id = produtos.lojista_id
          and lu.auth_user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'produtos'
      and policyname = 'produtos_update_own_lojista'
  ) then
    create policy produtos_update_own_lojista
    on public.produtos
    for update
    using (
      exists (
        select 1
        from public.lojistas_usuarios lu
        where lu.lojista_id = produtos.lojista_id
          and lu.auth_user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.lojistas_usuarios lu
        where lu.lojista_id = produtos.lojista_id
          and lu.auth_user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'produtos'
      and policyname = 'produtos_delete_own_lojista'
  ) then
    create policy produtos_delete_own_lojista
    on public.produtos
    for delete
    using (
      exists (
        select 1
        from public.lojistas_usuarios lu
        where lu.lojista_id = produtos.lojista_id
          and lu.auth_user_id = auth.uid()
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'compras'
      and policyname = 'compras_select_own_lojista'
  ) then
    create policy compras_select_own_lojista
    on public.compras
    for select
    using (
      exists (
        select 1
        from public.lojistas_usuarios lu
        where lu.lojista_id = compras.lojista_id
          and lu.auth_user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'compras'
      and policyname = 'compras_select_own_cliente'
  ) then
    create policy compras_select_own_cliente
    on public.compras
    for select
    using (
      exists (
        select 1
        from public.clientes_usuarios cu
        where cu.cliente_id = compras.cliente_id
          and cu.auth_user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'compras'
      and policyname = 'compras_insert_own_lojista'
  ) then
    create policy compras_insert_own_lojista
    on public.compras
    for insert
    with check (
      exists (
        select 1
        from public.lojistas_usuarios lu
        where lu.lojista_id = compras.lojista_id
          and lu.auth_user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'compras'
      and policyname = 'compras_update_own_lojista'
  ) then
    create policy compras_update_own_lojista
    on public.compras
    for update
    using (
      exists (
        select 1
        from public.lojistas_usuarios lu
        where lu.lojista_id = compras.lojista_id
          and lu.auth_user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.lojistas_usuarios lu
        where lu.lojista_id = compras.lojista_id
          and lu.auth_user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'compras'
      and policyname = 'compras_delete_own_lojista'
  ) then
    create policy compras_delete_own_lojista
    on public.compras
    for delete
    using (
      exists (
        select 1
        from public.lojistas_usuarios lu
        where lu.lojista_id = compras.lojista_id
          and lu.auth_user_id = auth.uid()
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'compra_itens'
      and policyname = 'compra_itens_select_own_lojista'
  ) then
    create policy compra_itens_select_own_lojista
    on public.compra_itens
    for select
    using (
      exists (
        select 1
        from public.compras c
        join public.lojistas_usuarios lu
          on lu.lojista_id = c.lojista_id
        where c.id = compra_itens.compra_id
          and lu.auth_user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'compra_itens'
      and policyname = 'compra_itens_select_own_cliente'
  ) then
    create policy compra_itens_select_own_cliente
    on public.compra_itens
    for select
    using (
      exists (
        select 1
        from public.compras c
        join public.clientes_usuarios cu
          on cu.cliente_id = c.cliente_id
        where c.id = compra_itens.compra_id
          and cu.auth_user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'compra_itens'
      and policyname = 'compra_itens_insert_own_lojista'
  ) then
    create policy compra_itens_insert_own_lojista
    on public.compra_itens
    for insert
    with check (
      exists (
        select 1
        from public.compras c
        join public.lojistas_usuarios lu
          on lu.lojista_id = c.lojista_id
        where c.id = compra_itens.compra_id
          and lu.auth_user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'compra_itens'
      and policyname = 'compra_itens_update_own_lojista'
  ) then
    create policy compra_itens_update_own_lojista
    on public.compra_itens
    for update
    using (
      exists (
        select 1
        from public.compras c
        join public.lojistas_usuarios lu
          on lu.lojista_id = c.lojista_id
        where c.id = compra_itens.compra_id
          and lu.auth_user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.compras c
        join public.lojistas_usuarios lu
          on lu.lojista_id = c.lojista_id
        where c.id = compra_itens.compra_id
          and lu.auth_user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'compra_itens'
      and policyname = 'compra_itens_delete_own_lojista'
  ) then
    create policy compra_itens_delete_own_lojista
    on public.compra_itens
    for delete
    using (
      exists (
        select 1
        from public.compras c
        join public.lojistas_usuarios lu
          on lu.lojista_id = c.lojista_id
        where c.id = compra_itens.compra_id
          and lu.auth_user_id = auth.uid()
      )
    );
  end if;
end $$;