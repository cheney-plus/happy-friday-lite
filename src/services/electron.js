export const electronService = {
  async invoke(command, args) {
    if (enterpriseCommands.has(command)) {
      if (!isAuthenticated()) {
        throw new Error('请先登录企业服务')
      }
      return invokeEnterprise(command, args)
    }
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
import { invokeEnterprise, isAuthenticated } from './enterprise'

const enterpriseCommands = new Set([
  'get_sessions', 'get_sessions_with_stats', 'get_session', 'create_session', 'update_session_title', 'delete_session', 'get_session_messages', 'save_message', 'rollback_session',
  'get_notebooks', 'get_notebook', 'create_notebook', 'update_notebook', 'delete_notebook', 'get_notes', 'get_note', 'create_note', 'import_note', 'update_note', 'delete_note', 'search_notes',
  'get_schedule_events', 'get_schedule_events_by_date_range', 'create_schedule_event', 'update_schedule_event', 'delete_schedule_event',
  'automation-list-tasks', 'automation-list-runs', 'automation-create-task', 'automation-update-task', 'automation-delete-task', 'automation-delete-run', 'usage-get-stats', 'usage-clear', 'history-clean-now'
])
