begin;
select plan(44);

select has_table('public', 'sales_orders', 'sales orders exist');
select has_table('public', 'sales_order_items', 'sales order lines exist');
select has_table('public', 'invoices', 'invoices are stored separately from orders');
select has_table('public', 'dispatches', 'dispatch records exist');
select ok((select relrowsecurity from pg_class where oid = 'public.sales_orders'::regclass), 'sales orders have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.invoices'::regclass), 'invoices have RLS enabled');

insert into auth.users (id, email, encrypted_password, raw_user_meta_data, aud, role)
values
  ('92000000-0000-4000-8000-000000000001', 'sales-workflow-sales@snackflow.test', '', '{"display_name":"Sales Workflow User"}', 'authenticated', 'authenticated'),
  ('92000000-0000-4000-8000-000000000002', 'sales-workflow-admin@snackflow.test', '', '{"display_name":"Sales Workflow Admin"}', 'authenticated', 'authenticated'),
  ('92000000-0000-4000-8000-000000000003', 'sales-workflow-accountant@snackflow.test', '', '{"display_name":"Sales Workflow Accountant"}', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = '92000000-0000-4000-8000-000000000002';
update public.profiles set role = 'accountant' where id = '92000000-0000-4000-8000-000000000003';
insert into public.customers(id, name, state_code, assigned_salesman_id) values
  ('93000000-0000-4000-8000-000000000001', 'Test Tamil Nadu Retailer', '33', '92000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000002', 'Test Karnataka Retailer', '29', '92000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$ insert into public.sales_orders(customer_id, created_by, customer_state_code) values ('93000000-0000-4000-8000-000000000001', auth.uid(), '33') $$,
  '42501', null, 'sales orders must be created through the authorized transactional function'
);
select lives_ok(
  $$ select public.create_sales_order('93000000-0000-4000-8000-000000000001', '[{"product_id":"30000000-0000-4000-8000-000000000001","quantity":10}]'::jsonb, 'tn-order') $$,
  'salesman can place an order for an assigned customer'
);
select is((select count(*)::integer from public.sales_orders where created_by = auth.uid()), 1, 'salesman can read their own order');
select is((select subtotal from public.sales_orders where notes = 'tn-order'), 500::numeric, '10 packets at ₹50 have ₹500 taxable subtotal');
select is((select cgst_amount from public.sales_orders where notes = 'tn-order'), 12.5::numeric, 'intra-state order calculates CGST');
select is((select sgst_amount from public.sales_orders where notes = 'tn-order'), 12.5::numeric, 'intra-state order calculates SGST');
select is((select igst_amount from public.sales_orders where notes = 'tn-order'), 0::numeric, 'intra-state order has no IGST');
select is((select total_amount from public.sales_orders where notes = 'tn-order'), 525::numeric, 'order total includes GST');
select throws_ok($$ select public.approve_sales_order((select id from public.sales_orders where notes = 'tn-order')) $$, '42501', null, 'salesman cannot approve their own order');
select lives_ok($$ select public.create_sales_order('93000000-0000-4000-8000-000000000002', '[{"product_id":"30000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb, 'interstate-order') $$, 'salesman can submit an inter-state order for an assigned customer');
select is((select subtotal from public.sales_orders where notes = 'interstate-order'), 100::numeric, 'inter-state taxable subtotal uses server product price');
select is((select igst_amount from public.sales_orders where notes = 'interstate-order'), 5::numeric, 'inter-state order calculates IGST');
select is((select cgst_amount from public.sales_orders where notes = 'interstate-order'), 0::numeric, 'inter-state order has no CGST');
select is((select sgst_amount from public.sales_orders where notes = 'interstate-order'), 0::numeric, 'inter-state order has no SGST');

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);
select lives_ok($$ select public.approve_sales_order((select id from public.sales_orders where notes = 'tn-order')) $$, 'admin approves the submitted order');
select is((select status::text from public.sales_orders where notes = 'tn-order'), 'approved', 'approved order status is saved');
select lives_ok($$ select public.issue_sales_invoice((select id from public.sales_orders where notes = 'tn-order')) $$, 'admin issues the invoice for the approved order');
select is((select status::text from public.sales_orders where notes = 'tn-order'), 'invoiced', 'invoice generation advances the order');
select is((select total_amount from public.invoices where sales_order_id = (select id from public.sales_orders where notes = 'tn-order')), 525::numeric, 'invoice total matches the approved order total');
select ok((select invoice_number ~ '^SF/[0-9]{4}-[0-9]{2}/[0-9]{6}$' from public.invoices where sales_order_id = (select id from public.sales_orders where notes = 'tn-order')), 'invoice has sequential number and financial year');
select lives_ok($$ select public.dispatch_sales_order((select id from public.sales_orders where notes = 'tn-order'), null) $$, 'admin dispatches the invoiced order');
select is((select balance from public.inventory_balances where item_type = 'product' and item_id = '30000000-0000-4000-8000-000000000001'), 40::numeric, 'dispatch deducts finished goods through the ledger');
select is((select count(*)::integer from public.inventory_movements where movement_type = 'dispatch' and source_document_type = 'dispatch' and source_document_id = (select id from public.dispatches where sales_order_id = (select id from public.sales_orders where notes = 'tn-order'))), 1, 'dispatch ledger movement references its dispatch document');
select is((select status::text from public.sales_orders where notes = 'tn-order'), 'dispatched', 'dispatched status is saved');
select throws_ok($$ select public.dispatch_sales_order((select id from public.sales_orders where notes = 'tn-order'), null) $$, '55000', null, 'dispatched order cannot be dispatched twice');

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
select lives_ok($$ select public.create_sales_order('93000000-0000-4000-8000-000000000001', '[{"product_id":"30000000-0000-4000-8000-000000000001","quantity":40}]'::jsonb, 'stock-changed-after-invoice') $$, 'salesman submits an order that fits current stock');
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);
select lives_ok($$ select public.approve_sales_order((select id from public.sales_orders where notes = 'stock-changed-after-invoice')) $$, 'admin approves while sufficient stock is available');
select lives_ok($$ select public.issue_sales_invoice((select id from public.sales_orders where notes = 'stock-changed-after-invoice')) $$, 'admin issues invoice before the stock changes');
select lives_ok(
  $$ insert into public.inventory_movements(item_type, product_id, movement_type, quantity, unit_id, source_document_type, source_document_id, idempotency_key, note)
     values ('product', '30000000-0000-4000-8000-000000000001', 'adjustment_out', 40, '10000000-0000-4000-8000-000000000005', 'adjustment', '94000000-0000-4000-8000-000000000001', 'test:sales:deplete-stock', 'Test stock change before dispatch') $$,
  'admin can record an authorized stock adjustment'
);
select throws_ok($$ select public.dispatch_sales_order((select id from public.sales_orders where notes = 'stock-changed-after-invoice'), null) $$, '23514', null, 'dispatch revalidates stock after invoice and fails on a shortage');
select is((select status::text from public.sales_orders where notes = 'stock-changed-after-invoice'), 'invoiced', 'failed dispatch leaves order invoiced');
select is((select count(*)::integer from public.dispatches where sales_order_id = (select id from public.sales_orders where notes = 'stock-changed-after-invoice')), 0, 'failed dispatch creates no dispatch record');
select is((select balance from public.inventory_balances where item_type = 'product' and item_id = '30000000-0000-4000-8000-000000000001'), 0::numeric, 'failed dispatch leaves the independently depleted stock at zero');

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
select lives_ok($$ select public.create_sales_order('93000000-0000-4000-8000-000000000001', '[{"product_id":"30000000-0000-4000-8000-000000000001","quantity":1}]'::jsonb, 'short-stock-order') $$, 'order can still be submitted when stock is short');
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);
select throws_ok($$ select public.approve_sales_order((select id from public.sales_orders where notes = 'short-stock-order')) $$, '23514', null, 'admin approval rejects an order that exceeds available finished stock');
select is((select status::text from public.sales_orders where notes = 'short-stock-order'), 'submitted', 'stock shortage leaves the order pending approval');

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.invoices), 2, 'accountant can read invoices for reporting');
select throws_ok($$ update public.invoices set total_amount = 0 $$, '42501', null, 'accountant cannot alter posted invoices');
reset role;

select * from finish();
rollback;
