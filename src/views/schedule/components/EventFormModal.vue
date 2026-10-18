<template>
  <Teleport to="body">
    <div v-if="visible" class="event-modal-overlay" @click.self="close">
      <div class="event-modal">
        <div class="modal-header">
          <div class="modal-header-left">
            <h3>{{ isEditing ? t('schedule.editEvent') : t('schedule.createEvent') }}</h3>
            <button ref="dateChipRef" type="button" class="set-date-btn" :class="{ active: dateDropdownOpen }" @click="toggleDateDropdown">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01M16 18h.01"></path></svg>
              <span>{{ dateChipLabel }}</span>
            </button>
            <div v-if="dateDropdownOpen" ref="datePanelRef" class="date-dropdown">
              <div class="cal-header">
                <span class="cal-title">{{ calendarTitle }}</span>
                <div class="cal-nav">
                  <button type="button" class="cal-nav-btn" @click="navMonth(-1)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <button type="button" class="cal-nav-btn" @click="goSelectedMonth">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"></circle></svg>
                  </button>
                  <button type="button" class="cal-nav-btn" @click="navMonth(1)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </div>
              </div>
              <div class="cal-weekdays">
                <span v-for="(w, i) in weekdayHeaders" :key="i">{{ w }}</span>
              </div>
              <div class="cal-grid">
                <button
                  v-for="cell in calendarCells"
                  :key="cell.key"
                  type="button"
                  class="cal-day"
                  :class="{
                    outside: !cell.inMonth,
                    today: cell.inMonth && isTodayStr(cell.iso),
                    'in-range': inRange(cell.iso),
                    'range-end': formData.hasDate && (cell.iso === formData.start || cell.iso === formData.end),
                  }"
                  @click="pickDate(cell)"
                >{{ cell.day }}</button>
              </div>
              <div class="date-options">
                <label :class="['checkbox-label', { disabled: !formData.hasDate }]">
                  <input type="checkbox" :checked="formData.allDay" @change="formData.allDay = $event.target.checked" class="checkbox-input" :disabled="!formData.hasDate" />
                  <span class="checkbox-custom"></span>
                  {{ t('schedule.allDay') }}
                </label>
                <label :class="['checkbox-label', { disabled: !formData.hasDate || isPast }]">
                  <input type="checkbox" :checked="formData.reminder" @change="formData.reminder = $event.target.checked" class="checkbox-input" :disabled="!formData.hasDate || isPast" />
                  <span class="checkbox-custom"></span>
                  {{ t('schedule.reminder') }}
                </label>
                <button v-if="formData.hasDate" type="button" class="clear-date-btn" @click="clearDate">{{ t('schedule.clearDate') }}</button>
              </div>
            </div>
          </div>
          <button class="modal-close-btn" @click="close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="modal-body">
          <ScheduleEventForm ref="formRef" :model="formData" @submit="save" />
        </div>
        <div class="modal-footer">
          <button v-if="isEditing" class="btn btn-delete" @click="remove">{{ t('schedule.delete') }}</button>
          <div class="footer-spacer"></div>
          <button class="btn btn-secondary" @click="close">{{ t('schedule.cancel') }}</button>
          <button class="btn btn-primary" @click="save" :disabled="!formData.title.trim()">{{ t('schedule.save') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, onDeactivated } from 'vue';
import { useI18n } from 'vue-i18n';
import { EVENT_COLORS, DEFAULT_EVENT_PRIORITY } from '@/store/modules/schedule';
import { useCalendarHelpers, formatDate, isTodayStr, isDateInRange } from '../utils/calendarHelpers';
import ScheduleEventForm from './ScheduleEventForm.vue';

const { t } = useI18n();
const { isZh, getMonthDayLabel, weekDayMiniLabels, monthNames } = useCalendarHelpers();
const emit = defineEmits(['save', 'update', 'delete']);

const visible = ref(false);
const formRef = ref(null);
/** 编辑模式的日程 id；null 表示新建 */
const editingId = ref(null);
const isEditing = computed(() => !!editingId.value);

// ========== 日期日历下拉（单日历双击选区间：首点定开始，次点定结束） ==========
const dateDropdownOpen = ref(false);
const dateChipRef = ref(null);
const datePanelRef = ref(null);
const pickingEnd = ref(false); // true 表示已选开始日期，等待点击结束日期
const viewYear = ref(0);
const viewMonth = ref(0); // 0-based

const dateChipLabel = computed(() => {
  if (!formData.hasDate || !formData.start) return t('schedule.setDate');
  if (!formData.end || formData.end === formData.start) return getMonthDayLabel(formData.start);
  return `${getMonthDayLabel(formData.start)} ~ ${getMonthDayLabel(formData.end)}`;
});

const calendarTitle = computed(() => {
  if (isZh.value) return `${viewYear.value}年${viewMonth.value + 1}月`;
  return `${monthNames.value[viewMonth.value]} ${viewYear.value}`;
});

// 周日开头（与参考样式一致）：周一开头的 mini 标签整体右旋一位
const weekdayHeaders = computed(() => {
  const arr = weekDayMiniLabels.value;
  return [arr[arr.length - 1], ...arr.slice(0, arr.length - 1)];
});

const calendarCells = computed(() => {
  const firstDay = new Date(viewYear.value, viewMonth.value, 1).getDay(); // Sunday=0
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(viewYear.value, viewMonth.value, 1 - firstDay + i);
    cells.push({
      key: i,
      day: d.getDate(),
      inMonth: d.getMonth() === viewMonth.value,
      iso: formatDate(d.getFullYear(), d.getMonth(), d.getDate()),
    });
  }
  return cells;
});

function inRange(iso) {
  return formData.hasDate && iso !== formData.start && iso !== formData.end
    && isDateInRange(iso, formData.start, formData.end);
}

const isPast = computed(() => {
  if (!formData.end) return false;
  const today = new Date().toISOString().split('T')[0];
  return formData.end < today;
});

// 清除日期：回到无期限状态（无日期的日程不会过期，提醒一并清除）
function clearDate() {
  formData.hasDate = false;
  formData.reminder = false;
  pickingEnd.value = false;
}

function syncCalendarView() {
  const src = formData.start || formData.end;
  if (src) {
    viewYear.value = parseInt(src.slice(0, 4));
    viewMonth.value = parseInt(src.slice(5, 7)) - 1;
  } else {
    const now = new Date();
    viewYear.value = now.getFullYear();
    viewMonth.value = now.getMonth();
  }
}

function toggleDateDropdown() {
  dateDropdownOpen.value = !dateDropdownOpen.value;
  if (dateDropdownOpen.value) {
    pickingEnd.value = false;
    syncCalendarView();
  }
}

function navMonth(delta) {
  let m = viewMonth.value + delta;
  let y = viewYear.value;
  if (m < 0) { m = 11; y -= 1; }
  if (m > 11) { m = 0; y += 1; }
  viewMonth.value = m;
  viewYear.value = y;
}

function goSelectedMonth() {
  syncCalendarView();
}

function pickDate(cell) {
  if (!pickingEnd.value) {
    // 首次点击：设定开始日期，结束日期暂与开始相同，等待第二次点击
    formData.hasDate = true;
    formData.start = cell.iso;
    formData.end = cell.iso;
    pickingEnd.value = true;
  } else if (cell.iso >= formData.start) {
    // 第二次点击：完成区间，自动收起
    formData.end = cell.iso;
    dateDropdownOpen.value = false;
  } else {
    // 早于开始日期：视为重新选择开始日期
    formData.start = cell.iso;
    formData.end = cell.iso;
  }
}

const formData = reactive({
  title: '',
  hasDate: false,
  start: '',
  end: '',
  startTime: '09:00',
  endTime: '10:00',
  allDay: true,
  description: '',
  color: EVENT_COLORS[0],
  reminder: false,
  completed: false,
  priority: DEFAULT_EVENT_PRIORITY,
});

/**
 * 打开弹窗：传 { event } 进入编辑模式，传 { start, end, ... } 进入新建模式
 * @param {{ event?: object, start?: string, end?: string, startTime?: string, endTime?: string, allDay?: boolean }} initial
 */
function open(initial = {}) {
  const ev = initial.event;
  const today = new Date().toISOString().split('T')[0];
  dateDropdownOpen.value = false;
  if (ev) {
    editingId.value = ev.id;
    Object.assign(formData, {
      title: ev.title,
      hasDate: !!ev.start,
      start: ev.start || today,
      end: ev.end || ev.start || today,
      allDay: ev.allDay !== undefined ? ev.allDay : true,
      startTime: ev.startTime || '09:00',
      endTime: ev.endTime || '10:00',
      description: ev.description || '',
      color: ev.color || EVENT_COLORS[0],
      reminder: ev.reminder || false,
      completed: ev.completed || false,
      priority: ev.priority || DEFAULT_EVENT_PRIORITY,
    });
  } else {
    editingId.value = null;
    const date = initial.start || today;
    Object.assign(formData, {
      title: '',
      // 从具体日期格点击进入时预设该日期并默认勾选，其余情况默认无期限
      hasDate: !!initial.start,
      start: date,
      end: initial.end || date,
      allDay: initial.allDay !== undefined ? initial.allDay : true,
      startTime: initial.startTime || '09:00',
      endTime: initial.endTime || '10:00',
      description: '',
      color: EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)],
      reminder: false,
      completed: false,
      priority: initial.priority || DEFAULT_EVENT_PRIORITY,
    });
  }
  visible.value = true;
  nextTick(() => formRef.value?.focusTitle());
}

function close() {
  visible.value = false;
}

function save() {
  if (!formData.title.trim()) return;
  // 未勾选"设置日期"时按无期限提交（start/end 为空，永不过期）
  const payload = {
    title: formData.title,
    start: formData.hasDate ? formData.start : '',
    end: formData.hasDate ? formData.end : '',
    allDay: formData.allDay,
    startTime: formData.hasDate && !formData.allDay ? formData.startTime : '',
    endTime: formData.hasDate && !formData.allDay ? formData.endTime : '',
    description: formData.description,
    color: formData.color,
    reminder: formData.hasDate ? formData.reminder : false,
    completed: formData.completed,
    priority: formData.priority,
  };
  if (editingId.value) emit('update', { id: editingId.value, ...payload });
  else emit('save', payload);
  close();
}

function remove() {
  if (!editingId.value) return;
  if (window.confirm(t('schedule.confirmDelete'))) {
    emit('delete', editingId.value);
    visible.value = false;
  }
}

function onKeydown(e) {
  if (e.key === 'Escape' && visible.value) {
    if (dateDropdownOpen.value) dateDropdownOpen.value = false;
    else close();
  }
}

function onDocMouseDown(e) {
  if (!dateDropdownOpen.value) return;
  const chip = dateChipRef.value;
  const panel = datePanelRef.value;
  if (chip?.contains(e.target) || panel?.contains(e.target)) return;
  dateDropdownOpen.value = false;
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('mousedown', onDocMouseDown);
});
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('mousedown', onDocMouseDown);
});
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

.modal-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  position: relative;
}

/* 日期触发 chip：无边框极简（日历图标 + 文字），参考目标样式 */
.set-date-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  border-radius: 7px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  line-height: 1;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.set-date-btn svg {
  color: var(--text-tertiary);
  transition: color 0.15s;
}

.set-date-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.set-date-btn.active {
  color: var(--accent-color);
}

.set-date-btn.active svg {
  color: var(--accent-color);
}

/* 日期面板：单月历区间选择，与全局下拉统一（bg-primary + 双层投影） */
.date-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 30;
  width: 320px;
  padding: 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
}

.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}

.cal-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.cal-nav {
  display: flex;
  align-items: center;
  gap: 2px;
}

.cal-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s;
}

.cal-nav-btn:hover {
  background: var(--bg-hover);
}

.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-top: 10px;
}

.cal-weekdays span {
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 4px 0;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 2px;
  margin-top: 2px;
}

.cal-day {
  place-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 50%;
  font-size: 13px;
  font-family: inherit;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.cal-day:hover {
  background: var(--bg-hover);
}

.cal-day.outside {
  color: var(--text-tertiary);
  opacity: 0.55;
}

.cal-day.today {
  font-weight: 700;
}

/* 区间中间日：淡蓝圆圈标记 */
.cal-day.in-range {
  background: var(--accent-light);
}

/* 区间端点：淡蓝圆底 */
.cal-day.range-end {
  background: var(--accent-light);
  color: var(--accent-color);
  font-weight: 600;
}

.cal-day.range-end:hover {
  background: var(--accent-light);
}

/* 日历下方选项行：全天 / 到期提醒 / 清除日期 */
.date-options {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 7px;
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
  width: 17px;
  height: 17px;
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

.btn-delete {
  background: transparent;
  color: #ef4444;
}

.btn-delete:hover {
  background: rgba(239, 68, 68, 0.1);
  opacity: 1;
}
</style>
