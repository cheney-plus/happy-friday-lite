import { defineStore } from 'pinia'

export const useTabStore = defineStore('tabs', {
  state: () => ({
    openedTabs: [],
    activeTabId: '',
    fridayCounter: 0
  }),
  actions: {
    addTab(tab) {
      const existingTabIndex = this.openedTabs.findIndex(t => t.id === tab.id)
      if (existingTabIndex === -1) {
        this.openedTabs.push(tab)
      }
      this.activeTabId = tab.id
    },
    addFridayTab() {
      this.fridayCounter++
      const id = `friday-${this.fridayCounter}`
      const tab = {
        id,
        path: '/friday',
        fullPath: `/friday?__tab=${id}`,
        i18nKey: 'friday.title',
        icon: 'Bot'
      }
      this.openedTabs.push(tab)
      this.activeTabId = tab.id
      return tab
    },
    addFileTab(file) {
      const id = `file-${file.path}`
      const existingTabIndex = this.openedTabs.findIndex(t => t.id === id)
      if (existingTabIndex === -1) {
        const tab = {
          id,
          path: '/file-viewer',
          fullPath: `/file-viewer?path=${encodeURIComponent(file.path)}&name=${encodeURIComponent(file.name)}&type=${file.type || 'unknown'}`,
          title: file.name,
          icon: 'FileText'
        }
        this.openedTabs.push(tab)
      }
      this.activeTabId = id
      return this.openedTabs.find(t => t.id === id)
    },
    removeTab(id) {
      const index = this.openedTabs.findIndex(t => t.id === id)
      if (index !== -1) {
        this.openedTabs.splice(index, 1)

        if (this.activeTabId === id) {
          if (this.openedTabs.length > 0) {
            const nextIndex = Math.max(0, index - 1)
            this.activeTabId = this.openedTabs[nextIndex].id
          } else {
            this.addFridayTab()
          }
        }
      }
    },
    setActiveTab(id) {
      this.activeTabId = id
    },
    updateTabFullPath(id, fullPath) {
      const tab = this.openedTabs.find(t => t.id === id)
      if (tab) {
        tab.fullPath = fullPath
      }
    }
  }
})
