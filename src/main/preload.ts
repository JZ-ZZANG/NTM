import { contextBridge, ipcRenderer } from 'electron';

console.log('>>> [Preload] Script is loading (CommonJS)...');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window Controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: any, status: boolean) => callback(status);
    ipcRenderer.on('window-maximized-status', listener);
    return () => { ipcRenderer.removeListener('window-maximized-status', listener); };
  },
  isMaximized: () => ipcRenderer.invoke('get-is-maximized'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  saveJsonFile: (args: { path: string, fileName: string, data: any }) => ipcRenderer.invoke('save-json-file', args),
  startTagRemoval: (items: any, settings: any) => ipcRenderer.invoke('start-tag-removal', items, settings),
  onProgress: (callback: (progress: any) => void) => {
    const listener = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('process-progress', listener);
    return () => { ipcRenderer.removeListener('process-progress', listener); };
  },
  
  // Tag Suggestion
  suggestTags: (keyword: string) => ipcRenderer.invoke('suggest-tags', keyword),
});

console.log('>>> [Preload] electronAPI exposed successfully');