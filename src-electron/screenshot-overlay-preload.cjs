const { contextBridge, ipcRenderer } = require('electron')

// 截图框选窗口专用 preload，只暴露框选所需的最小接口
contextBridge.exposeInMainWorld('screenshotOverlay', {
  init: () => ipcRenderer.invoke('screenshot-overlay-init'),
  confirm: payload => ipcRenderer.invoke('screenshot-overlay-confirm', payload),
  cancel: () => ipcRenderer.invoke('screenshot-overlay-cancel'),
})
