<template>
  <div class="shape-palette" :class="{ 'is-library': showLibrary }" @mousedown.stop>
    <Transition name="picker">
      <div v-if="!showLibrary" class="palette-picker">
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
            <component :is="groupIcons[group.id]" :size="16" :stroke-width="1.8" />
          </button>
        </div>

        <Transition name="flyout">
          <section v-if="activeGroup" class="palette-flyout">
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

            <div class="flyout-body" @scroll="hideTooltip">
              <div class="shape-grid">
                <button
                  v-for="item in visibleItems"
                  :key="item.id"
                  type="button"
                  class="shape-item"
                  :class="{ selected: item.kind === 'edge' && item.style === edgeStyleId }"
                  @mousedown="onItemMouseDown($event, item)"
                  @click="onItemClick(item)"
                  @mouseenter="showItemTooltip($event, item)"
                  @mouseleave="hideTooltip"
                >
                  <ShapePreview :preview="item.preview" compact />
                </button>
              </div>
            </div>

            <button
              v-if="activeGroup.id === 'general'"
              type="button"
              class="more-button"
              @click="openLibrary"
            >
              <span>{{ t('drawing.palette.moreShapes') }}</span>
              <kbd>M</kbd>
            </button>
          </section>
        </Transition>
      </div>
    </Transition>

    <Transition name="library">
      <section v-if="showLibrary" class="palette-flyout library">
        <header class="library-header">
          <strong>{{ t('drawing.palette.moreShapes') }}</strong>
          <button type="button" class="close-button" :title="t('drawing.palette.close')" @click="closeLibrary">
            <X :size="14" :stroke-width="2" />
          </button>
        </header>
        <div class="flyout-body" @scroll="hideTooltip">
          <section v-for="section in librarySections" :key="section.id" class="library-section">
            <h4>{{ t(`drawing.groups.${section.id}`) }}</h4>
            <div class="shape-grid">
              <button
                v-for="item in section.items"
                :key="item.id"
                type="button"
                class="shape-item"
                :class="{ selected: item.kind === 'edge' && item.style === edgeStyleId }"
                @mousedown="onItemMouseDown($event, item)"
                @click="onItemClick(item)"
                @mouseenter="showItemTooltip($event, item)"
                @mouseleave="hideTooltip"
              >
                <ShapePreview :preview="item.preview" compact />
              </button>
            </div>
          </section>
        </div>
      </section>
    </Transition>

    <Teleport to="body">
      <div
        v-if="tooltip.visible"
        class="drawing-palette-tooltip"
        :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
      >
        {{ tooltip.text }}
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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

defineProps({
  edgeStyleId: { type: String, default: 'manhattan' }
})

const emit = defineEmits(['add-node', 'drag-node', 'set-edge', 'action', 'insert-template', 'library-change'])

const { t } = useI18n()
const groups = PALETTE_GROUPS
const openGroup = ref('general')
const openChild = ref('timeline')
const showLibrary = ref(false)
const tooltip = reactive({ visible: false, text: '', x: 0, y: 0 })

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

const librarySections = computed(() => {
  const sections = []
  for (const group of groups) {
    if (group.children) {
      for (const child of group.children) {
        sections.push({ id: child.id, items: child.items })
      }
    } else {
      sections.push({ id: group.id, items: group.items })
    }
  }
  return sections
})

const toggleGroup = (id) => {
  openGroup.value = openGroup.value === id ? null : id
  showLibrary.value = false
  hideTooltip()
  if (id === 'advanced' && !openChild.value) openChild.value = 'timeline'
}

const openLibrary = () => {
  showLibrary.value = true
  hideTooltip()
}

const closeLibrary = () => {
  if (!showLibrary.value) return
  showLibrary.value = false
  openGroup.value = 'general'
  hideTooltip()
}

watch(showLibrary, (open) => {
  emit('library-change', open)
})

const showItemTooltip = (event, item) => {
  const rect = event.currentTarget.getBoundingClientRect()
  tooltip.visible = true
  tooltip.text = t(`drawing.shapes.${item.id}`)
  tooltip.x = rect.left + rect.width / 2
  tooltip.y = rect.top
}

const hideTooltip = () => {
  tooltip.visible = false
}

let dragging = false
let dragStarted = false

const onItemMouseDown = (event, item) => {
  if (event.button !== 0 || item.kind !== 'node') return
  dragging = true
  dragStarted = false
  hideTooltip()
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

const isTypingTarget = (target) => {
  if (!target || !(target instanceof Element)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return Boolean(target.closest('[contenteditable="true"]'))
}

const onPointerDown = (event) => {
  if (showLibrary.value) return
  const target = event.target
  if (typeof target?.closest !== 'function' || target.closest('.shape-palette')) return
  openGroup.value = null
  hideTooltip()
}

const onKeyDown = (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key !== 'm' && event.key !== 'M') return
  if (isTypingTarget(event.target)) return
  if (showLibrary.value || openGroup.value !== 'general') return
  event.preventDefault()
  openLibrary()
}

onMounted(() => {
  document.addEventListener('mousedown', onPointerDown)
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onPointerDown)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.shape-palette {
  position: absolute;
  z-index: 20;
  top: 72px;
  left: 16px;
  pointer-events: none;
}
.palette-picker,
.palette-rail,
.palette-flyout {
  pointer-events: auto;
}
.palette-picker {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.palette-rail {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 5px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-primary) 92%, transparent);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(16px);
}
.rail-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
}
.rail-button:hover { background: var(--bg-hover); color: var(--text-primary); }
.rail-button.active {
  color: var(--accent-color);
  background: var(--accent-light);
}
.palette-flyout {
  display: flex;
  flex-direction: column;
  width: 204px;
  max-height: min(420px, calc(100vh - 160px));
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg-primary) 96%, transparent);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(18px);
  outline: none;
}
.palette-flyout.library {
  position: absolute;
  top: 0;
  left: 0;
  width: 212px;
  height: min(680px, calc(100vh - 88px));
  max-height: min(680px, calc(100vh - 88px));
  padding: 8px 0 8px 10px;
}
.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  padding-right: 6px;
  flex-shrink: 0;
}
.library-header strong {
  font-size: 12px;
  font-weight: 650;
}
.close-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
}
.close-button:hover { background: var(--bg-hover); color: var(--text-primary); }
.flyout-body {
  overflow: auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--text-tertiary) 55%, transparent) transparent;
}
.palette-flyout.library .flyout-body {
  flex: 1;
  max-height: none;
  padding-right: 0;
  scrollbar-width: thin;
  scrollbar-gutter: auto;
}
.palette-flyout.library .flyout-body::-webkit-scrollbar {
  width: 3px;
}
.palette-flyout.library .flyout-body::-webkit-scrollbar-track {
  background: transparent;
}
.palette-flyout.library .flyout-body::-webkit-scrollbar-thumb {
  border-radius: 99px;
  background: color-mix(in srgb, var(--text-tertiary) 50%, transparent);
}
.palette-flyout.library .flyout-body::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--text-secondary) 70%, transparent);
}
.subtabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.subtab {
  padding: 2px 7px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--text-secondary);
  background: transparent;
  font-size: 10px;
  line-height: 16px;
  cursor: pointer;
}
.subtab.active { color: var(--accent-color); border-color: var(--accent-color); background: var(--accent-light); }
.shape-grid {
  display: grid;
  grid-template-columns: repeat(5, 32px);
  gap: 4px 6px;
  justify-content: space-between;
}
.shape-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  color: var(--text-secondary);
  background: transparent;
  cursor: grab;
}
.shape-item:hover,
.shape-item.selected {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.palette-flyout.library .library-section { padding-right: 6px; }
.library-section + .library-section { margin-top: 10px; }
.library-section h4 {
  margin: 0 0 6px;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 600;
}
.more-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 30px;
  margin-top: 8px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}
.more-button:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.more-button kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: inherit;
  font-size: 10px;
  line-height: 1;
}
.picker-enter-active,
.picker-leave-active,
.library-enter-active,
.library-leave-active {
  transition: opacity .2s ease;
}
.picker-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}
.library-enter-active {
  z-index: 2;
}
.picker-enter-from,
.picker-leave-to,
.library-enter-from,
.library-leave-to {
  opacity: 0;
}
.flyout-enter-active,
.flyout-leave-active {
  transition: opacity .16s ease;
}
.flyout-enter-from,
.flyout-leave-to {
  opacity: 0;
}
</style>

<style>
.drawing-palette-tooltip {
  position: fixed;
  z-index: 80;
  transform: translate(-50%, calc(-100% - 8px));
  padding: 4px 8px;
  border-radius: 6px;
  background: #1c1917;
  color: #fff;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.18);
}
.drawing-palette-tooltip::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -3px;
  width: 6px;
  height: 6px;
  background: #1c1917;
  transform: translateX(-50%) rotate(45deg);
}
</style>
