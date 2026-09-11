<template>
  <div class="drawing-editor">
    <div ref="containerRef" class="graph-container" :class="{ 'is-pan': mode === 'pan' }"></div>
    <div v-if="isEmpty" class="empty-hint">{{ t('drawing.canvas.emptyHint') }}</div>

    <EditorToolbar
      :mode="mode"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :zoom-label="zoomLabel"
      :grid-visible="gridVisible"
      @set-mode="setMode"
      @undo="graph?.undo()"
      @redo="graph?.redo()"
      @delete="deleteSelection"
      @zoom-in="graph?.zoom(0.12)"
      @zoom-out="graph?.zoom(-0.12)"
      @zoom-reset="graph?.zoomTo(1)"
      @fit="fitContent"
      @toggle-grid="toggleGrid"
      @export="exportCanvas"
    />

    <ShapePalette
      :edge-style-id="edgeStyleId"
      @add-node="addNodeAtCenter"
      @drag-node="onDragNode"
      @set-edge="onSetEdge"
      @action="onAnimationAction"
      @insert-template="onInsertTemplate"
    />

    <PropertyPanel
      v-bind="propState"
      @update="updateSelection"
    />

    <DrawingContextMenu
      :visible="menu.visible"
      :x="menu.x"
      :y="menu.y"
      @action="onMenuAction"
    />

    <div ref="minimapRef" class="minimap"></div>
    <input ref="imageInputRef" class="hidden-input" type="file" accept="image/*" @change="onImagePicked" />
  </div>
</template>

<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/utils/theme'
import { applyCellAnimation } from '../shapes/animation.js'
import { getCanvasTheme } from '../shapes/theme.js'
import {
  addCatalogNode,
  applyAnimationToSelection,
  applyGraphTheme,
  connectSelected,
  createDrawingGraph,
  downloadFile,
  getViewportCenter,
  insertTemplate,
  loadGraphData,
  setInteractionMode,
  setPendingEdgeStyle,
  startCatalogDrag
} from '../composables/useGraphEditor.js'
import DrawingContextMenu from './DrawingContextMenu.vue'
import EditorToolbar from './EditorToolbar.vue'
import PropertyPanel from './PropertyPanel.vue'
import ShapePalette from './ShapePalette.vue'

const props = defineProps({
  canvas: { type: Object, required: true }
})

const emit = defineEmits(['change'])
const { t } = useI18n()
const { appliedTheme } = useTheme()

function toColorInput(value, fallback) {
  if (typeof value === 'string' && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value)) {
    if (value.length === 4) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
    }
    return value
  }
  return fallback
}

function itemLabel(item) {
  return t(`drawing.shapes.${item.id}`)
}

const containerRef = ref(null)
const minimapRef = ref(null)
const imageInputRef = ref(null)
const graph = ref(null)
let dnd = null
let saveTimer = null
let skipSave = false
let lastDropAt = 0
let pendingImageItem = null

const mode = ref('select')
const edgeStyleId = ref('manhattan')
const canUndo = ref(false)
const canRedo = ref(false)
const zoomLabel = ref('100%')
const gridVisible = ref(true)
const isEmpty = ref(true)
const cellCount = ref(0)
const menu = reactive({ visible: false, x: 0, y: 0 })
const graphState = { mode: 'select', edgeStyleId: 'manhattan' }
const propState = reactive({
  hasSelection: false,
  isNode: false,
  isEdge: false,
  label: '',
  fill: '#ffffff',
  stroke: '#94a3b8',
  strokeWidth: 1.5,
  fontSize: 13,
  router: 'manhattan',
  connector: 'rounded',
  animation: 'none'
})

const canvasName = computed(() => props.canvas.title || t(`drawing.canvas.${props.canvas.titleKey || 'untitled'}`))

const syncHistory = () => {
  if (!graph.value) return
  canUndo.value = graph.value.canUndo()
  canRedo.value = graph.value.canRedo()
  zoomLabel.value = `${Math.round(graph.value.zoom() * 100)}%`
  cellCount.value = graph.value.getCellCount()
  isEmpty.value = cellCount.value === 0
}

const scheduleSave = () => {
  if (skipSave || !graph.value) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    emit('change', { id: props.canvas.id, graphJSON: graph.value.toJSON() })
  }, 400)
}

const refreshProps = () => {
  const cells = graph.value?.getSelectedCells() || []
  const cell = cells[0]
  propState.hasSelection = cells.length > 0
  if (!cell) return
  propState.isNode = cell.isNode()
  propState.isEdge = cell.isEdge()
  propState.label = cell.isNode() ? cell.attr('label/text') || cell.attr('text/text') || '' : ''
  propState.fill = toColorInput(cell.attr('body/fill'), '#ffffff')
  propState.stroke = toColorInput(
    cell.isEdge() ? cell.attr('line/stroke') : cell.attr('body/stroke'),
    cell.isEdge() ? '#64748b' : '#94a3b8'
  )
  propState.strokeWidth = Number(cell.isEdge() ? cell.attr('line/strokeWidth') : cell.attr('body/strokeWidth')) || 1.5
  propState.fontSize = Number(cell.attr('label/fontSize')) || 13
  const router = cell.getRouter?.()
  const connector = cell.getConnector?.()
  propState.router = typeof router === 'string' ? router : router?.name || 'manhattan'
  propState.connector = typeof connector === 'string' ? connector : connector?.name || 'rounded'
  propState.animation = cell.getData()?.animation || 'none'
}

const loadCanvas = () => {
  if (!graph.value) return
  skipSave = true
  loadGraphData(graph.value, props.canvas.graphJSON || { cells: [] })
  skipSave = false
  syncHistory()
  refreshProps()
}

const setMode = (next) => {
  mode.value = next
  graphState.mode = next
  if (graph.value) setInteractionMode(graph.value, next)
}

const toggleGrid = () => {
  gridVisible.value = !gridVisible.value
  if (gridVisible.value) graph.value?.showGrid()
  else graph.value?.hideGrid()
}

const fitContent = () => {
  if (!graph.value?.getCells().length) return
  graph.value.zoomToFit({ padding: 56, maxScale: 1.2 })
  graph.value.centerContent()
}

const deleteSelection = () => {
  const cells = graph.value?.getSelectedCells() || []
  if (cells.length) graph.value.removeCells(cells)
}

const addNodeAtCenter = (item) => {
  if (!graph.value || Date.now() - lastDropAt < 250) return
  if (item.shape === 'draw-image') {
    pendingImageItem = item
    imageInputRef.value?.click()
    return
  }
  const center = getViewportCenter(graph.value, containerRef.value)
  addCatalogNode(graph.value, item, center.x - item.width / 2, center.y - item.height / 2, {
    label: itemLabel(item)
  })
}

const onDragNode = (item, event) => {
  if (!graph.value || !dnd) return
  if (item.shape === 'draw-image') {
    pendingImageItem = item
    imageInputRef.value?.click()
    return
  }
  startCatalogDrag(graph.value, dnd, item, event, { label: itemLabel(item) })
}

const onSetEdge = (styleId) => {
  edgeStyleId.value = styleId
  graphState.edgeStyleId = styleId
  if (!graph.value) return
  setPendingEdgeStyle(graph.value, styleId, graphState)
  connectSelected(graph.value, styleId)
}

const onAnimationAction = (type) => {
  if (!graph.value) return
  applyAnimationToSelection(graph.value, type)
}

const onInsertTemplate = (name) => {
  if (graph.value) insertTemplate(graph.value, name)
}

const onImagePicked = (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || !graph.value || !pendingImageItem) return
  const reader = new FileReader()
  reader.onload = () => {
    const center = getViewportCenter(graph.value, containerRef.value)
    const node = addCatalogNode(
      graph.value,
      pendingImageItem,
      center.x - pendingImageItem.width / 2,
      center.y - pendingImageItem.height / 2,
      { label: file.name }
    )
    node.attr('image/xlinkHref', reader.result)
    pendingImageItem = null
  }
  reader.readAsDataURL(file)
}

const updateSelection = (patch) => {
  const cells = graph.value?.getSelectedCells() || []
  cells.forEach((cell) => {
    if (patch.label != null && cell.isNode()) {
      cell.attr('label/text', patch.label)
      if (cell.shape === 'draw-uml-class') {
        cell.setData({ ...(cell.getData() || {}), className: patch.label })
      }
    }
    if (patch.fill != null && cell.isNode()) cell.attr('body/fill', patch.fill)
    if (patch.stroke != null) {
      if (cell.isEdge()) cell.attr('line/stroke', patch.stroke)
      else cell.attr('body/stroke', patch.stroke)
    }
    if (patch.strokeWidth != null) {
      if (cell.isEdge()) cell.attr('line/strokeWidth', patch.strokeWidth)
      else cell.attr('body/strokeWidth', patch.strokeWidth)
    }
    if (patch.fontSize != null && cell.isNode()) cell.attr('label/fontSize', patch.fontSize)
    if (patch.router != null && cell.isEdge()) cell.setRouter({ name: patch.router })
    if (patch.connector != null && cell.isEdge()) cell.setConnector({ name: patch.connector })
    if (patch.animation != null) applyCellAnimation(cell, patch.animation)
  })
  Object.assign(propState, patch)
}

const closeMenu = () => {
  menu.visible = false
}

const openMenu = (event) => {
  event.preventDefault()
  menu.visible = true
  menu.x = event.clientX
  menu.y = event.clientY
}

const onMenuAction = (action) => {
  const cells = graph.value?.getSelectedCells() || []
  if (action === 'cut' && cells.length) graph.value.cut(cells)
  if (action === 'copy' && cells.length) graph.value.copy(cells)
  if (action === 'paste' && !graph.value.isClipboardEmpty()) graph.value.paste({ offset: 24 })
  if (action === 'duplicate' && cells.length) {
    graph.value.copy(cells)
    graph.value.paste({ offset: 28 })
  }
  if (action === 'delete') deleteSelection()
  if (action === 'front') cells.forEach((cell) => cell.toFront())
  if (action === 'back') cells.forEach((cell) => cell.toBack())
  closeMenu()
}

const exportCanvas = (type) => {
  if (!graph.value) return
  const name = canvasName.value || 'canvas'
  if (type === 'json') {
    downloadFile(JSON.stringify({ title: name, graphJSON: graph.value.toJSON() }, null, 2), `${name}.json`)
    return
  }
  const options = { padding: 24, backgroundColor: getCanvasTheme().dark ? '#1a1a1c' : '#ffffff' }
  if (type === 'png') graph.value.exportPNG(`${name}.png`, options)
  if (type === 'svg') graph.value.exportSVG(`${name}.svg`, options)
}

watch(() => props.canvas.id, loadCanvas)
watch(appliedTheme, () => {
  if (gridVisible.value) applyGraphTheme(graph.value)
})

onMounted(() => {
  const created = createDrawingGraph(containerRef.value, minimapRef.value, graphState)
  graph.value = created.graph
  dnd = created.dnd
  const originalDrop = dnd.options.getDropNode
  dnd.options.getDropNode = (...args) => {
    lastDropAt = Date.now()
    return originalDrop(...args)
  }

  created.graph.on('history:change', () => {
    syncHistory()
    scheduleSave()
  })
  created.graph.on('scale', syncHistory)
  created.graph.on('translate', syncHistory)
  created.graph.on('cell:added', syncHistory)
  created.graph.on('cell:removed', syncHistory)
  created.graph.on('selection:changed', refreshProps)
  created.graph.on('blank:contextmenu', ({ e }) => openMenu(e))
  created.graph.on('cell:contextmenu', ({ e }) => openMenu(e))
  created.graph.on('blank:click', closeMenu)
  created.graph.on('cell:click', closeMenu)
  created.graph.container.setAttribute('tabindex', '-1')
  created.graph.container.focus({ preventScroll: true })
  document.addEventListener('click', closeMenu)

  loadCanvas()
})

onActivated(() => graph.value?.enableKeyboard())
onDeactivated(() => graph.value?.disableKeyboard())

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenu)
  clearTimeout(saveTimer)
  if (graph.value && !skipSave) emit('change', { id: props.canvas.id, graphJSON: graph.value.toJSON() })
  dnd?.dispose()
  graph.value?.dispose()
})
</script>

<style scoped>
.drawing-editor { position: relative; width: 100%; height: 100%; overflow: hidden; }
.graph-container { width: 100%; height: 100%; }
.graph-container.is-pan { cursor: grab; }
.empty-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  color: var(--text-tertiary);
  font-size: 13px;
  pointer-events: none;
  transform: translate(-50%, -50%);
  white-space: nowrap;
}
.minimap {
  position: absolute;
  right: 16px;
  bottom: 16px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-primary) 88%, transparent);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
}
.hidden-input { display: none; }
</style>

<style>
@keyframes draw-edge-flow {
  to { stroke-dashoffset: -24; }
}
@keyframes draw-node-breathe {
  50% { filter: drop-shadow(0 0 10px rgba(37, 99, 235, 0.45)); }
}
.drawing-editor .x6-widget-selection-box {
  border: 1.5px solid var(--accent-color);
  box-shadow: none;
}
.drawing-editor .x6-widget-selection-inner {
  border: 1px dashed var(--accent-color);
}
.drawing-editor .x6-port-body { visibility: hidden; }
.drawing-editor .x6-node:hover .x6-port-body,
.drawing-editor .x6-node-selected .x6-port-body { visibility: visible; }
.draw-uml-class {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1.5px solid #7c3aed;
  border-radius: 8px;
  background: #f5f3ff;
  color: #1c1917;
  font-size: 12px;
}
[data-theme='dark'] .draw-uml-class {
  background: #2a2438;
  color: #ededed;
  border-color: #8b5cf6;
}
.draw-uml-class__head {
  padding: 8px 10px;
  background: #7c3aed;
  color: #fff;
  font-weight: 650;
  text-align: center;
}
.draw-uml-class__section {
  flex: 1;
  padding: 8px 10px;
  white-space: pre-line;
  border-top: 1px solid rgba(124, 58, 237, 0.25);
}
</style>
