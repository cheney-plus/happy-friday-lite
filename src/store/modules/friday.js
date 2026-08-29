import { defineStore } from 'pinia'

const MODE_KEY = 'happy-friday-chat-mode'
const THINK_KEY = 'happy-friday-think-mode'
const SELECTED_MODEL_KEY = 'happy-friday-selected-model'
const HISTORY_WIDTH_KEY = 'happy-friday-history-sidebar-width'
const HISTORY_SESSIONS_KEY = 'happy-friday-history-sessions'
const DEFAULT_HISTORY_WIDTH = 240

function readStorage(key, fallback = '') {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

function loadHistorySidebarWidth() {
  try {
    const savedWidth = Number(localStorage.getItem(HISTORY_WIDTH_KEY))
    return savedWidth >= 200 && savedWidth <= 400 ? savedWidth : DEFAULT_HISTORY_WIDTH
  } catch {
    return DEFAULT_HISTORY_WIDTH
  }
}

function loadCachedHistorySessions() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(HISTORY_SESSIONS_KEY) || '[]')
    return Array.isArray(cached) ? cached : []
  } catch {
    return []
  }
}

export const useFridayStore = defineStore('friday', {
  state: () => ({
    mode: readStorage(MODE_KEY, 'agent'),
    thinkMode: readStorage(THINK_KEY, 'fast'),
    modelId: readStorage(SELECTED_MODEL_KEY, ''),
    pendingLaunches: {},
    streamingByTab: {},
    historySessions: loadCachedHistorySessions(),
    historyCollapsed: false,
    historySidebarWidth: loadHistorySidebarWidth()
  }),
  actions: {
    setMode(mode) {
      this.mode = mode
      writeStorage(MODE_KEY, mode)
    },
    setThinkMode(thinkMode) {
      this.thinkMode = thinkMode
      writeStorage(THINK_KEY, thinkMode)
    },
    setModelId(modelId) {
      this.modelId = modelId
      writeStorage(SELECTED_MODEL_KEY, modelId)
    },
    setPendingLaunch(tabId, payload) {
      this.pendingLaunches[tabId || '_default'] = payload
    },
    takePendingLaunch(tabId) {
      const key = tabId || '_default'
      const payload = this.pendingLaunches[key] || null
      delete this.pendingLaunches[key]
      return payload
    },
    setTabStreaming(tabId, streaming) {
      const key = tabId || '_default'
      if (streaming) this.streamingByTab[key] = true
      else delete this.streamingByTab[key]
    },
    isTabStreaming(tabId) {
      return !!this.streamingByTab[tabId || '_default']
    },
    setHistorySessions(sessions) {
      this.historySessions = Array.isArray(sessions) ? sessions : []
      try {
        sessionStorage.setItem(HISTORY_SESSIONS_KEY, JSON.stringify(this.historySessions))
      } catch {}
    },
    patchHistorySession(sessionId, patch) {
      const session = this.historySessions.find(item => item.id === sessionId)
      if (!session) return
      Object.assign(session, patch)
      this.setHistorySessions(this.historySessions)
    },
    removeHistorySession(sessionId) {
      this.setHistorySessions(this.historySessions.filter(item => item.id !== sessionId))
    },
    setHistoryCollapsed(collapsed) {
      this.historyCollapsed = collapsed
    },
    setHistorySidebarWidth(width) {
      this.historySidebarWidth = Math.min(400, Math.max(200, width))
    },
    persistHistorySidebarWidth() {
      writeStorage(HISTORY_WIDTH_KEY, String(this.historySidebarWidth))
    }
  }
})
