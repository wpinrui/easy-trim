import { contextBridge, ipcRenderer } from 'electron';
import type { Api, ExportProgress, ExportRequest } from '../shared/types';

const api: Api = {
  openVideo: () => ipcRenderer.invoke('open-video'),
  chooseExportPath: (defaultName: string) =>
    ipcRenderer.invoke('choose-export-path', defaultName),
  exportSegments: (req: ExportRequest) => ipcRenderer.invoke('export-segments', req),
  onExportProgress: (cb: (p: ExportProgress) => void) => {
    const listener = (_: unknown, p: ExportProgress) => cb(p);
    ipcRenderer.on('export-progress', listener);
    return () => ipcRenderer.removeListener('export-progress', listener);
  },
  cancelExport: () => ipcRenderer.invoke('cancel-export')
};

contextBridge.exposeInMainWorld('api', api);
