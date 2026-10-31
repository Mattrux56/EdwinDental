import { normalizeSearchText } from './search.js';

/** Las prótesis son los productos cuya categoría empieza por «PROTESIS» (sin importar mayúsculas ni tildes) */
export const esProtesis = (categoria) => normalizeSearchText(String(categoria ?? '').trim()).startsWith('protesis');

const RANGO_TIPO = { BASE: 0, PROTESIS: 1, ADICIONAL: 2 };

/** Ordena sin alterar el orden dentro de cada grupo: bases, prótesis y adicionales (`tipoDe` devuelve BASE, PROTESIS o ADICIONAL) */
export const ordenarPorTipo = (items, tipoDe) =>
  items
    .map((item, i) => ({ item, i, r: RANGO_TIPO[tipoDe(item)] ?? RANGO_TIPO.ADICIONAL }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.item);
