import DashboardView from './views/DashboardView.jsx';
import { useCasesController } from './controllers/useCasesController.js';

export default function App() {
  const controller = useCasesController();
  return <DashboardView controller={controller} />;
}
