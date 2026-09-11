<template>
  <div class="shape-palette" @mousedown.stop>
    <div class="palette-rail">
      <button
        v-for="group in groups"
        :key="group.id"
        type="button"
        class="rail-button"
        :class="{ active: openGroup === group.id }"
        :title="t(`drawing.groups.${group.id}`)"
        @click="toggleGroup(group.id)"
      >
        <component :is="groupIcons[group.id]" :size="18" :stroke-width="1.8" />
      </button>
    </div>

    <Transition name="flyout">
      <section v-if="activeGroup" class="palette-flyout">
        <header class="flyout-header">
          <strong>{{ t(`drawing.groups.${activeGroup.id}`) }}</strong>
          <button type="button" class="close-button" :title="t('drawing.palette.close')" @click="openGroup = null">
            <X :size="14" :stroke-width="2" />
          </button>
        </header>

        <div v-if="activeGroup.children" class="subtabs">
          <button
            v-for="child in activeGroup.children"
            :key="child.id"
            type="button"
            class="subtab"
            :class="{ active: openChild === child.id }"
            @click="openChild = child.id"
          >
            {{ t(`drawing.groups.${child.id}`) }}
          </button>
        </div>

        <p v-if="activeGroup.id === 'animation'" class="flyout-hint">{{ t('drawing.palette.animationHint') }}</p>
        <p v-else-if="activeGroup.id === 'lines'" class="flyout-hint">{{ t('drawing.palette.lineHint') }}</p>
        <p v-else class="flyout-hint">{{ t('drawing.palette.dragHint') }}</p>

        <div class="shape-grid">
          <button
            v-for="item in visibleItems"
            :key="item.id"
            type="button"
            class="shape-item"
            :class="{ selected: item.kind === 'edge' && item.style === edgeStyleId }"
            :title="t(`drawing.shapes.${item.id}`)"
            @mousedown="onItemMouseDown($event, item)"
            @click="onItemClick(item)"
          >
            <ShapePreview :preview="item.preview" />
            <span>{{ t(`drawing.shapes.${item.id}`) }}</span>
          </button>
        </div>
      </section>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Boxes,
  Database,
  Layers,
  Share2,
  Sparkles,
  Spline,
  Square,
  Workflow,
  X
} from 'lucide-vue-next'
import { PALETTE_GROUPS } from '../shapes/catalog.js'
import ShapePreview from './ShapePreview.vue'

const props = defineProps({
  edgeStyleId: { type: String, default: 'manhattan' }
})

const emit = defineEmits(['add-node', 'drag-node', 'set-edge', 'action', 'insert-template'])

const { t } = useI18n()
const groups = PALETTE_GROUPS
const openGroup = ref('general')
const openChild = ref('timeline')

const groupIcons = {
  general: Square,
  lines: Spline,
  animation: Sparkles,
  mindmap: Share2,
  flowchart: Workflow,
  er: Database,
  uml: Boxes,
  advanced: Layers
}

const activeGroup = computed(() => groups.find((group) => group.id === openGroup.value) || null)

const visibleItems = computed(() => {
  const group = activeGroup.value
  if (!group) return []
  if (group.children) {
    return group.children.find((child) => child.id === openChild.value)?.items || group.children[0].items
  }
  return group.items
})

const toggleGroup = (id) => {
  openGroup.value = openGroup.value === id ? null : id
  if (id === 'advanced' && !openChild.value) openChild.value = 'timeline'
}

let dragging = false
let dragStarted = false

const onItemMouseDown = (event, item) => {
  if (event.button !== 0 || item.kind !== 'node') return
  dragging = true
  dragStarted = false
  const startX = event.clientX
  const startY = event.clientY
  const onMove = (moveEvent) => {
    if (!dragging || dragStarted) return
    if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 5) return
    dragStarted = true
    emit('drag-node', item, moveEvent)
  }
  const onUp = () => {
    dragging = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

const onItemClick = (item) => {
  if (item.kind === 'node') {
    if (dragStarted) return
    emit('add-node', item)
    return
  }
  if (item.kind === 'edge') emit('set-edge', item.style)
  if (item.kind === 'action') emit('action', item.action)
  if (item.kind === 'template') emit('insert-template', item.template)
}

const onPointerDown = (event) => {
  if (!event.target.closest('.shape-palette')) openGroup.value = null
}

onMounted(() => document.addEventListener('mousedown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('mousedown', onPointerDown))
</script>

<style scoped>
.shape-palette {
  position: absolute;
  z-index: 20;
  top: 72px;
  left: 16px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  pointer-events: none;
}
.palette-rail,
.palette-flyout {
  pointer-events: auto;
}
.palette-rail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 6px;
  border: 1px solid var(--border-color);
  border-radius: 18px;
  background: color-mix(in srgb, var(--bg-primary) 88%, transparent);
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(16px);
}
.rail-button,
.close-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
}
.rail-button:hover,
.close-button:hover { background: var(--bg-hover); color: var(--text-primary); }
.rail-button.active {
  color: var(--accent-color);
  background: var(--accent-light);
}
.palette-flyout {
  width: 268px;
  max-height: min(560px, calc(100vh - 180px));
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-primary) 94%, transparent);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(18px);
}
.flyout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.flyout-header strong { font-size: 13px; font-weight: 650; }
.flyout-hint { margin: 0 0 10px; color: var(--text-tertiary); font-size: 11px; line-height: 1.5; }
.subtabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.subtab {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--text-secondary);
  background: transparent;
  font-size: 11px;
  cursor: pointer;
}
.subtab.active { color: var(--accent-color); border-color: var(--accent-color); background: var(--accent-light); }
.shape-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.shape-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-height: 72px;
  padding: 8px 6px 7px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-secondary) 70%, transparent);
  cursor: grab;
}
.shape-item span {
  max-width: 100%;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shape-item:hover,
.shape-item.selected { border-color: var(--accent-color); color: var(--text-primary); background: var(--accent-light); }
.flyout-enter-active, .flyout-leave-active { transition: opacity .16s ease, transform .16s ease; }
.flyout-enter-from, .flyout-leave-to { opacity: 0; transform: translateX(-8px); }
</style>
