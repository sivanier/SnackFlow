-- Phase 4 foundation: production plans are snapshotted from an active BOM;
-- completion and every related ledger movement are committed in one transaction.

create type public.production_run_status as enum ('draft', 'completed');

create table public.production_runs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  bom_header_id uuid not null references public.bom_headers(id) on delete restrict,
  planned_quantity numeric(18,6) not null check (planned_quantity > 0),
  unit_id uuid not null references public.units(id) on delete restrict,
  status public.production_run_status not null default 'draft',
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index production_runs_product_time_idx on public.production_runs(product_id, created_at desc);
create index production_runs_status_time_idx on public.production_runs(status, created_at desc);

create table public.production_consumption (
  id uuid primary key default gen_random_uuid(),
  production_run_id uuid not null references public.production_runs(id) on delete restrict,
  bom_item_id uuid references public.bom_items(id) on delete set null,
  raw_material_id uuid references public.raw_materials(id) on delete restrict,
  packaging_material_id uuid references public.packaging_materials(id) on delete restrict,
  planned_quantity numeric(18,6) not null check (planned_quantity > 0),
  actual_quantity numeric(18,6) check (actual_quantity is null or actual_quantity >= 0),
  unit_id uuid not null references public.units(id) on delete restrict,
  constraint production_consumption_one_item check ((raw_material_id is not null)::int + (packaging_material_id is not null)::int = 1)
);
create unique index production_consumption_raw_unique on public.production_consumption(production_run_id, raw_material_id) where raw_material_id is not null;
create unique index production_consumption_packaging_unique on public.production_consumption(production_run_id, packaging_material_id) where packaging_material_id is not null;
create index production_consumption_run_idx on public.production_consumption(production_run_id);

create table public.production_outputs (
  id uuid primary key default gen_random_uuid(),
  production_run_id uuid not null unique references public.production_runs(id) on delete restrict,
  good_quantity numeric(18,6) not null check (good_quantity >= 0),
  rejected_quantity numeric(18,6) not null default 0 check (rejected_quantity >= 0),
  wastage_quantity numeric(18,6) not null default 0 check (wastage_quantity >= 0),
  actual_quantity numeric(18,6) generated always as (good_quantity + rejected_quantity + wastage_quantity) stored,
  unit_id uuid not null references public.units(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.production_runs enable row level security;
alter table public.production_consumption enable row level security;
alter table public.production_outputs enable row level security;

create policy production_runs_read_ops on public.production_runs for select to authenticated
  using (public.has_any_role(array['owner','admin','production','accountant']::public.app_role[]));
create policy production_consumption_read_ops on public.production_consumption for select to authenticated
  using (public.has_any_role(array['owner','admin','production','accountant']::public.app_role[]));
create policy production_outputs_read_ops on public.production_outputs for select to authenticated
  using (public.has_any_role(array['owner','admin','production','accountant']::public.app_role[]));

grant select on public.production_runs, public.production_consumption, public.production_outputs to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.production_runs, public.production_consumption, public.production_outputs from anon, authenticated;

create view public.production_consumption_variance with (security_invoker = true) as
  select c.id, c.production_run_id, c.raw_material_id, c.packaging_material_id,
         c.planned_quantity, c.actual_quantity,
         case when c.actual_quantity is null then null else c.actual_quantity - c.planned_quantity end as variance_quantity,
         case when c.actual_quantity is null then null else (c.actual_quantity - c.planned_quantity) / c.planned_quantity * 100 end as variance_percent,
         c.unit_id
    from public.production_consumption c;

create view public.production_run_metrics with (security_invoker = true) as
  select r.id as production_run_id, r.product_id, r.planned_quantity, r.unit_id, r.status,
         o.good_quantity, o.rejected_quantity, o.wastage_quantity, o.actual_quantity,
         case when o.id is null then null else o.good_quantity / r.planned_quantity * 100 end as yield_percent,
         case when o.id is null or o.actual_quantity = 0 then null else o.rejected_quantity / o.actual_quantity * 100 end as rejection_percent,
         case when o.id is null or o.actual_quantity = 0 then null else o.wastage_quantity / o.actual_quantity * 100 end as wastage_percent
    from public.production_runs r left join public.production_outputs o on o.production_run_id = r.id;
grant select on public.production_consumption_variance, public.production_run_metrics to authenticated;

create function public.create_production_run(p_product_id uuid, p_planned_quantity numeric, p_notes text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_bom public.bom_headers%rowtype;
  v_product_unit uuid;
  v_run_id uuid;
  v_items integer;
begin
  if v_user is null or not public.has_any_role(array['owner','admin','production']::public.app_role[]) then
    raise exception 'You are not authorized to create production runs' using errcode = '42501';
  end if;
  if p_planned_quantity is null or p_planned_quantity <= 0 then
    raise exception 'Planned output quantity must be greater than zero' using errcode = '23514';
  end if;
  select stock_unit_id into v_product_unit from public.products where id = p_product_id and is_active;
  if v_product_unit is null then raise exception 'Select an active finished product' using errcode = '23503'; end if;
  select * into v_bom from public.bom_headers where product_id = p_product_id and is_active for share;
  if not found then raise exception 'The selected product has no active BOM' using errcode = '23514'; end if;
  if v_bom.output_unit_id <> v_product_unit then raise exception 'BOM output unit does not match the product stock unit' using errcode = '23514'; end if;

  insert into public.production_runs(product_id, bom_header_id, planned_quantity, unit_id, notes, created_by)
  values (p_product_id, v_bom.id, p_planned_quantity, v_product_unit, nullif(btrim(p_notes), ''), v_user)
  returning id into v_run_id;

  insert into public.production_consumption(production_run_id, bom_item_id, raw_material_id, packaging_material_id, planned_quantity, unit_id)
  select v_run_id, bi.id, bi.raw_material_id, bi.packaging_material_id,
         round(bi.quantity * p_planned_quantity / v_bom.expected_output, 6), bi.unit_id
    from public.bom_items bi where bi.bom_header_id = v_bom.id;
  get diagnostics v_items = row_count;
  if v_items = 0 then raise exception 'The active BOM has no material rows' using errcode = '23514'; end if;
  return v_run_id;
end;
$$;

create function public.complete_production_run(
  p_run_id uuid,
  p_consumption jsonb,
  p_good_quantity numeric,
  p_rejected_quantity numeric default 0,
  p_wastage_quantity numeric default 0,
  p_notes text default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_run public.production_runs%rowtype;
  v_line record;
  v_output_id uuid;
  v_count integer;
  v_updated integer;
begin
  if v_user is null or not public.has_any_role(array['owner','admin','production']::public.app_role[]) then
    raise exception 'You are not authorized to complete production runs' using errcode = '42501';
  end if;
  if jsonb_typeof(p_consumption) <> 'array' or jsonb_array_length(p_consumption) = 0 then
    raise exception 'Provide actual consumption for every BOM material' using errcode = '22023';
  end if;
  if p_good_quantity is null or p_good_quantity < 0 or coalesce(p_rejected_quantity, 0) < 0 or coalesce(p_wastage_quantity, 0) < 0 then
    raise exception 'Output quantities must be zero or greater' using errcode = '23514';
  end if;
  select * into v_run from public.production_runs where id = p_run_id for update;
  if not found then raise exception 'Production run was not found' using errcode = 'P0002'; end if;
  if v_run.status <> 'draft' then raise exception 'Only draft production runs can be completed' using errcode = '55000'; end if;

  select count(*) into v_count from public.production_consumption where production_run_id = p_run_id;
  if jsonb_array_length(p_consumption) <> v_count then
    raise exception 'Actual consumption must include each planned material exactly once' using errcode = '22023';
  end if;
  update public.production_consumption c
     set actual_quantity = (entry.value->>'actual_quantity')::numeric
    from jsonb_array_elements(p_consumption) as entry(value)
   where c.production_run_id = p_run_id and c.id = (entry.value->>'consumption_id')::uuid
     and (entry.value->>'actual_quantity') is not null
     and (entry.value->>'actual_quantity')::numeric >= 0;
  get diagnostics v_updated = row_count;
  if v_updated <> v_count or exists (select 1 from public.production_consumption where production_run_id = p_run_id and actual_quantity is null) then
    raise exception 'Actual consumption contains a missing, duplicate, or invalid material quantity' using errcode = '22023';
  end if;

  -- Stable item ordering makes concurrent multi-material runs acquire ledger locks consistently.
  for v_line in
    select c.* from public.production_consumption c
     where c.production_run_id = p_run_id and c.actual_quantity > 0
     order by coalesce(c.raw_material_id, c.packaging_material_id)
  loop
    insert into public.inventory_movements(
      item_type, raw_material_id, packaging_material_id, movement_type, quantity, unit_id,
      source_document_type, source_document_id, source_line_id, idempotency_key, note, user_id
    ) values (
      case when v_line.raw_material_id is not null then 'raw_material'::public.inventory_item_type else 'packaging_material'::public.inventory_item_type end,
      v_line.raw_material_id, v_line.packaging_material_id, 'production_issue', v_line.actual_quantity, v_line.unit_id,
      'production_run', p_run_id, v_line.id, 'production-consumption:' || p_run_id::text || ':' || v_line.id::text,
      'Actual production consumption', v_user
    );
  end loop;

  insert into public.production_outputs(production_run_id, good_quantity, rejected_quantity, wastage_quantity, unit_id, notes)
  values (p_run_id, p_good_quantity, coalesce(p_rejected_quantity, 0), coalesce(p_wastage_quantity, 0), v_run.unit_id, nullif(btrim(p_notes), ''))
  returning id into v_output_id;
  if p_good_quantity > 0 then
    insert into public.inventory_movements(
      item_type, product_id, movement_type, quantity, unit_id,
      source_document_type, source_document_id, source_line_id, idempotency_key, note, user_id
    ) values (
      'product', v_run.product_id, 'production_receipt', p_good_quantity, v_run.unit_id,
      'production_run', p_run_id, v_output_id, 'production-output:' || p_run_id::text,
      'Good finished production output', v_user
    );
  end if;
  update public.production_runs set status = 'completed', completed_at = now() where id = p_run_id;
  return p_run_id;
end;
$$;

revoke all on function public.create_production_run(uuid,numeric,text) from public, anon;
revoke all on function public.complete_production_run(uuid,jsonb,numeric,numeric,numeric,text) from public, anon;
grant execute on function public.create_production_run(uuid,numeric,text) to authenticated;
grant execute on function public.complete_production_run(uuid,jsonb,numeric,numeric,numeric,text) to authenticated;

create trigger audit_production_runs after insert or update on public.production_runs for each row execute function public.write_audit_log();
create trigger audit_production_consumption after insert or update on public.production_consumption for each row execute function public.write_audit_log();
create trigger audit_production_outputs after insert on public.production_outputs for each row execute function public.write_audit_log();
