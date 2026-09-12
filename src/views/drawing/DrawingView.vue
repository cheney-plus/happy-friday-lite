<template>
  <div class="drawing-page" @click="closeMenus">
    <aside
      class="drawing-sidebar"
      :class="{ collapsed: sidebarCollapsed, 'is-resizing': isResizing }"
      :style="{ width: `${sidebarCollapsed ? 0 : sidebarWidth}px` }"
    >
      <div v-if="!searchMode" class="drawing-sidebar-topbar">
        <button class="topbar-button" type="button" :title="t('drawing.sidebar.collapse')" @click="toggleSidebar">
          <PanelLeftClose :size="18" :stroke-width="1.8" />
        </button>
        <div class="topbar-actions">
          <div class="new-canvas-button-group">
            <button class="new-canvas-main-button" type="button" :title="t('drawing.sidebar.newCanvas')" @click="createCanvas('blank')">
              <Plus :size="16" :stroke-width="2" />
            </button>
            <button class="new-canvas-dropdown-button" type="button" :title="t('drawing.sidebar.moreOptions')" @click.stop="newCanvasMenuVisible = !newCanvasMenuVisible">
              <ChevronDown :size="13" :stroke-width="2" />
            </button>
            <div v-if="newCanvasMenuVisible" class="new-canvas-dropdown-menu" @click.stop>
              <button type="button" class="dropdown-item" @click="createCanvas('blank')">
                <Plus :size="14" :stroke-width="2" />
                {{ t('drawing.sidebar.newCanvas') }}
              </button>
              <button type="button" class="dropdown-item" @click="createCanvas('mindmap')">
                <Share2 :size="14" :stroke-width="2" />
                {{ t('drawing.canvas.mindMap') }}
              </button>
              <button type="button" class="dropdown-item" @click="createCanvas('flowchart')">
                <Workflow :size="14" :stroke-width="2" />
                {{ t('drawing.canvas.flowchart') }}
              </button>
              <button type="button" class="dropdown-item" @click="triggerImport">
                <Upload :size="14" :stroke-width="2" />
                {{ t('drawing.sidebar.importCanvas') }}
              </button>
            </div>
          </div>
          <button class="topbar-button" type="button" :title="t('drawing.sidebar.search')" @click="enterSearchMode">
            <Search :size="18" :stroke-width="2" />
          </button>
        </div>
      </div>

      <div v-else class="sidebar-search">
        <Search :size="16" :stroke-width="2" />
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="search"
          :placeholder="t('drawing.sidebar.searchPlaceholder')"
          @keydown.escape="exitSearchMode"
          @blur="exitSearchMode"
        />
      </div>

      <div class="directory-heading">{{ t('drawing.sidebar.allCanvases') }}</div>
      <div class="canvas-list">
        <button
          v-for="canvas in filteredCanvases"
          :key="canvas.id"
          type="button"
          class="canvas-card"
          :class="{ active: drawingStore.selectedCanvasId === canvas.id }"
          @click="drawingStore.selectCanvas(canvas.id)"
          @contextmenu.prevent="openCardMenu($event, canvas)"
        >
          <div class="canvas-preview" :class="`preview-${canvas.kind}`">
            <CanvasThumbnail :graph-json="canvas.graphJSON" />
          </div>
          <span class="canvas-card-footer">
            <input
              v-if="renamingId === canvas.id"
              :value="canvasTitle(canvas)"
              class="rename-input"
              @click.stop
              @keydown.enter.prevent="commitRename($event, canvas)"
              @keydown.escape="renamingId = null"
              @blur="commitRename($event, canvas)"
            />
            <strong v-else>{{ canvasTitle(canvas) }}</strong>
            <small>{{ formatUpdated(canvas.updatedAt) }}</small>
          </span>
        </button>
      </div>
      <div class="resize-handle" @mousedown.prevent="startResizing"></div>
    </aside>

    <button v-if="sidebarCollapsed" class="sidebar-expand-button" type="button" :title="t('drawing.sidebar.expand')" @click="toggleSidebar">
      <PanelLeftOpen :size="18" :stroke-width="1.8" />
    </button>

    <main class="drawing-workspace" aria-label="Drawing workspace">
      <DrawingEditor
        v-if="drawingStore.currentCanvas"
        :key="drawingStore.currentCanvas.id"
        :canvas="drawingStore.currentCanvas"
        @change="onGraphChange"
        @library-change="onLibraryChange"
      />
    </main>

    <div v-if="cardMenu.visible" class="card-menu" :style="{ left: `${cardMenu.x}px`, top: `${cardMenu.y}px` }" @click.stop>
      <button type="button" @click="startRename(cardMenu.canvas)">{{ t('drawing.sidebar.rename') }}</button>
      <button type="button" class="danger" @click="removeCanvas(cardMenu.canvas)">{{ t('drawing.sidebar.deleteCanvas') }}</button>
    </div>
    <input ref="importInputRef" class="hidden-input" type="file" accept="application/json,.json" @change="onImportFile" />
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Share2,
  Upload,
  Workflow
} from 'lucide-vue-next'
import { useDrawingStore } from '@/store'
import DrawingEditor from './components/DrawingEditor.vue'
import CanvasThumbnail from './components/CanvasThumbnail.vue'

const { t } = useI18n()
const drawingStore = useDrawingStore()
const SIDEBAR_MIN_WIDTH = 220
const SIDEBAR_MAX_WIDTH = 340
const SIDEBAR_DEFAULT_WIDTH = 272
const sidebarWidth = ref(SIDEBAR_DEFAULT_WIDTH)
const sidebarCollapsed = ref(false)
const isResizing = ref(false)
const searchMode = ref(false)
const searchQuery = ref('')
const searchInputRef = ref(null)
const importInputRef = ref(null)
const newCanvasMenuVisible = ref(false)
const renamingId = ref(null)
const cardMenu = reactive({ visible: false, x: 0, y: 0, canvas: null })

const canvasTitle = (canvas) => canvas.title || t(`drawing.canvas.${canvas.titleKey || 'untitled'}`)

const formatUpdated = (ts) => {
  const date = new Date(ts)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return t('drawing.canvas.updatedToday')
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return t('drawing.canvas.updatedYesterday')
  return date.toLocaleDateString()
}

const filteredCanvases = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  if (!query) return drawingStore.canvases
  return drawingStore.canvases.filter((canvas) => canvasTitle(canvas).toLocaleLowerCase().includes(query))
})

const closeMenus = () => {
  newCanvasMenuVisible.value = false
  cardMenu.visible = false
}

const collapsedByLibrary = ref(false)

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
  collapsedByLibrary.value = false
  closeMenus()
}

const onLibraryChange = (open) => {
  if (open) {
    if (!sidebarCollapsed.value) {
      sidebarCollapsed.value = true
      collapsedByLibrary.value = true
    }
    return
  }
  if (collapsedByLibrary.value) {
    sidebarCollapsed.value = false
    collapsedByLibrary.value = false
  }
}

const enterSearchMode = () => {
  searchMode.value = true
  closeMenus()
  nextTick(() => searchInputRef.value?.focus())
}

const exitSearchMode = () => {
  searchMode.value = false
  searchQuery.value = ''
}

const createCanvas = (kind) => {
  drawingStore.createCanvas(kind)
  closeMenus()
}

const triggerImport = () => {
  closeMenus()
  importInputRef.value?.click()
}

const onImportFile = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    const payload = JSON.parse(await file.text())
    drawingStore.importCanvas({
      title: payload.title || file.name.replace(/\.json$/i, ''),
      graphJSON: payload.graphJSON || payload
    })
  } catch {
    // ignore invalid json
  }
}

const openCardMenu = (event, canvas) => {
  cardMenu.visible = true
  cardMenu.x = event.clientX
  cardMenu.y = event.clientY
  cardMenu.canvas = canvas
}

const startRename = (canvas) => {
  renamingId.value = canvas.id
  cardMenu.visible = false
}

const commitRename = (event, canvas) => {
  const title = event.target.value.trim()
  if (title) drawingStore.renameCanvas(canvas.id, title)
  renamingId.value = null
}

const removeCanvas = (canvas) => {
  drawingStore.deleteCanvas(canvas.id)
  cardMenu.visible = false
}

const onGraphChange = ({ id, graphJSON }) => {
  if (id && graphJSON) drawingStore.saveGraph(id, graphJSON)
}

let initialPointerX = 0
let initialWidth = 0

const resizeSidebar = (event) => {
  sidebarWidth.value = Math.min(
    SIDEBAR_MAX_WIDTH,
    Math.max(SIDEBAR_MIN_WIDTH, initialWidth + event.clientX - initialPointerX)
  )
}

const stopResizing = () => {
  isResizing.value = false
  window.removeEventListener('mousemove', resizeSidebar)
  window.removeEventListener('mouseup', stopResizing)
}

const startResizing = (event) => {
  isResizing.value = true
  initialPointerX = event.clientX
  initialWidth = sidebarWidth.value
  window.addEventListener('mousemove', resizeSidebar)
  window.addEventListener('mouseup', stopResizing)
}

onUnmounted(stopResizing)
</script>

<style scoped>
.drawing-page { position: relative; display: flex; height: 100%; min-height: 0; color: var(--text-primary); background: var(--bg-primary); overflow: hidden; }
.drawing-sidebar { position: relative; display: flex; flex: 0 0 auto; flex-direction: column; min-width: 0; overflow: hidden; border-right: 1px solid var(--border-color); background: var(--bg-primary); transition: width .2s ease; }
.drawing-sidebar.is-resizing { transition: none; }
.drawing-sidebar.collapsed { border-right-color: transparent; }
.drawing-sidebar-topbar { display: flex; align-items: center; justify-content: space-between; height: 56px; padding: 0 12px; box-sizing: border-box; }
.topbar-button { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 8px; color: var(--text-primary); background: transparent; cursor: pointer; }
.topbar-button:hover { background: var(--bg-hover); }
.topbar-actions, .new-canvas-button-group { display: flex; align-items: center; }
.topbar-actions { gap: 4px; }
.new-canvas-button-group { position: relative; }
.new-canvas-main-button, .new-canvas-dropdown-button { display: inline-flex; align-items: center; justify-content: center; height: 32px; padding: 0; border: 0; color: var(--text-primary); background: transparent; cursor: pointer; }
.new-canvas-main-button { width: 32px; border-radius: 8px 0 0 8px; }
.new-canvas-dropdown-button { width: 20px; border-radius: 0 8px 8px 0; }
.new-canvas-main-button:hover, .new-canvas-dropdown-button:hover { background: var(--bg-hover); }
.new-canvas-dropdown-menu { position: absolute; z-index: 40; top: 36px; right: 0; min-width: 148px; padding: 4px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); box-shadow: 0 4px 16px rgba(0, 0, 0, .12); }
.dropdown-item { display: flex; align-items: center; width: 100%; gap: 8px; padding: 7px 8px; border: 0; border-radius: 5px; color: var(--text-primary); background: transparent; font-size: 12px; text-align: left; cursor: pointer; }
.dropdown-item:hover { background: var(--bg-hover); }
.sidebar-search { display: flex; align-items: center; gap: 6px; height: 56px; padding: 12px; box-sizing: border-box; color: var(--text-tertiary); }
.sidebar-search input { flex: 1; min-width: 0; height: 32px; padding: 0; border: 0; outline: 0; color: var(--text-primary); background: transparent; font-size: 14px; }
.directory-heading { padding: 0 16px 10px; color: var(--text-secondary); font-size: 12px; font-weight: 600; }
.canvas-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; justify-content: start; padding: 0 14px 16px; overflow-y: auto; }
.canvas-card { display: flex; flex-direction: column; min-width: 0; aspect-ratio: .9; padding: 0; overflow: hidden; border: 1px solid var(--border-color); border-radius: 6px; color: inherit; background: var(--bg-primary); text-align: left; cursor: pointer; }
.canvas-card:hover { border-color: #a8a29e; }
.canvas-card.active, .canvas-card.active:hover { border-color: #1c1917; box-shadow: none; }
.canvas-preview { position: relative; display: flex; flex: 1; align-items: center; justify-content: center; min-height: 0; overflow: hidden; color: var(--text-tertiary); border-bottom: 1px solid var(--border-color); background-color: color-mix(in srgb, var(--bg-secondary) 72%, transparent); }
.canvas-card-footer { display: flex; flex-direction: column; gap: 3px; padding: 9px; flex-shrink: 0; }
.canvas-card-footer strong { overflow: hidden; font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.canvas-card-footer small { color: var(--text-tertiary); font-size: 10px; }
.rename-input { width: 100%; height: 18px; padding: 0; border: 0; outline: 0; color: var(--text-primary); background: transparent; font-size: 12px; font-weight: 600; }
.mindmap-preview { position: relative; width: 76px; height: 48px; }
.mindmap-preview b, .mindmap-preview i { position: absolute; display: block; border: 1px solid var(--text-tertiary); border-radius: 2px; opacity: .65; }
.mindmap-preview b { top: 17px; left: 27px; width: 21px; height: 13px; }
.mindmap-preview i:nth-child(1) { top: 1px; right: 0; width: 18px; height: 11px; }
.mindmap-preview i:nth-child(2) { top: 19px; right: 0; width: 18px; height: 11px; }
.mindmap-preview i:nth-child(3) { bottom: 1px; right: 0; width: 18px; height: 11px; }
.kanban-preview { display: flex; gap: 5px; align-items: flex-start; width: 74px; height: 52px; padding: 5px; border: 1px dashed var(--border-color); }
.kanban-preview i { flex: 1; height: 40px; border-radius: 2px; background: var(--border-color); opacity: .65; }
.flowchart-preview { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.flowchart-preview i { display: block; width: 29px; height: 10px; border: 1px solid var(--text-tertiary); border-radius: 2px; opacity: .65; }
.resize-handle { position: absolute; z-index: 3; top: 0; right: -3px; bottom: 0; width: 6px; cursor: col-resize; }
.resize-handle:hover { background: var(--accent-color); opacity: .45; }
.sidebar-expand-button { position: absolute; z-index: 30; top: 12px; left: 12px; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 8px; color: var(--text-primary); background: transparent; cursor: pointer; }
.sidebar-expand-button:hover { background: var(--bg-hover); }
.drawing-workspace { position: relative; flex: 1; min-width: 0; overflow: hidden; background: var(--bg-primary); }
.card-menu {
  position: fixed;
  z-index: 50;
  min-width: 120px;
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  box-shadow: 0 8px 20px rgba(0, 0, 0, .12);
}
.card-menu button {
  display: block;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: 5px;
  color: var(--text-primary);
  background: transparent;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.card-menu button:hover { background: var(--bg-hover); }
.card-menu .danger { color: #e11d48; }
.hidden-input { display: none; }
@media (max-width: 760px) { .drawing-sidebar { width: min(272px, 72vw) !important; } .canvas-list { grid-template-columns: 1fr; } }
</style>
