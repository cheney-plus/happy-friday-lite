<template>
  <div class="task-list-view" @click="closeAllDropdowns">
    <!-- Filter Bar -->
    <div class="task-filter-bar">
      <div class="filter-left">
        <!-- Filter Dropdown -->
        <div class="dropdown-wrapper" ref="filterDropdownRef">
          <button class="dropdown-trigger" @click.stop="toggleFilterDropdown">
            <span class="trigger-text">{{ activeFilterLabel }}</span>
            <span class="trigger-count">{{ activeFilterCount }}</span>
            <svg class="trigger-arrow" :class="{ expanded: showFilterDropdown }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <Transition name="dropdown">
            <div v-if="showFilterDropdown" class="dropdown-panel filter-dropdown-panel" @click.stop>
              <div
                v-for="tab in filterTabs"
                :key="tab.key"
                :class="['dropdown-item', { active: activeFilter === tab.key }]"
                @click="selectFilter(tab.key)"
              >
                <span class="dropdown-item-label">{{ tab.label }}</span>
                <span class="dropdown-item-count">{{ tab.count }}</span>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Sort Dropdown -->
        <div class="dropdown-wrapper" ref="sortDropdownRef">
          <button class="dropdown-trigger" @click.stop="toggleSortDropdown">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"></path><path d="M3 12h12"></path><path d="M3 18h6"></path>
            </svg>
            <span class="trigger-text">{{ activeSortLabel }}</span>
            <svg class="trigger-arrow" :class="{ expanded: showSortDropdown }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <Transition name="dropdown">
            <div v-if="showSortDropdown" class="dropdown-panel sort-dropdown-panel" @click.stop>
              <div
                v-for="opt in sortOptions"
                :key="opt.key"
                :class="['dropdown-item', { active: sortBy === opt.key }]"
                @click="selectSort(opt.key)"
              >
                <svg v-if="sortBy === opt.key" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span v-else style="width:14px"></span>
                <span class="dropdown-item-label">{{ opt.label }}</span>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Stats Summary -->
    <div class="task-stats">
      <div class="stat-card">
        <div class="stat-icon-wrap total">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ totalTasks }}</div>
          <div class="stat-desc">{{ t('schedule.totalTasks') }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap completed">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number completed-num">{{ completedCount }}</div>
          <div class="stat-desc">{{ t('schedule.completed') }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap uncompleted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number uncompleted-num">{{ uncompletedCount }}</div>
          <div class="stat-desc">{{ t('schedule.uncompleted') }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap progress">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number progress-num">{{ completionRate }}<span class="stat-percent">%</span></div>
          <div class="stat-desc">{{ t('schedule.completionRate') }}</div>
        </div>
      </div>
    </div>

    <!-- Task List -->
    <div class="task-list-scroll">
      <div v-if="filteredTasks.length === 0" class="task-empty">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M9 11l3 3L22 4"></path>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
        <p>{{ t('schedule.noTasks') }}</p>
      </div>

      <div v-else class="task-items">
        <div
          v-for="task in filteredTasks"
          :key="task.id"
          :class="['task-item', { completed: task.completed }]"
          @click="onTaskClick(task)"
        >
          <button
            class="task-checkbox"
            @click.stop="toggleTaskComplete(task)"
          >
            <svg v-if="task.completed" width="16" height="16" viewBox="0 0 24 24" fill="#16a34a" stroke="white" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="4"></rect>
              <polyline points="20 6 9 17 4 12" stroke="white" fill="none"></polyline>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="4"></rect>
            </svg>
          </button>
          <span class="task-color-bar" :style="{ backgroundColor: task.color }"></span>
          <div class="task-content">
            <div :class="['task-title', { 'line-through': task.completed }]">{{ task.title }}</div>
            <div class="task-meta">
              <span class="task-date">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                {{ formatDate(task) }}
              </span>
              <span v-if="!task.allDay && task.startTime" class="task-time">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                {{ task.startTime }} - {{ task.endTime }}
              </span>
              <span v-if="task.reminder" class="task-reminder">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
              </span>
            </div>
          </div>
          <div :class="['task-status-badge', task.completed ? 'done' : 'pending']">
            {{ task.completed ? t('schedule.completed') : t('schedule.uncompleted') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useScheduleStore } from '@/store/modules/schedule';

const { t } = useI18n();
const router = useRouter();
const scheduleStore = useScheduleStore();

const activeFilter = ref('all');
const sortBy = ref('time');
const showFilterDropdown = ref(false);
const showSortDropdown = ref(false);
const filterDropdownRef = ref(null);
const sortDropdownRef = ref(null);

const allEvents = computed(() => scheduleStore.events);

const now = new Date();

function getWeekRange() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

function getMonthRange() {
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    start: new Date(y, m, 1).toISOString().split('T')[0],
    end: new Date(y, m + 1, 0).toISOString().split('T')[0],
  };
}

const weekRange = getWeekRange();
const monthRange = getMonthRange();

const completedCount = computed(() => allEvents.value.filter(e => e.completed).length);
const uncompletedCount = computed(() => allEvents.value.filter(e => !e.completed).length);
const totalTasks = computed(() => allEvents.value.length);
const completionRate = computed(() => {
  if (totalTasks.value === 0) return 0;
  return Math.round((completedCount.value / totalTasks.value) * 100);
});

const weekCount = computed(() =>
  allEvents.value.filter(e => e.start >= weekRange.start && e.start <= weekRange.end).length
);

const monthCount = computed(() =>
  allEvents.value.filter(e => e.start >= monthRange.start && e.start <= monthRange.end).length
);

const filterTabs = computed(() => [
  { key: 'all', label: t('schedule.filterAll'), count: totalTasks.value },
  { key: 'week', label: t('schedule.filterWeek'), count: weekCount.value },
  { key: 'month', label: t('schedule.filterMonth'), count: monthCount.value },
  { key: 'uncompleted', label: t('schedule.uncompleted'), count: uncompletedCount.value },
  { key: 'completed', label: t('schedule.completed'), count: completedCount.value },
]);

const sortOptions = computed(() => [
  { key: 'time', label: t('schedule.sortByTime') },
  { key: 'status', label: t('schedule.sortByStatus') },
]);

const activeFilterLabel = computed(() => filterTabs.value.find(f => f.key === activeFilter.value)?.label || '');
const activeFilterCount = computed(() => filterTabs.value.find(f => f.key === activeFilter.value)?.count || 0);
const activeSortLabel = computed(() => sortOptions.value.find(s => s.key === sortBy.value)?.label || '');

const filteredTasks = computed(() => {
  let list = [...allEvents.value];

  switch (activeFilter.value) {
    case 'week':
      list = list.filter(e => e.start >= weekRange.start && e.start <= weekRange.end);
      break;
    case 'month':
      list = list.filter(e => e.start >= monthRange.start && e.start <= monthRange.end);
      break;
    case 'uncompleted':
      list = list.filter(e => !e.completed);
      break;
    case 'completed':
      list = list.filter(e => e.completed);
      break;
  }

  if (sortBy.value === 'time') {
    list.sort((a, b) => {
      if (a.start !== b.start) return a.start < b.start ? -1 : 1;
      if (a.startTime && b.startTime) return a.startTime < b.startTime ? -1 : 1;
      return 0;
    });
  } else if (sortBy.value === 'status') {
    list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.start !== b.start) return a.start < b.start ? -1 : 1;
      return 0;
    });
  }

  return list;
});

function formatDate(task) {
  if (task.start === task.end) return task.start;
  return `${task.start} ~ ${task.end}`;
}

function onTaskClick(task) {
  router.push(`/schedule/${task.id}`);
}

async function toggleTaskComplete(task) {
  await scheduleStore.updateEvent(task.id, { completed: !task.completed });
}

function toggleFilterDropdown() {
  showFilterDropdown.value = !showFilterDropdown.value;
  showSortDropdown.value = false;
}

function toggleSortDropdown() {
  showSortDropdown.value = !showSortDropdown.value;
  showFilterDropdown.value = false;
}

function selectFilter(key) {
  activeFilter.value = key;
  showFilterDropdown.value = false;
}

function selectSort(key) {
  sortBy.value = key;
  showSortDropdown.value = false;
}

function closeAllDropdowns() {
  showFilterDropdown.value = false;
  showSortDropdown.value = false;
}

function onDocClick(e) {
  if (filterDropdownRef.value && !filterDropdownRef.value.contains(e.target)) {
    showFilterDropdown.value = false;
  }
  if (sortDropdownRef.value && !sortDropdownRef.value.contains(e.target)) {
    showSortDropdown.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocClick);
});
</script>

<style scoped>
.task-list-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  max-width: 820px;
  margin: 0 auto;
}

/* ========== Filter Bar ========== */
.task-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.filter-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dropdown-wrapper {
  position: relative;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  line-height: 1;
}

.dropdown-trigger:hover {
  border-color: var(--text-tertiary);
  background: var(--bg-secondary);
}

.trigger-text {
  white-space: nowrap;
}

.trigger-count {
  font-size: 11px;
  font-weight: 600;
  background: var(--accent-light);
  color: var(--accent-color);
  padding: 1px 7px;
  border-radius: 10px;
  line-height: 1.4;
}

.trigger-arrow {
  transition: transform 0.2s ease;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.trigger-arrow.expanded {
  transform: rotate(180deg);
}

/* ========== Dropdown Panel ========== */
.dropdown-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  z-index: 100;
  padding: 4px;
  min-width: 160px;
}

.filter-dropdown-panel {
  min-width: 180px;
}

.sort-dropdown-panel {
  min-width: 170px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.12s;
  white-space: nowrap;
}

.dropdown-item:hover {
  background-color: var(--bg-hover);
}

.dropdown-item.active {
  background: var(--accent-light);
  color: var(--accent-color);
  font-weight: 600;
}

.dropdown-item-label {
  flex: 1;
}

.dropdown-item-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  background: var(--bg-secondary);
  padding: 1px 7px;
  border-radius: 10px;
  line-height: 1.4;
}

.dropdown-item.active .dropdown-item-count {
  background: var(--accent-color);
  color: white;
}

/* Dropdown Transition */
.dropdown-enter-active {
  animation: dropdownIn 0.15s ease-out;
}

.dropdown-leave-active {
  animation: dropdownIn 0.12s ease-in reverse;
}

@keyframes dropdownIn {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========== Stats Summary ========== */
.task-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 14px;
  flex-shrink: 0;
}

.stat-card {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s ease;
  border: 1px solid var(--border-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.stat-card:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.09);
  transform: translateY(-1px);
}

.stat-icon-wrap {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon-wrap svg {
  width: 16px;
  height: 16px;
}

.stat-icon-wrap.total {
  background: linear-gradient(135deg, #dbeafe, #eff6ff);
  color: #2563eb;
}

.stat-icon-wrap.completed {
  background: linear-gradient(135deg, #dcfce7, #ecfdf5);
  color: #16a34a;
}

.stat-icon-wrap.uncompleted {
  background: linear-gradient(135deg, #fef3c7, #fffbeb);
  color: #d97706;
}

.stat-icon-wrap.progress {
  background: linear-gradient(135deg, #ede9fe, #f5f3ff);
  color: #7c3aed;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.stat-number {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.1;
  letter-spacing: -0.5px;
}

.stat-number.completed-num {
  color: #16a34a;
}

.stat-number.uncompleted-num {
  color: #d97706;
}

.stat-number.progress-num {
  color: #7c3aed;
}

.stat-percent {
  font-size: 13px;
  font-weight: 600;
  margin-left: 1px;
}

.stat-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 500;
  line-height: 1;
}

/* ========== Task List Scroll ========== */
.task-list-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.task-list-scroll::-webkit-scrollbar {
  width: 6px;
}

.task-list-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.task-list-scroll::-webkit-scrollbar-thumb {
  background-color: var(--border-color);
  border-radius: 3px;
}

.task-list-scroll::-webkit-scrollbar-thumb:hover {
  background-color: var(--text-tertiary);
}

/* ========== Empty State ========== */
.task-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-tertiary);
  padding: 80px 0;
}

.task-empty p {
  font-size: 14px;
  margin: 0;
}

/* ========== Task Items ========== */
.task-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.12s, opacity 0.2s;
  background: var(--bg-primary);
}

.task-item:hover {
  background: var(--bg-hover);
}

.task-item.completed {
  opacity: 0.6;
}

.task-item.completed:hover {
  opacity: 0.8;
}

.task-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: transform 0.15s;
}

.task-checkbox:hover {
  transform: scale(1.15);
}

.task-color-bar {
  width: 4px;
  height: 28px;
  border-radius: 2px;
  flex-shrink: 0;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
}

.task-title.line-through {
  text-decoration: line-through;
  color: var(--text-tertiary);
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 3px;
}

.task-date,
.task-time,
.task-reminder {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.task-status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
  flex-shrink: 0;
  white-space: nowrap;
  letter-spacing: 0.2px;
}

.task-status-badge.done {
  background: #ecfdf5;
  color: #16a34a;
}

.task-status-badge.pending {
  background: #fffbeb;
  color: #d97706;
}
</style>
