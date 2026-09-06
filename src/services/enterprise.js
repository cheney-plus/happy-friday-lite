const SERVER_KEY = 'happy-friday-enterprise-server-url'
const ACCESS_KEY = 'happy-friday-enterprise-access-token'
const REFRESH_KEY = 'happy-friday-enterprise-refresh-token'
const PROFILE_KEY = 'happy-friday-enterprise-profile'

function storage() { return window.localStorage }
export function getServerURL() { return storage().getItem(SERVER_KEY) || import.meta.env.VITE_ENTERPRISE_SERVER_URL || 'http://127.0.0.1:8080' }
export function setServerURL(value) { storage().setItem(SERVER_KEY, String(value || '').replace(/\/$/, '')) }
export function isAuthenticated() { return Boolean(storage().getItem(ACCESS_KEY)) }
export function getAccessToken() { return storage().getItem(ACCESS_KEY) || '' }
export function getProfile() { try { return JSON.parse(storage().getItem(PROFILE_KEY) || 'null') } catch { return null } }
export function clearSession() { [ACCESS_KEY, REFRESH_KEY, PROFILE_KEY].forEach(key => storage().removeItem(key)) }

async function request(path, options = {}, retry = true) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  const token = storage().getItem(ACCESS_KEY)
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${getServerURL()}${path}`, { ...options, headers })
  if (response.status === 401 && retry && storage().getItem(REFRESH_KEY)) {
    await refresh()
    return request(path, options, false)
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message || `服务请求失败 (${response.status})`)
  return payload.data
}

export async function login({ serverURL, email, password, deviceName = 'Happy Friday Desktop' }) {
  if (serverURL) setServerURL(serverURL)
  const data = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password, deviceName }) }, false)
  storage().setItem(ACCESS_KEY, data.accessToken); storage().setItem(REFRESH_KEY, data.refreshToken)
  const profile = await request('/api/v1/me'); storage().setItem(PROFILE_KEY, JSON.stringify(profile))
  await refreshModels()
  return profile
}
export async function refresh() {
  const token = storage().getItem(REFRESH_KEY)
  if (!token) throw new Error('登录已失效')
  const data = await request('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: token, deviceName: 'Happy Friday Desktop' }) }, false)
  storage().setItem(ACCESS_KEY, data.accessToken); storage().setItem(REFRESH_KEY, data.refreshToken)
  return data
}
export async function logout() { const token = storage().getItem(REFRESH_KEY); try { if (token) await request('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: token }) }, false) } finally { clearSession() } }
export async function restoreSession() { if (!isAuthenticated()) return null; try { const profile = await request('/api/v1/me'); storage().setItem(PROFILE_KEY, JSON.stringify(profile)); await refreshModels(); return profile } catch { clearSession(); return null } }
export async function refreshModels() { const models = await request('/api/v1/model-configs/active'); const normalized = models.map(item => ({ ...item, providerLabel: item.displayName, id: item.id })); storage().setItem('happy-friday-custom-models', JSON.stringify(normalized)); if (!localStorage.getItem('happy-friday-selected-model') && normalized[0]) localStorage.setItem('happy-friday-selected-model', normalized[0].id); return normalized }
export const enterpriseAPI = { request, login, logout, restoreSession, refreshModels }

const route = (method, path, body) => request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
export async function invokeEnterprise(command, args = {}) {
  switch (command) {
    case 'get_sessions': return route('GET', '/api/v1/conversations')
    case 'get_sessions_with_stats': { const items = await route('GET', '/api/v1/conversations'); return { sessions: items, hasMore: false } }
    case 'get_session': return route('GET', `/api/v1/conversations/${args.sessionId}`)
    case 'create_session': return route('POST', '/api/v1/conversations', { title: args.title, kind: args.mode || 'chat' })
    case 'update_session_title': return route('PATCH', `/api/v1/conversations/${args.sessionId}`, { title: args.title })
    case 'delete_session': return route('DELETE', `/api/v1/conversations/${args.sessionId}`)
    case 'get_session_messages': return route('GET', `/api/v1/conversations/${args.sessionId}/messages`)
    case 'save_message': return route('POST', `/api/v1/conversations/${args.sessionId}/messages`, { role: args.role, content: args.content, metadata: args.metadata || '' })
    case 'rollback_session': return route('POST', `/api/v1/conversations/${args.sessionId}/rollback`, { messageId: args.messageId })
    case 'get_notebooks': return route('GET', '/api/v1/notebooks')
    case 'get_notebook': return route('GET', `/api/v1/notebooks/${args.notebookId}`)
    case 'create_notebook': return route('POST', '/api/v1/notebooks', args)
    case 'update_notebook': return route('PATCH', `/api/v1/notebooks/${args.notebookId}`, args)
    case 'delete_notebook': return route('DELETE', `/api/v1/notebooks/${args.notebookId}`)
    case 'get_notes': return route('GET', `/api/v1/notes${args.notebookId ? `?notebookId=${encodeURIComponent(args.notebookId)}` : ''}`)
    case 'get_note': return route('GET', `/api/v1/notes/${args.noteId}`)
    case 'create_note': return route('POST', '/api/v1/notes', { notebookId: args.notebookId || null, title: args.title || '', content: '', contentText: '' })
    case 'import_note': return route('POST', '/api/v1/notes', { notebookId: args.notebookId || null, title: args.title || '', content: args.content || '', contentText: args.contentText || '' })
    case 'update_note': return route('PATCH', `/api/v1/notes/${args.noteId}`, { notebookId: args.notebookId ?? null, title: args.title, content: args.content, contentText: args.contentText })
    case 'delete_note': return route('DELETE', `/api/v1/notes/${args.noteId}`)
    case 'search_notes': return route('GET', `/api/v1/notes/search?q=${encodeURIComponent(args.query || '')}`)
    case 'get_schedule_events': return route('GET', '/api/v1/schedule-events')
    case 'get_schedule_events_by_date_range': return route('GET', `/api/v1/schedule-events?startDate=${args.start}&endDate=${args.end}`)
    case 'create_schedule_event': return route('POST', '/api/v1/schedule-events', args)
    case 'update_schedule_event': return route('PATCH', `/api/v1/schedule-events/${args.eventId}`, args)
    case 'delete_schedule_event': return route('DELETE', `/api/v1/schedule-events/${args.eventId}`)
    case 'automation-list-tasks': return route('GET', '/api/v1/automation/tasks')
    case 'automation-list-runs': return route('GET', '/api/v1/automation/runs')
    case 'automation-create-task': return route('POST', '/api/v1/automation/tasks', { ...args, modelConfigId: args.modelId, triggerConfig: JSON.stringify(args.triggerConfig || {}) })
    case 'automation-update-task': return route('PATCH', `/api/v1/automation/tasks/${args.taskId}`, { ...args, modelConfigId: args.modelId, triggerConfig: args.triggerConfig ? JSON.stringify(args.triggerConfig) : '' })
    case 'automation-delete-task': return route('DELETE', `/api/v1/automation/tasks/${args.taskId}`)
    case 'automation-delete-run': return route('DELETE', `/api/v1/automation/runs/${args.runId}`)
    case 'usage-get-stats': { const data = await route('GET', '/api/v1/usage-records/summary'); return { success: true, data: { summary: { totalPrompt: data.promptTokens, totalCompletion: data.completionTokens, totalTokens: data.totalTokens, totalReasoning: data.reasoningTokens, totalRequests: data.requests }, byModel: [], byDay: [], bySource: [] } } }
    default: return undefined
  }
}
