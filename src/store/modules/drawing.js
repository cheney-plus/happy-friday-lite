import { defineStore } from 'pinia'
import { electronService } from '@/services/electron'
import { uid } from '@/views/drawing/shapes/id.js'
import {
  createArchitectureTemplate,
  createErTemplate,
  createFlowchartTemplate,
  createKanbanTemplate,
  createMindMapTemplate
} from '@/views/drawing/shapes/templates.js'

// 旧版浏览器缓存 key：仅用于向 SQLite 迁移历史数据，以及非 Electron 环境回退
const STORAGE_KEY = 'hfl-drawing-canvases-v2'

function canvasTitleKey(kind) {
  if (kind === 'mindmap') return 'mindMap'
  if (kind === 'flowchart') return 'flowchart'
  if (kind === 'er') return 'er'
  if (kind === 'architecture') return 'architecture'
  if (kind === 'kanban') return 'kanban'
  return 'blankCanvas'
}

function templateForKind(kind) {
  if (kind === 'mindmap') return createMindMapTemplate()
  if (kind === 'flowchart') return createFlowchartTemplate()
  if (kind === 'er') return createErTemplate()
  if (kind === 'architecture') return createArchitectureTemplate()
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
    createdAt: partial.createdAt || partial.updatedAt || Date.now(),
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
    createCanvasRecord({ id: 'er', kind: 'er', titleKey: 'er', updatedAt: now - 2 * 864e5 }),
    createCanvasRecord({ id: 'architecture', kind: 'architecture', titleKey: 'architecture', updatedAt: now - 3 * 864e5 }),
    createCanvasRecord({ id: 'blank', kind: 'blank', titleKey: 'blankCanvas', updatedAt: now - 9e7, graphJSON: { cells: [] } })
  ]
}

function addMissingDefaultTemplates(canvases) {
  const existingIds = new Set(canvases.map((canvas) => canvas.id))
  const now = Date.now()
  const defaults = [
    { id: 'flowchart', kind: 'flowchart', titleKey: 'flowchart', updatedAt: now - 864e5 },
    { id: 'er', kind: 'er', titleKey: 'er', updatedAt: now - 2 * 864e5 },
    { id: 'architecture', kind: 'architecture', titleKey: 'architecture', updatedAt: now - 3 * 864e5 }
  ]
  return [
    ...canvases,
    ...defaults.filter((item) => !existingIds.has(item.id)).map(createCanvasRecord)
  ]
}

function loadLocalState() {
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
      canvases: addMissingDefaultTemplates(parsed.canvases.map((canvas) => createCanvasRecord({
        ...canvas,
        categoryId: categoryIds.has(canvas.categoryId) ? canvas.categoryId : null
      })))
    }
  } catch {
    return null
  }
}

export const useDrawingStore = defineStore('drawing', {
  state: () => ({
    canvases: [],
    categories: [],
    selectedCanvasId: null,
    initialized: false
  }),

  getters: {
    currentCanvas(state) {
      return state.canvases.find((item) => item.id === state.selectedCanvasId) || null
    }
  },

  actions: {
    // 从 SQLite 加载画布数据；空库时迁移 localStorage 旧数据或播种默认画布。
    // 非 Electron 环境（浏览器开发）保持原有 localStorage 行为。
    async initialize() {
      if (this.initialized) return
      this.initialized = true

      if (!electronService.isElectron) {
        const saved = loadLocalState()
        const canvases = saved?.canvases || defaultCanvases()
        this.canvases = canvases
        this.categories = saved?.categories || []
        this.selectedCanvasId = saved?.selectedCanvasId && canvases.some((item) => item.id === saved.selectedCanvasId)
          ? saved.selectedCanvasId
          : canvases[0].id
        return
      }

      const state = await electronService.invoke('get_drawing_state')
      const dbCanvases = (state?.canvases || []).map((canvas) => createCanvasRecord(canvas))
      const dbCategories = state?.categories || []

      if (dbCanvases.length || dbCategories.length) {
        const canvases = addMissingDefaultTemplates(dbCanvases)
        this.canvases = canvases
        this.categories = dbCategories
        this.selectedCanvasId = state?.selectedCanvasId && canvases.some((item) => item.id === state.selectedCanvasId)
          ? state.selectedCanvasId
          : canvases[0].id
        await this.syncAll()
        return
      }

      // 空库：优先迁移 localStorage 中的旧数据，否则播种默认模板画布
      const saved = loadLocalState()
      if (saved?.canvases?.length) {
        this.canvases = saved.canvases
        this.categories = saved.categories
        this.selectedCanvasId = saved.selectedCanvasId && saved.canvases.some((item) => item.id === saved.selectedCanvasId)
          ? saved.selectedCanvasId
          : saved.canvases[0].id
      } else {
        this.canvases = defaultCanvases()
        this.selectedCanvasId = this.canvases[0].id
      }
      await this.syncAll()
      if (saved?.canvases?.length) {
        localStorage.removeItem(STORAGE_KEY)
      }
    },

    // 全量同步到 SQLite（首次初始化用）
    async syncAll() {
      if (!electronService.isElectron) return
      await Promise.all([
        ...this.categories.map((category) => electronService.invoke('save_drawing_category', category)),
        ...this.canvases.map((canvas) => electronService.invoke('save_drawing_canvas', canvas)),
        electronService.invoke('save_drawing_selected_canvas', { canvasId: this.selectedCanvasId })
      ])
    },

    // 非 Electron 环境的浏览器缓存回退
    persist() {
      if (electronService.isElectron) return
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          canvases: this.canvases,
          categories: this.categories,
          selectedCanvasId: this.selectedCanvasId
        })
      )
    },

    persistCanvas(id) {
      const canvas = this.canvases.find((item) => item.id === id)
      if (!canvas) return
      if (electronService.isElectron) {
        electronService.invoke('save_drawing_canvas', canvas)
      }
      this.persist()
    },

    selectCanvas(id) {
      if (!this.canvases.some((item) => item.id === id)) return
      this.selectedCanvasId = id
      if (electronService.isElectron) {
        electronService.invoke('save_drawing_selected_canvas', { canvasId: id })
      }
      this.persist()
    },

    createCanvas(kind = 'blank', title = '', categoryId = null) {
      const canvas = createCanvasRecord({ kind, title, categoryId })
      this.canvases.unshift(canvas)
      this.selectedCanvasId = canvas.id
      this.persistCanvas(canvas.id)
      if (electronService.isElectron) {
        electronService.invoke('save_drawing_selected_canvas', { canvasId: canvas.id })
      }
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
      this.persistCanvas(canvas.id)
      if (electronService.isElectron) {
        electronService.invoke('save_drawing_selected_canvas', { canvasId: canvas.id })
      }
      return canvas
    },

    createCategory(name) {
      const trimmed = String(name || '').trim()
      if (!trimmed) return null
      const category = { id: uid('category'), name: trimmed, createdAt: Date.now() }
      this.categories.unshift(category)
      if (electronService.isElectron) {
        electronService.invoke('save_drawing_category', category)
      }
      this.persist()
      return category
    },

    renameCategory(id, name) {
      const category = this.categories.find((item) => item.id === id)
      const trimmed = String(name || '').trim()
      if (!category || !trimmed) return
      category.name = trimmed
      if (electronService.isElectron) {
        electronService.invoke('save_drawing_category', category)
      }
      this.persist()
    },

    deleteCategory(id) {
      if (!this.categories.some((item) => item.id === id)) return
      this.canvases.forEach((canvas) => {
        if (canvas.categoryId === id) {
          canvas.categoryId = null
          this.persistCanvas(canvas.id)
        }
      })
      this.categories = this.categories.filter((item) => item.id !== id)
      if (electronService.isElectron) {
        electronService.invoke('delete_drawing_category', { categoryId: id })
      }
      this.persist()
    },

    moveCanvas(id, categoryId = null) {
      const canvas = this.canvases.find((item) => item.id === id)
      if (!canvas) return
      if (categoryId && !this.categories.some((item) => item.id === categoryId)) return
      canvas.categoryId = categoryId || null
      this.persistCanvas(canvas.id)
    },

    renameCanvas(id, title) {
      const canvas = this.canvases.find((item) => item.id === id)
      if (!canvas) return
      canvas.title = title
      canvas.titleKey = title ? '' : canvas.titleKey
      canvas.updatedAt = Date.now()
      this.persistCanvas(canvas.id)
    },

    deleteCanvas(id) {
      if (this.canvases.length <= 1) return
      this.canvases = this.canvases.filter((item) => item.id !== id)
      if (this.selectedCanvasId === id) {
        this.selectedCanvasId = this.canvases[0].id
        if (electronService.isElectron) {
          electronService.invoke('save_drawing_selected_canvas', { canvasId: this.selectedCanvasId })
        }
      }
      if (electronService.isElectron) {
        electronService.invoke('delete_drawing_canvas', { canvasId: id })
      }
      this.persist()
    },

    saveGraph(id, graphJSON) {
      const canvas = this.canvases.find((item) => item.id === id)
      if (!canvas) return
      canvas.graphJSON = graphJSON
      canvas.updatedAt = Date.now()
      this.persistCanvas(canvas.id)
    }
  }
})
