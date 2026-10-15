// Puente de la ventana principal: solo abrir la vista previa de impresión (PDF) de un documento
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('labtraceEscritorio', {
  vistaImpresion: (html, titulo) => ipcRenderer.invoke('impresion:vista', { html, titulo }),
});
