export const electronService = {
  async invoke(command, args) {
    if (window.electronAPI) {
      try {
        return await window.electronAPI.invoke(command, args)
      } catch (e) {
        console.error(`IPC invoke '${command}' failed:`, e)
        return null
      }
    }
    console.warn('Electron API not available, invoke command:', command)
    return null
  },

  async saveFile(options) {
    if (window.electronAPI) {
      return window.electronAPI.invoke('save-file-dialog', options)
    }
    console.warn('Electron API not available, using fallback')
    return null
  },

  listen(event, callback) {
    if (window.electronAPI) {
      return window.electronAPI.on(event, (data) => {
        callback({ payload: data })
      })
    }
    console.warn('Electron API not available, cannot listen to event:', event)
    return () => {}
  },

  send(channel, data) {
    if (window.electronAPI) {
      window.electronAPI.send(channel, data)
    }
  },

  get isElectron() {
    return !!window.electronAPI
  }
}
