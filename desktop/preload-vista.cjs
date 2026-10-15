// Puente de la ventana de vista previa de impresión: solo imprimir el documento que muestra (en papel carta)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('labtraceVista', {
  imprimir: () => ipcRenderer.invoke('impresion:imprimir'),
});
