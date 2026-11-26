import type { AppRole } from './supabase'

export const roleModuleAccess: Record<AppRole, string[]> = {
  owner: ['Dashboard', 'Orders', 'Products', 'Customers', 'Materials', 'Suppliers', 'Inventory', 'Production', 'BOM', 'Units', 'Purchases', 'Invoices', 'Payments', 'Reports', 'Settings'],
  admin: ['Dashboard', 'Orders', 'Products', 'Customers', 'Materials', 'Suppliers', 'Inventory', 'Production', 'BOM', 'Units', 'Purchases', 'Invoices', 'Payments', 'Reports', 'Settings'],
  salesman: ['Dashboard', 'Orders', 'Products', 'Customers', 'Units'],
  production: ['Dashboard', 'Materials', 'Suppliers', 'Inventory', 'Production', 'BOM', 'Units', 'Purchases'],
  accountant: ['Dashboard', 'Products', 'Materials', 'Suppliers', 'Inventory', 'BOM', 'Units', 'Invoices', 'Payments', 'Reports'],
}

/** Navigation convenience only. PostgreSQL RLS remains the security boundary. */
export function canSeeModule(role: AppRole, moduleName: string) {
  return roleModuleAccess[role].includes(moduleName)
}

export function canManageMaster(role: AppRole, entity: 'products' | 'customers' | 'suppliers' | 'materials' | 'units' | 'bom') {
  if (role === 'owner' || role === 'admin') return true
  return (entity === 'materials' || entity === 'bom') && role === 'production'
}

export const roleLabels: Record<AppRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  salesman: 'Salesman',
  production: 'Production Supervisor',
  accountant: 'Accountant / Auditor',
}
