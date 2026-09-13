import { defineStore } from 'pinia'
import { uid } from '@/views/drawing/shapes/id.js'
import {
  createFlowchartTemplate,
  createKanbanTemplate,
  createMindMapTemplate
} from '@/views/drawing/shapes/templates.js'

const STORAGE_KEY = 'hfl-drawing-canvases-v2'

function canvasTitleKey(kind) {
  if (kind === 'mindmap') return 'mindMap'
  if (kind === 'flowchart') return 'flowchart'
  if (kind === 'kanban') return 'kanban'
  return 'blankCanvas'
}

function templateForKind(kind) {
  if (kind === 'mindmap') return createMindMapTemplate()
  if (kind === 'flowchart') return createFlowchartTemplate()
  if (kind === 'kanban') return createKanbanTemplate()
  return { cells: [] }
}

function createCanvasRecord(partial = {}) {
  const kind = partial.kind || 'blank'
  return {
    id: partial.id || uid('canvas'),
    title: partial.title || '',
    titleKey: partial.titleKey || (partial.title ? '' : canvasTitleKey(kind)),
    kind,
    categoryId: partial.categoryId || null,
    updatedAt: partial.updatedAt || Date.now(),
    graphJSON: partial.graphJSON || templateForKind(kind)
  }
}

function defaultCanvases() {
  const now = Date.now()
  return [
    createCanvasRecord({ id: 'mindmap', kind: 'mindmap', titleKey: 'mindMap', updatedAt: now }),
    createCanvasRecord({ id: 'kanban', kind: 'kanban', titleKey: 'kanban', updatedAt: now - 36e5 }),
    createCanvasRecord({ id: 'flowchart', kind: 'flowchart', titleKey: 'flowchart', updatedAt: now - 864e5 }),
    createCanvasRecord({ id: 'blank', kind: 'blank', titleKey: 'blankCanvas', updatedAt: now - 9e7, graphJSON: { cells: [] } })
  ]
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.canvases) || !parsed.canvases.length) return null
    const categories = Array.isArray(parsed.categories)
      ? parsed.categories.filter((category) => category?.id && category?.name)
      : []
    const categoryIds = new Set(categories.map((category) => category.id))
    return {
      ...parsed,
      categories,
      canvases: parsed.canvases.map((canvas) => createCanvasRecord({
        ...canvas,
        categoryId: categoryIds.has(canvas.categoryId) ? canvas.categoryId : null
      }))
    }
  } catch {
    return null
  }
}

export const useDrawingStore = defineStore('drawing', {
  state: () => {
    const saved = loadState()
    const canvases = saved?.canvases || defaultCanvases()
    return {
      canvases,
      categories: saved?.categories || [],
      selectedCanvasId: saved?.selectedCanvasId && canvases.some((item) => item.id === saved.selectedCanvasId)
        ? saved.selectedCanvasId
        : canvases[0].id
    }
  },

  getters: {
    currentCanvas(state) {
      return state.canvases.find((item) => item.id === state.selectedCanvasId) || null
    }
  },

  actions: {
    persist() {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          canvases: this.canvases,
          categories: this.categories,
          selectedCanvasId: this.selectedCanvasId
        })
      )
    },

    selectCanvas(id) {
      if (!this.canvases.some((item) => item.id === id)) return
      this.selectedCanvasId = id
      this.persist()
    },

    createCanvas(kind = 'blank', title = '', categoryId = null) {
      const canvas = createCanvasRecord({ kind, title, categoryId })
      this.canvases.unshift(canvas)
      this.selectedCanvasId = canvas.id
      this.persist()
      return canvas
    },

    importCanvas(payload) {
      const source = payload?.graphJSON || payload || {}
      const graphJSON = source.cells
        ? source
        : { cells: [...(source.nodes || []), ...(source.edges || [])] }
      const canvas = createCanvasRecord({
        kind: payload?.kind || 'blank',
        title: payload?.title || '',
        titleKey: payload?.title ? '' : 'untitled',
        categoryId: payload?.categoryId || null,
        graphJSON
      })
      this.canvases.unshift(canvas)
      this.selectedCanvasId = canvas.id
      this.persist()
      return canvas
    },

    createCategory(name) {
      const trimmed = String(name || '').trim()
      if (!trimmed) return null
      const category = { id: uid('category'), name: trimmed, createdAt: Date.now() }
      this.categories.unshift(category)
      this.persist()
      return category
    },

    renameCategory(id, name) {
      const category = this.categories.find((item) => item.id === id)
      const trimmed = String(name || '').trim()
      if (!category || !trimmed) return
      category.name = trimmed
      this.persist()
    },

    deleteCategory(id) {
      if (!this.categories.some((item) => item.id === id)) return
      this.canvases.forEach((canvas) => {
        if (canvas.categoryId === id) canvas.categoryId = null
      })
      this.categories = this.categories.filter((item) => item.id !== id)
      this.persist()
    },

    moveCanvas(id, categoryId = null) {
      const canvas = this.canvases.find((item) => item.id === id)
      if (!canvas) return
      if (categoryId && !this.categories.some((item) => item.id === categoryId)) return
      canvas.categoryId = categoryId || null
      this.persist()
    },

    renameCanvas(id, title) {
      const canvas = this.canvases.find((item) => item.id === id)
      if (!canvas) return
      canvas.title = title
      canvas.titleKey = title ? '' : canvas.titleKey
      canvas.updatedAt = Date.now()
      this.persist()
    },

    deleteCanvas(id) {
      if (this.canvases.length <= 1) return
      this.canvases = this.canvases.filter((item) => item.id !== id)
      if (this.selectedCanvasId === id) this.selectedCanvasId = this.canvases[0].id
      this.persist()
    },

    saveGraph(id, graphJSON) {
      const canvas = this.canvases.find((item) => item.id === id)
      if (!canvas) return
      canvas.graphJSON = graphJSON
      canvas.updatedAt = Date.now()
      this.persist()
    }
  }
})
