import { useState } from 'react';
import { imprimirRemision } from '../../services/remisiones.service.js';
import { Icon } from './Icon.jsx';

/** Botón «Imprimir» de una remisión: abre «Guardar como» para elegir dónde guardar el archivo */
export default function PrintRemisionButton({ remision, showToast, className, iconSize = 15, busyLabel = '…' }) {
  const [busy, setBusy] = useState(false);

  const imprimir = async (event) => {
    event.stopPropagation();
    setBusy(true);
    try {
      await imprimirRemision(remision.id, remision.numero, remision.tipo);
    } catch (reason) {
      showToast?.('error', reason.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className={className} onClick={imprimir} disabled={busy}>
      <Icon name="printer" size={iconSize} /> {busy ? busyLabel : 'Imprimir'}
    </button>
  );
}
