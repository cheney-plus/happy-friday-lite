<template>
  <div class="event-form">
    <div class="form-group">
      <label class="form-label">{{ t('schedule.eventTitle') }}</label>
      <input
        ref="titleInputRef"
        :value="model.title"
        @input="onFieldChange('title', $event.target.value)"
        type="text"
        class="form-input"
        :placeholder="t('schedule.eventTitlePlaceholder')"
        @keydown.enter="$emit('submit')"
      />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">{{ t('schedule.startDate') }}</label>
        <input :value="model.start" @input="onFieldChange('start', $event.target.value)" type="date" class="form-input" />
      </div>
      <div class="form-group">
        <label class="form-label">{{ t('schedule.endDate') }}</label>
        <input :value="model.end" @input="onFieldChange('end', $event.target.value)" type="date" class="form-input" :min="model.start" />
      </div>
    </div>

    <div class="form-group">
      <div class="checkbox-row">
        <label class="checkbox-label">
          <input type="checkbox" :checked="model.allDay" @change="onFieldChange('allDay', $event.target.checked)" class="checkbox-input" />
          <span class="checkbox-custom"></span>
          {{ t('schedule.allDay') }}
        </label>
        <label :class="['checkbox-label', { disabled: isPast }]">
          <input type="checkbox" :checked="model.reminder" @change="onFieldChange('reminder', $event.target.checked)" class="checkbox-input" :disabled="isPast" />
          <span class="checkbox-custom"></span>
          {{ t('schedule.reminder') }}
        </label>
      </div>
    </div>

    <div v-if="!model.allDay" class="form-row">
      <div class="form-group">
        <label class="form-label">{{ t('schedule.startTime') }}</label>
        <input :value="model.startTime" @input="onFieldChange('startTime', $event.target.value)" type="time" class="form-input" />
      </div>
      <div class="form-group">
        <label class="form-label">{{ t('schedule.endTime') }}</label>
        <input :value="model.endTime" @input="onFieldChange('endTime', $event.target.value)" type="time" class="form-input" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">{{ t('schedule.description') }}</label>
      <textarea
        :value="model.description"
        @input="onFieldChange('description', $event.target.value)"
        class="form-textarea"
        :placeholder="t('schedule.descriptionPlaceholder')"
        rows="3"
      ></textarea>
    </div>

    <div class="form-group">
      <label class="form-label">{{ t('schedule.color') }}</label>
      <div class="color-picker">
        <div
          v-for="color in EVENT_COLORS"
          :key="color"
          :class="['color-option', { active: model.color === color }]"
          :style="{ backgroundColor: color }"
          @click="onFieldChange('color', color)"
        >
          <svg v-if="model.color === color" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { EVENT_COLORS } from '@/store/modules/schedule';

const { t } = useI18n();

const props = defineProps({
  /** 反应式表单数据对象，由父组件持有 */
  model: { type: Object, required: true },
});

const emit = defineEmits(['change', 'submit']);

const titleInputRef = ref(null);

const isPast = computed(() => {
  if (!props.model.end) return false;
  const today = new Date().toISOString().split('T')[0];
  return props.model.end < today;
});

function onFieldChange(field, value) {
  props.model[field] = value;
  emit('change', { field, value });
}

function focusTitle() {
  titleInputRef.value?.focus();
}

defineExpose({ focusTitle });
</script>

<style scoped>
.event-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-input {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
  font-family: inherit;
  box-sizing: border-box;
  width: 100%;
}

.form-input:focus {
  border-color: var(--accent-color);
}

.form-textarea {
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.15s;
  box-sizing: border-box;
  width: 100%;
}

.form-textarea:focus {
  border-color: var(--accent-color);
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

.checkbox-row {
  display: flex;
  gap: 20px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  user-select: none;
}

.checkbox-label.disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.checkbox-input {
  display: none;
}

.checkbox-custom {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
  background: var(--bg-primary);
}

.checkbox-input:checked + .checkbox-custom {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.checkbox-input:checked + .checkbox-custom::after {
  content: '';
  width: 5px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) translate(-1px, -1px);
}

.color-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-option {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s, box-shadow 0.15s;
  border: 2px solid transparent;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.active {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 2px var(--bg-primary);
}
</style>
