<template>
  <div v-if="visible" class="context-menu" :style="{ left: `${x}px`, top: `${y}px` }" @mousedown.stop>
    <button type="button" @click="$emit('action', 'cut')">{{ t('drawing.context.cut') }}</button>
    <button type="button" @click="$emit('action', 'copy')">{{ t('drawing.context.copy') }}</button>
    <button type="button" @click="$emit('action', 'paste')">{{ t('drawing.context.paste') }}</button>
    <button type="button" @click="$emit('action', 'duplicate')">{{ t('drawing.context.duplicate') }}</button>
    <button type="button" @click="$emit('action', 'delete')">{{ t('drawing.context.delete') }}</button>
    <span class="menu-sep"></span>
    <button type="button" @click="$emit('action', 'front')">{{ t('drawing.context.toFront') }}</button>
    <button type="button" @click="$emit('action', 'back')">{{ t('drawing.context.toBack') }}</button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 }
})

defineEmits(['action'])
const { t } = useI18n()
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 50;
  min-width: 148px;
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
.menu-sep { display: block; height: 1px; margin: 4px 6px; background: var(--border-color); }
</style>
