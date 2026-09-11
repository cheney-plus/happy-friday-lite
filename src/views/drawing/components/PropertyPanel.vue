<template>
  <aside v-if="hasSelection" class="property-panel" @mousedown.stop>
    <header>{{ t('drawing.props.title') }}</header>

    <label v-if="isNode">
      <span>{{ t('drawing.props.label') }}</span>
      <input :value="label" type="text" @change="$emit('update', { label: $event.target.value })" />
    </label>

    <label v-if="isNode">
      <span>{{ t('drawing.props.fill') }}</span>
      <input :value="fill" type="color" @input="$emit('update', { fill: $event.target.value })" />
    </label>

    <label>
      <span>{{ t('drawing.props.stroke') }}</span>
      <input :value="stroke" type="color" @input="$emit('update', { stroke: $event.target.value })" />
    </label>

    <label>
      <span>{{ t('drawing.props.strokeWidth') }}</span>
      <input :value="strokeWidth" type="range" min="1" max="8" step="0.5" @input="$emit('update', { strokeWidth: Number($event.target.value) })" />
    </label>

    <label v-if="isNode">
      <span>{{ t('drawing.props.fontSize') }}</span>
      <input :value="fontSize" type="range" min="10" max="28" step="1" @input="$emit('update', { fontSize: Number($event.target.value) })" />
    </label>

    <label v-if="isEdge">
      <span>{{ t('drawing.props.router') }}</span>
      <select :value="router" @change="$emit('update', { router: $event.target.value })">
        <option value="normal">Normal</option>
        <option value="orth">Orth</option>
        <option value="manhattan">Manhattan</option>
        <option value="er">ER</option>
        <option value="metro">Metro</option>
      </select>
    </label>

    <label v-if="isEdge">
      <span>{{ t('drawing.props.connector') }}</span>
      <select :value="connector" @change="$emit('update', { connector: $event.target.value })">
        <option value="normal">Normal</option>
        <option value="rounded">Rounded</option>
        <option value="smooth">Smooth</option>
        <option value="jumpover">Jumpover</option>
      </select>
    </label>

    <label>
      <span>{{ t('drawing.props.animation') }}</span>
      <select :value="animation" @change="$emit('update', { animation: $event.target.value })">
        <option value="none">{{ t('drawing.shapes.stopAnim') }}</option>
        <option value="pulse">{{ t('drawing.shapes.pulse') }}</option>
        <option value="breathe">{{ t('drawing.shapes.breathe') }}</option>
        <option value="bounce">{{ t('drawing.shapes.bounce') }}</option>
        <option value="flow">{{ t('drawing.shapes.flow') }}</option>
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
  stroke: { type: String, default: '#94a3b8' },
  strokeWidth: { type: Number, default: 1.5 },
  fontSize: { type: Number, default: 13 },
  router: { type: String, default: 'manhattan' },
  connector: { type: String, default: 'rounded' },
  animation: { type: String, default: 'none' }
})

defineEmits(['update'])
const { t } = useI18n()
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
.property-panel input[type='color'] {
  width: 100%;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
}
</style>
