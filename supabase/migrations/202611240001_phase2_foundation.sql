-- SnackFlow Phase 2: normalized master data, identity, append-only stock ledger, RLS.
-- No stock balance is stored. Inventory is derived from inventory_movements.

create type public.app_role as enum ('owner', 'admin', 'salesman', 'production', 'accountant');
create type public.unit_dimension as enum ('mass', 'volume', 'count');
create type public.inventory_item_type as enum ('raw_material', 'packaging_material', 'product');
create type public.inventory_movement_type as enum (
  'opening_balance', 'purchase_receipt', 'production_issue', 'production_receipt', 'dispatch', 'adjustment_in', 'adjustment_out'
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{0,19}$'),
  name text not null,
  symbol text not null,
  dimension public.unit_dimension not null,
  -- Base factors are provided only for mass and volume. Count conversions are pack/item-specific.
  factor_to_base numeric(18,9),
  created_at timestamptz not null default now(),
  constraint units_positive_factor check (factor_to_base is null or factor_to_base > 0),
  constraint units_count_factor check (dimension <> 'count' or factor_to_base is null)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  role public.app_role not null default 'salesman',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state_code char(2) not null check (state_code ~ '^[0-9]{2}$'),
  state_name text not null,
  country_code char(2) not null default 'IN' check (country_code = 'IN'),
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  gstin char(15) check (gstin is null or gstin ~ '^[0-9A-Z]{15}$'),
  state_code char(2) check (state_code is null or state_code ~ '^[0-9]{2}$'),
  phone text,
  email text,
  billing_address text,
  assigned_salesman_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  gstin char(15) check (gstin is null or gstin ~ '^[0-9A-Z]{15}$'),
  state_code char(2) check (state_code is null or state_code ~ '^[0-9]{2}$'),
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text,
  hsn_code text,
  pack_size numeric(14,3) not null check (pack_size > 0),
  pack_unit_id uuid not null references public.units(id) on delete restrict,
  stock_unit_id uuid not null references public.units(id) on delete restrict,
  gst_rate numeric(7,5) not null default 0 check (gst_rate >= 0 and gst_rate <= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  constraint product_prices_valid_range check (effective_to is null or effective_to >= effective_from),
  unique (product_id, effective_from)
);

create table public.raw_materials (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  base_unit_id uuid not null references public.units(id) on delete restrict,
  reorder_level numeric(18,6) not null default 0 check (reorder_level >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.packaging_materials (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  base_unit_id uuid not null references public.units(id) on delete restrict,
  reorder_level numeric(18,6) not null default 0 check (reorder_level >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bom_headers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  version integer not null check (version > 0),
  expected_output numeric(18,6) not null check (expected_output > 0),
  output_unit_id uuid not null references public.units(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, version)
);

create unique index bom_one_active_version_per_product on public.bom_headers(product_id) where is_active;

create table public.bom_items (
  id uuid primary key default gen_random_uuid(),
  bom_header_id uuid not null references public.bom_headers(id) on delete cascade,
  raw_material_id uuid references public.raw_materials(id) on delete restrict,
  packaging_material_id uuid references public.packaging_materials(id) on delete restrict,
  quantity numeric(18,6) not null check (quantity > 0),
  unit_id uuid not null references public.units(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  constraint bom_item_exactly_one_material check ((raw_material_id is not null)::int + (packaging_material_id is not null)::int = 1)
);

create unique index bom_item_raw_unique on public.bom_items(bom_header_id, raw_material_id) where raw_material_id is not null;
create unique index bom_item_packaging_unique on public.bom_items(bom_header_id, packaging_material_id) where packaging_material_id is not null;

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_type public.inventory_item_type not null,
  raw_material_id uuid references public.raw_materials(id) on delete restrict,
  packaging_material_id uuid references public.packaging_materials(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  movement_type public.inventory_movement_type not null,
  quantity numeric(18,6) not null check (quantity > 0),
  unit_id uuid not null references public.units(id) on delete restrict,
  -- Unit cost is recorded in INR per inventory base unit when known, never used as a balance.
  unit_cost numeric(14,4) check (unit_cost is null or unit_cost >= 0),
  source_document_type text not null check (source_document_type in ('opening_balance', 'purchase', 'production_run', 'dispatch', 'adjustment')),
  source_document_id uuid,
  source_line_id uuid,
  idempotency_key text not null unique,
  note text,
  user_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint inventory_movement_one_item check ((raw_material_id is not null)::int + (packaging_material_id is not null)::int + (product_id is not null)::int = 1),
  constraint inventory_item_type_matches check (
    (item_type = 'raw_material' and raw_material_id is not null and packaging_material_id is null and product_id is null) or
    (item_type = 'packaging_material' and packaging_material_id is not null and raw_material_id is null and product_id is null) or
    (item_type = 'product' and product_id is not null and raw_material_id is null and packaging_material_id is null)
  ),
  constraint inventory_opening_source check (movement_type <> 'opening_balance' or source_document_type = 'opening_balance'),
  constraint inventory_movement_source_matches check (
    (movement_type = 'opening_balance' and source_document_type = 'opening_balance') or
    (movement_type = 'purchase_receipt' and source_document_type = 'purchase') or
    (movement_type in ('production_issue','production_receipt') and source_document_type = 'production_run') or
    (movement_type = 'dispatch' and source_document_type = 'dispatch') or
    (movement_type in ('adjustment_in','adjustment_out') and source_document_type = 'adjustment')
  ),
  constraint inventory_source_id_required check (movement_type = 'opening_balance' or source_document_id is not null)
);

create unique index inventory_movement_source_line_unique on public.inventory_movements(source_document_type, source_document_id, source_line_id, movement_type) where source_document_id is not null and source_line_id is not null;
create index inventory_movements_raw_time_idx on public.inventory_movements(raw_material_id, occurred_at desc) where raw_material_id is not null;
create index inventory_movements_pack_time_idx on public.inventory_movements(packaging_material_id, occurred_at desc) where packaging_material_id is not null;
create index inventory_movements_product_time_idx on public.inventory_movements(product_id, occurred_at desc) where product_id is not null;
create index customers_salesman_idx on public.customers(assigned_salesman_id);
create index product_prices_lookup_idx on public.product_prices(product_id, effective_from desc);
create index bom_items_header_idx on public.bom_items(bom_header_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  table_name text not null,
  record_id uuid,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);

create index audit_logs_record_idx on public.audit_logs(table_name, record_id, occurred_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_id, occurred_at desc);

-- Role helper is SECURITY DEFINER so policies can check profiles without recursive RLS.
create function public.has_any_role(required_roles public.app_role[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any(required_roles));
$$;
revoke all on function public.has_any_role(public.app_role[]) from public;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;

create function public.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Never trust user-supplied auth metadata for authorization role assignment.
  insert into public.profiles(id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), 'salesman')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_profile_created after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.guard_profile_role_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.has_any_role(array['owner']::public.app_role[]) then
    raise exception 'Only an owner can change profile roles' using errcode = '42501';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_role_guard before update on public.profiles
for each row execute function public.guard_profile_role_change();

create function public.guard_bom_units()
returns trigger language plpgsql set search_path = public
as $$
declare
  expected_unit uuid;
begin
  if tg_table_name = 'bom_headers' then
    select stock_unit_id into expected_unit from public.products where id = new.product_id;
    if expected_unit is null or new.output_unit_id <> expected_unit then
      raise exception 'BOM output unit must match the product stock unit' using errcode = '23514';
    end if;
  else
    if new.raw_material_id is not null then
      select base_unit_id into expected_unit from public.raw_materials where id = new.raw_material_id;
    else
      select base_unit_id into expected_unit from public.packaging_materials where id = new.packaging_material_id;
    end if;
    if expected_unit is null or new.unit_id <> expected_unit then
      raise exception 'BOM item unit must match the material stock unit' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger bom_header_unit_guard before insert or update on public.bom_headers
for each row execute function public.guard_bom_units();
create trigger bom_item_unit_guard before insert or update on public.bom_items
for each row execute function public.guard_bom_units();

create function public.inventory_movement_sign(kind public.inventory_movement_type)
returns smallint language sql immutable strict
as $$
  select case when kind in ('opening_balance', 'purchase_receipt', 'production_receipt', 'adjustment_in') then 1 else -1 end::smallint;
$$;

create function public.guard_inventory_movement()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  item_uuid uuid;
  expected_unit uuid;
  current_balance numeric(18,6);
  lock_key bigint;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Inventory movements are append-only; post a correcting movement instead' using errcode = '55000';
  end if;
  item_uuid := coalesce(new.raw_material_id, new.packaging_material_id, new.product_id);
  lock_key := hashtextextended(new.item_type::text || ':' || item_uuid::text, 0);
  perform pg_advisory_xact_lock(lock_key);

  if new.item_type = 'raw_material' then
    select base_unit_id into expected_unit from public.raw_materials where id = item_uuid;
    select coalesce(sum(quantity * public.inventory_movement_sign(movement_type)), 0) into current_balance from public.inventory_movements where raw_material_id = item_uuid;
  elsif new.item_type = 'packaging_material' then
    select base_unit_id into expected_unit from public.packaging_materials where id = item_uuid;
    select coalesce(sum(quantity * public.inventory_movement_sign(movement_type)), 0) into current_balance from public.inventory_movements where packaging_material_id = item_uuid;
  else
    select stock_unit_id into expected_unit from public.products where id = item_uuid;
    select coalesce(sum(quantity * public.inventory_movement_sign(movement_type)), 0) into current_balance from public.inventory_movements where product_id = item_uuid;
  end if;

  if expected_unit is null then
    raise exception 'Inventory item does not exist' using errcode = '23503';
  end if;
  if new.unit_id <> expected_unit then
    raise exception 'Movement unit must match the item stock unit' using errcode = '23514';
  end if;
  if public.inventory_movement_sign(new.movement_type) < 0 and current_balance < new.quantity then
    raise exception 'Insufficient stock: available %, requested %', current_balance, new.quantity using errcode = '23514';
  end if;
  if auth.uid() is not null then
    new.user_id := auth.uid();
    new.occurred_at := now();
  end if;
  return new;
end;
$$;

create trigger inventory_movement_guard before insert or update or delete on public.inventory_movements
for each row execute function public.guard_inventory_movement();

create function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  row_data jsonb;
  row_id uuid;
begin
  if tg_op = 'DELETE' then row_data := to_jsonb(old); row_id := old.id;
  else row_data := to_jsonb(new); row_id := new.id;
  end if;
  insert into public.audit_logs(actor_id, action, table_name, record_id, before_data, after_data)
  values (auth.uid(), tg_op, tg_table_name, row_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create trigger audit_customers after insert or update or delete on public.customers for each row execute function public.write_audit_log();
create trigger audit_suppliers after insert or update or delete on public.suppliers for each row execute function public.write_audit_log();
create trigger audit_profiles after update on public.profiles for each row execute function public.write_audit_log();
create trigger audit_locations after insert or update or delete on public.business_locations for each row execute function public.write_audit_log();
create trigger audit_products after insert or update or delete on public.products for each row execute function public.write_audit_log();
create trigger audit_product_prices after insert or update or delete on public.product_prices for each row execute function public.write_audit_log();
create trigger audit_raw_materials after insert or update or delete on public.raw_materials for each row execute function public.write_audit_log();
create trigger audit_packaging_materials after insert or update or delete on public.packaging_materials for each row execute function public.write_audit_log();
create trigger audit_bom_headers after insert or update or delete on public.bom_headers for each row execute function public.write_audit_log();
create trigger audit_bom_items after insert or update or delete on public.bom_items for each row execute function public.write_audit_log();
create trigger audit_inventory_movements after insert on public.inventory_movements for each row execute function public.write_audit_log();

create view public.inventory_balances with (security_invoker = true) as
  select 'raw_material'::public.inventory_item_type as item_type, raw_material_id as item_id, unit_id,
         sum(quantity * public.inventory_movement_sign(movement_type)) as balance
    from public.inventory_movements where raw_material_id is not null group by raw_material_id, unit_id
  union all
  select 'packaging_material'::public.inventory_item_type, packaging_material_id, unit_id,
         sum(quantity * public.inventory_movement_sign(movement_type))
    from public.inventory_movements where packaging_material_id is not null group by packaging_material_id, unit_id
  union all
  select 'product'::public.inventory_item_type, product_id, unit_id,
         sum(quantity * public.inventory_movement_sign(movement_type))
    from public.inventory_movements where product_id is not null group by product_id, unit_id;

-- Updated timestamps for editable master records.
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();
create trigger suppliers_touch before update on public.suppliers for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger raw_materials_touch before update on public.raw_materials for each row execute function public.touch_updated_at();
create trigger packaging_materials_touch before update on public.packaging_materials for each row execute function public.touch_updated_at();

-- RLS is the security boundary. Frontend route/navigation checks are only presentation.
alter table public.profiles enable row level security;
alter table public.business_locations enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.product_prices enable row level security;
alter table public.raw_materials enable row level security;
alter table public.packaging_materials enable row level security;
alter table public.units enable row level security;
alter table public.bom_headers enable row level security;
alter table public.bom_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read_self_or_admin on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_any_role(array['owner','admin']::public.app_role[]));
create policy profiles_update_self_or_owner on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_any_role(array['owner']::public.app_role[]))
  with check (id = auth.uid() or public.has_any_role(array['owner']::public.app_role[]));

create policy locations_read_authenticated on public.business_locations for select to authenticated using (true);
create policy locations_manage_admin on public.business_locations for all to authenticated
  using (public.has_any_role(array['owner','admin']::public.app_role[]))
  with check (public.has_any_role(array['owner','admin']::public.app_role[]));

create policy customers_read_assigned_or_admin on public.customers for select to authenticated
  using (public.has_any_role(array['owner','admin']::public.app_role[]) or assigned_salesman_id = auth.uid());
create policy customers_manage_admin on public.customers for all to authenticated
  using (public.has_any_role(array['owner','admin']::public.app_role[]))
  with check (public.has_any_role(array['owner','admin']::public.app_role[]));

create policy suppliers_read_ops on public.suppliers for select to authenticated
  using (public.has_any_role(array['owner','admin','production','accountant']::public.app_role[]));
create policy suppliers_manage_admin on public.suppliers for all to authenticated
  using (public.has_any_role(array['owner','admin']::public.app_role[]))
  with check (public.has_any_role(array['owner','admin']::public.app_role[]));

create policy products_read_authenticated on public.products for select to authenticated using (true);
create policy products_manage_admin on public.products for all to authenticated
  using (public.has_any_role(array['owner','admin']::public.app_role[]))
  with check (public.has_any_role(array['owner','admin']::public.app_role[]));
create policy product_prices_read_authenticated on public.product_prices for select to authenticated using (true);
create policy product_prices_manage_admin on public.product_prices for all to authenticated
  using (public.has_any_role(array['owner','admin']::public.app_role[]))
  with check (public.has_any_role(array['owner','admin']::public.app_role[]));

create policy raw_materials_read_ops on public.raw_materials for select to authenticated
  using (public.has_any_role(array['owner','admin','production','accountant']::public.app_role[]));
create policy raw_materials_manage_ops on public.raw_materials for all to authenticated
  using (public.has_any_role(array['owner','admin','production']::public.app_role[]))
  with check (public.has_any_role(array['owner','admin','production']::public.app_role[]));
create policy packaging_materials_read_ops on public.packaging_materials for select to authenticated
  using (public.has_any_role(array['owner','admin','production','accountant']::public.app_role[]));
create policy packaging_materials_manage_ops on public.packaging_materials for all to authenticated
  using (public.has_any_role(array['owner','admin','production']::public.app_role[]))
  with check (public.has_any_role(array['owner','admin','production']::public.app_role[]));

create policy units_read_authenticated on public.units for select to authenticated using (true);
create policy units_manage_admin on public.units for all to authenticated
  using (public.has_any_role(array['owner','admin']::public.app_role[]))
  with check (public.has_any_role(array['owner','admin']::public.app_role[]));

create policy bom_read_ops on public.bom_headers for select to authenticated
  using (public.has_any_role(array['owner','admin','production','accountant']::public.app_role[]));
create policy bom_manage_ops on public.bom_headers for all to authenticated
  using (public.has_any_role(array['owner','admin','production']::public.app_role[]))
  with check (public.has_any_role(array['owner','admin','production']::public.app_role[]));
create policy bom_items_read_ops on public.bom_items for select to authenticated
  using (public.has_any_role(array['owner','admin','production','accountant']::public.app_role[]));
create policy bom_items_manage_ops on public.bom_items for all to authenticated
  using (public.has_any_role(array['owner','admin','production']::public.app_role[]))
  with check (public.has_any_role(array['owner','admin','production']::public.app_role[]));

create policy inventory_read_ops on public.inventory_movements for select to authenticated
  using (public.has_any_role(array['owner','admin','production','accountant']::public.app_role[]));
create policy inventory_append_ops on public.inventory_movements for insert to authenticated
  with check (
    public.has_any_role(array['owner','admin']::public.app_role[]) or
    (
      public.has_any_role(array['production']::public.app_role[]) and
      ((movement_type = 'purchase_receipt' and item_type in ('raw_material','packaging_material')) or
       (movement_type = 'production_issue' and item_type in ('raw_material','packaging_material')) or
       (movement_type = 'production_receipt' and item_type = 'product'))
    )
  );
-- No UPDATE/DELETE policies: corrections must be new, auditable movements.

create policy audit_read_owner_admin_accountant on public.audit_logs for select to authenticated
  using (public.has_any_role(array['owner','admin','accountant']::public.app_role[]));
-- No authenticated INSERT/UPDATE/DELETE policies; audit rows are written by triggers.

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.business_locations, public.customers, public.suppliers,
  public.products, public.product_prices, public.raw_materials, public.packaging_materials,
  public.units, public.bom_headers, public.bom_items to authenticated;
grant select, insert on public.inventory_movements to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.audit_logs, public.inventory_balances to authenticated;

-- Database-level tests can inspect this read-only ledger view under each user's own RLS scope.
