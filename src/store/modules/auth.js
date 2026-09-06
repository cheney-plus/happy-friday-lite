import { defineStore } from 'pinia'
import { clearSession, getProfile, isAuthenticated, login, logout, restoreSession } from '@/services/enterprise'
import { useFridayStore } from './friday'
import { useNoteStore } from './note'
import { useScheduleStore } from './schedule'
import { useNotebookStore } from './notebook'
import { useHistoryStore } from './history'
import { useTabStore } from './tabs'

function resetUserScopedStores() {
  ;[useFridayStore(), useNoteStore(), useScheduleStore(), useNotebookStore(), useHistoryStore(), useTabStore()]
    .forEach(store => store.$reset())
}

export const useAuthStore = defineStore('auth', {
  state: () => ({ ready: false, authenticated: isAuthenticated(), profile: getProfile(), error: '' }),
  actions: {
    async restore() { this.ready = false; this.profile = await restoreSession(); this.authenticated = !!this.profile; this.ready = true; return this.profile },
    async signIn(payload) {
      this.error = ''
      this.profile = await login(payload)
      resetUserScopedStores()
      this.authenticated = true
      return this.profile
    },
    async signOut() {
      await logout()
      clearSession()
      resetUserScopedStores()
      this.profile = null
      this.authenticated = false
    }
  }
})
