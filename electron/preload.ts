import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  printReceipt: (options?: { silent?: boolean }) =>
    ipcRenderer.invoke('pos:print-receipt', options || {}),
});
