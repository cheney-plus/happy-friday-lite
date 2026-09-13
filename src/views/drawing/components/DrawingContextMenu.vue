<template>
  <div
    v-if="visible"
    ref="menuRef"
    class="context-menu"
    :style="{ left: `${left}px`, top: `${top}px`, visibility: placed ? 'visible' : 'hidden' }"
    @mousedown.stop
  >
    <template v-if="isMind">
      <button type="button" @click="$emit('action', 'addBranch')">{{ t('drawing.context.addBranch') }}</button>
      <button type="button" @click="$emit('action', 'addChild')">{{ t('drawing.context.addChild') }}</button>
      <button type="button" @click="$emit('action', 'addSibling')">{{ t('drawing.context.addSibling') }}</button>
      <button type="button" :disabled="!canIndent" @click="$emit('action', 'indent')">{{ t('drawing.context.indent') }}</button>
      <button type="button" :disabled="!canOutdent" @click="$emit('action', 'outdent')">{{ t('drawing.context.outdent') }}</button>
      <button v-if="canCollapse" type="button" @click="$emit('action', isCollapsed ? 'expand' : 'collapse')">
        {{ t(isCollapsed ? 'drawing.context.expand' : 'drawing.context.collapse') }}
      </button>
      <span class="menu-sep"></span>
    </template>
    <button type="button" @click="$emit('action', 'duplicate')">{{ t('drawing.context.duplicate') }}</button>
    <button type="button" @click="$emit('action', 'delete')">{{ t('drawing.context.delete') }}</button>
    <span class="menu-sep"></span>
    <button type="button" @click="$emit('action', 'front')">{{ t('drawing.context.toFront') }}</button>
    <button type="button" @click="$emit('action', 'back')">{{ t('drawing.context.toBack') }}</button>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  isMind: { type: Boolean, default: false },
  canIndent: { type: Boolean, default: false },
  canOutdent: { type: Boolean, default: false },
  canCollapse: { type: Boolean, default: false },
  isCollapsed: { type: Boolean, default: false }
})

defineEmits(['action'])
const { t } = useI18n()

const PAD = 8
const menuRef = ref(null)
const left = ref(0)
const top = ref(0)
const placed = ref(false)

function viewportBox() {
  const view = window.visualViewport
  if (view) {
    return {
      left: view.offsetLeft,
      top: view.offsetTop,
      right: view.offsetLeft + view.width,
      bottom: view.offsetTop + view.height
    }
  }
  return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
}

async function fitToViewport() {
  placed.value = false
  left.value = props.x
  top.value = props.y
  await nextTick()
  const el = menuRef.value
  if (!el || !props.visible) return
  const rect = el.getBoundingClientRect()
  const box = viewportBox()
  const maxX = box.right - rect.width - PAD
  const maxY = box.bottom - rect.height - PAD
  left.value = Math.max(box.left + PAD, Math.min(props.x, maxX))
  top.value = Math.max(box.top + PAD, Math.min(props.y, maxY))
  placed.value = true
}

watch(
  () => [props.visible, props.x, props.y, props.isMind, props.canCollapse],
  () => {
    if (!props.visible) {
      placed.value = false
      return
    }
    fitToViewport()
  }
)

watch(
  () => props.visible,
  (visible) => {
    if (visible) window.addEventListener('resize', fitToViewport)
    else window.removeEventListener('resize', fitToViewport)
  }
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', fitToViewport)
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 50;
  min-width: 148px;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  overflow: auto;
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-primary);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
}
.context-menu button {
  display: block;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: 7px;
  color: var(--text-primary);
  background: transparent;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.context-menu button:hover { background: var(--bg-hover); }
.context-menu button:disabled { opacity: 0.4; cursor: default; }
.context-menu button:disabled:hover { background: transparent; }
.menu-sep { display: block; height: 1px; margin: 4px 6px; background: var(--border-color); }
</style>
