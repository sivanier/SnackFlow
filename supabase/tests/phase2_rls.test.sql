begin;
select plan(29);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'inventory_movements', 'append-only inventory ledger exists');
select has_table('public', 'audit_logs', 'audit log exists');
select has_column('public', 'inventory_movements', 'idempotency_key', 'ledger has idempotency key');
select has_view('public', 'inventory_balances', 'stock balance is a view derived from movements');
select has_trigger('public', 'inventory_movements', 'inventory_movement_guard', 'ledger guard trigger exists');
select is((select count(*)::integer from public.products where sku = 'SF-MUR-200'), 1, 'seed contains exactly one Murukku benchmark product');
select is((select expected_output::numeric from public.bom_headers where product_id = '30000000-0000-4000-8000-000000000001' and is_active), 200::numeric, 'benchmark BOM output is 200 packets');
select is((select balance from public.inventory_balances where item_type = 'raw_material' and item_id = '40000000-0000-4000-8000-000000000001'), 100::numeric, 'seeded flour opening ledger balance is 100 kg');
select is((select unit_price::numeric from public.product_prices where product_id = '30000000-0000-4000-8000-000000000001'), 50::numeric, 'benchmark pre-tax selling price is ₹50');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.inventory_movements'::regclass),
  'RLS is enabled for inventory movements'
);
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inventory_movements' and cmd in ('UPDATE', 'DELETE', 'ALL')
  ),
  'authenticated users cannot update or delete posted inventory movements'
);
select ok(
  (select qual like '%assigned_salesman_id%' from pg_policies where schemaname = 'public' and tablename = 'customers' and policyname = 'customers_read_assigned_or_admin'),
  'salesman customer reads are scoped to assigned customers'
);
select ok(
  (select with_check like '%production%' and with_check not like '%accountant%' from pg_policies where schemaname = 'public' and tablename = 'inventory_movements' and policyname = 'inventory_append_ops'),
  'production can append ledger entries while accountants are excluded'
);

-- Minimal Auth fixtures exercise actual RLS, not just policy definitions.
insert into auth.users (id, email, encrypted_password, raw_user_meta_data, aud, role)
values
  ('81000000-0000-4000-8000-000000000001', 'sales-one@snackflow.test', '', '{"display_name":"Sales One","role":"owner"}', 'authenticated', 'authenticated'),
  ('81000000-0000-4000-8000-000000000002', 'sales-two@snackflow.test', '', '{"display_name":"Sales Two"}', 'authenticated', 'authenticated'),
  ('81000000-0000-4000-8000-000000000003', 'accountant@snackflow.test', '', '{"display_name":"Test Accountant"}', 'authenticated', 'authenticated'),
  ('81000000-0000-4000-8000-000000000004', 'production@snackflow.test', '', '{"display_name":"Test Production"}', 'authenticated', 'authenticated'),
  ('81000000-0000-4000-8000-000000000005', 'owner@snackflow.test', '', '{"display_name":"Test Owner"}', 'authenticated', 'authenticated');

update public.profiles set role = 'owner' where id = '81000000-0000-4000-8000-000000000005';
update public.profiles set role = 'accountant' where id = '81000000-0000-4000-8000-000000000003';
update public.profiles set role = 'production' where id = '81000000-0000-4000-8000-000000000004';

insert into public.customers (id, name, assigned_salesman_id) values
  ('82000000-0000-4000-8000-000000000001', 'Assigned test customer', '81000000-0000-4000-8000-000000000001'),
  ('82000000-0000-4000-8000-000000000002', 'Other test customer', '81000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*)::integer from public.customers), 1, 'salesman sees only customers assigned to their profile');
select is((select count(*)::integer from public.profiles), 1, 'salesman sees only their own profile');
select is((select role::text from public.profiles where id = auth.uid()), 'salesman', 'auth metadata cannot grant a privileged role');
select throws_ok(
  $$ insert into public.customers (name, assigned_salesman_id) values ('Forbidden test customer', '81000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'salesman cannot create customer master records'
);
select throws_ok(
  $$ update public.profiles set role = 'owner' where id = auth.uid() $$,
  '42501', null, 'salesman cannot promote their own role'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.inventory_movements), 6, 'accountant can read inventory movements for reporting');
select throws_ok(
  $$ insert into public.inventory_movements (item_type, raw_material_id, movement_type, quantity, unit_id, source_document_type, source_document_id, source_line_id, idempotency_key)
     values ('raw_material', '40000000-0000-4000-8000-000000000001', 'adjustment_in', 1, '10000000-0000-4000-8000-000000000001', 'adjustment', '83000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000002', 'test:accountant:write-denied') $$,
  '42501', null, 'accountant cannot write inventory movements'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', true);
select lives_ok(
  $$ insert into public.inventory_movements (item_type, raw_material_id, movement_type, quantity, unit_id, source_document_type, source_document_id, source_line_id, idempotency_key)
     values ('raw_material', '40000000-0000-4000-8000-000000000001', 'purchase_receipt', 1, '10000000-0000-4000-8000-000000000001', 'purchase', '84000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000002', 'test:production:purchase-receipt-allowed') $$,
  'production role can append an allowed raw-material receipt'
);
select throws_ok(
  $$ insert into public.inventory_movements (item_type, product_id, movement_type, quantity, unit_id, source_document_type, source_document_id, source_line_id, idempotency_key)
     values ('product', '30000000-0000-4000-8000-000000000001', 'dispatch', 1, '10000000-0000-4000-8000-000000000005', 'dispatch', '85000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000002', 'test:production:dispatch-denied') $$,
  '42501', null, 'production role cannot post sales dispatches'
);
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000005', true);
select lives_ok(
  $$ update public.profiles set role = 'admin' where id = '81000000-0000-4000-8000-000000000002' $$,
  'owner can assign a role to another profile'
);
select is((select role::text from public.profiles where id = '81000000-0000-4000-8000-000000000002'), 'admin', 'owner role change is persisted');
reset role;

select throws_ok(
  $$ insert into public.bom_items (bom_header_id, raw_material_id, packaging_material_id, quantity, unit_id)
     values ('60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 1, '10000000-0000-4000-8000-000000000001') $$,
  '23514', null, 'BOM item must reference exactly one material'
);
select throws_ok(
  $$ insert into public.inventory_movements (item_type, raw_material_id, movement_type, quantity, unit_id, source_document_type, idempotency_key)
     values ('raw_material', '40000000-0000-4000-8000-000000000001', 'opening_balance', 1, '10000000-0000-4000-8000-000000000001', 'opening_balance', 'benchmark:opening:flour:v1') $$,
  '23505', null, 'duplicate idempotency key is rejected'
);
select throws_ok(
  $$ insert into public.inventory_movements (item_type, raw_material_id, movement_type, quantity, unit_id, source_document_type, source_document_id, source_line_id, idempotency_key)
     values ('raw_material', '40000000-0000-4000-8000-000000000001', 'production_issue', 102, '10000000-0000-4000-8000-000000000001', 'production_run', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', 'test:overdraw:flour') $$,
  '23514', null, 'ledger rejects an issue larger than available flour stock after receipt'
);
select throws_ok(
  $$ update public.inventory_movements set note = 'should fail' where id = '70000000-0000-4000-8000-000000000001' $$,
  '55000', null, 'posted movements cannot be edited'
);

select * from finish();
rollback;
