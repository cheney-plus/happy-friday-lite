<template>
  <Teleport to="body">
    <div v-if="visible" class="ctx-overlay" @click="close" @contextmenu.prevent>
      <div class="ctx-menu" :style="menuStyle">
        <div v-if="event" class="ctx-item" @click="onToggleComplete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="event.completed ? 'var(--text-tertiary)' : 'var(--text-secondary)'" stroke-width="2">
            <polyline v-if="!event.completed" points="20 6 9 17 4 12"></polyline>
            <circle v-else cx="12" cy="12" r="10"></circle>
          </svg>
          {{ event.completed ? t('schedule.markUncomplete') : t('schedule.markComplete') }}
        </div>
        <div v-if="event && event.start" class="ctx-item" @click="onPostponeWeek">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>
          {{ t('schedule.postponeWeek') }}
        </div>
        <div class="ctx-item danger" @click="onDelete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          {{ t('schedule.deleteEvent') }}
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onDeactivated } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  visible: { type: Boolean, default: false },
  event: { type: Object, default: null },
  pos: { type: Object, default: () => ({ x: 0, y: 0 }) },
});

const emit = defineEmits(['close', 'toggle-complete', 'postpone-week', 'delete']);

// 钳制菜单位置，避免靠近右/下边缘时溢出视口
const MENU_MARGIN = 8;
const MENU_EST_WIDTH = 180;
const MENU_EST_HEIGHT = 132;

const menuStyle = computed(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = props.pos.x;
  let y = props.pos.y;
  if (x + MENU_EST_WIDTH > vw - MENU_MARGIN) x = Math.max(MENU_MARGIN, vw - MENU_MARGIN - MENU_EST_WIDTH);
  if (y + MENU_EST_HEIGHT > vh - MENU_MARGIN) y = Math.max(MENU_MARGIN, vh - MENU_MARGIN - MENU_EST_HEIGHT);
  return { left: x + 'px', top: y + 'px' };
});

function close() {
  emit('close');
}

function onToggleComplete() {
  emit('toggle-complete', props.event);
}

function onPostponeWeek() {
  emit('postpone-week', props.event);
}

function onDelete() {
  emit('delete', props.event);
}

onDeactivated(() => emit('close'));
</script>

<style scoped>
.ctx-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
}

.ctx-menu {
  position: fixed;
  background: var(--bg-primary);
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
  padding: 5px;
  min-width: 160px;
  animation: ctxIn 0.15s ease;
  z-index: 1001;
}

@keyframes ctxIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 7px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.12s;
  color: var(--text-primary);
  user-select: none;
}

.ctx-item:hover {
  background-color: var(--bg-hover);
}

.ctx-item.danger:hover {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
</style>
