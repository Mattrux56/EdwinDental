import DashboardView from './views/DashboardView.jsx';
import { useCasesController } from './controllers/useCasesController.js';
import { useRemisionesController } from './controllers/useRemisionesController.js';

export default function App() {
  const controller = useCasesController();
  const remisiones = useRemisionesController({ showToast: controller.showToast });
  return (
    <DashboardView controller={controller} remisionesController={remisiones} />
  );
}
