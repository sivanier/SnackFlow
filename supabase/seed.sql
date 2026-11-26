-- Reproducible benchmark master data. No real-world customer or supplier is invented.
-- Fixed IDs make this script safely repeatable; inventory rows use stable idempotency keys.

insert into public.units (id, code, name, symbol, dimension, factor_to_base) values
  ('10000000-0000-4000-8000-000000000001', 'kg', 'Kilogram', 'kg', 'mass', 1),
  ('10000000-0000-4000-8000-000000000002', 'g', 'Gram', 'g', 'mass', 0.001),
  ('10000000-0000-4000-8000-000000000003', 'litre', 'Litre', 'L', 'volume', 1),
  ('10000000-0000-4000-8000-000000000004', 'piece', 'Piece', 'pc', 'count', null),
  ('10000000-0000-4000-8000-000000000005', 'packet', 'Packet', 'pkt', 'count', null),
  ('10000000-0000-4000-8000-000000000006', 'carton', 'Carton', 'ctn', 'count', null)
on conflict (code) do nothing;

insert into public.business_locations (id, name, state_code, state_name) values
  ('20000000-0000-4000-8000-000000000001', 'SnackFlow Benchmark Factory', '33', 'Tamil Nadu')
on conflict (id) do nothing;

insert into public.products (id, sku, name, description, hsn_code, pack_size, pack_unit_id, stock_unit_id, gst_rate) values
  ('30000000-0000-4000-8000-000000000001', 'SF-MUR-200', 'Murukku 200 g', 'Benchmark packaged murukku, 200 g packet', null, 200, '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', 0.05)
on conflict (sku) do nothing;

insert into public.product_prices (id, product_id, unit_price, currency, effective_from) values
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 50.00, 'INR', '2026-01-01')
on conflict (product_id, effective_from) do nothing;

insert into public.raw_materials (id, sku, name, base_unit_id, reorder_level) values
  ('40000000-0000-4000-8000-000000000001', 'RM-FLOUR', 'Flour', '10000000-0000-4000-8000-000000000001', 20),
  ('40000000-0000-4000-8000-000000000002', 'RM-OIL', 'Cooking oil', '10000000-0000-4000-8000-000000000003', 5),
  ('40000000-0000-4000-8000-000000000003', 'RM-SPICE', 'Salt and spice mix', '10000000-0000-4000-8000-000000000001', 1)
on conflict (sku) do nothing;

insert into public.packaging_materials (id, sku, name, base_unit_id, reorder_level) values
  ('50000000-0000-4000-8000-000000000001', 'PK-POUCH-200', '200 g pouch', '10000000-0000-4000-8000-000000000004', 100),
  ('50000000-0000-4000-8000-000000000002', 'PK-CARTON', 'Carton', '10000000-0000-4000-8000-000000000006', 10)
on conflict (sku) do nothing;

insert into public.bom_headers (id, product_id, version, expected_output, output_unit_id, is_active) values
  ('60000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 1, 200, '10000000-0000-4000-8000-000000000005', true)
on conflict (product_id, version) do nothing;

insert into public.bom_items (id, bom_header_id, raw_material_id, quantity, unit_id) values
  ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 40, '10000000-0000-4000-8000-000000000001'),
  ('61000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 10, '10000000-0000-4000-8000-000000000003'),
  ('61000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 1.2, '10000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.bom_items (id, bom_header_id, packaging_material_id, quantity, unit_id) values
  ('61000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 200, '10000000-0000-4000-8000-000000000004'),
  ('61000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 10, '10000000-0000-4000-8000-000000000006')
on conflict (id) do nothing;

insert into public.inventory_movements
  (id, item_type, raw_material_id, movement_type, quantity, unit_id, unit_cost, source_document_type, idempotency_key, note)
values
  ('70000000-0000-4000-8000-000000000001', 'raw_material', '40000000-0000-4000-8000-000000000001', 'opening_balance', 100, '10000000-0000-4000-8000-000000000001', 42.00, 'opening_balance', 'benchmark:opening:flour:v1', 'Benchmark opening inventory'),
  ('70000000-0000-4000-8000-000000000002', 'raw_material', '40000000-0000-4000-8000-000000000002', 'opening_balance', 30, '10000000-0000-4000-8000-000000000003', 140.00, 'opening_balance', 'benchmark:opening:oil:v1', 'Benchmark opening inventory'),
  ('70000000-0000-4000-8000-000000000003', 'raw_material', '40000000-0000-4000-8000-000000000003', 'opening_balance', 5, '10000000-0000-4000-8000-000000000001', 200.00, 'opening_balance', 'benchmark:opening:spice:v1', 'Benchmark opening inventory')
on conflict (idempotency_key) do nothing;

insert into public.inventory_movements
  (id, item_type, packaging_material_id, movement_type, quantity, unit_id, unit_cost, source_document_type, idempotency_key, note)
values
  ('70000000-0000-4000-8000-000000000004', 'packaging_material', '50000000-0000-4000-8000-000000000001', 'opening_balance', 500, '10000000-0000-4000-8000-000000000004', 2.50, 'opening_balance', 'benchmark:opening:pouches:v1', 'Benchmark opening inventory'),
  ('70000000-0000-4000-8000-000000000005', 'packaging_material', '50000000-0000-4000-8000-000000000002', 'opening_balance', 30, '10000000-0000-4000-8000-000000000006', 15.00, 'opening_balance', 'benchmark:opening:cartons:v1', 'Benchmark opening inventory')
on conflict (idempotency_key) do nothing;

insert into public.inventory_movements
  (id, item_type, product_id, movement_type, quantity, unit_id, source_document_type, idempotency_key, note)
values
  ('70000000-0000-4000-8000-000000000006', 'product', '30000000-0000-4000-8000-000000000001', 'opening_balance', 50, '10000000-0000-4000-8000-000000000005', 'opening_balance', 'benchmark:opening:murukku:v1', 'Benchmark opening finished goods')
on conflict (idempotency_key) do nothing;
