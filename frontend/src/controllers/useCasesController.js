import { useCallback, useEffect, useRef, useState } from 'react';
import { casesService } from '../services/cases.service.js';

const EMPTY_STATS = { total: 0, enLaboratorio: 0, enProceso: 0, finalizados: 0 };

export function useCasesController() {
  const [casos, setCasos] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [search, setSearchState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'nuevo'
  const [selectedCase, setSelectedCase] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const listRequest = useRef(0); // evita que una respuesta lenta pise a una más reciente
  const searchRef = useRef('');

  // ------------------------------------------------------------- Notificaciones
  const showToast = useCallback((type, message) => {
    setToast({ id: Date.now(), type, message });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // -------------------------------------------------------------------- Carga
  const loadCases = useCallback(async (term) => {
    const requestId = ++listRequest.current;
    setLoading(true);
    setError(null);
    try {
      const data = await casesService.list(term);
      if (requestId === listRequest.current) setCasos(data);
    } catch (e) {
      if (requestId === listRequest.current) setError(e.message);
    } finally {
      if (requestId === listRequest.current) setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      setStats(await casesService.stats());
    } catch {
      /* las métricas no son críticas: el error de conexión ya se muestra en la tabla */
    }
  }, []);

  // Búsqueda en tiempo real con debounce (300 ms)
  useEffect(() => {
    searchRef.current = search;
    const timer = setTimeout(() => loadCases(search), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, loadCases]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const refresh = useCallback(
    () => Promise.all([loadCases(searchRef.current), loadStats()]),
    [loadCases, loadStats],
  );

  // ---------------------------------------------------------------- Búsqueda
  const setSearch = useCallback((value) => {
    setSearchState(value);
    setActiveView('dashboard'); // al buscar siempre se muestran los resultados
  }, []);

  // ----------------------------------------------------------------- Detalle
  const openCase = useCallback(async (caso) => {
    setSelectedCase(caso); // abre al instante con los datos de la tabla...
    try {
      const fresh = await casesService.getById(caso.id); // ...y los refresca desde el servidor
      setSelectedCase((current) => (current && current.id === fresh.id ? fresh : current));
    } catch (e) {
      showToast('error', e.message);
    }
  }, [showToast]);

  const closeCase = useCallback(() => setSelectedCase(null), []);

  // ------------------------------------------------------------ Mutaciones
  const createCase = useCallback(
    async (payload) => {
      setSaving(true);
      try {
        const created = await casesService.create(payload);
        showToast('success', `Caso ${created.codigo} registrado correctamente`);
        setActiveView('dashboard');
        setSearchState('');
        await Promise.all([loadCases(''), loadStats()]);
        return created;
      } catch (e) {
        showToast('error', e.message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [loadCases, loadStats, showToast],
  );

  const addFollowUp = useCallback(
    async (casoId, payload) => {
      setSaving(true);
      try {
        const updated = await casesService.addFollowUp(casoId, payload);
        setSelectedCase(updated);
        showToast('success', 'Seguimiento registrado');
        await refresh();
        return updated;
      } catch (e) {
        showToast('error', e.message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [refresh, showToast],
  );

  return {
    // estado
    casos,
    stats,
    search,
    loading,
    error,
    activeView,
    selectedCase,
    saving,
    toast,
    // acciones
    setSearch,
    setActiveView,
    refresh,
    openCase,
    closeCase,
    createCase,
    addFollowUp,
    dismissToast,
  };
}
