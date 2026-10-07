import { useCallback, useEffect, useRef, useState } from 'react';
import { casesService } from '../services/cases.service.js';

const EMPTY_STATS = {
  total: 0,
  enLaboratorio: 0,
  enPrueba: 0,
  finalizados: 0,
  arreglos: 0,
  archivados: 0,
  alertas: 0,
};

export function useCasesController() {
  const [casos, setCasos] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeView, setActiveViewRaw] = useState('resumen');
  const [verArchivados, setVerArchivados] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Al salir del Panel de casos se vuelve a la lista normal (los archivados no deben colarse en Remisiones ni en el Resumen)
  const setActiveView = useCallback((view) => {
    setActiveViewRaw(view);
    if (view !== 'casos') setVerArchivados(false);
  }, []);

  const listRequest = useRef(0); // evita que una respuesta lenta pise a una más reciente

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
  const loadCases = useCallback(async () => {
    const requestId = ++listRequest.current;
    setLoading(true);
    setError(null);
    try {
      const data = await casesService.list('', verArchivados);
      if (requestId === listRequest.current) setCasos(data);
    } catch (e) {
      if (requestId === listRequest.current) setError(e.message);
    } finally {
      if (requestId === listRequest.current) setLoading(false);
    }
  }, [verArchivados]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await casesService.stats());
    } catch {
      /* las métricas no son críticas: el error de conexión ya se muestra en la tabla */
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const refresh = useCallback(
    () => Promise.all([loadCases(), loadStats()]),
    [loadCases, loadStats],
  );

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
        setActiveView('casos');
        await Promise.all([loadCases(), loadStats()]);
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

  /** Edita los datos del caso (título, paciente, cliente, fechas) */
  const updateCase = useCallback(
    async (id, payload) => {
      setSaving(true);
      try {
        const updated = await casesService.update(id, payload);
        setSelectedCase((current) => (current && current.id === id ? updated : current));
        showToast('success', 'Caso actualizado');
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

  const archiveCase = useCallback(
    async (caso, archivar = true) => {
      setSaving(true);
      try {
        await (archivar ? casesService.archivar(caso.id) : casesService.restaurar(caso.id));
        if (selectedCase?.id === caso.id) setSelectedCase(null);
        showToast('success', archivar ? `Caso ${caso.codigo} archivado` : `Caso ${caso.codigo} restaurado`);
        await refresh();
        return true;
      } catch (e) {
        showToast('error', e.message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [refresh, selectedCase, showToast],
  );

  const removePhoto = useCallback(
    async (imagenId) => {
      setSaving(true);
      try {
        const updated = await casesService.removeImagen(imagenId);
        setSelectedCase(updated);
        showToast('success', 'Foto eliminada');
        await loadCases();
        return true;
      } catch (e) {
        showToast('error', e.message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loadCases, showToast],
  );

  const deleteCase = useCallback(async (caso) => {
    setDeletingId(caso.id);
    try {
      await casesService.remove(caso.id);
      if (selectedCase?.id === caso.id) setSelectedCase(null);
      showToast('success', `Caso ${caso.codigo} eliminado`);
      await Promise.all([loadCases(), loadStats()]);
      return true;
    } catch (e) {
      showToast('error', e.message);
      return false;
    } finally {
      setDeletingId(null);
    }
  }, [loadCases, loadStats, selectedCase, showToast]);

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
    loading,
    error,
    activeView,
    verArchivados,
    selectedCase,
    saving,
    deletingId,
    toast,
    // acciones
    setActiveView,
    setVerArchivados,
    updateCase,
    archiveCase,
    removePhoto,
    refresh,
    openCase,
    closeCase,
    createCase,
    deleteCase,
    addFollowUp,
    dismissToast,
    showToast,
  };
}
