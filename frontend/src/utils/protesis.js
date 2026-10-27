import { normalizeSearchText } from './search.js';

/** Las prótesis son los productos cuya categoría empieza por «PROTESIS» (sin importar mayúsculas ni tildes) */
export const esProtesis = (categoria) => normalizeSearchText(String(categoria ?? '').trim()).startsWith('protesis');
