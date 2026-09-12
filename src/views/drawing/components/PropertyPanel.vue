<template>
  <aside v-if="hasSelection" class="property-panel" @mousedown.stop>
    <header>{{ t('drawing.props.title') }}</header>

    <label v-if="isNode || isEdge">
      <span>{{ t('drawing.props.label') }}</span>
      <input :value="label" type="text" @change="$emit('update', { label: $event.target.value })" />
    </label>

    <label v-if="isNode">
      <span>{{ t('drawing.props.fill') }}</span>
      <div class="color-picker">
        <button
          v-for="color in fillColors"
          :key="`fill-${color.value}`"
          type="button"
          class="color-swatch"
          :class="{ selected: fill.toLowerCase() === color.value }"
          :style="{ backgroundColor: color.value }"
          :title="t(`drawing.colors.${color.name}`)"
          :aria-label="t(`drawing.colors.${color.name}`)"
          @click="$emit('update', { fill: color.value })"
        ></button>
        <input
          :value="fill"
          type="color"
          :title="t('drawing.colors.custom')"
          :aria-label="t('drawing.colors.custom')"
          @input="$emit('update', { fill: $event.target.value })"
        />
      </div>
    </label>

    <label>
      <span>{{ t('drawing.props.textColor') }}</span>
      <div class="color-picker">
        <button
          v-for="color in textColors"
          :key="color.value"
          type="button"
          class="color-swatch"
          :class="{ selected: textColor.toLowerCase() === color.value }"
          :style="{ backgroundColor: color.value }"
          :title="t(`drawing.colors.${color.name}`)"
          :aria-label="t(`drawing.colors.${color.name}`)"
          @click="$emit('update', { textColor: color.value })"
        ></button>
        <input
          :value="textColor"
          type="color"
          :title="t('drawing.colors.custom')"
          :aria-label="t('drawing.colors.custom')"
          @input="$emit('update', { textColor: $event.target.value })"
        />
      </div>
    </label>

    <label>
      <span>{{ t('drawing.props.strokeWidth') }}</span>
      <input :value="strokeWidth" type="range" min="1" max="8" step="0.5" @input="$emit('update', { strokeWidth: Number($event.target.value) })" />
    </label>

    <label v-if="isNode">
      <span>{{ t('drawing.props.fontSize') }}</span>
      <input :value="fontSize" type="range" min="10" max="28" step="1" @input="$emit('update', { fontSize: Number($event.target.value) })" />
    </label>

    <label>
      <span>{{ t('drawing.props.animation') }}</span>
      <select :value="animation" @change="$emit('update', { animation: $event.target.value })">
        <option value="none">{{ t('drawing.shapes.stopAnim') }}</option>
        <option v-if="isNode" value="pulse">{{ t('drawing.shapes.pulse') }}</option>
        <option v-if="isNode" value="breathe">{{ t('drawing.shapes.breathe') }}</option>
        <option v-if="isNode" value="bounce">{{ t('drawing.shapes.bounce') }}</option>
        <option v-if="isEdge" value="flow">{{ t('drawing.shapes.flow') }}</option>
      </select>
    </label>
  </aside>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

defineProps({
  hasSelection: { type: Boolean, default: false },
  isNode: { type: Boolean, default: false },
  isEdge: { type: Boolean, default: false },
  label: { type: String, default: '' },
  fill: { type: String, default: '#ffffff' },
  textColor: { type: String, default: '#1c1917' },
  strokeWidth: { type: Number, default: 1.5 },
  fontSize: { type: Number, default: 13 },
  animation: { type: String, default: 'none' }
})

defineEmits(['update'])
const { t } = useI18n()

const fillColors = [
  { name: 'macaronPink', value: '#ffd6e7' },
  { name: 'macaronYellow', value: '#ffe5b4' },
  { name: 'macaronGreen', value: '#cdeccf' },
  { name: 'macaronBlue', value: '#cfe8ff' },
  { name: 'macaronPurple', value: '#e6d7ff' },
  { name: 'paleYellow', value: '#fff7cc' },
  { name: 'paleTeal', value: '#d6f5ee' },
  { name: 'lightGray', value: '#f1f2f4' },
  { name: 'white', value: '#ffffff' }
]

const textColors = [
  { name: 'black', value: '#1c1917' },
  { name: 'charcoal', value: '#374151' },
  { name: 'slate', value: '#4b5563' },
  { name: 'navy', value: '#1e3a8a' },
  { name: 'darkGreen', value: '#166534' },
  { name: 'darkRed', value: '#991b1b' },
  { name: 'darkPurple', value: '#581c87' },
  { name: 'darkTeal', value: '#0f766e' }
]
</script>

<style scoped>
.property-panel {
  position: absolute;
  z-index: 20;
  top: 72px;
  right: 16px;
  width: 220px;
  padding: 14px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-primary) 92%, transparent);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(16px);
}
.property-panel header { margin-bottom: 12px; font-size: 13px; font-weight: 650; }
.property-panel label { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; color: var(--text-secondary); font-size: 11px; }
.property-panel input[type='text'],
.property-panel select {
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  background: var(--bg-primary);
}
.color-picker {
  display: grid;
  grid-template-columns: repeat(6, 20px);
  gap: 6px;
  align-items: center;
}
.color-swatch {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid rgba(28, 25, 23, .16);
  border-radius: 50%;
  cursor: pointer;
}
.color-swatch:hover { transform: scale(1.12); }
.color-swatch.selected { outline: 2px solid var(--accent-color); outline-offset: 2px; }
.color-picker input[type='color'] {
  width: 20px;
  height: 20px;
  padding: 2px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
}
</style>
