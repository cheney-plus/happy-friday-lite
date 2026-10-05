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

    <div v-if="!model.hasDate" class="form-group">
      <button type="button" class="set-date-btn" @click="onHasDateChange(true)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01M16 18h.01"></path></svg>
        <span>{{ t('schedule.setDate') }}</span>
      </button>
    </div>

    <template v-else>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ t('schedule.startDate') }}</label>
          <input :value="model.start" @input="onStartChange($event.target.value)" type="date" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('schedule.endDate') }}</label>
          <input :value="model.end" @input="onEndChange($event.target.value)" type="date" class="form-input" :min="model.start" />
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
          <button type="button" class="clear-date-btn" @click="onHasDateChange(false)">{{ t('schedule.clearDate') }}</button>
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
    </template>

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

const isPast = computed(() => {
  if (!props.model.end) return false;
  const today = new Date().toISOString().split('T')[0];
  return props.model.end < today;
});

function onFieldChange(field, value) {
  props.model[field] = value;
  emit('change', { field, value });
}

// 结束日期是否被手动设置过：设过则改开始日期时不再同步
// 初始时若 end 与 start 不同，说明结束日期已被预设（跨日拖选/已有日程），视为已设置
const endTouched = ref(!!props.model.end && props.model.end !== props.model.start);

function onStartChange(value) {
  onFieldChange('start', value);
  if (!endTouched.value && value) {
    props.model.end = value;
    emit('change', { field: 'end', value });
  }
}

function onEndChange(value) {
  endTouched.value = true;
  onFieldChange('end', value);
}

// 关闭"设置日期"时清除到期提醒（无日期的日程不会过期，提醒无意义）
function onHasDateChange(checked) {
  props.model.hasDate = checked;
  if (!checked && props.model.reminder) {
    props.model.reminder = false;
    emit('change', { field: 'reminder', value: false });
  }
  emit('change', { field: 'hasDate', value: checked });
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
  align-items: center;
}

.set-date-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  align-self: flex-start;
  padding: 7px 12px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, color 0.15s;
}

.set-date-btn svg {
  color: var(--text-tertiary);
  transition: color 0.15s;
}

.set-date-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.set-date-btn:hover svg {
  color: var(--accent-color);
}

.clear-date-btn {
  margin-left: auto;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.15s;
}

.clear-date-btn:hover {
  color: var(--text-primary);
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
