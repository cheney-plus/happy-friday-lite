<template>
  <div class="drawing-editor">
    <div
      ref="containerRef"
      class="graph-container"
      :class="{ 'is-pan': mode === 'pan', 'is-edge-pending': edgePending }"
    ></div>
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
      @library-change="$emit('library-change', $event)"
    />

    <PropertyPanel
      v-bind="propState"
      @update="updateSelection"
    />

    <DrawingContextMenu
      :visible="menu.visible"
      :x="menu.x"
      :y="menu.y"
      :is-mind="menu.isMind"
      :can-indent="menu.canIndent"
      :can-outdent="menu.canOutdent"
      :can-collapse="menu.canCollapse"
      :is-collapsed="menu.isCollapsed"
      @action="onMenuAction"
    />

    <div ref="minimapRef" class="minimap"></div>
    <input ref="imageInputRef" class="hidden-input" type="file" accept="image/*" @change="onImagePicked" />
  </div>
</template>

<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDrawingStore } from '@/store'
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
  duplicateDrawingCells,
  getViewportCenter,
  insertTemplate,
  loadGraphData,
  removeDrawingCells,
  setInteractionMode,
  setPendingEdgeStyle,
  startCatalogDrag
} from '../composables/useGraphEditor.js'
import {
  addMindChild,
  addMindSibling,
  canCollapseMindNode,
  canIndentMindNode,
  canOutdentMindNode,
  indentMindNode,
  isMindCollapsed,
  isMindNode,
  outdentMindNode,
  setMindCollapsed
} from '../shapes/mindmap.js'
import DrawingContextMenu from './DrawingContextMenu.vue'
import EditorToolbar from './EditorToolbar.vue'
import PropertyPanel from './PropertyPanel.vue'
import ShapePalette from './ShapePalette.vue'

const props = defineProps({
  canvas: { type: Object, required: true }
})

const emit = defineEmits(['change', 'library-change'])
const { t } = useI18n()
const { appliedTheme } = useTheme()
const drawingStore = useDrawingStore()

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
const edgePending = ref(false)
const canUndo = ref(false)
const canRedo = ref(false)
const zoomLabel = ref('100%')
const gridVisible = ref(true)
const isEmpty = ref(true)
const cellCount = ref(0)
const menu = reactive({
  visible: false,
  x: 0,
  y: 0,
  isMind: false,
  canIndent: false,
  canOutdent: false,
  canCollapse: false,
  isCollapsed: false
})
const graphState = { mode: 'select', edgeStyleId: 'manhattan' }
const propState = reactive({
  hasSelection: false,
  isNode: false,
  isEdge: false,
  label: '',
  fill: '#ffffff',
  textColor: '#1c1917',
  strokeWidth: 1.5,
  fontSize: 13,
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
  propState.label = cell.isNode()
    ? cell.attr('label/text') || cell.attr('text/text') || ''
    : cell.getLabels?.()[0]?.attrs?.label?.text || ''
  propState.fill = toColorInput(cell.attr('body/fill'), '#ffffff')
  propState.textColor = cell.isEdge()
    ? toColorInput(cell.getLabels?.()[0]?.attrs?.label?.fill || cell.getData()?.labelColor, '#1c1917')
    : toColorInput(cell.attr('label/fill'), '#1c1917')
  propState.strokeWidth = Number(cell.isEdge() ? cell.attr('line/strokeWidth') : cell.attr('body/strokeWidth')) || 1.5
  propState.fontSize = Number(cell.attr('label/fontSize')) || 13
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
  if (next === 'pan') edgePending.value = false
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
  if (cells.length) removeDrawingCells(graph.value, cells)
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
  if (!styleId) {
    edgeStyleId.value = null
    edgePending.value = false
    return
  }
  edgeStyleId.value = styleId
  graphState.edgeStyleId = styleId
  edgePending.value = true
  if (!graph.value) return
  setPendingEdgeStyle(graph.value, styleId, graphState)
  connectSelected(graph.value, styleId)
}

const cancelPendingEdge = (event) => {
  if (event.key === 'Escape') edgePending.value = false
}

const onAnimationAction = (type) => {
  if (!graph.value) return
  applyAnimationToSelection(graph.value, type)
}

const onInsertTemplate = (name) => {
  if (!graph.value) return
  const sourceCanvas = name === 'flowchart'
    ? drawingStore.canvases.find((canvas) => (
      canvas.id === 'flowchart'
      || canvas.titleKey === 'flowchart'
      || canvas.title === t('drawing.canvas.flowchart')
    ))
    : name === 'er'
      ? drawingStore.canvases.find((canvas) => (
        canvas.id === 'er'
        || canvas.titleKey === 'er'
        || canvas.title === t('drawing.groups.er')
      ))
      : null
  const rawSource = sourceCanvas
    ? (sourceCanvas.id === props.canvas.id ? graph.value.toJSON() : sourceCanvas.graphJSON)
    : null
  const source = rawSource?.cells?.length ? JSON.parse(JSON.stringify(rawSource)) : null
  insertTemplate(graph.value, name, source)
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
    if (patch.label != null && cell.isEdge()) {
      const text = patch.label.trim()
      if (!text) {
        cell.setLabels([])
      } else {
        const currentLabel = cell.getLabels?.()[0] || {}
        cell.setLabels([{
          ...currentLabel,
          position: currentLabel.position ?? 0.5,
          attrs: {
            ...currentLabel.attrs,
            label: {
              ...currentLabel.attrs?.label,
              text,
              fontSize: currentLabel.attrs?.label?.fontSize || 11,
              fill: currentLabel.attrs?.label?.fill || cell.getData()?.labelColor || '#1c1917'
            }
          }
        }])
      }
    }
    if (patch.textColor != null) {
      if (cell.isEdge()) {
        const data = cell.getData() || {}
        cell.setData({ ...data, labelColor: patch.textColor })
        const currentLabel = cell.getLabels?.()[0]
        if (currentLabel) {
          cell.setLabels([{
            ...currentLabel,
            attrs: {
              ...currentLabel.attrs,
              label: { ...currentLabel.attrs?.label, fill: patch.textColor }
            }
          }])
        }
      } else {
        cell.attr('label/fill', patch.textColor)
      }
    }
    if (patch.fill != null && cell.isNode()) cell.attr('body/fill', patch.fill)
    if (patch.strokeWidth != null) {
      if (cell.isEdge()) cell.attr('line/strokeWidth', patch.strokeWidth)
      else cell.attr('body/strokeWidth', patch.strokeWidth)
    }
    if (patch.fontSize != null && cell.isNode()) cell.attr('label/fontSize', patch.fontSize)
    if (patch.animation != null) applyCellAnimation(cell, patch.animation)
  })
  Object.assign(propState, patch)
}

const closeMenu = () => {
  menu.visible = false
}

const openMenu = (event) => {
  event.preventDefault()
  const cells = graph.value?.getSelectedCells() || []
  const mindNode = cells.find((cell) => isMindNode(cell))
  menu.visible = true
  menu.x = event.clientX
  menu.y = event.clientY
  menu.isMind = Boolean(mindNode)
  menu.canIndent = mindNode ? canIndentMindNode(graph.value, mindNode) : false
  menu.canOutdent = mindNode ? canOutdentMindNode(graph.value, mindNode) : false
  menu.canCollapse = mindNode ? canCollapseMindNode(graph.value, mindNode) : false
  menu.isCollapsed = mindNode ? isMindCollapsed(mindNode) : false
}

const onMenuAction = (action) => {
  const cells = graph.value?.getSelectedCells() || []
  const mindNode = cells.find((cell) => isMindNode(cell))
  if (action === 'addBranch' && mindNode) addMindChild(graph.value, mindNode, { type: 'topic-branch' })
  if (action === 'addChild' && mindNode) addMindChild(graph.value, mindNode, { type: 'topic-child' })
  if (action === 'addSibling' && mindNode) addMindSibling(graph.value, mindNode)
  if (action === 'indent' && mindNode) indentMindNode(graph.value, mindNode)
  if (action === 'outdent' && mindNode) outdentMindNode(graph.value, mindNode)
  if (action === 'collapse' && mindNode) setMindCollapsed(graph.value, mindNode, true)
  if (action === 'expand' && mindNode) setMindCollapsed(graph.value, mindNode, false)
  if (action === 'duplicate') duplicateDrawingCells(graph.value)
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
  created.graph.on('edge:connected', ({ isNew }) => {
    if (isNew) edgePending.value = false
  })
  created.graph.on('blank:contextmenu', ({ e }) => openMenu(e))
  created.graph.on('cell:contextmenu', ({ e, cell }) => {
    if (cell && !created.graph.isSelected(cell)) {
      created.graph.cleanSelection()
      created.graph.select(cell)
    }
    openMenu(e)
  })
  created.graph.on('blank:click', closeMenu)
  created.graph.on('cell:click', closeMenu)
  created.graph.container.setAttribute('tabindex', '-1')
  created.graph.container.focus({ preventScroll: true })
  document.addEventListener('click', closeMenu)
  document.addEventListener('keydown', cancelPendingEdge)

  loadCanvas()
})

onActivated(() => graph.value?.enableKeyboard())
onDeactivated(() => graph.value?.disableKeyboard())

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenu)
  document.removeEventListener('keydown', cancelPendingEdge)
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
.graph-container.is-edge-pending,
.graph-container.is-edge-pending * { cursor: crosshair !important; }
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
