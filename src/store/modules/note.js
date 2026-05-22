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
    _pendingSave: null
  }),

  getters: {
    currentNote(state) {
      return state.notes.find(n => n.id === state.currentNoteId)
    }
  },

  actions: {
    async fetchNotes(knowledgeBaseId) {
      this.loading = true
      try {
        const notes = await electronService.invoke('get_notes', {
          knowledgeBaseId: knowledgeBaseId ?? null
        })
        this.notes = notes || []
      } finally {
        this.loading = false
      }
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

    async createNote(knowledgeBaseId, title) {
      const note = await electronService.invoke('create_note', {
        knowledgeBaseId: knowledgeBaseId ?? null,
        title: title ?? null
      })
      if (!note) {
        return null
      }
      this.notes.unshift(note)
      this.currentNoteId = note.id
      return note
    },

    async deleteNote(noteId) {
      await electronService.invoke('delete_note', { noteId })
      this.notes = this.notes.filter(n => n.id !== noteId)
      if (this.currentNoteId === noteId) {
        this.currentNoteId = this.notes.length > 0 ? this.notes[0].id : null
      }
    },

    async searchNotes(query) {
      this.loading = true
      try {
        const notes = await electronService.invoke('search_notes', { query })
        this.notes = notes || []
      } finally {
        this.loading = false
      }
    },

    selectNote(noteId) {
      this.currentNoteId = noteId
    },

    scheduleSave(noteId, title, content, contentText) {
      this._pendingSave = { noteId, title, content, contentText }

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
        await electronService.invoke('update_note', {
          noteId: pending.noteId,
          title: pending.title,
          content: pending.content,
          contentText: pending.contentText
        })

        const note = this.notes.find(n => n.id === pending.noteId)
        if (note) {
          note.title = pending.title
          note.content = pending.content
          note.contentText = pending.contentText
          note.updatedAt = new Date().toISOString()
        }
      } finally {
        this.saving = false
      }
    }
  }
})
