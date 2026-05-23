import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    sidebarVisible: true,
    language: 'zh-CN',
    theme: 'light',
    loading: false,
    noteFimCompletion: true
  }),
  actions: {
    toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible
    },
    setLanguage(lang) {
      this.language = lang
    },
    setTheme(theme) {
      this.theme = theme
    },
    setNoteFimCompletion(value) {
      this.noteFimCompletion = value
    }
  }
})
