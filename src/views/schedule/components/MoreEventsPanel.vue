<template>
  <Teleport to="body">
    <div v-if="visible" class="more-overlay" @click="close" @contextmenu.prevent>
      <div class="more-panel" :style="{ left: pos.x + 'px', top: pos.y + 'px' }" @click.stop>
        <div class="more-panel-header">
          <span class="more-panel-date">{{ date }}</span>
          <span class="more-panel-count">{{ t('schedule.eventCount', { count: events.length }) }}</span>
        </div>
        <div class="more-panel-list">
          <div
            v-for="event in events"
            :key="event.id"
            :class="['more-panel-item', event.completed ? 'is-completed' : 'is-incomplete']"
            :style="{ backgroundColor: getEventBgColor(event), borderLeftColor: getEventDisplayColor(event) }"
            @click.stop="$emit('event-click', event)"
            @contextmenu.prevent.stop="$emit('event-right-click', $event, event)"
          >
            <div class="more-panel-item-main">
              <div class="more-panel-item-title">
                <span class="more-panel-item-title-text">{{ event.title }}</span>
                <span
                  class="more-panel-item-priority"
                  :class="priorityClass(event.priority)"
                  :title="priorityLabel(event.priority)"
                >
                  <span class="more-panel-item-priority-dot"></span>
                  {{ priorityLabel(event.priority) }}
                </span>
              </div>
              <div class="more-panel-item-meta">
                <span v-if="event.start !== event.end" class="more-panel-item-range">{{ event.start }} ~ {{ event.end }}</span>
                <span v-else-if="!event.allDay && event.startTime" class="more-panel-item-time">{{ event.startTime }} - {{ event.endTime }}</span>
                <span v-else class="more-panel-item-allday">{{ t('schedule.allDay') }}</span>
              </div>
            </div>
            <button
              class="more-panel-toggle"
              :title="event.completed ? t('schedule.markUncomplete') : t('schedule.markComplete')"
              @click.stop="$emit('toggle-complete', event)"
            >
              <svg v-if="event.completed" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { onDeactivated } from 'vue';
import { useI18n } from 'vue-i18n';
import { getEventBgColor, getEventDisplayColor } from '../utils/calendarHelpers';
import { DEFAULT_EVENT_PRIORITY } from '@/store/modules/schedule';

const { t } = useI18n();

defineProps({
  visible: { type: Boolean, default: false },
  date: { type: String, default: '' },
  events: { type: Array, default: () => [] },
  pos: { type: Object, default: () => ({ x: 0, y: 0 }) },
});

const emit = defineEmits(['close', 'event-click', 'event-right-click', 'toggle-complete']);

function priorityClass(p) {
  return `priority-${p || DEFAULT_EVENT_PRIORITY}`;
}

function priorityLabel(p) {
  const key = p || DEFAULT_EVENT_PRIORITY;
  if (key === 'urgent') return t('schedule.priorityUrgent');
  if (key === 'minor') return t('schedule.priorityMinor');
  return t('schedule.priorityImportant');
}

function close() {
  emit('close');
}

onDeactivated(() => emit('close'));
</script>

<style scoped>
.more-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 900;
}

.more-panel {
  position: fixed;
  width: 260px;
  max-height: 360px;
  background: var(--bg-primary);
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: panelIn 0.15s ease;
  z-index: 901;
}

@keyframes panelIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.more-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  font-size: 12px;
}

.more-panel-date {
  font-weight: 600;
  color: var(--text-primary);
}

.more-panel-count {
  color: var(--text-secondary);
  font-size: 11px;
}

.more-panel-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.more-panel-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 5px;
  border-left: 3px solid;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.more-panel-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.more-panel-item-main {
  flex: 1;
  min-width: 0;
}

.more-panel-item-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-primary);
}

.more-panel-item-title-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.more-panel-item-priority {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.more-panel-item-priority-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.more-panel-item-priority.priority-urgent {
  background: rgba(239, 68, 68, 0.14);
  color: #b91c1c;
}
.more-panel-item-priority.priority-important {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}
.more-panel-item-priority.priority-minor {
  background: rgba(100, 116, 139, 0.14);
  color: #475569;
}

.more-panel-item.is-completed .more-panel-item-title {
  font-weight: 400;
  opacity: 0.65;
}

.more-panel-item.is-incomplete .more-panel-item-title {
  font-weight: 700;
  opacity: 1.0;
}

.more-panel-item-meta {
  font-size: 10px;
  color: var(--text-secondary);
  margin-top: 1px;
}

.more-panel-toggle {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  transition: background-color 0.12s;
}

.more-panel-toggle:hover {
  background-color: rgba(0, 0, 0, 0.06);
}
</style>
