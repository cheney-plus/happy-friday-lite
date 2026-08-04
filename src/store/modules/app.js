import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    sidebarVisible: true,
    language: 'zh-CN',
    theme: 'light',
    loading: false,
    noteFimCompletion: true,
    scheduleDefaultView: 'month',
    // 用户头像：{ dataUrl, name, rarity, updatedAt } 或 null（回退到默认头像）
    avatar: null
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
    },
    setScheduleDefaultView(value) {
      this.scheduleDefaultView = value
    },
    setAvatar(avatar) {
      this.avatar = avatar || null
    }
  }
})
