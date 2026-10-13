// Puente de la ventana de configuración: solo leer, importar y guardar las claves
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('labtrace', {
  leer: () => ipcRenderer.invoke('config:leer'),
  importar: () => ipcRenderer.invoke('config:importar'),
  guardar: (valores) => ipcRenderer.invoke('config:guardar', valores),
});
