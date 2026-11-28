import { HashRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Shell } from './components/Shell';
import { UiProvider } from './components/ui';
import { Dashboard } from './features/dashboard/Dashboard';
import { CutPlans } from './features/cutter/CutPlans';
import { CutPlanEditor } from './features/cutter/CutPlanEditor';
import { WeightCalc } from './features/weight/WeightCalc';
import { Catalog } from './features/catalog/Catalog';
import { Quotes } from './features/quotes/Quotes';
import { QuoteEditor } from './features/quotes/QuoteEditor';
import { Clients } from './features/clients/Clients';
import { SettingsPage } from './features/settings/SettingsPage';

export default function App() {
  return (
    <HashRouter>
      <UiProvider>
        <Shell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cortes" element={<CutPlans />} />
            <Route path="/cortes/:id" element={<CutPlanEditor />} />
            <Route path="/peso" element={<WeightCalc />} />
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/presupuestos" element={<Quotes />} />
            <Route path="/presupuestos/:id" element={<QuoteEditor />} />
            <Route path="/clientes" element={<Clients />} />
            <Route path="/ajustes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </UiProvider>
    </HashRouter>
  );
}
