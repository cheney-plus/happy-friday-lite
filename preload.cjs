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
      'get_sessions_with_stats',
      'get_session',
      'get_session_messages',
      'create_session',
      'update_session_title',
      'delete_session',
      'save_message',
      'rollback_session',
      'get-share-link',
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
      'python-status',
      'python-autodetect',
      'python-set-path',
      'python-select-file',
      'python-verify',
      'python-invalidate-cache',
      'kb-get-data-dir',
      'kb-read-dir',
      'kb-create-dir',
      'kb-search-files',
      'kb-mkdir',
      'kb-path-exists',
      'kb-copy-file',
      'kb-copy-folder',
      'kb-fetch-webpage',
      'kb-save-webpage',
      'kb-save-note',
      'kb-delete-dir',
      'kb-rename-dir',
      'kb-open-in-explorer',
      'kb-read-file',
      'kb-read-file-buffer',
      'kb-open-file-external',
      'kb-watch-current-dir',
      'logs-open-dir',
      'backup-create',
      'backup-restore',
      'backup-get-config',
      'backup-set-config',
      'backup-select-dir',
      'history-get-config',
      'history-set-config',
      'history-clean-now',
      'rag-build-index',
      'rag-stop-build-index',
      'rag-manual-update',
      'rag-get-file-status',
      'rag-get-batch-status',
      'rag-get-kb-summary',
      'rag-get-queue-stats',
      'rag-retry-failed',
      'rag-clear-kb-index',
      'rag-search',
      'agent-invoke',
      'agent-stop',
      'agent-tool-approval-resume',
      'agent-list-tools',
      'agent-list-skills',
      'agent-delete-skill',
      'agent-import-skill',
      'mcp-list-servers',
      'mcp-add-servers',
      'mcp-delete-server',
      'mcp-refresh-server',
      'mcp-get-local-config',
      'mcp-local-toggle',
      'agent-list-memories',
      'agent-read-memory',
      'agent-write-memory',
      'agent-get-avatar-history',
      'agent-set-avatar'
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
      'backup-progress',
      'note-ai-chunk',
      'note-ai-done',
      'note-ai-error',
      'note-fim-result',
      'python-stdout',
      'python-stderr',
      'rag-update-progress',
      'rag-update-done',
      'rag-build-progress',
      'rag-task-complete',
      'agent-tool-call',
      'agent-tool-result',
      'agent-tool-approval',
      'kb-directory-changed'
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
