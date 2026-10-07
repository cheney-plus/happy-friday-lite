<template>
  <div class="event-form">
    <div class="form-group">
      <input
        ref="titleInputRef"
        :value="model.title"
        @input="onFieldChange('title', $event.target.value)"
        type="text"
        class="title-input"
        :placeholder="t('schedule.eventTitlePlaceholder')"
        @keydown.enter="$emit('submit')"
      />
    </div>

    <div class="form-group">
      <textarea
        :value="model.description"
        @input="onFieldChange('description', $event.target.value)"
        class="desc-textarea"
        :placeholder="t('schedule.descriptionPlaceholder')"
        rows="3"
      ></textarea>
    </div>

    <div v-if="model.hasDate && !model.allDay" class="form-row">
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
      <label class="form-label">{{ t('schedule.priority') }}</label>
      <div class="priority-picker">
        <button
          v-for="opt in priorityOptions"
          :key="opt.key"
          type="button"
          :class="['priority-option', opt.key, { active: model.priority === opt.key }]"
          @click="onFieldChange('priority', opt.key)"
        >
          <span class="priority-dot"></span>
          <span>{{ opt.label }}</span>
        </button>
      </div>
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
import { EVENT_COLORS, DEFAULT_EVENT_PRIORITY } from '@/store/modules/schedule';

const { t } = useI18n();

const props = defineProps({
  /** 反应式表单数据对象，由父组件持有 */
  model: { type: Object, required: true },
});

const emit = defineEmits(['change', 'submit']);

const titleInputRef = ref(null);

// 优先级缺失时回填默认值，保证表单始终有可用值
if (!props.model.priority) {
  props.model.priority = DEFAULT_EVENT_PRIORITY;
}

const priorityOptions = computed(() => [
  { key: 'urgent-important', label: t('schedule.priorityUrgentImportant') },
  { key: 'important', label: t('schedule.priorityImportant') },
  { key: 'minor-urgent', label: t('schedule.priorityMinorUrgent') },
  { key: 'minor', label: t('schedule.priorityMinor') },
]);

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

/* 大标题式标题输入（无边框极简风） */
.title-input {
  border: none;
  background: transparent;
  padding: 0;
  outline: none;
  width: 100%;
  font-family: inherit;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  box-sizing: border-box;
}

.title-input::placeholder {
  color: var(--text-tertiary);
  opacity: 1;
}

/* 无边框描述输入 */
.desc-textarea {
  border: none;
  background: transparent;
  padding: 0;
  outline: none;
  resize: none;
  width: 100%;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  min-height: 90px;
  box-sizing: border-box;
}

.desc-textarea::placeholder {
  color: var(--text-tertiary);
  opacity: 1;
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

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
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

.priority-picker {
  display: flex;
  gap: 6px;
}

.priority-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.priority-option:hover {
  border-color: var(--text-tertiary);
  color: var(--text-primary);
}

.priority-option.active {
  color: var(--text-primary);
  font-weight: 600;
}

.priority-option.active.urgent-important {
  background: rgba(239, 68, 68, 0.12);
  border-color: #ef4444;
}

.priority-option.active.important {
  background: rgba(245, 158, 11, 0.12);
  border-color: #f59e0b;
}

.priority-option.active.minor-urgent {
  background: rgba(59, 130, 246, 0.12);
  border-color: #3b82f6;
}

.priority-option.active.minor {
  background: rgba(20, 184, 166, 0.12);
  border-color: #14b8a6;
}

.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-tertiary);
}

.priority-option.urgent-important .priority-dot { background: #ef4444; }
.priority-option.important .priority-dot { background: #f59e0b; }
.priority-option.minor-urgent .priority-dot { background: #3b82f6; }
.priority-option.minor .priority-dot { background: #14b8a6; }
</style>
