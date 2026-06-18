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
      'import_note',
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
      'note_ai_action',
      'stop_note_ai',
      'note_fim_completion',
      'stop_note_fim_completion',
      'get_notebooks',
      'get_notebook',
      'create_notebook',
      'update_notebook',
      'delete_notebook',
      'export_html_to_pdf',
      'export_markdown',
      'open-external',
      'python-check',
      'python-run',
      'python-run-streaming',
      'python-get-path',
      'kb-get-data-dir',
      'kb-read-dir',
      'kb-create-dir',
      'kb-search-files',
      'kb-mkdir',
      'kb-path-exists',
      'kb-copy-file',
      'kb-copy-folder',
      'kb-delete-dir',
      'kb-rename-dir',
      'kb-open-in-explorer',
      'kb-read-file',
      'kb-read-file-buffer',
      'kb-open-file-external'
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
      'config-changed',
      'note-ai-chunk',
      'note-ai-done',
      'note-ai-error',
      'note-fim-result',
      'python-stdout',
      'python-stderr'
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
