import { useCallback, useEffect, useRef, useState } from 'react';
import { casesService } from '../services/cases.service.js';
import { invalidarClientes } from '../services/clientes.service.js';
import { lastMovement, portadaCaso, totalMovimientos } from '../utils/format.js';

const EMPTY_STATS = {
  total: 0,
  enLaboratorio: 0,
  enPrueba: 0,
  finalizados: 0,
  arreglos: 0,
  devoluciones: 0,
  archivados: 0,
  alertas: 0,
};

/** El listado guarda cada caso resumido (sin el historial completo); así se reduce lo que devuelve una mutación */
function resumir({ seguimientos, ...caso }) {
  if (!seguimientos) return caso;
  return {
    ...caso,
    totalMovimientos: totalMovimientos({ seguimientos }),
    ultimoMovimiento: lastMovement({ seguimientos, creadoEn: caso.creadoEn }),
    portada: portadaCaso({ seguimientos }) ?? null,
  };
}

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

  /** Pone el caso devuelto por el servidor en el listado (o lo quita si ya no pertenece a él), sin volver a pedir todo */
  const mergeCase = useCallback(
    (caso) => {
      setCasos((prev) => {
        const sigue = Boolean(caso.archivado) === verArchivados;
        if (!sigue) return prev.filter((c) => c.id !== caso.id);
        const resumen = resumir(caso);
        return prev.some((c) => c.id === caso.id) ? prev.map((c) => (c.id === caso.id ? resumen : c)) : [resumen, ...prev];
      });
    },
    [verArchivados],
  );

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
      setSelectedCase((current) => (current && current.id === caso.id ? null : current)); // sin historial no hay nada que mostrar
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
        invalidarClientes(); // el caso pudo crear un cliente nuevo
        showToast('success', `Orden de trabajo ${created.codigo} registrada correctamente`);
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
        invalidarClientes(); // pudo cambiar de cliente o crear uno nuevo
        mergeCase(updated);
        showToast('success', 'Caso actualizado');
        await loadStats();
        return updated;
      } catch (e) {
        showToast('error', e.message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [loadStats, mergeCase, showToast],
  );

  const archiveCase = useCallback(
    async (caso, archivar = true) => {
      setSaving(true);
      try {
        const actualizado = await (archivar ? casesService.archivar(caso.id) : casesService.restaurar(caso.id));
        if (selectedCase?.id === caso.id) setSelectedCase(null);
        mergeCase(actualizado);
        showToast('success', archivar ? `Caso ${caso.codigo} archivado` : `Caso ${caso.codigo} restaurado`);
        await loadStats();
        return true;
      } catch (e) {
        showToast('error', e.message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loadStats, mergeCase, selectedCase, showToast],
  );

  const removePhoto = useCallback(
    async (imagenId) => {
      setSaving(true);
      try {
        const updated = await casesService.removeImagen(imagenId);
        setSelectedCase(updated);
        mergeCase(updated);
        showToast('success', 'Foto eliminada');
        return true;
      } catch (e) {
        showToast('error', e.message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [mergeCase, showToast],
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
        mergeCase(updated);
        showToast('success', 'Seguimiento registrado');
        await loadStats();
        return updated;
      } catch (e) {
        showToast('error', e.message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [loadStats, mergeCase, showToast],
  );

  /** Edita un seguimiento ya registrado (tipo, descripción, fecha de entrega y fotos nuevas) */
  const updateFollowUp = useCallback(
    async (casoId, seguimientoId, payload) => {
      setSaving(true);
      try {
        const updated = await casesService.updateFollowUp(casoId, seguimientoId, payload);
        setSelectedCase(updated);
        mergeCase(updated);
        showToast('success', 'Seguimiento actualizado');
        await loadStats();
        return updated;
      } catch (e) {
        showToast('error', e.message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [loadStats, mergeCase, showToast],
  );

  /** Elimina un seguimiento del historial (y sus fotos) */
  const deleteFollowUp = useCallback(
    async (casoId, seguimientoId) => {
      setSaving(true);
      try {
        const updated = await casesService.removeFollowUp(casoId, seguimientoId);
        setSelectedCase(updated);
        mergeCase(updated);
        showToast('success', 'Seguimiento eliminado');
        await loadStats();
        return updated;
      } catch (e) {
        showToast('error', e.message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [loadStats, mergeCase, showToast],
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
    updateFollowUp,
    deleteFollowUp,
    dismissToast,
    showToast,
  };
}
