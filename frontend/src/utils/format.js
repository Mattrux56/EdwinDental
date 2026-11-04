const dateTime = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const dateOnly = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
const estimatedDateOnly = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

export const formatDateTime = (iso) => (iso ? dateTime.format(new Date(iso)) : '—');
export const formatDate = (iso) => (iso ? dateOnly.format(new Date(iso)) : '—');
export const formatEstimatedDate = (iso) =>
  iso ? estimatedDateOnly.format(new Date(iso)) : '—';

/** Fecha de ingreso (YYYY-MM-DD) de un caso; sin ella se usa la de creación, en hora local */
export function ingresoDate(caso) {
  if (caso?.fechaIngreso) return String(caso.fechaIngreso).slice(0, 10);
  const date = new Date(caso?.creadoEn);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** ¿La fecha (YYYY-MM-DD o ISO) cae en el periodo { anio, mes }? Sin periodo, siempre */
export function enPeriodo(fecha, periodo) {
  if (!periodo) return true;
  return String(fecha ?? '').slice(0, 7) === `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`;
}

/** Un caso finalizado ya no tiene entrega pendiente: no se marca como vencido ni por vencer */
export function deliverySla(fecha, estado) {
  if (!fecha) return null;
  if (String(estado ?? '').toLocaleLowerCase('es') === 'finalizado') return null;
  const [year, month, day] = fecha.slice(0, 10).split('-').map(Number);
  const due = Date.UTC(year, month - 1, day);
  const today = new Date();
  const currentDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = Math.round((due - currentDay) / 86400000);
  if (daysLeft < 0) return { label: 'Vencido', status: 'overdue' };
  if (daysLeft <= 3) return { label: 'Por vencer', status: 'dueSoon' };
  return { label: 'A tiempo', status: 'onTime' };
}

/*
 * El listado de casos viene resumido (totalMovimientos, ultimoMovimiento, portada) y el detalle trae el historial
 * completo (seguimientos). Estos tres helpers sirven con cualquiera de las dos formas.
 */

/** Fecha del último movimiento de un caso (último seguimiento) */
export const lastMovement = (caso) => {
  const list = caso?.seguimientos;
  if (list) return list.length ? list[list.length - 1].creadoEn : caso?.creadoEn;
  return caso?.ultimoMovimiento ?? caso?.creadoEn;
};

/** Cantidad de movimientos (seguimientos) del caso */
export const totalMovimientos = (caso) => caso?.seguimientos?.length ?? caso?.totalMovimientos ?? 0;

/** Primera foto del caso, si tiene */
export const portadaCaso = (caso) =>
  caso?.seguimientos
    ? caso.seguimientos.flatMap((movimiento) => movimiento.imagenes ?? [])[0]?.urlImagen
    : caso?.portada ?? undefined;

const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});
export const formatMoney = (value) => money.format(value ?? 0);
export const formatRemisionNumber = (remision) =>
  remision?.tipo === 'ELECTRONICA' ? `FE-${remision.numero}` : String(remision?.numero ?? '');
