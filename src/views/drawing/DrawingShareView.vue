<template>
  <div class="drawing-share">
    <header class="share-header">
      <span class="share-title">{{ title }}</span>
      <span class="share-badge">{{ t('drawing.share.readOnly') }}</span>
    </header>
    <div class="share-body">
      <div v-if="error" class="share-error">{{ t('drawing.share.notFound') }}</div>
      <div v-show="!error" ref="containerRef" class="share-canvas"></div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { Graph } from '@antv/x6'
import { loadGraphData } from './composables/useGraphEditor.js'
import { registerDrawingShapes } from './shapes/register.js'
import { getCanvasTheme } from './shapes/theme.js'

const route = useRoute()
const { t } = useI18n()

const containerRef = ref(null)
const title = ref('')
const error = ref(false)
let graph = null

onMounted(async () => {
  const canvasId = route.params.id
  if (!canvasId) {
    error.value = true
    return
  }
  try {
    const res = await fetch(`/api/share/drawing/${encodeURIComponent(canvasId)}`)
    const data = await res.json()
    if (!data?.success || !data.canvas) {
      error.value = true
      return
    }
    const canvas = data.canvas
    title.value = canvas.title || t(`drawing.canvas.${canvas.titleKey || 'untitled'}`)
    renderGraph(canvas.graphJSON)
  } catch (err) {
    console.error('Failed to load shared drawing:', err)
    error.value = true
  }
})

function renderGraph(graphJSON) {
  registerDrawingShapes()
  const theme = getCanvasTheme()
  graph = new Graph({
    container: containerRef.value,
    autoResize: true,
    preventDefaultContextMenu: true,
    background: { color: 'transparent' },
    grid: {
      visible: true,
      type: 'dot',
      size: 16,
      args: { color: theme.grid }
    },
    panning: {
      enabled: true,
      modifiers: null,
      eventTypes: ['leftMouseDown', 'mouseWheel']
    },
    mousewheel: {
      enabled: true,
      zoomAtMousePosition: true,
      modifiers: ['ctrl', 'meta'],
      minScale: 0.2,
      maxScale: 3
    },
    // 只读：禁止一切节点/连线交互，仅保留平移与缩放
    interacting: false
  })
  loadGraphData(graph, graphJSON)
}

onBeforeUnmount(() => {
  graph?.dispose()
  graph = null
})
</script>

<style scoped>
.drawing-share { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; background: var(--bg-primary); color: var(--text-primary); }
.share-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 48px; padding: 0 16px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
.share-title { overflow: hidden; font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.share-badge { flex-shrink: 0; padding: 2px 8px; border: 1px solid var(--border-color); border-radius: 999px; color: var(--text-tertiary); font-size: 11px; }
.share-body { position: relative; flex: 1; min-height: 0; }
.share-canvas { width: 100%; height: 100%; }
/* 只读视图隐藏连接点（端口），保持画面干净 */
.share-canvas :deep(.x6-port) { display: none; }
.share-error { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-tertiary); font-size: 13px; }
</style>
