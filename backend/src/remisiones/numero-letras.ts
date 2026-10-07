const UNIDADES = [
  '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
  'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS',
  'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
];

/** 1..999. El "uno" final se apocopa ("UN") porque siempre va antes de MIL, MILLÓN o PESOS. */
function centenas(n: number): string {
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto < 30) {
    if (resto) partes.push(UNIDADES[resto]);
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    partes.push(u ? `${DECENAS[d]} Y ${UNIDADES[u]}` : DECENAS[d]);
  }
  return partes.join(' ');
}

/** Entero 1..999.999.999.999 en letras (mayúsculas). */
function enteroEnLetras(n: number): string {
  const milesDeMillones = Math.floor(n / 1_000_000_000);
  const millones = Math.floor((n % 1_000_000_000) / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const unidades = n % 1000;
  const partes: string[] = [];

  if (milesDeMillones) {
    partes.push(milesDeMillones === 1 ? 'MIL' : `${centenas(milesDeMillones)} MIL`);
    // "MIL MILLONES" / "DOS MIL MILLONES": los miles de millones comparten la palabra MILLONES
    partes.push(millones ? '' : 'MILLONES');
  }
  if (millones) partes.push(millones === 1 && !milesDeMillones ? 'UN MILLÓN' : `${centenas(millones)} MILLONES`);
  if (miles) partes.push(miles === 1 ? 'MIL' : `${centenas(miles)} MIL`);
  if (unidades) partes.push(centenas(unidades));
  return partes.filter(Boolean).join(' ');
}

/**
 * Valor en letras para el campo "DEBE LA SUMA DE" de la remisión.
 * Ej.: 185000 → "CIENTO OCHENTA Y CINCO MIL 00/100 PESOS M/CTE"
 * (Reemplaza la macro NumeroLetras del Excel original, que solo funciona en el equipo que la tiene instalada.)
 */
export function totalEnLetras(total: number, moneda = 'PESOS M/CTE'): string {
  if (!Number.isFinite(total) || total < 0 || total >= 1_000_000_000_000) {
    throw new RangeError(`Valor fuera de rango para convertir a letras: ${total}`);
  }
  let pesos = Math.floor(total);
  let centavos = Math.round((total - pesos) * 100);
  if (centavos === 100) {
    pesos += 1;
    centavos = 0;
  }
  const letras = pesos === 0 ? 'CERO' : enteroEnLetras(pesos);
  return `${letras} ${String(centavos).padStart(2, '0')}/100 ${moneda}`;
}
