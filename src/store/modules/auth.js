import { defineStore } from 'pinia'
import { clearSession, getProfile, isAuthenticated, login, logout, restoreSession } from '@/services/enterprise'

export const useAuthStore = defineStore('auth', {
  state: () => ({ ready: false, authenticated: isAuthenticated(), profile: getProfile(), error: '' }),
  actions: {
    async restore() { this.ready = false; this.profile = await restoreSession(); this.authenticated = !!this.profile; this.ready = true; return this.profile },
    async signIn(payload) { this.error = ''; this.profile = await login(payload); this.authenticated = true; return this.profile },
    async signOut() { await logout(); clearSession(); this.profile = null; this.authenticated = false }
  }
})
