import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell, modules } from './components/layout/AppShell'
import { PhaseOnePage } from './pages/PhaseOnePage'
import { ModulePreviewPage } from './pages/ModulePreviewPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { LoginPage } from './pages/LoginPage'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { useAuth } from './auth/AuthProvider'
import { canSeeModule } from './lib/permissions'
import { ProductsPage } from './pages/masters/ProductsPage'
import { CustomersPage } from './pages/masters/CustomersPage'
import { SuppliersPage } from './pages/masters/SuppliersPage'
import { MaterialsPage } from './pages/masters/MaterialsPage'
import { UnitsPage } from './pages/masters/UnitsPage'
import { BOMPage } from './pages/masters/BOMPage'
import { InventoryPage } from './pages/inventory/InventoryPage'
import { ProductionPage } from './pages/production/ProductionPage'
import { OrdersPage } from './pages/sales/OrdersPage'

function RoutedModulePreview() {
  const { pathname } = useLocation()
  const { profile } = useAuth()
  const module = modules.find((item) => item.path === pathname)
  if (!module) return <NotFoundPage />
  if (profile && !canSeeModule(profile.role, module.label)) return <ModulePreviewPage title={module.label} accessDenied />
  switch (pathname) {
    case '/products': return <ProductsPage />
    case '/customers': return <CustomersPage />
    case '/suppliers': return <SuppliersPage />
    case '/materials': return <MaterialsPage />
    case '/units': return <UnitsPage />
    case '/bom': return <BOMPage />
    case '/inventory': return <InventoryPage />
    case '/production': return <ProductionPage />
    case '/orders': return <OrdersPage />
  }
  return <ModulePreviewPage title={module.label} />
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage/>}/>
    <Route element={<ProtectedRoute/>}>
      <Route element={<AppShell/>}>
        <Route path="/" element={<PhaseOnePage/>}/>
        <Route path="/dashboard" element={<Navigate to="/" replace/>}/>
        {modules.filter((item) => item.path !== '/').map((item) => <Route key={item.path} path={item.path} element={<RoutedModulePreview/>}/>)}
        <Route path="*" element={<NotFoundPage/>}/>
      </Route>
    </Route>
  </Routes>
}
