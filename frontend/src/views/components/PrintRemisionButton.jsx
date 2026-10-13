import { useState } from 'react';
import { guardarRemisionExcel } from '../../services/remisiones.service.js';
import { imprimirRemision } from '../../utils/printRemision.js';
import { Icon } from './Icon.jsx';

/**
 * Botones de una remisión: «Imprimir» abre la ventana de impresión del navegador y
 * «Guardar» abre «Guardar como» para elegir dónde dejar el archivo de Excel.
 */
export default function PrintRemisionButton({ remision, showToast, className, saveClassName = className, iconSize = 15, busyLabel = '…' }) {
  const [busy, setBusy] = useState(false);

  const imprimir = (event) => {
    event.stopPropagation();
    try {
      imprimirRemision(remision);
    } catch (reason) {
      showToast?.('error', reason.message);
    }
  };

  const guardar = async (event) => {
    event.stopPropagation();
    setBusy(true);
    try {
      await guardarRemisionExcel(remision.id, remision.numero, remision.tipo);
    } catch (reason) {
      showToast?.('error', reason.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={saveClassName} onClick={guardar} disabled={busy}>
        <Icon name="download" size={iconSize} /> {busy ? busyLabel : 'Guardar'}
      </button>
      <button type="button" className={className} onClick={imprimir}>
        <Icon name="printer" size={iconSize} /> Imprimir
      </button>
    </>
  );
}
