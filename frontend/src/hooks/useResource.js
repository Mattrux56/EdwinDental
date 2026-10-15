import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carga datos del servidor con su estado de «cargando» y error.
 * `deps` son los valores de los que depende `fetcher` (p. ej. el mes elegido): al cambiar, se vuelve a cargar.
 * Si llegan varias respuestas seguidas (cambios rápidos de filtro), solo cuenta la última.
 */
export function useResource(fetcher, deps = [], initial = []) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pedido = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    const mio = ++pedido.current;
    setLoading(true);
    setError('');
    try {
      const resultado = await fetcher();
      if (mio === pedido.current) setData(resultado);
    } catch (reason) {
      if (mio === pedido.current) {
        setData(initial);
        setError(reason.message);
      }
    } finally {
      if (mio === pedido.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
