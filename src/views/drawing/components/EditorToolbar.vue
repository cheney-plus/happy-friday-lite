<template>
  <div class="editor-toolbar" @mousedown.stop>
    <div class="tool-group">
      <button type="button" :class="{ active: mode === 'select' }" :title="t('drawing.toolbar.select')" @click="$emit('set-mode', 'select')">
        <MousePointer2 :size="16" :stroke-width="1.8" />
      </button>
      <button type="button" :class="{ active: mode === 'pan' }" :title="t('drawing.toolbar.pan')" @click="$emit('set-mode', 'pan')">
        <Hand :size="16" :stroke-width="1.8" />
      </button>
    </div>
    <span class="divider"></span>
    <div class="tool-group">
      <button type="button" :disabled="!canUndo" :title="t('drawing.toolbar.undo')" @click="$emit('undo')">
        <Undo2 :size="16" :stroke-width="1.8" />
      </button>
      <button type="button" :disabled="!canRedo" :title="t('drawing.toolbar.redo')" @click="$emit('redo')">
        <Redo2 :size="16" :stroke-width="1.8" />
      </button>
      <button type="button" :title="t('drawing.toolbar.delete')" @click="$emit('delete')">
        <Trash2 :size="16" :stroke-width="1.8" />
      </button>
    </div>
    <span class="divider"></span>
    <div class="tool-group">
      <button type="button" :title="t('drawing.toolbar.zoomOut')" @click="$emit('zoom-out')">
        <ZoomOut :size="16" :stroke-width="1.8" />
      </button>
      <button type="button" class="zoom-label" :title="t('drawing.toolbar.zoomReset')" @click="$emit('zoom-reset')">{{ zoomLabel }}</button>
      <button type="button" :title="t('drawing.toolbar.zoomIn')" @click="$emit('zoom-in')">
        <ZoomIn :size="16" :stroke-width="1.8" />
      </button>
      <button type="button" :title="t('drawing.toolbar.fit')" @click="$emit('fit')">
        <Maximize2 :size="16" :stroke-width="1.8" />
      </button>
    </div>
    <span class="divider"></span>
    <div class="tool-group">
      <button type="button" :class="{ active: gridVisible }" :title="t('drawing.toolbar.grid')" @click="$emit('toggle-grid')">
        <Grid3x3 :size="16" :stroke-width="1.8" />
      </button>
      <div class="export-wrap">
        <button type="button" :title="t('drawing.toolbar.export')" @click="exportOpen = !exportOpen">
          <Download :size="16" :stroke-width="1.8" />
        </button>
        <div v-if="exportOpen" class="export-menu">
          <button type="button" @click="choose('png')">{{ t('drawing.toolbar.exportPng') }}</button>
          <button type="button" @click="choose('svg')">{{ t('drawing.toolbar.exportSvg') }}</button>
          <button type="button" @click="choose('json')">{{ t('drawing.toolbar.exportJson') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Download,
  Grid3x3,
  Hand,
  Maximize2,
  MousePointer2,
  Redo2,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut
} from 'lucide-vue-next'

defineProps({
  mode: { type: String, default: 'select' },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  zoomLabel: { type: String, default: '100%' },
  gridVisible: { type: Boolean, default: true }
})

const emit = defineEmits([
  'set-mode',
  'undo',
  'redo',
  'delete',
  'zoom-in',
  'zoom-out',
  'zoom-reset',
  'fit',
  'toggle-grid',
  'export'
])

const { t } = useI18n()
const exportOpen = ref(false)

const choose = (type) => {
  exportOpen.value = false
  emit('export', type)
}
</script>

<style scoped>
.editor-toolbar {
  position: absolute;
  z-index: 20;
  top: 16px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg-primary) 90%, transparent);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
  transform: translateX(-50%);
  backdrop-filter: blur(16px);
}
.tool-group { display: flex; align-items: center; gap: 2px; }
.tool-group button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 9px;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
}
.tool-group button:hover { background: var(--bg-hover); color: var(--text-primary); }
.tool-group button.active { color: var(--accent-color); background: var(--accent-light); }
.tool-group button:disabled { opacity: .35; cursor: default; }
.zoom-label { width: auto !important; padding: 0 8px !important; font-size: 12px; font-variant-numeric: tabular-nums; }
.divider { width: 1px; height: 18px; background: var(--border-color); }
.export-wrap { position: relative; }
.export-menu {
  position: absolute;
  top: 38px;
  right: 0;
  min-width: 132px;
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-primary);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
}
.export-menu button {
  display: block;
  width: 100%;
  height: auto;
  padding: 7px 8px;
  border: 0;
  border-radius: 7px;
  color: var(--text-primary);
  background: transparent;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.export-menu button:hover { background: var(--bg-hover); }
</style>
