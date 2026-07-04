<template>
  <Teleport to="body">
    <div v-if="visible" class="event-modal-overlay" @click.self="close">
      <div class="event-modal">
        <div class="modal-header">
          <h3>{{ t('schedule.createEvent') }}</h3>
          <button class="modal-close-btn" @click="close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="modal-body">
          <ScheduleEventForm ref="formRef" :model="formData" @submit="save" />
        </div>
        <div class="modal-footer">
          <div class="footer-spacer"></div>
          <button class="btn btn-secondary" @click="close">{{ t('schedule.cancel') }}</button>
          <button class="btn btn-primary" @click="save" :disabled="!formData.title.trim()">{{ t('schedule.save') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, nextTick, onMounted, onUnmounted, onDeactivated } from 'vue';
import { useI18n } from 'vue-i18n';
import { EVENT_COLORS } from '@/store/modules/schedule';
import ScheduleEventForm from './ScheduleEventForm.vue';

const { t } = useI18n();
const emit = defineEmits(['save']);

const visible = ref(false);
const formRef = ref(null);

const formData = reactive({
  title: '',
  start: '',
  end: '',
  startTime: '09:00',
  endTime: '10:00',
  allDay: true,
  description: '',
  color: EVENT_COLORS[0],
  reminder: false,
  completed: false,
});

/**
 * 打开创建弹窗
 * @param {{ start?: string, end?: string, startTime?: string, endTime?: string, allDay?: boolean }} initial
 */
function open(initial = {}) {
  const date = initial.start || new Date().toISOString().split('T')[0];
  Object.assign(formData, {
    title: '',
    start: date,
    end: initial.end || date,
    allDay: initial.allDay !== undefined ? initial.allDay : true,
    startTime: initial.startTime || '09:00',
    endTime: initial.endTime || '10:00',
    description: '',
    color: EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)],
    reminder: false,
    completed: false,
  });
  visible.value = true;
  nextTick(() => formRef.value?.focusTitle());
}

function close() {
  visible.value = false;
}

function save() {
  if (!formData.title.trim()) return;
  emit('save', {
    title: formData.title,
    start: formData.start,
    end: formData.end,
    allDay: formData.allDay,
    startTime: formData.allDay ? '' : formData.startTime,
    endTime: formData.allDay ? '' : formData.endTime,
    description: formData.description,
    color: formData.color,
    reminder: formData.reminder,
    completed: formData.completed,
  });
  close();
}

function onKeydown(e) {
  if (e.key === 'Escape' && visible.value) close();
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onUnmounted(() => document.removeEventListener('keydown', onKeydown));
onDeactivated(() => { visible.value = false; });

defineExpose({ open, close, visible });
</script>

<style scoped>
.event-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.event-modal {
  background: var(--bg-primary);
  border-radius: 14px;
  width: 440px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 0;
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s;
}

.modal-close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 16px 20px;
}

.modal-footer {
  display: flex;
  align-items: center;
  padding: 12px 20px 18px;
  gap: 8px;
}

.footer-spacer {
  flex: 1;
}

.btn {
  padding: 0 16px;
  height: 34px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  font-family: inherit;
}

.btn:hover {
  opacity: 0.9;
}

.btn-primary {
  background: var(--accent-color);
  color: white;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
</style>
