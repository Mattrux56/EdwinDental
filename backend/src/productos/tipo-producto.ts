import { esProtesis } from './es-protesis';

export type TipoProductoValor = 'BASE' | 'PROTESIS' | 'ADICIONAL';

const sinTildes = (texto: string) =>
  texto
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const BASES = ['base semirigida', 'base metalica'];

/** Base: «Base semirrígida» o «Base Metálica» (en la descripción o la categoría). Prótesis: categoría «PROTESIS…». Lo demás es adicional. */
export function tipoDeProducto(categoria: string, descripcion: string): TipoProductoValor {
  if (BASES.includes(sinTildes(descripcion)) || BASES.includes(sinTildes(categoria))) return 'BASE';
  return esProtesis(categoria) ? 'PROTESIS' : 'ADICIONAL';
}

const RANGO: Record<TipoProductoValor, number> = { BASE: 0, PROTESIS: 1, ADICIONAL: 2 };

/** Ordena (sin alterar el orden dentro de cada grupo): bases, prótesis y adicionales */
export function ordenarPorTipo<T>(items: T[], tipoDe: (item: T) => TipoProductoValor): T[] {
  return items
    .map((item, i) => ({ item, i, r: RANGO[tipoDe(item)] }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.item);
}
