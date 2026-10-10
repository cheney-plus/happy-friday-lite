<template>
  <div class="quadrant-view">
    <div class="quadrant-grid">
      <section
        v-for="(quad, qIdx) in quadrantDefs"
        :key="quad.key"
        :class="['quadrant-card', `q-${quad.key}`]"
        @dblclick="onQuadrantDblClick(quad.key)"
      >
        <header class="quadrant-header">
          <span class="quadrant-badge">{{ qIdx + 1 }}</span>
          <span class="quadrant-title">{{ quad.title }}</span>
        </header>

        <div class="quadrant-body">
          <template v-if="quad.groups.length">
            <div
              v-for="group in quad.groups"
              :key="group.key"
              class="task-group"
            >
              <div class="group-header" @click="toggleGroup(qIdx, group.key)" @dblclick.stop>
                <svg
                  class="group-chevron"
                  :class="{ collapsed: isGroupCollapsed(qIdx, group.key) }"
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2.5"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <span class="group-title">{{ group.label }}</span>
                <span class="group-count">{{ group.items.length }}</span>
              </div>
              <div v-show="!isGroupCollapsed(qIdx, group.key)" class="group-items">
                <div
                  v-for="ev in group.items"
                  :key="ev.id"
                  :class="['task-row', { completed: ev.completed }]"
                  @click="openDetail(ev)"
                  @dblclick.stop
                >
                  <button class="task-checkbox" @click.stop="toggleComplete(ev)">
                    <svg v-if="ev.completed" width="16" height="16" viewBox="0 0 24 24" :fill="quad.color" stroke="white" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="4"></rect>
                      <polyline points="20 6 9 17 4 12" stroke="white" fill="none"></polyline>
                    </svg>
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="quad.color" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="4"></rect>
                    </svg>
                  </button>
                  <span :class="['task-title', { 'line-through': ev.completed }]">{{ ev.title }}</span>
                  <span class="task-meta">
                    <span v-if="!ev.allDay && ev.startTime" class="task-time">{{ ev.startTime }}</span>
                    <span v-if="dateLabel(ev)" class="task-date" :class="dateClass(ev)">{{ dateLabel(ev) }}</span>
                  </span>
                  <button class="task-delete" :title="t('schedule.delete')" @click.stop="deleteEvent(ev)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="quadrant-empty">{{ t('schedule.quadrantEmpty') }}</div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated } from 'vue';
import { useI18n } from 'vue-i18n';
import { useScheduleStore, normalizePriority } from '@/store/modules/schedule';
import { useCalendarHelpers } from './utils/calendarHelpers';

const { t } = useI18n();
const emit = defineEmits(['open-event', 'create-event']);
const scheduleStore = useScheduleStore();
const { getMonthDayLabel } = useCalendarHelpers();

const events = computed(() => scheduleStore.events);

// 响应式"当前时间"，keep-alive 重激活时刷新，避免日期分组陈旧
const now = ref(new Date());

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const todayStr = computed(() => toLocalDateStr(now.value));

// 当前时刻 HH:mm，用于判断"今天但有具体时间"的日程是否已过期
const nowTimeStr = computed(() =>
  `${String(now.value.getHours()).padStart(2, '0')}:${String(now.value.getMinutes()).padStart(2, '0')}`
);

function shiftedStr(days) {
  const d = new Date(now.value);
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

const tomorrowStr = computed(() => shiftedStr(1));
// 7 天视界：仅用于行内日期标签的淡化展示
const horizonStr = computed(() => shiftedStr(7));

// ========== 象限映射 ==========
// 四等级重要性与四象限一一对应（旧三级数据已在 store 加载时归一化）
function quadrantIndexOf(ev) {
  switch (normalizePriority(ev.priority)) {
    case 'urgent-important': return 0;
    case 'minor-urgent': return 2;
    case 'minor': return 3;
    default: return 1;
  }
}

// ========== 固定三分组：待完成 / 已过期 / 已完成 ==========
const groupOrder = ['pending', 'overdue', 'completed'];

function groupKeyOf(ev) {
  if (ev.completed) return 'completed';
  if (!ev.start) return 'pending';
  if (ev.start < todayStr.value) return 'overdue';
  // 日程为今天时：有具体开始时间且已过的，同样视为已过期
  if (ev.start === todayStr.value && !ev.allDay && ev.startTime && ev.startTime <= nowTimeStr.value) return 'overdue';
  return 'pending';
}

function groupLabel(key) {
  if (key === 'pending') return t('schedule.groupPending');
  if (key === 'overdue') return t('schedule.groupOverdue');
  return t('schedule.completed');
}

const quadrantDefs = computed(() => {
  const defs = [
    { key: 'urgent-important', title: t('schedule.quadrantUrgentImportant'), color: 'var(--quadrant-red)' },
    { key: 'important', title: t('schedule.quadrantImportant'), color: 'var(--quadrant-orange)' },
    { key: 'minor-urgent', title: t('schedule.quadrantUrgent'), color: 'var(--quadrant-blue)' },
    { key: 'neither', title: t('schedule.quadrantNeither'), color: 'var(--quadrant-teal)' },
  ];
  const buckets = defs.map(() => new Map());
  for (const ev of events.value) {
    const qIdx = quadrantIndexOf(ev);
    const gKey = groupKeyOf(ev);
    if (!buckets[qIdx].has(gKey)) buckets[qIdx].set(gKey, []);
    buckets[qIdx].get(gKey).push(ev);
  }
  return defs.map((def, qIdx) => ({
    ...def,
    groups: groupOrder
      .filter(gKey => buckets[qIdx].has(gKey))
      // 待完成/已过期按时间降序排列，已完成保持升序
      .map(gKey => ({ key: gKey, label: groupLabel(gKey), items: sortItems(buckets[qIdx].get(gKey), gKey !== 'completed') })),
  }));
});

function sortItems(list, descending = false) {
  const dir = descending ? -1 : 1;
  return [...list].sort((a, b) => {
    // 无日期的固定排最前；同日期按开始时间排序（无具体时间的排当日最前）
    if (!a.start && !b.start) return 0;
    if (!a.start) return -1;
    if (!b.start) return 1;
    if (a.start !== b.start) return (a.start < b.start ? -1 : 1) * dir;
    const at = a.startTime || '';
    const bt = b.startTime || '';
    if (!at && !bt) return 0;
    if (!at) return -1;
    if (!bt) return 1;
    return (at < bt ? -1 : at > bt ? 1 : 0) * dir;
  });
}

// ========== 分组折叠 ==========
// 待完成/已过期默认展开，已完成默认收缩（仍可手动切换）
const DEFAULT_COLLAPSED = ['completed'];
const collapsedGroups = ref(new Set(
  [0, 1, 2, 3].flatMap(qIdx => DEFAULT_COLLAPSED.map(g => `${qIdx}:${g}`))
));

function groupKey(qIdx, gKey) {
  return `${qIdx}:${gKey}`;
}

function isGroupCollapsed(qIdx, gKey) {
  return collapsedGroups.value.has(groupKey(qIdx, gKey));
}

function toggleGroup(qIdx, gKey) {
  const key = groupKey(qIdx, gKey);
  const next = new Set(collapsedGroups.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  collapsedGroups.value = next;
}

// ========== 行内展示 ==========
function dateLabel(ev) {
  if (!ev.start) return '';
  if (ev.end && ev.end !== ev.start) {
    return `${getMonthDayLabel(ev.start)} ~ ${getMonthDayLabel(ev.end)}`;
  }
  if (ev.start === todayStr.value) return t('schedule.groupToday');
  if (ev.start === tomorrowStr.value) return t('schedule.groupTomorrow');
  return getMonthDayLabel(ev.start);
}

function dateClass(ev) {
  if (ev.completed) return '';
  if (!ev.start || ev.start > horizonStr.value) return 'dim';
  if (ev.start < todayStr.value) return 'overdue';
  if (ev.start <= tomorrowStr.value) return 'soon';
  return '';
}

function openDetail(ev) {
  emit('open-event', ev);
}

// 双击象限空白处新建日程，自动带入该象限对应的优先级
function onQuadrantDblClick(quadKey) {
  emit('create-event', quadKey === 'neither' ? 'minor' : quadKey);
}

async function toggleComplete(ev) {
  await scheduleStore.updateEvent(ev.id, { completed: !ev.completed });
}

// 删除日程（带确认），同 EventFormModal 的确认方式
function deleteEvent(ev) {
  if (window.confirm(t('schedule.confirmDelete'))) {
    scheduleStore.removeEvent(ev.id);
  }
}

// 定时刷新当前时间：视图停留时已到时的日程能自动归入"已过期"
let nowTimer = null

onMounted(() => {
  scheduleStore.loadEvents();
  nowTimer = setInterval(() => {
    now.value = new Date();
  }, 30 * 1000);
});

onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer);
});

// keep-alive 重激活时刷新数据与当前时间
onActivated(() => {
  now.value = new Date();
  scheduleStore.loadEvents();
});
</script>

<style scoped>
.quadrant-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  /* 象限主题色（徽标底色 + 文字色分离，便于深色下单独提亮文字） */
  --quadrant-red: #e03131;
  --quadrant-red-text: #e03131;
  --quadrant-orange: #f08c00;
  --quadrant-orange-text: #e8590c;
  --quadrant-blue: #1971c2;
  --quadrant-blue-text: #1971c2;
  --quadrant-teal: #0ca678;
  --quadrant-teal-text: #0ca678;
}

[data-theme='dark'] .quadrant-view {
  --quadrant-red: #e03131;
  --quadrant-red-text: #ff8787;
  --quadrant-orange: #f08c00;
  --quadrant-orange-text: #ffa94d;
  --quadrant-blue: #339af0;
  --quadrant-blue-text: #74c0fc;
  --quadrant-teal: #0ca678;
  --quadrant-teal-text: #63e6be;
}

.quadrant-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 12px;
}

/* ========== 象限卡片 ========== */
.quadrant-card {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.2s ease;
  overflow: hidden;
}

.quadrant-card:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.09);
}

.quadrant-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 8px;
  flex-shrink: 0;
}

.quadrant-badge {
  width: 17px;
  height: 17px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  flex-shrink: 0;
}

.q-urgent-important .quadrant-badge { background: var(--quadrant-red); }
.q-important .quadrant-badge { background: var(--quadrant-orange); }
.q-minor-urgent .quadrant-badge { background: var(--quadrant-blue); }
.q-neither .quadrant-badge { background: var(--quadrant-teal); }

.quadrant-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}

.q-urgent-important .quadrant-title { color: var(--quadrant-red-text); }
.q-important .quadrant-title { color: var(--quadrant-orange-text); }
.q-minor-urgent .quadrant-title { color: var(--quadrant-blue-text); }
.q-neither .quadrant-title { color: var(--quadrant-teal-text); }

/* ========== 任务区域 ========== */
.quadrant-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 6px 8px;
}

/* 细滚动条：悬停时显现 */
.quadrant-body::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}

.quadrant-body::-webkit-scrollbar-track {
  background: transparent;
}

.quadrant-body::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
}

.quadrant-body:hover::-webkit-scrollbar-thumb {
  background: var(--border-color);
}

.quadrant-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--text-tertiary);
  padding-bottom: 24px;
}

.task-group + .task-group {
  margin-top: 4px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px 6px;
  cursor: pointer;
  user-select: none;
  border-radius: 6px;
  color: var(--text-secondary);
}

.group-header:hover {
  background: var(--bg-hover);
}

.group-chevron {
  color: var(--text-tertiary);
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.group-chevron.collapsed {
  transform: rotate(-90deg);
}

.group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.group-count {
  font-size: 12px;
  color: var(--text-tertiary);
}

.group-items {
  padding-bottom: 2px;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px 7px 26px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.task-row:hover {
  background: var(--bg-hover);
}

.task-row + .task-row {
  position: relative;
}

.task-row + .task-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 26px;
  right: 10px;
  height: 1px;
  background: var(--border-color);
  opacity: 0.6;
}

.task-row:hover + .task-row::before,
.task-row:hover::before {
  opacity: 0;
}

.task-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}

.task-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-row.completed .task-title {
  color: var(--text-tertiary);
}

.line-through {
  text-decoration: line-through;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.task-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.task-date {
  font-size: 12px;
  color: var(--text-tertiary);
}

.task-date.overdue {
  color: var(--quadrant-red-text);
}

.task-date.soon {
  color: var(--quadrant-orange-text);
}

.task-date.dim {
  color: var(--text-tertiary);
}

/* 删除按钮：默认隐藏，悬停任务行时显现 */
.task-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.task-row:hover .task-delete {
  opacity: 1;
  visibility: visible;
}

.task-delete:hover {
  color: var(--quadrant-red-text);
}

/* ========== 深色主题 ========== */
[data-theme='dark'] .quadrant-card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

[data-theme='dark'] .quadrant-card:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
</style>
