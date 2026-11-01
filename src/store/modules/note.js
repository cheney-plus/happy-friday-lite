import { defineStore } from 'pinia'
import { electronService } from '@/services/electron'

const DEBOUNCE_MS = 800

export const useNoteStore = defineStore('note', {
  state: () => ({
    notes: [],
    currentNoteId: null,
    loading: false,
    saving: false,
    _saveTimer: null,
    _pendingSave: null,
    _selectToken: null
  }),

  getters: {
    currentNote(state) {
      return state.notes.find(n => n.id === state.currentNoteId)
    }
  },

  actions: {
    async fetchNotes(knowledgeBaseId, notebookId) {
      this.loading = true
      try {
        const notes = await electronService.invoke('get_notes', {
          knowledgeBaseId: knowledgeBaseId ?? null,
          notebookId: notebookId ?? null
        })
        this.notes = this._mergeWithCurrentContent(notes || [])
      } finally {
        this.loading = false
      }
    },

    // 列表接口只返回摘要（不含正文），刷新时保留当前打开笔记的正文，
    // 避免编辑器被空内容覆盖后把空内容写回数据库
    _mergeWithCurrentContent(incoming) {
      const current = this.notes.find(n => n.id === this.currentNoteId)
      if (!current || current.content === undefined) return incoming
      return incoming.map(n => {
        if (n.id !== current.id || n.content !== undefined) return n
        return { ...n, content: current.content, marpContent: current.marpContent }
      })
    },

    async fetchNote(noteId) {
      const note = await electronService.invoke('get_note', { noteId })
      if (note) {
        const idx = this.notes.findIndex(n => n.id === noteId)
        if (idx >= 0) {
          this.notes[idx] = note
        } else {
          this.notes.unshift(note)
        }
      }
      return note
    },

    async createNote(knowledgeBaseId, title, notebookId) {
      const note = await electronService.invoke('create_note', {
        knowledgeBaseId: knowledgeBaseId ?? null,
        notebookId: notebookId ?? null,
        title: title ?? null
      })
      if (!note) {
        return null
      }
      this.notes.unshift(note)
      this.currentNoteId = note.id
      return note
    },

    async importNote(knowledgeBaseId, notebookId, title, content, contentText) {
      const note = await electronService.invoke('import_note', {
        knowledgeBaseId: knowledgeBaseId ?? null,
        notebookId: notebookId ?? null,
        title: title ?? null,
        content: content ?? '',
        contentText: contentText ?? ''
      })
      if (!note) {
        return null
      }
      this.notes.unshift(note)
      return note
    },

    async deleteNote(noteId) {
      await electronService.invoke('delete_note', { noteId })
      this.notes = this.notes.filter(n => n.id !== noteId)
      if (this.currentNoteId === noteId) {
        this.currentNoteId = null
        if (this.notes.length > 0) {
          await this.selectNote(this.notes[0].id)
        }
      }
    },

    async searchNotes(query) {
      this.loading = true
      try {
        const notes = await electronService.invoke('search_notes', { query })
        this.notes = this._mergeWithCurrentContent(notes || [])
      } finally {
        this.loading = false
      }
    },

    // 列表项是摘要，切换时若缺正文则拉取完整笔记后再切换，避免编辑器先被清空
    async selectNote(noteId) {
      this._selectToken = noteId
      const note = this.notes.find(n => n.id === noteId)
      if (note && note.content === undefined) {
        await this.fetchNote(noteId)
        // 加载期间用户又切换了笔记，放弃本次切换
        if (this._selectToken !== noteId) return
      }
      this.currentNoteId = noteId
    },

    scheduleSave(noteId, title, content, contentText, marpContent) {
      this._pendingSave = { noteId, title, content, contentText, marpContent }

      if (this._saveTimer) {
        clearTimeout(this._saveTimer)
      }

      this._saveTimer = setTimeout(() => {
        this._flushSave()
      }, DEBOUNCE_MS)
    },

    async flushPendingSave() {
      if (this._saveTimer) {
        clearTimeout(this._saveTimer)
        this._saveTimer = null
      }
      if (this._pendingSave) {
        await this._flushSave()
      }
    },

    async _flushSave() {
      this._saveTimer = null
      const pending = this._pendingSave
      if (!pending) return

      this._pendingSave = null
      this.saving = true
      try {
        const note = this.notes.find(n => n.id === pending.noteId)
        const notebookId = note?.notebookId ?? null

        await electronService.invoke('update_note', {
          noteId: pending.noteId,
          title: pending.title,
          content: pending.content,
          contentText: pending.contentText,
          notebookId,
          ...(pending.marpContent !== undefined ? { marpContent: pending.marpContent } : {})
        })

        if (note) {
          note.title = pending.title
          note.content = pending.content
          note.contentText = pending.contentText
          if (pending.marpContent !== undefined) {
            note.marpContent = pending.marpContent
          }
          note.updatedAt = new Date().toISOString()
        }
      } finally {
        this.saving = false
      }
    }
  }
})
