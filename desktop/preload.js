const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  isDesktop: true,
  platform: process.platform,
  getSources: () => ipcRenderer.invoke('get-sources'),
  selectSource: (sourceId) => ipcRenderer.invoke('select-source', sourceId),
  cancelSource: () => ipcRenderer.invoke('cancel-source'),
  onOpenScreenPicker: (callback) => {
    ipcRenderer.on('open-screen-picker', () => callback());
  }
});
