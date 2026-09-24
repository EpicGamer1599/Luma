import { contextBridge, ipcRenderer } from 'electron';
import type { Bridge } from '../src/shared/types';
const bridge: Bridge = { request: (request) => ipcRenderer.invoke('luma:request', request) };
contextBridge.exposeInMainWorld('luma', bridge);
