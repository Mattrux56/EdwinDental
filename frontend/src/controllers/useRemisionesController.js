import { useCallback, useEffect, useState } from 'react';
import { downloadRemisionExcel, remisionesService } from '../services/remisiones.service.js';

export function useRemisionesController({ showToast }) {
  const [remisiones, setRemisiones] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [anulandoId, setAnulandoId] = useState(null);

  const loadProductos = useCallback(async () => {
    const precios = await remisionesService.productos();
    setProductos(precios);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lista] = await Promise.all([remisionesService.list(), loadProductos()]);
      setRemisiones(lista);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [loadProductos]);

  useEffect(() => {
    load();
  }, [load]);

  /** Crea la remisión y descarga su Excel de inmediato */
  const createRemision = useCallback(
    async (payload) => {
      setSaving(true);
      try {
        const created = await remisionesService.create(payload);
        showToast('success', `Remisión N° ${created.numero} creada. Descargando Excel…`);
        downloadRemisionExcel(created.id, created.numero).catch((e) => showToast('error', e.message));
        await load();
        return created;
      } catch (e) {
        showToast('error', e.message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [load, showToast],
  );

  /** Corrige la remisión (sin cambiar su número) y descarga el Excel actualizado */
  const updateRemision = useCallback(
    async (id, payload) => {
      setSaving(true);
      try {
        const updated = await remisionesService.update(id, payload);
        showToast('success', `Remisión N° ${updated.numero} actualizada`);
        await load();
        return updated;
      } catch (e) {
        showToast('error', e.message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [load, showToast],
  );

  const anularRemision = useCallback(
    async (remision) => {
      setAnulandoId(remision.id);
      try {
        await remisionesService.anular(remision.id);
        showToast('success', `Remisión N° ${remision.numero} anulada`);
        await load();
        return true;
      } catch (e) {
        showToast('error', e.message);
        return false;
      } finally {
        setAnulandoId(null);
      }
    },
    [load, showToast],
  );

  const reactivarRemision = useCallback(
    async (remision) => {
      setAnulandoId(remision.id);
      try {
        await remisionesService.reactivar(remision.id);
        showToast('success', `Remisión N° ${remision.numero} reactivada`);
        await load();
        return true;
      } catch (e) {
        showToast('error', e.message);
        return false;
      } finally {
        setAnulandoId(null);
      }
    },
    [load, showToast],
  );

  return {
    remisiones,
    productos,
    loading,
    error,
    saving,
    anulandoId,
    reload: load,
    reloadProductos: loadProductos,
    createRemision,
    updateRemision,
    anularRemision,
    reactivarRemision,
  };
}
