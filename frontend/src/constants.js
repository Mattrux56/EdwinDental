export const ESTADOS = ['En laboratorio', 'En prueba', 'Finalizado', 'arreglo'];

export const TIPOS_SEGUIMIENTO = [
  'prueba',
  'reingreso',
  'entrega',
  'arreglo',
];

export function normalizeEstado(estado = '') {
  const value = estado.toLocaleLowerCase('es');
  if (value === 'en proceso') return 'En prueba';
  if (value === 'en laboratorio') return 'En laboratorio';
  if (value === 'finalizado') return 'Finalizado';
  if (value === 'arreglo') return 'arreglo';
  return estado;
}
