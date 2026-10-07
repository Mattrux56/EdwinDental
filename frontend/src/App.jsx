import DashboardView from './views/DashboardView.jsx';
import PublicCaseView from './views/PublicCaseView.jsx';
import { useCasesController } from './controllers/useCasesController.js';
import { useRemisionesController } from './controllers/useRemisionesController.js';
import { useEffect, useRef } from 'react';

export default function App() {
  const clientId = useRef(null);
  if (!clientId.current) {
    clientId.current = globalThis.crypto?.randomUUID?.()
      ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const random = Math.floor(Math.random() * 16);
        return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
      });
  }

  useEffect(() => {
    const heartbeat = (active) => {
      const body = JSON.stringify({ clientId: clientId.current, active });
      if (!active && navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/runtime/heartbeat',
          new Blob([body], { type: 'application/json' }),
        );
        return;
      }
      fetch('/api/runtime/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: !active,
      }).catch(() => {});
    };

    heartbeat(true);
    const timer = window.setInterval(() => heartbeat(true), 10_000);
    window.addEventListener('pagehide', () => heartbeat(false), { once: true });
    return () => window.clearInterval(timer);
  }, []);

  const publicMatch = window.location.pathname.match(/^\/consulta\/([^/]+)\/?$/);
  if (publicMatch) {
    return <PublicCaseView codigo={decodeURIComponent(publicMatch[1])} />;
  }

  return <DashboardApp />;
}

function DashboardApp() {
  const controller = useCasesController();
  const remisiones = useRemisionesController({ showToast: controller.showToast });
  return (
    <DashboardView controller={controller} remisionesController={remisiones} />
  );
}
