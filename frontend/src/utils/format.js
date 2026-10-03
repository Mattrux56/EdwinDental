const dateTime = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const dateOnly = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

export const formatDateTime = (iso) => (iso ? dateTime.format(new Date(iso)) : '—');
export const formatDate = (iso) => (iso ? dateOnly.format(new Date(iso)) : '—');

/** Fecha del último movimiento de un caso (último seguimiento) */
export const lastMovement = (caso) => {
  const list = caso?.seguimientos ?? [];
  return list.length ? list[list.length - 1].creadoEn : caso?.creadoEn;
};
