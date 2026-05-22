const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  invoke(channel, ...args) {
    const validChannels = [
      'get-config',
      'save-config',
      'get-platform',
      'save-file-dialog',
      'open-file-dialog',
      'get_notes',
      'get_note',
      'create_note',
      'update_note',
      'delete_note',
      'search_notes',
      'get_schedule_events',
      'get_schedule_events_by_date_range',
      'get_schedule_event',
      'create_schedule_event',
      'update_schedule_event',
      'delete_schedule_event',
      'get_sessions',
      'get_session',
      'get_session_messages',
      'create_session',
      'update_session_title',
      'delete_session',
      'save_message',
      'rollback_session',
      'chat_with_memory',
      'chat_without_memory',
      'stop_chat',
      'export_html_to_pdf',
      'export_markdown',
      'open-external'
    ]
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`Invalid IPC channel: ${channel}`))
  },

  send(channel, ...args) {
    const validChannels = [
      'window-minimize',
      'window-maximize',
      'window-close'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  },

  on(channel, callback) {
    const validChannels = [
      'chat-chunk',
      'chat-reasoning-chunk',
      'chat-done',
      'chat-error',
      'session-title-updated',
      'config-changed'
    ]
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args)
      ipcRenderer.on(channel, subscription)
      return () => {
        ipcRenderer.removeListener(channel, subscription)
      }
    }
    return () => {}
  }
})
