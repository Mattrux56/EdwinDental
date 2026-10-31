// Puente de la ventana principal: abrir la vista previa de impresión (PDF) de un documento o imprimirlo directo
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('labtraceEscritorio', {
  vistaImpresion: (html, titulo) => ipcRenderer.invoke('impresion:vista', { html, titulo }),
  imprimir: (html) => ipcRenderer.invoke('impresion:directa', { html }),
  // Cambiar la base de datos (claves del .env)
  configLeer: () => ipcRenderer.invoke('config:leer'),
  configImportar: () => ipcRenderer.invoke('config:importar'),
  configGuardar: (valores) => ipcRenderer.invoke('config:guardar', valores),
});
