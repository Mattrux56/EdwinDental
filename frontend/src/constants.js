export const ESTADOS = ['En laboratorio', 'En prueba', 'Finalizado', 'arreglo'];

export const TIPOS_SEGUIMIENTO = [
  'prueba',
  'reingreso',
  'entrega',
  'arreglo',
];

export const MOVIMIENTOS = [
  { tipo: 'reingreso', estado: 'En laboratorio', label: 'Reingreso · En laboratorio' },
  { tipo: 'prueba', estado: 'En prueba', label: 'Prueba · En prueba' },
  { tipo: 'entrega', estado: 'Finalizado', label: 'Entrega · Finalizado' },
  { tipo: 'arreglo', estado: 'arreglo', label: 'Arreglo · Arreglo' },
];

export function normalizeEstado(estado = '') {
  const value = estado.toLocaleLowerCase('es');
  if (value === 'en proceso') return 'En prueba';
  if (value === 'en laboratorio') return 'En laboratorio';
  if (value === 'finalizado') return 'Finalizado';
  if (value === 'arreglo') return 'arreglo';
  return estado;
}
