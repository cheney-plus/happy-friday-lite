import { defineStore } from 'pinia'
import { uid } from '@/views/drawing/shapes/id.js'
import {
  createFlowchartTemplate,
  createKanbanTemplate,
  createMindMapTemplate
} from '@/views/drawing/shapes/templates.js'

const STORAGE_KEY = 'hfl-drawing-canvases-v1'

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
    return parsed
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
          selectedCanvasId: this.selectedCanvasId
        })
      )
    },

    selectCanvas(id) {
      if (!this.canvases.some((item) => item.id === id)) return
      this.selectedCanvasId = id
      this.persist()
    },

    createCanvas(kind = 'blank', title = '') {
      const canvas = createCanvasRecord({ kind, title })
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
        graphJSON
      })
      this.canvases.unshift(canvas)
      this.selectedCanvasId = canvas.id
      this.persist()
      return canvas
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
