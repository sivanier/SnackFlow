begin;
select plan(32);

select has_table('public', 'production_runs', 'production run headers exist');
select has_table('public', 'production_consumption', 'planned and actual consumption snapshots exist');
select has_table('public', 'production_outputs', 'production output records exist');
select has_view('public', 'production_run_metrics', 'production yield metrics are derived');
select has_view('public', 'production_consumption_variance', 'consumption variance is derived');
select ok((select relrowsecurity from pg_class where oid = 'public.production_runs'::regclass), 'production runs have RLS enabled');

insert into auth.users (id, email, encrypted_password, raw_user_meta_data, aud, role)
values
  ('91000000-0000-4000-8000-000000000001', 'engine-production@snackflow.test', '', '{"display_name":"Engine Production"}', 'authenticated', 'authenticated'),
  ('91000000-0000-4000-8000-000000000002', 'engine-accountant@snackflow.test', '', '{"display_name":"Engine Accountant"}', 'authenticated', 'authenticated');
update public.profiles set role = 'production' where id = '91000000-0000-4000-8000-000000000001';
update public.profiles set role = 'accountant' where id = '91000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$ insert into public.production_runs(product_id, bom_header_id, planned_quantity, unit_id, created_by)
     values ('30000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 200, '10000000-0000-4000-8000-000000000005', '91000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'production records cannot bypass the validated creation RPC'
);
select lives_ok(
  $$ select public.create_production_run('30000000-0000-4000-8000-000000000001', 200, 'pgTAP production run') $$,
  'authorized production user creates a draft from the active BOM'
);
select is((select planned_quantity from public.production_consumption c join public.raw_materials m on m.id = c.raw_material_id where c.production_run_id = (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1) and m.sku = 'RM-FLOUR'), 40::numeric, 'BOM scaling plans 40 kg flour for 200 packets');
select is((select planned_quantity from public.production_consumption c join public.raw_materials m on m.id = c.raw_material_id where c.production_run_id = (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1) and m.sku = 'RM-OIL'), 10::numeric, 'BOM scaling plans 10 litres oil for 200 packets');
select is((select count(*)::integer from public.production_consumption c where c.production_run_id = (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1)), 5, 'run snapshots every BOM input, including packaging');

select throws_ok(
  $$ select public.complete_production_run(
      (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1),
      (select jsonb_agg(jsonb_build_object('consumption_id', c.id, 'actual_quantity', case when m.sku = 'RM-OIL' then 31 else c.planned_quantity end) order by c.id)
         from public.production_consumption c left join public.raw_materials m on m.id = c.raw_material_id
        where c.production_run_id = (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1)),
      188, 0, 12, 'insufficient oil test') $$,
  '23514', null, 'insufficient oil prevents the whole production posting'
);
select is((select status::text from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1), 'draft', 'failed posting leaves the run draft');
select is((select balance from public.inventory_balances where item_type = 'raw_material' and item_id = '40000000-0000-4000-8000-000000000001'), 100::numeric, 'failed posting rolls back flour deduction already attempted');
select is((select count(*)::integer from public.inventory_movements where source_document_type = 'production_run' and source_document_id = (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1)), 0, 'failed posting leaves no partial production ledger movements');

select lives_ok(
  $$ select public.complete_production_run(
      (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1),
      (select jsonb_agg(jsonb_build_object('consumption_id', c.id, 'actual_quantity',
        case when m.sku = 'RM-FLOUR' then 40 when m.sku = 'RM-OIL' then 10.5 when m.sku = 'RM-SPICE' then 1.2 else c.planned_quantity end) order by c.id)
         from public.production_consumption c left join public.raw_materials m on m.id = c.raw_material_id
        where c.production_run_id = (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1)),
      188, 0, 12, 'successful production test') $$,
  'valid actual consumption and output complete atomically'
);
select is((select status::text from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1), 'completed', 'successful posting completes the run');
select is((select yield_percent from public.production_run_metrics where production_run_id = (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1)), 94::numeric, '188 good packets against 200 planned yields 94 percent');
select is((select yield_percent - 100 from public.production_run_metrics where production_run_id = (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1)), -6::numeric, 'yield variance is -6 percent against plan');
select is((select wastage_percent from public.production_run_metrics where production_run_id = (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1)), 6::numeric, '12 wastage units out of 200 total units gives 6 percent');
select is((select variance_percent from public.production_consumption_variance v join public.raw_materials m on m.id = v.raw_material_id where v.production_run_id = (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1) and m.sku = 'RM-OIL'), 5::numeric, '10.5 litres actual against 10 planned gives +5 percent variance');
select is((select balance from public.inventory_balances where item_type = 'raw_material' and item_id = '40000000-0000-4000-8000-000000000001'), 60::numeric, 'successful production deducts flour through the ledger');
select is((select balance from public.inventory_balances where item_type = 'raw_material' and item_id = '40000000-0000-4000-8000-000000000002'), 19.5::numeric, 'successful production deducts actual oil through the ledger');
select is((select balance from public.inventory_balances where item_type = 'raw_material' and item_id = '40000000-0000-4000-8000-000000000003'), 3.8::numeric, 'successful production deducts spice through the ledger');
select is((select balance from public.inventory_balances where item_type = 'packaging_material' and item_id = '50000000-0000-4000-8000-000000000001'), 300::numeric, 'successful production deducts pouches through the ledger');
select is((select balance from public.inventory_balances where item_type = 'packaging_material' and item_id = '50000000-0000-4000-8000-000000000002'), 20::numeric, 'successful production deducts cartons through the ledger');
select is((select balance from public.inventory_balances where item_type = 'product' and item_id = '30000000-0000-4000-8000-000000000001'), 238::numeric, 'only good output is added to finished stock');
select is((select count(*)::integer from public.inventory_movements where source_document_type = 'production_run' and source_document_id = (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1)), 6, 'all five input issues and the good output receipt are linked to the run');
select throws_ok(
  $$ select public.complete_production_run(
      (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1),
      (select jsonb_agg(jsonb_build_object('consumption_id', id, 'actual_quantity', actual_quantity) order by id)
         from public.production_consumption where production_run_id = (select id from public.production_runs where created_by = '91000000-0000-4000-8000-000000000001' order by created_at desc limit 1)),
      188, 0, 12, null) $$,
  '55000', null, 'completed production cannot be posted a second time'
);

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.production_outputs), 1, 'accountant can read production outputs');
select throws_ok($$ update public.production_outputs set notes = 'edit' $$, '42501', null, 'accountant cannot modify production outputs');
select throws_ok($$ select public.create_production_run('30000000-0000-4000-8000-000000000001', 20, null) $$, '42501', null, 'accountant cannot create production runs');
reset role;

select * from finish();
rollback;
