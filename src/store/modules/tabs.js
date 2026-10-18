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
            // 关闭中间标签时优先激活右侧标签（与主流浏览器一致），无右侧则激活左侧
            const nextIndex = Math.min(index, this.openedTabs.length - 1)
            this.activeTabId = this.openedTabs[nextIndex].id
          } else {
            this.addFridayTab()
          }
        }
      }
    },
    closeOtherTabs(id) {
      const tab = this.openedTabs.find(t => t.id === id)
      if (!tab) return

      this.openedTabs = [tab]
      this.activeTabId = id
    },
    closeAllTabs() {
      this.openedTabs = []
      this.activeTabId = ''
      return this.addFridayTab()
    },
    moveTab(id, direction) {
      const index = this.openedTabs.findIndex(t => t.id === id)
      const targetIndex = index + direction
      if (index === -1 || targetIndex < 0 || targetIndex >= this.openedTabs.length) {
        return false
      }

      const [tab] = this.openedTabs.splice(index, 1)
      this.openedTabs.splice(targetIndex, 0, tab)
      return true
    },
    // 拖拽排序：将 tab 移动到原数组语义的 toIndex 位置（插入到原 toIndex 项之前）
    reorderTab(id, toIndex) {
      const from = this.openedTabs.findIndex(t => t.id === id)
      // toIndex 允许等于 length（拖到最后）；from === toIndex 或 toIndex - 1 为原位不动
      if (from === -1 || toIndex < 0 || toIndex > this.openedTabs.length || from === toIndex || from === toIndex - 1) {
        return false
      }

      const [tab] = this.openedTabs.splice(from, 1)
      // 从左侧拖到右侧时，移除自身后目标项左移一位，需回退一格
      const insertAt = from < toIndex ? toIndex - 1 : toIndex
      this.openedTabs.splice(insertAt, 0, tab)
      return true
    },
    // 会话恢复：整体替换标签列表与激活项（不做存在性校验，校验由恢复逻辑负责）
    restoreTabs(tabs, activeTabId, fridayCounter) {
      this.openedTabs = Array.isArray(tabs) ? tabs : []
      this.activeTabId = activeTabId || (this.openedTabs.length > 0 ? this.openedTabs[this.openedTabs.length - 1].id : '')
      this.fridayCounter = fridayCounter || 0
    },
    setActiveTab(id) {
      this.activeTabId = id
    },
    updateTabFullPath(id, fullPath) {
      const tab = this.openedTabs.find(t => t.id === id)
      if (tab) {
        tab.fullPath = fullPath
      }
    },
    updateTabTitle(id, title) {
      const tab = this.openedTabs.find(t => t.id === id)
      if (tab) {
        tab.title = title
      }
    },
    // Office 编辑器 Tab 当前文件路径（用于视图丢失后按原文件恢复）
    updateTabFilePath(id, filePath) {
      const tab = this.openedTabs.find(t => t.id === id)
      if (tab) {
        tab.officeFilePath = filePath
      }
    },
    // 会话恢复时批量更新标签字段（如 Office 标签重开后 id/fullPath 变化）
    updateTab(id, patch) {
      const tab = this.openedTabs.find(t => t.id === id)
      if (tab) Object.assign(tab, patch)
    }
  }
})
