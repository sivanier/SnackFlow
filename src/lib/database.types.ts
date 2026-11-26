export type AppRole = 'owner' | 'admin' | 'salesman' | 'production' | 'accountant'
export type UnitDimension = 'mass' | 'volume' | 'count'
export type InventoryItemType = 'raw_material' | 'packaging_material' | 'product'
export type InventoryMovementType = 'opening_balance' | 'purchase_receipt' | 'production_issue' | 'production_receipt' | 'dispatch' | 'adjustment_in' | 'adjustment_out'
export type ProductionRunStatus = 'draft' | 'completed'
export type SalesOrderStatus = 'submitted' | 'approved' | 'invoiced' | 'dispatched'
type Table<Row extends Record<string, unknown>> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] }
type IdRow = { id: string; created_at: string }

export type Database = {
  public: {
    Tables: {
      profiles: Table<IdRow & { display_name: string; role: AppRole; updated_at: string }>
      units: Table<IdRow & { code: string; name: string; symbol: string; dimension: UnitDimension; factor_to_base: number | null }>
      business_locations: Table<IdRow & { name: string; state_code: string; state_name: string; country_code: string }>
      customers: Table<IdRow & { name: string; gstin: string | null; state_code: string | null; phone: string | null; email: string | null; billing_address: string | null; assigned_salesman_id: string | null; is_active: boolean; updated_at: string }>
      suppliers: Table<IdRow & { name: string; gstin: string | null; state_code: string | null; phone: string | null; email: string | null; address: string | null; is_active: boolean; updated_at: string }>
      products: Table<IdRow & { sku: string; name: string; description: string | null; hsn_code: string | null; pack_size: number; pack_unit_id: string; stock_unit_id: string; gst_rate: number; is_active: boolean; updated_at: string }>
      product_prices: Table<IdRow & { product_id: string; unit_price: number; currency: string; effective_from: string; effective_to: string | null }>
      raw_materials: Table<IdRow & { sku: string; name: string; base_unit_id: string; reorder_level: number; is_active: boolean; updated_at: string }>
      packaging_materials: Table<IdRow & { sku: string; name: string; base_unit_id: string; reorder_level: number; is_active: boolean; updated_at: string }>
      bom_headers: Table<IdRow & { product_id: string; version: number; expected_output: number; output_unit_id: string; is_active: boolean }>
      bom_items: Table<IdRow & { bom_header_id: string; raw_material_id: string | null; packaging_material_id: string | null; quantity: number; unit_id: string; notes: string | null }>
      inventory_movements: Table<IdRow & { item_type: InventoryItemType; raw_material_id: string | null; packaging_material_id: string | null; product_id: string | null; movement_type: InventoryMovementType; quantity: number; unit_id: string; unit_cost: number | null; source_document_type: string; source_document_id: string | null; source_line_id: string | null; idempotency_key: string; note: string | null; user_id: string | null; occurred_at: string }>
      production_runs: Table<IdRow & { product_id: string; bom_header_id: string; planned_quantity: number; unit_id: string; status: ProductionRunStatus; notes: string | null; created_by: string; completed_at: string | null }>
      production_consumption: Table<{ id: string; production_run_id: string; bom_item_id: string | null; raw_material_id: string | null; packaging_material_id: string | null; planned_quantity: number; actual_quantity: number | null; unit_id: string }>
      production_outputs: Table<IdRow & { production_run_id: string; good_quantity: number; rejected_quantity: number; wastage_quantity: number; actual_quantity: number; unit_id: string; notes: string | null }>
      sales_orders: Table<IdRow & { customer_id: string; created_by: string; customer_state_code: string; status: SalesOrderStatus; subtotal: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number; notes: string | null; submitted_at: string; approved_by: string | null; approved_at: string | null }>
      sales_order_items: Table<IdRow & { sales_order_id: string; product_id: string; product_sku: string; product_name: string; quantity: number; unit_id: string; unit_price: number; gst_rate: number; taxable_amount: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number }>
      invoices: Table<IdRow & { sales_order_id: string; invoice_number: string; financial_year: string; issue_date: string; customer_id: string; customer_name: string; customer_gstin: string | null; customer_state_code: string; factory_state_code: string; subtotal: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number; issued_by: string }>
      invoice_items: Table<{ id: string; invoice_id: string; sales_order_item_id: string; product_id: string; product_sku: string; product_name: string; hsn_code: string | null; quantity: number; unit_id: string; unit_price: number; gst_rate: number; taxable_amount: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number }>
      dispatches: Table<{ id: string; sales_order_id: string; invoice_id: string; dispatched_by: string; dispatched_at: string; notes: string | null }>
      audit_logs: Table<IdRow & { actor_id: string | null; action: string; table_name: string; record_id: string | null; before_data: Json | null; after_data: Json | null; occurred_at: string }>
    }
    Views: {
      inventory_balances: { Row: { item_type: InventoryItemType; item_id: string; unit_id: string; balance: number }; Relationships: [] }
      production_consumption_variance: { Row: { id: string; production_run_id: string; raw_material_id: string | null; packaging_material_id: string | null; planned_quantity: number; actual_quantity: number | null; variance_quantity: number | null; variance_percent: number | null; unit_id: string }; Relationships: [] }
      production_run_metrics: { Row: { production_run_id: string; product_id: string; planned_quantity: number; unit_id: string; status: ProductionRunStatus; good_quantity: number | null; rejected_quantity: number | null; wastage_quantity: number | null; actual_quantity: number | null; yield_percent: number | null; rejection_percent: number | null; wastage_percent: number | null }; Relationships: [] }
    }
    Functions: {
      has_any_role: { Args: { required_roles: AppRole[] }; Returns: boolean }
      create_production_run: { Args: { p_product_id: string; p_planned_quantity: number; p_notes?: string | null }; Returns: string }
      complete_production_run: { Args: { p_run_id: string; p_consumption: Json; p_good_quantity: number; p_rejected_quantity?: number; p_wastage_quantity?: number; p_notes?: string | null }; Returns: string }
      create_sales_order: { Args: { p_customer_id: string; p_lines: Json; p_notes?: string | null }; Returns: string }
      approve_sales_order: { Args: { p_order_id: string }; Returns: string }
      issue_sales_invoice: { Args: { p_order_id: string }; Returns: string }
      dispatch_sales_order: { Args: { p_order_id: string; p_notes?: string | null }; Returns: string }
    }
    Enums: { app_role: AppRole; unit_dimension: UnitDimension; inventory_item_type: InventoryItemType; inventory_movement_type: InventoryMovementType; production_run_status: ProductionRunStatus; sales_order_status: SalesOrderStatus }
    CompositeTypes: Record<never, never>
  }
}

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
