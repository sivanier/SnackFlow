-- Minimal secure order -> approval -> invoice -> dispatch workflow.
create type public.sales_order_status as enum ('submitted', 'approved', 'invoiced', 'dispatched');
create sequence public.invoice_number_seq;

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  customer_state_code char(2) not null check (customer_state_code ~ '^[0-9]{2}$'),
  status public.sales_order_status not null default 'submitted',
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  cgst_amount numeric(14,2) not null default 0 check (cgst_amount >= 0),
  sgst_amount numeric(14,2) not null default 0 check (sgst_amount >= 0),
  igst_amount numeric(14,2) not null default 0 check (igst_amount >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  notes text,
  submitted_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sales_order_tax_split check ((cgst_amount = 0 and sgst_amount = 0) or igst_amount = 0),
  constraint sales_order_total_check check (total_amount = subtotal + cgst_amount + sgst_amount + igst_amount)
);
create index sales_orders_customer_date_idx on public.sales_orders(customer_id, created_at desc);
create index sales_orders_creator_date_idx on public.sales_orders(created_by, created_at desc);
create index sales_orders_status_date_idx on public.sales_orders(status, submitted_at desc);

create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_sku text not null,
  product_name text not null,
  quantity numeric(18,6) not null check (quantity > 0),
  unit_id uuid not null references public.units(id) on delete restrict,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  gst_rate numeric(7,5) not null check (gst_rate >= 0 and gst_rate <= 1),
  taxable_amount numeric(14,2) not null check (taxable_amount >= 0),
  cgst_amount numeric(14,2) not null default 0 check (cgst_amount >= 0),
  sgst_amount numeric(14,2) not null default 0 check (sgst_amount >= 0),
  igst_amount numeric(14,2) not null default 0 check (igst_amount >= 0),
  total_amount numeric(14,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  constraint sales_order_item_total_check check (total_amount = taxable_amount + cgst_amount + sgst_amount + igst_amount),
  constraint sales_order_item_tax_split check ((cgst_amount = 0 and sgst_amount = 0) or igst_amount = 0)
);
create index sales_order_items_order_idx on public.sales_order_items(sales_order_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null unique references public.sales_orders(id) on delete restrict,
  invoice_number text not null unique,
  financial_year text not null,
  issue_date date not null default current_date,
  customer_id uuid not null references public.customers(id) on delete restrict,
  customer_name text not null,
  customer_gstin char(15),
  customer_state_code char(2) not null,
  factory_state_code char(2) not null,
  subtotal numeric(14,2) not null check (subtotal >= 0),
  cgst_amount numeric(14,2) not null check (cgst_amount >= 0),
  sgst_amount numeric(14,2) not null check (sgst_amount >= 0),
  igst_amount numeric(14,2) not null check (igst_amount >= 0),
  total_amount numeric(14,2) not null check (total_amount = subtotal + cgst_amount + sgst_amount + igst_amount),
  issued_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint invoice_tax_split check ((cgst_amount = 0 and sgst_amount = 0) or igst_amount = 0)
);
create index invoices_customer_date_idx on public.invoices(customer_id, issue_date desc);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  sales_order_item_id uuid not null references public.sales_order_items(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_sku text not null,
  product_name text not null,
  hsn_code text,
  quantity numeric(18,6) not null check (quantity > 0),
  unit_id uuid not null references public.units(id) on delete restrict,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  gst_rate numeric(7,5) not null check (gst_rate >= 0 and gst_rate <= 1),
  taxable_amount numeric(14,2) not null check (taxable_amount >= 0),
  cgst_amount numeric(14,2) not null check (cgst_amount >= 0),
  sgst_amount numeric(14,2) not null check (sgst_amount >= 0),
  igst_amount numeric(14,2) not null check (igst_amount >= 0),
  total_amount numeric(14,2) not null check (total_amount = taxable_amount + cgst_amount + sgst_amount + igst_amount)
);
create index invoice_items_invoice_idx on public.invoice_items(invoice_id);

create table public.dispatches (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null unique references public.sales_orders(id) on delete restrict,
  invoice_id uuid not null unique references public.invoices(id) on delete restrict,
  dispatched_by uuid not null references public.profiles(id) on delete restrict,
  dispatched_at timestamptz not null default now(),
  notes text
);
create index dispatches_time_idx on public.dispatches(dispatched_at desc);

alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.dispatches enable row level security;

create policy sales_orders_read_owner_admin_or_creator on public.sales_orders for select to authenticated
  using (public.has_any_role(array['owner','admin']::public.app_role[]) or created_by = auth.uid());
create policy sales_order_items_read_visible_order on public.sales_order_items for select to authenticated
  using (exists (select 1 from public.sales_orders o where o.id = sales_order_id));
create policy invoices_read_finance_or_order_owner on public.invoices for select to authenticated
  using (public.has_any_role(array['owner','admin','accountant']::public.app_role[]) or exists (select 1 from public.sales_orders o where o.id = sales_order_id and o.created_by = auth.uid()));
create policy invoice_items_read_visible_invoice on public.invoice_items for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));
create policy dispatches_read_finance_or_order_owner on public.dispatches for select to authenticated
  using (public.has_any_role(array['owner','admin','accountant']::public.app_role[]) or exists (select 1 from public.sales_orders o where o.id = sales_order_id and o.created_by = auth.uid()));

grant select on public.sales_orders, public.sales_order_items, public.invoices, public.invoice_items, public.dispatches to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.sales_orders, public.sales_order_items, public.invoices, public.invoice_items, public.dispatches from anon, authenticated;
revoke all on sequence public.invoice_number_seq from public, anon, authenticated;

create function public.create_sales_order(p_customer_id uuid, p_lines jsonb, p_notes text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_role public.app_role;
  v_customer public.customers%rowtype;
  v_factory_state char(2);
  v_is_interstate boolean;
  v_order_id uuid;
  v_line jsonb;
  v_product public.products%rowtype;
  v_price numeric(14,2);
  v_taxable numeric(14,2);
  v_cgst numeric(14,2);
  v_sgst numeric(14,2);
  v_igst numeric(14,2);
  v_subtotal numeric(14,2) := 0;
  v_cgst_total numeric(14,2) := 0;
  v_sgst_total numeric(14,2) := 0;
  v_igst_total numeric(14,2) := 0;
begin
  if v_user is null then raise exception 'Sign in to create an order' using errcode = '42501'; end if;
  select role into v_role from public.profiles where id = v_user;
  if v_role is null or v_role not in ('owner','admin','salesman') then raise exception 'You are not authorized to create orders' using errcode = '42501'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Order lines must be a JSON array' using errcode = '22023'; end if;
  if jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one product to the order' using errcode = '22023'; end if;
  select * into v_customer from public.customers where id = p_customer_id and is_active;
  if not found then raise exception 'Select an active customer' using errcode = '23503'; end if;
  if v_role = 'salesman' and v_customer.assigned_salesman_id <> v_user then raise exception 'Salesmen may order only for customers assigned to them' using errcode = '42501'; end if;
  if v_customer.state_code is null then raise exception 'Customer state code is required before ordering' using errcode = '23514'; end if;
  select state_code into v_factory_state from public.business_locations order by created_at limit 1;
  if v_factory_state is null then raise exception 'Configure a factory location before ordering' using errcode = '23514'; end if;
  v_is_interstate := v_customer.state_code <> v_factory_state;

  insert into public.sales_orders(customer_id, created_by, customer_state_code, notes)
  values (p_customer_id, v_user, v_customer.state_code, nullif(btrim(p_notes), '')) returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if (v_line->>'product_id') is null or (v_line->>'quantity') is null then raise exception 'Each order line needs a product and quantity' using errcode = '22023'; end if;
    if (v_line->>'quantity')::numeric <= 0 then raise exception 'Order quantity must be greater than zero' using errcode = '23514'; end if;
    select * into v_product from public.products where id = (v_line->>'product_id')::uuid and is_active;
    if not found then raise exception 'An order product is missing or inactive' using errcode = '23503'; end if;
    select pp.unit_price into v_price from public.product_prices pp
     where pp.product_id = v_product.id and pp.effective_from <= current_date and (pp.effective_to is null or pp.effective_to >= current_date)
     order by pp.effective_from desc limit 1;
    if v_price is null then raise exception 'No current selling price is set for %', v_product.name using errcode = '23514'; end if;
    v_taxable := round((v_line->>'quantity')::numeric * v_price, 2);
    if v_is_interstate then
      v_cgst := 0; v_sgst := 0; v_igst := round(v_taxable * v_product.gst_rate, 2);
    else
      v_cgst := round(v_taxable * v_product.gst_rate / 2, 2); v_sgst := v_cgst; v_igst := 0;
    end if;
    insert into public.sales_order_items(sales_order_id, product_id, product_sku, product_name, quantity, unit_id, unit_price, gst_rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount)
    values (v_order_id, v_product.id, v_product.sku, v_product.name, (v_line->>'quantity')::numeric, v_product.stock_unit_id, v_price, v_product.gst_rate, v_taxable, v_cgst, v_sgst, v_igst, v_taxable + v_cgst + v_sgst + v_igst);
    v_subtotal := v_subtotal + v_taxable; v_cgst_total := v_cgst_total + v_cgst; v_sgst_total := v_sgst_total + v_sgst; v_igst_total := v_igst_total + v_igst;
  end loop;
  update public.sales_orders set subtotal = v_subtotal, cgst_amount = v_cgst_total, sgst_amount = v_sgst_total, igst_amount = v_igst_total,
    total_amount = v_subtotal + v_cgst_total + v_sgst_total + v_igst_total where id = v_order_id;
  return v_order_id;
end;
$$;

create function public.approve_sales_order(p_order_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.sales_orders%rowtype;
  v_stock record;
  v_balance numeric;
begin
  if v_user is null or not public.has_any_role(array['owner','admin']::public.app_role[]) then raise exception 'Only an owner or admin can approve orders' using errcode = '42501'; end if;
  select * into v_order from public.sales_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if v_order.status <> 'submitted' then raise exception 'Only submitted orders can be approved' using errcode = '55000'; end if;
  for v_stock in select product_id, sum(quantity) as requested from public.sales_order_items where sales_order_id = p_order_id group by product_id order by product_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('product:' || v_stock.product_id::text, 0));
    select coalesce(sum(quantity * public.inventory_movement_sign(movement_type)), 0) into v_balance from public.inventory_movements where product_id = v_stock.product_id;
    if v_balance < v_stock.requested then raise exception 'Insufficient finished stock for product %. Available %, requested %', v_stock.product_id, v_balance, v_stock.requested using errcode = '23514'; end if;
  end loop;
  update public.sales_orders set status = 'approved', approved_by = v_user, approved_at = now() where id = p_order_id;
  return p_order_id;
end;
$$;

create function public.issue_sales_invoice(p_order_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.sales_orders%rowtype;
  v_customer public.customers%rowtype;
  v_factory_state char(2);
  v_invoice_id uuid;
  v_year_start integer;
  v_fy text;
  v_invoice_number text;
begin
  if v_user is null or not public.has_any_role(array['owner','admin']::public.app_role[]) then raise exception 'Only an owner or admin can issue invoices' using errcode = '42501'; end if;
  select * into v_order from public.sales_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if v_order.status <> 'approved' then raise exception 'Only an approved order can be invoiced' using errcode = '55000'; end if;
  select * into v_customer from public.customers where id = v_order.customer_id;
  select state_code into v_factory_state from public.business_locations order by created_at limit 1;
  v_year_start := extract(year from current_date)::integer - case when extract(month from current_date) < 4 then 1 else 0 end;
  v_fy := v_year_start::text || '-' || right((v_year_start + 1)::text, 2);
  v_invoice_number := 'SF/' || v_fy || '/' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
  insert into public.invoices(sales_order_id, invoice_number, financial_year, customer_id, customer_name, customer_gstin, customer_state_code, factory_state_code, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount, issued_by)
  values (p_order_id, v_invoice_number, v_fy, v_customer.id, v_customer.name, v_customer.gstin, v_order.customer_state_code, v_factory_state,
    v_order.subtotal, v_order.cgst_amount, v_order.sgst_amount, v_order.igst_amount, v_order.total_amount, v_user)
  returning id into v_invoice_id;
  insert into public.invoice_items(invoice_id, sales_order_item_id, product_id, product_sku, product_name, hsn_code, quantity, unit_id, unit_price, gst_rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount)
  select v_invoice_id, oi.id, oi.product_id, oi.product_sku, oi.product_name, p.hsn_code, oi.quantity, oi.unit_id, oi.unit_price, oi.gst_rate, oi.taxable_amount, oi.cgst_amount, oi.sgst_amount, oi.igst_amount, oi.total_amount
    from public.sales_order_items oi join public.products p on p.id = oi.product_id where oi.sales_order_id = p_order_id;
  update public.sales_orders set status = 'invoiced' where id = p_order_id;
  return v_invoice_id;
end;
$$;

create function public.dispatch_sales_order(p_order_id uuid, p_notes text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.sales_orders%rowtype;
  v_invoice_id uuid;
  v_line record;
  v_dispatch_id uuid;
  v_balance numeric;
begin
  if v_user is null or not public.has_any_role(array['owner','admin']::public.app_role[]) then raise exception 'Only an owner or admin can dispatch orders' using errcode = '42501'; end if;
  select * into v_order from public.sales_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if v_order.status <> 'invoiced' then raise exception 'Only an invoiced order can be dispatched' using errcode = '55000'; end if;
  select id into v_invoice_id from public.invoices where sales_order_id = p_order_id;
  if v_invoice_id is null then raise exception 'The order has no posted invoice' using errcode = '23514'; end if;

  -- Acquire all affected item locks in stable order before checking or deducting stock.
  for v_line in select product_id from public.sales_order_items where sales_order_id = p_order_id group by product_id order by product_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('product:' || v_line.product_id::text, 0));
  end loop;
  for v_line in select product_id, unit_id, sum(quantity) as quantity from public.sales_order_items where sales_order_id = p_order_id group by product_id, unit_id order by product_id
  loop
    select coalesce(sum(quantity * public.inventory_movement_sign(movement_type)), 0) into v_balance from public.inventory_movements where product_id = v_line.product_id;
    if v_balance < v_line.quantity then raise exception 'Insufficient finished stock for product %. Available %, requested %', v_line.product_id, v_balance, v_line.quantity using errcode = '23514'; end if;
  end loop;

  insert into public.dispatches(sales_order_id, invoice_id, dispatched_by, notes)
  values (p_order_id, v_invoice_id, v_user, nullif(btrim(p_notes), '')) returning id into v_dispatch_id;
  for v_line in select * from public.sales_order_items where sales_order_id = p_order_id order by product_id, id
  loop
    insert into public.inventory_movements(item_type, product_id, movement_type, quantity, unit_id, source_document_type, source_document_id, source_line_id, idempotency_key, note, user_id)
    values ('product', v_line.product_id, 'dispatch', v_line.quantity, v_line.unit_id, 'dispatch', v_dispatch_id, v_line.id,
      'dispatch:' || v_dispatch_id::text || ':' || v_line.id::text, 'Sales order ' || p_order_id::text, v_user);
  end loop;
  update public.sales_orders set status = 'dispatched' where id = p_order_id;
  return v_dispatch_id;
end;
$$;

revoke all on function public.create_sales_order(uuid,jsonb,text) from public, anon;
revoke all on function public.approve_sales_order(uuid) from public, anon;
revoke all on function public.issue_sales_invoice(uuid) from public, anon;
revoke all on function public.dispatch_sales_order(uuid,text) from public, anon;
grant execute on function public.create_sales_order(uuid,jsonb,text) to authenticated;
grant execute on function public.approve_sales_order(uuid) to authenticated;
grant execute on function public.issue_sales_invoice(uuid) to authenticated;
grant execute on function public.dispatch_sales_order(uuid,text) to authenticated;

create trigger audit_sales_orders after insert or update on public.sales_orders for each row execute function public.write_audit_log();
create trigger audit_sales_order_items after insert on public.sales_order_items for each row execute function public.write_audit_log();
create trigger audit_invoices after insert on public.invoices for each row execute function public.write_audit_log();
create trigger audit_invoice_items after insert on public.invoice_items for each row execute function public.write_audit_log();
create trigger audit_dispatches after insert on public.dispatches for each row execute function public.write_audit_log();
