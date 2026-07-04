<template>
  <div class="schedule-detail">
    <button class="back-btn" @click="goBack">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>
    <h1 class="page-title">{{ t('schedule.title') }}</h1>

    <div v-if="event" class="detail-content">

      <div v-if="!isEditing" class="detail-view">
        <div class="group-title">日程详情</div>
        <div class="group-content">
          <div class="setting-item">
            <span class="item-label">{{ t('schedule.eventTitle') }}</span>
            <div class="item-value-row">
              <span class="color-dot" :style="{ backgroundColor: event.color }"></span>
              <span class="item-value-text">{{ event.title }}</span>
            </div>
          </div>

          <div class="setting-item">
            <span class="item-label">{{ t('schedule.dateRange') }}</span>
            <span class="item-value-text" v-if="event.start === event.end">{{ event.start }}</span>
            <span class="item-value-text" v-else>{{ event.start }} ~ {{ event.end }}</span>
          </div>

          <div v-if="!event.allDay && event.startTime" class="setting-item">
            <span class="item-label">{{ t('schedule.time') }}</span>
            <span class="item-value-text">{{ event.startTime }} - {{ event.endTime }}</span>
          </div>

          <div v-if="event.allDay" class="setting-item">
            <span class="item-label">{{ t('schedule.type') }}</span>
            <span class="item-value-text">{{ t('schedule.allDay') }}</span>
          </div>

          <div class="setting-item">
            <span class="item-label">{{ t('schedule.reminder') }}</span>
            <div class="item-value-row">
              <svg v-if="event.reminder" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              <span class="item-value-text">{{ event.reminder ? t('schedule.reminderOn') : t('schedule.reminderOff') }}</span>
            </div>
          </div>

          <div class="setting-item">
            <span class="item-label">{{ t('schedule.status') }}</span>
            <button class="status-toggle" @click="toggleStatus">
              <svg v-if="event.completed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 8 12 12 15 14"></polyline></svg>
              <span>{{ event.completed ? t('schedule.completed') : t('schedule.uncompleted') }}</span>
            </button>
          </div>

          <div v-if="event.description" class="setting-item desc-item">
            <span class="item-label">{{ t('schedule.description') }}</span>
            <p class="desc-text">{{ event.description }}</p>
          </div>
        </div>

        <div class="detail-actions-bar">
          <button class="action-btn" @click="startEdit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            {{ t('schedule.edit') }}
          </button>
          <button class="action-btn danger" @click="showDeleteConfirm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            {{ t('schedule.delete') }}
          </button>
        </div>
      </div>

      <div v-else class="edit-form">
        <div class="group-title">编辑日程</div>
        <div class="group-content edit-group">
          <ScheduleEventForm ref="editFormRef" :model="editForm" @submit="saveEdit" />
        </div>

        <div class="edit-actions-bar">
          <button class="cancel-btn" @click="cancelEdit">{{ t('schedule.cancel') }}</button>
          <button class="save-btn" @click="saveEdit" :disabled="!editForm.title.trim()">{{ t('schedule.save') }}</button>
        </div>
      </div>
    </div>

    <div v-else class="detail-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      <p>{{ t('schedule.noEvents') }}</p>
      <button class="btn-back" @click="goBack">{{ t('schedule.back') }}</button>
    </div>

    <Teleport to="body">
      <div v-if="deleteConfirmVisible" class="modal-overlay" @click.self="cancelDelete">
        <div class="delete-confirm-dialog">
          <div class="delete-confirm-content">
            <p class="delete-confirm-title">确认删除</p>
            <p class="delete-confirm-message">确定要删除日程「{{ event?.title }}」吗？</p>
            <p class="delete-confirm-hint">此操作不可撤销</p>
          </div>
          <div class="delete-confirm-actions">
            <button class="cancel-btn" @click="cancelDelete">取消</button>
            <button class="confirm-delete-btn" @click="doDelete">删除</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onDeactivated } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useScheduleStore, EVENT_COLORS } from '@/store/modules/schedule';
import ScheduleEventForm from './components/ScheduleEventForm.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const scheduleStore = useScheduleStore();

const isEditing = ref(false);
const editFormRef = ref(null);
const deleteConfirmVisible = ref(false);

const eventId = computed(() => route.params.id);
const event = computed(() => scheduleStore.getEventById(eventId.value));

const editForm = reactive({
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

function goBack() {
  router.push('/schedule');
}

function startEdit() {
  if (!event.value) return;
  Object.assign(editForm, {
    title: event.value.title,
    start: event.value.start,
    end: event.value.end,
    allDay: event.value.allDay,
    startTime: event.value.startTime || '09:00',
    endTime: event.value.endTime || '10:00',
    description: event.value.description,
    color: event.value.color,
    reminder: event.value.reminder || false,
    completed: event.value.completed || false,
  });
  isEditing.value = true;
  nextTick(() => editFormRef.value?.focusTitle());
}

function cancelEdit() {
  isEditing.value = false;
}

async function saveEdit() {
  if (!editForm.title.trim() || !event.value) return;
  await scheduleStore.updateEvent(eventId.value, {
    title: editForm.title,
    start: editForm.start,
    end: editForm.end,
    allDay: editForm.allDay,
    startTime: editForm.allDay ? '' : editForm.startTime,
    endTime: editForm.allDay ? '' : editForm.endTime,
    description: editForm.description,
    color: editForm.color,
    reminder: editForm.reminder,
    completed: editForm.completed,
  });
  isEditing.value = false;
}

function showDeleteConfirm() {
  deleteConfirmVisible.value = true;
}

function cancelDelete() {
  deleteConfirmVisible.value = false;
}

async function doDelete() {
  await scheduleStore.removeEvent(eventId.value);
  deleteConfirmVisible.value = false;
  goBack();
}

async function toggleStatus() {
  if (!event.value) return;
  await scheduleStore.updateEvent(eventId.value, { completed: !event.value.completed });
}

onMounted(() => {
  if (!event.value) {
    goBack();
  }
});

onDeactivated(() => {
  deleteConfirmVisible.value = false;
});
</script>

<style scoped>
.schedule-detail {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 40px;
  position: relative;
}

.back-btn {
  position: absolute;
  top: 12px;
  left: 16px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  transition: all 0.15s;
  border-radius: 6px;
}

.back-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.back-btn svg {
  display: block;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 28px;
  max-width: 720px;
  width: 100%;
  text-align: left;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 720px;
  width: 100%;
}

.group-title {
  font-size: 14px;
  color: var(--text-tertiary);
  padding: 16px 0 10px;
  font-weight: 400;
}

.group-content {
  background-color: var(--bg-secondary);
  border-radius: 10px;
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  min-height: 52px;
}

.item-label {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  flex-shrink: 0;
}

.item-value-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.item-value-text {
  font-size: 14px;
  color: var(--text-secondary);
  text-align: right;
}

.desc-item {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.desc-text {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.7;
  white-space: pre-wrap;
  margin: 0;
}

.detail-actions-bar {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 16px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s;
  font-family: inherit;
  font-weight: 500;
}

.action-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.action-btn.danger:hover {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.edit-group {
  padding: 20px;
}

.edit-actions-bar {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

.cancel-btn {
  background-color: transparent;
  color: var(--text-primary);
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
  font-family: inherit;
  transition: background-color 0.15s;
}

.cancel-btn:hover {
  background-color: var(--bg-hover);
}

.save-btn {
  background-color: #d4d4d4;
  color: white;
  border: none;
  padding: 8px 28px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.save-btn:not(:disabled) {
  background-color: var(--accent-color);
}

.save-btn:not(:disabled):hover {
  opacity: 0.85;
}

.save-btn:disabled {
  cursor: not-allowed;
}

.detail-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-tertiary);
  padding: 60px 0;
}

.detail-empty p {
  font-size: 14px;
}

.btn-back {
  background-color: transparent;
  color: var(--text-primary);
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
  font-family: inherit;
  transition: background-color 0.15s;
}

.btn-back:hover {
  background-color: var(--bg-hover);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.delete-confirm-dialog {
  background-color: var(--bg-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 360px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.25s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.delete-confirm-content {
  padding: 24px;
}

.delete-confirm-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.delete-confirm-message {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 6px;
}

.delete-confirm-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
}

.delete-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.confirm-delete-btn {
  background-color: #ef4444;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
}

.confirm-delete-btn:hover {
  opacity: 0.9;
}

.status-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;
  font-family: inherit;
}

.status-toggle:hover {
  background-color: #ecfdf5;
}
</style>
