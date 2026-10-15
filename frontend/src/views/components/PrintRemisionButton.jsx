import { useState } from 'react';
import { guardarRemisionExcel } from '../../services/remisiones.service.js';
import { generarRemision, imprimirRemision } from '../../utils/printRemision.js';
import { Icon } from './Icon.jsx';

/**
 * Botones de una remisión: «Imprimir» abre la ventana de impresión de Windows con la hoja con el diseño
 * de la plantilla y «Guardar» abre «Guardar como» para elegir dónde dejar el archivo de Excel.
 */
export default function PrintRemisionButton({ remision, showToast, className, saveClassName = className, iconSize = 15, busyLabel = '…' }) {
  const [busy, setBusy] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);

  const imprimir = async (event) => {
    event.stopPropagation();
    setImprimiendo(true);
    try {
      await imprimirRemision(await generarRemision(remision), remision);
    } catch (reason) {
      showToast?.('error', reason.message);
    } finally {
      setImprimiendo(false);
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
      <button type="button" className={className} onClick={imprimir} disabled={imprimiendo}>
        <Icon name="printer" size={iconSize} /> {imprimiendo ? busyLabel : 'Imprimir'}
      </button>
    </>
  );
}
