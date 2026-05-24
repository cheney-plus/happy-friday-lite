import { defineStore } from 'pinia'
import { electronService } from '@/services/electron'

export const useNotebookStore = defineStore('notebook', {
  state: () => ({
    notebooks: [],
    loading: false
  }),

  actions: {
    async fetchNotebooks() {
      this.loading = true
      try {
        const notebooks = await electronService.invoke('get_notebooks')
        console.log('[NotebookStore] Fetched notebooks:', notebooks)
        this.notebooks = notebooks || []
        if (!notebooks) {
          console.warn('[NotebookStore] get_notebooks returned null/undefined')
        }
      } catch (error) {
        console.error('[NotebookStore] Failed to fetch notebooks:', error)
        this.notebooks = []
      } finally {
        this.loading = false
      }
    },

    async createNotebook(name, description) {
      console.log('[NotebookStore] Creating notebook:', { name, description })
      const notebook = await electronService.invoke('create_notebook', {
        name,
        description: description || ''
      })
      console.log('[NotebookStore] Created notebook:', notebook)
      if (notebook) {
        this.notebooks.unshift(notebook)
      } else {
        console.error('[NotebookStore] create_notebook returned null')
      }
      return notebook
    },

    async updateNotebook(notebookId, name, description) {
      const notebook = await electronService.invoke('update_notebook', {
        notebookId,
        name,
        description: description || ''
      })
      if (notebook) {
        const idx = this.notebooks.findIndex(n => n.id === notebookId)
        if (idx >= 0) {
          this.notebooks[idx] = notebook
        }
      }
      return notebook
    },

    async deleteNotebook(notebookId) {
      await electronService.invoke('delete_notebook', { notebookId })
      this.notebooks = this.notebooks.filter(n => n.id !== notebookId)
    }
  }
})