import { createHashRouter, createMemoryRouter, RouterProvider, useRouteError, Link, type RouteObject } from 'react-router-dom';
import { IS_ARTIFACT } from '@/lib/platform';
import { Toaster } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { ConfirmProvider } from '@/components/ui/confirm';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { QuotesList } from '@/features/quotes/QuotesList';
import { QuoteEditorPage } from '@/features/quotes/QuoteEditor';
import { QuoteView } from '@/features/quotes/QuoteView';
import { MaterialsPage } from '@/features/materials/MaterialsPage';
import { ClientsPage } from '@/features/clients/ClientsPage';
import { ClientDetail } from '@/features/clients/ClientDetail';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { EstimatorPage } from '@/features/estimator/EstimatorPage';
import { EmptyState, Button } from '@/components/ui';
import { WebEstimatorPage } from '@/features/web/WebEstimatorPage';
import { RequestImport } from '@/features/web/RequestImport';

function RouteError() {
  const err = useRouteError() as Error | { statusText?: string } | undefined;
  const msg = err && 'message' in err ? err.message : (err as { statusText?: string })?.statusText;
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Algo salió mal"
      description={msg || 'No encontramos esta página.'}
      action={
        <Link to="/">
          <Button variant="primary">Ir al panel</Button>
        </Link>
      }
    />
  );
}

const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'cotizaciones', element: <QuotesList /> },
      { path: 'cotizaciones/nueva', element: <QuoteEditorPage /> },
      { path: 'cotizaciones/:id/editar', element: <QuoteEditorPage /> },
      { path: 'cotizaciones/:id', element: <QuoteView /> },
      { path: 'estimador', element: <EstimatorPage /> },
      { path: 'web', element: <WebEstimatorPage /> },
      { path: 'solicitud', element: <RequestImport /> },
      { path: 'materiales', element: <MaterialsPage /> },
      { path: 'clientes', element: <ClientsPage /> },
      { path: 'clientes/:id', element: <ClientDetail /> },
      { path: 'configuracion', element: <SettingsPage /> },
      { path: '*', element: <RouteError /> },
    ],
  },
];

// Dentro del artefacto el hash con rutas no se conserva: se navega en memoria.
const router = IS_ARTIFACT ? createMemoryRouter(routes) : createHashRouter(routes);

export function App() {
  return (
    <ConfirmProvider>
      <RouterProvider router={router} />
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: { background: '#1f1f22', border: '1px solid #2e2e33', color: '#ececef', fontFamily: 'inherit' },
        }}
      />
    </ConfirmProvider>
  );
}
