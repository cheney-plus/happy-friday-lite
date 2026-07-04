<template>
  <div class="schedule-calendar" @contextmenu.prevent>
    <div class="calendar-header">
      <div class="header-left">
        <button class="nav-btn" @click="navigatePrev">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <button class="today-btn" @click="navigateToday">{{ t('schedule.today') }}</button>
        <button class="nav-btn" @click="navigateNext">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
        <h2 class="current-date-label">{{ currentDateLabel }}</h2>
      </div>
      <div class="header-right">
        <div class="view-switcher">
          <button
            v-for="view in views"
            :key="view.key"
            :class="['view-btn', { active: currentView === view.key }]"
            @click="switchView(view.key)"
          >{{ view.label }}</button>
        </div>
        <button class="create-btn" @click="openCreateModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          {{ t('schedule.createEvent') }}
        </button>
        <button class="ai-assistant-btn" @click="openAIAssistant">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/>
          </svg>
          Friday 助理
        </button>
      </div>
    </div>

    <div class="calendar-body">
      <!-- Month View -->
      <div v-if="currentView === 'month'" class="month-view">
        <div class="weekday-header">
          <div v-for="day in weekDayLabels" :key="day" class="weekday-cell">{{ day }}</div>
        </div>
        <div ref="monthGridRef" class="month-grid" @mouseup="onGridMouseUp">
          <div
            v-for="(cell, idx) in monthGridCells"
            :key="idx"
            :class="['month-cell', {
              'other-month': !cell.isCurrentMonth,
              'is-today': cell.isToday,
              'is-selected': isDateInRange(cell.date, selectionStart, selectionEnd),
              'is-dragging': isDragging
            }]"
            @mousedown.prevent="onCellMouseDown(cell.date, $event)"
            @mouseenter="onCellMouseEnter(cell.date)"
            @mouseup="onCellMouseUp(cell.date)"
            @click="onCellClick(cell.date)"
          >
            <div class="cell-date-container">
              <div :class="['cell-date', { 'is-month-start': cell.day === 1 }]">
                <template v-if="cell.day === 1">{{ getMonthDayLabel(cell.date) }}</template>
                <template v-else>{{ cell.day }}</template>
              </div>
              <div v-if="getHolidayForDate(cell.date)" :class="['cell-holiday', { 'lunar-holiday': getHolidayForDate(cell.date)?.isLunar }]">
                {{ getHolidayForDate(cell.date)?.holiday }}
              </div>
            </div>
            <div class="cell-events" :style="{ marginTop: getMultiDayBarOffset(cell.date) + 'px' }">
              <div
                v-for="event in getSingleDayEventsForDate(cell.date).slice(0, getVisibleSingleDayCount(cell.date))"
                :key="event.id"
                :class="['cell-event', event.completed ? 'is-completed' : 'is-incomplete']"
                :style="{ backgroundColor: getEventBgColor(event), borderLeftColor: getEventDisplayColor(event) }"
                @click.stop="onEventClick(event)"
                @contextmenu.prevent.stop="onEventRightClick($event, event)"
              >
                {{ event.title }}
              </div>
            </div>
            <div v-if="shouldShowMore(cell.date)" class="cell-more" @click.stop="onMoreClick(cell.date, $event)">
              +{{ getHiddenEventCount(cell.date) }}
            </div>
          </div>
          <!-- Multi-day event bars overlay (continuous across cells) -->
          <div
            v-for="(bar, bidx) in visibleMultiDayEventBars"
            :key="'mdb-' + bidx"
            :class="['multi-day-bar', bar.event.completed ? 'is-completed' : 'is-incomplete']"
            :style="{
              left: 'calc(' + (bar.startCol * (100/7)) + '% + 4px)',
              width: 'calc(' + ((bar.endCol - bar.startCol + 1) * (100/7)) + '% - 8px)',
              top: 'calc(' + (bar.row * (100/6)) + '% + 22px + ' + (bar.slot * 18) + 'px)',
              backgroundColor: getEventBgColor(bar.event),
              borderLeftColor: getEventDisplayColor(bar.event)
            }"
            @click.stop="onEventClick(bar.event)"
            @contextmenu.prevent.stop="onEventRightClick($event, bar.event)"
          >
            <span class="multi-day-bar-title">{{ bar.event.title }}</span>
          </div>
        </div>
      </div>

      <!-- Week View -->
      <div v-else-if="currentView === 'week'" class="week-view">
        <div class="wk-header">
          <div class="wk-gutter-head"></div>
          <div class="wk-header-days">
            <div
              v-for="day in weekDays"
              :key="day.date"
              :class="['wk-head-day', { 'wk-today-col': day.isToday }]"
            >
              <span class="wk-head-weekday">{{ day.dayName }}</span>
              <span :class="['wk-head-date', { 'wk-head-date-today': day.isToday }]">{{ day.dayNumber }}</span>
            </div>
          </div>
        </div>
        <div class="wk-allday">
          <div class="wk-gutter-allday">{{ t('schedule.allDay') }}</div>
          <div class="wk-allday-cols">
            <div
              v-for="day in weekDays"
              :key="day.date"
              :class="['wk-allday-col', { 'wk-today-col': day.isToday }]"
              :style="allDayCellStyle(day.date)"
              @click="onAllDayCellClick(day.date)"
            >
              <div
                v-for="evt in getDayEventsForAllDayRow(day.date)"
                :key="evt.id"
                :class="['wk-allday-evt', evt.completed ? 'is-completed' : 'is-incomplete']"
                :style="{ backgroundColor: getEventBgColor(evt), color: getEventDisplayColor(evt), borderLeftColor: getEventDisplayColor(evt) }"
                @click.stop="onEventClick(evt)"
                @contextmenu.prevent.stop="onEventRightClick($event, evt)"
              >{{ evt.title }}</div>
            </div>
          </div>
        </div>
        <div class="wk-scroll" ref="weekScrollRef" @scroll="onWeekScroll">
          <div class="wk-body" :style="{ height: totalDayHeight + 'px' }">
            <div class="wk-gutter-times">
              <div v-for="h in 24" :key="h" class="wk-gutter-hour" :style="{ top: ((h - 1) * hourPx) + 'px' }">
                {{ formatHour(h - 1) }}
              </div>
            </div>
            <div class="wk-grid" @mouseup="onWeekCellMouseUp">
              <div
                v-for="day in weekDays"
                :key="day.date"
                :class="['wk-col', { 'wk-today-col': day.isToday }]"
              >
                <div
                  v-for="h in 24"
                  :key="h"
                  :class="['wk-cell', { 'wk-cell-selected': weekTimeDrag.active && day.date === weekTimeDrag.startDate && h - 1 >= Math.min(weekTimeDrag.startHour, weekTimeDrag.endHour) && h - 1 <= Math.max(weekTimeDrag.startHour, weekTimeDrag.endHour) }]"
                  :style="{ height: hourPx + 'px' }"
                  @mousedown.prevent="onWeekCellMouseDown(day.date, h - 1, $event)"
                  @mouseenter="onWeekCellMouseEnter(h - 1)"
                  @click="onWeekCellClick(day.date, h - 1)"
                >
                  <div class="wk-cell-half"></div>
                </div>
                <div class="wk-evt-layer">
                  <div
                    v-for="evt in getTimedEventsForDate(day.date)"
                    :key="evt.id"
                    class="wk-evt"
                    :style="timedEventStyle(evt)"
                    @click.stop="onEventClick(evt)"
                    @contextmenu.prevent.stop="onEventRightClick($event, evt)"
                  >
                    <div class="wk-evt-title">{{ evt.title }}</div>
                    <div class="wk-evt-time">{{ evt.startTime }} - {{ evt.endTime }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="isCurrentWeek" class="wk-now" :style="{ top: nowY + 'px' }">
              <div class="wk-now-line"></div>
              <div v-if="todayColIndex >= 0" class="wk-now-bold" :style="nowBoldStyle()"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Year View -->
      <div v-else-if="currentView === 'year'" class="year-view">
        <div
          v-for="month in yearMonths"
          :key="month.monthIndex"
          class="year-month-card"
          @click="onYearMonthClick(month.monthIndex)"
        >
          <div class="year-month-label">{{ month.label }}</div>
          <div class="year-month-grid">
            <div v-for="day in weekDayMiniLabels" :key="day" class="year-weekday-label">{{ day }}</div>
            <div
              v-for="(cell, idx) in month.cells"
              :key="idx"
              :class="['year-day-cell', {
                'other-month': !cell.isCurrentMonth,
                'is-today': cell.isToday,
                'has-event': cell.hasEvent
              }]"
            >
              <span class="year-day-number">{{ cell.day || '' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Task List View -->
      <ScheduleTaskList v-else-if="currentView === 'list'" />
    </div>

    <!-- 创建日程弹窗 -->
    <EventFormModal ref="eventModalRef" @save="onModalSave" />

    <!-- 右键菜单 -->
    <EventContextMenu
      :visible="contextMenuVisible"
      :event="contextMenuEvent"
      :pos="contextMenuPos"
      @close="contextMenuVisible = false"
      @toggle-complete="onCtxToggleComplete"
      @view-detail="onCtxViewDetail"
    />

    <!-- +n 日程面板 -->
    <MoreEventsPanel
      :visible="morePanelVisible"
      :date="morePanelDate || ''"
      :events="morePanelEvents"
      :pos="morePanelPos"
      @close="closeMorePanel"
      @event-click="onPanelEventClick"
      @event-right-click="onPanelEventRightClick"
      @toggle-complete="toggleEventComplete"
    />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch, onDeactivated } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useScheduleStore } from '@/store/modules/schedule';
import ScheduleTaskList from './ScheduleTaskList.vue';
import EventFormModal from './components/EventFormModal.vue';
import EventContextMenu from './components/EventContextMenu.vue';
import MoreEventsPanel from './components/MoreEventsPanel.vue';
import { getHolidayForDate } from './utils/lunarCalendar';
import {
  useCalendarHelpers,
  getDaysInMonth,
  getFirstDayOfWeek,
  formatDate,
  isTodayStr,
  isDateInRange,
  timeToMin,
  getEventBgColor,
  getEventDisplayColor,
} from './utils/calendarHelpers';

const { t } = useI18n();
const router = useRouter();
const scheduleStore = useScheduleStore();

const { isZh, formatHour, getMonthDayLabel, weekDayLabels, weekDayMiniLabels, monthNames } = useCalendarHelpers();

// ========== 视图状态 ==========
const currentView = ref('month');
const viewYear = ref(new Date().getFullYear());
const viewMonth = ref(new Date().getMonth());
const weekOffset = ref(0);
const weekScrollRef = ref(null);

const views = computed(() => [
  { key: 'month', label: t('schedule.month') },
  { key: 'week', label: t('schedule.week') },
  { key: 'year', label: t('schedule.year') },
  { key: 'list', label: t('schedule.list') },
]);

const currentDateLabel = computed(() => {
  if (currentView.value === 'year') {
    return `${viewYear.value}`;
  }
  if (currentView.value === 'week') {
    const days = weekDays.value;
    if (days.length < 7) return '';
    const first = days[0];
    const last = days[6];
    if (isZh.value) {
      const y = first.date.slice(0, 4);
      const sm = parseInt(first.date.slice(5, 7));
      const em = parseInt(last.date.slice(5, 7));
      const sd = parseInt(first.date.slice(8, 10));
      const ed = parseInt(last.date.slice(8, 10));
      if (sm === em) {
        return `${y}年${sm}月${sd}日 — ${ed}日`;
      }
      return `${sm}月${sd}日 — ${em}月${ed}日`;
    }
    return `${first.date} — ${last.date}`;
  }
  if (isZh.value) {
    return `${viewYear.value}年${viewMonth.value + 1}月`;
  }
  return `${monthNames.value[viewMonth.value]} ${viewYear.value}`;
});

// ========== 月视图网格 ==========
const monthGridRef = ref(null);
const rowHeight = ref(0);

// 格子内单日程 item 的尺寸常量（与 CSS 对应）
const CELL_PADDING_Y = 8;     // .month-cell padding top+bottom (4+4)
const DATE_HEADER_H = 20;     // .cell-date-container 高度
const ITEM_LINE_H = 18;       // .cell-event 高度 + gap (15+3)
const MAX_VISIBLE_ITEMS = 5;  // 单格最多展示的 item 数
// 跨日程条尺寸（与 CSS 中 .multi-day-bar 对应）
const BAR_TOP_OFFSET = 22;    // 色条顶部基准偏移（日期头高度）
const BAR_HEIGHT = 16;        // 色条高度

let gridResizeObserver = null;

const monthGridCells = computed(() => {
  const cells = [];
  const year = viewYear.value;
  const month = viewMonth.value;
  const firstDay = getFirstDayOfWeek(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const date = formatDate(prevYear, prevMonth, day);
    cells.push({ date, day, isCurrentMonth: false, isToday: isTodayStr(date) });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = formatDate(year, month, day);
    cells.push({ date, day, isCurrentMonth: true, isToday: isTodayStr(date) });
  }
  const remaining = 42 - cells.length;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  for (let day = 1; day <= remaining; day++) {
    const date = formatDate(nextYear, nextMonth, day);
    cells.push({ date, day, isCurrentMonth: false, isToday: isTodayStr(date) });
  }
  return cells;
});

// ========== 跨日日程条 ==========
const multiDayEventBars = computed(() => {
  const cells = monthGridCells.value;
  if (cells.length === 0) return [];

  const firstDate = cells[0].date;
  const lastDate = cells[cells.length - 1].date;

  const multiDayEvents = new Map();
  for (const cell of cells) {
    const events = getEventsForDate(cell.date);
    for (const evt of events) {
      if (evt.start !== evt.end && !multiDayEvents.has(evt.id)) {
        multiDayEvents.set(evt.id, evt);
      }
    }
  }

  const segments = [];
  for (const evt of multiDayEvents.values()) {
    let startDate = evt.start;
    let endDate = evt.end;
    if (endDate < firstDate || startDate > lastDate) continue;
    if (startDate < firstDate) startDate = firstDate;
    if (endDate > lastDate) endDate = lastDate;

    const startIdx = cells.findIndex(c => c.date === startDate);
    const endIdx = cells.findIndex(c => c.date === endDate);
    if (startIdx === -1 || endIdx === -1) continue;

    const startRow = Math.floor(startIdx / 7);
    const endRow = Math.floor(endIdx / 7);

    for (let row = startRow; row <= endRow; row++) {
      const rowStartIdx = row * 7;
      const rowEndIdx = rowStartIdx + 6;
      const segStartIdx = Math.max(startIdx, rowStartIdx);
      const segEndIdx = Math.min(endIdx, rowEndIdx);
      segments.push({
        event: evt,
        row,
        startCol: segStartIdx % 7,
        endCol: segEndIdx % 7,
        startIdx: segStartIdx,
        endIdx: segEndIdx,
      });
    }
  }

  // 按行分组并分配垂直槽位以避免重叠
  const segmentsByRow = {};
  for (const seg of segments) {
    if (!segmentsByRow[seg.row]) segmentsByRow[seg.row] = [];
    segmentsByRow[seg.row].push(seg);
  }

  const bars = [];
  for (const row of Object.keys(segmentsByRow)) {
    const rowSegs = segmentsByRow[row];
    rowSegs.sort((a, b) => a.startIdx - b.startIdx);
    const activeEndIndices = [];
    for (const seg of rowSegs) {
      let slot = -1;
      for (let i = 0; i < activeEndIndices.length; i++) {
        if (activeEndIndices[i] < seg.startIdx) {
          slot = i;
          break;
        }
      }
      if (slot === -1) {
        slot = activeEndIndices.length;
        activeEndIndices.push(seg.endIdx);
      } else {
        activeEndIndices[slot] = seg.endIdx;
      }
      seg.slot = slot;
      bars.push(seg);
    }
  }

  return bars;
});

/**
 * 根据行高计算最大可见 slot —— 行高不足时低优先级（高 slot）的色条自动隐藏，
 * 避免色条溢出到下一行格子。
 */
const maxVisibleBarSlot = computed(() => {
  if (rowHeight.value === 0) return 99; // 兜底：Observer 尚未触发时全部显示
  const slot = Math.floor((rowHeight.value - BAR_TOP_OFFSET - BAR_HEIGHT) / ITEM_LINE_H);
  return Math.max(-1, slot);
});

/** 实际渲染的跨日程条（仅含可见 slot） */
const visibleMultiDayEventBars = computed(() =>
  multiDayEventBars.value.filter(bar => bar.slot <= maxVisibleBarSlot.value)
);

/**
 * 计算某格的跨日程条偏移量。
 * 仅对实际覆盖该格的色条计算偏移 —— 未被覆盖的格子不留空白，
 * 单日程 item 从顶部开始排列，充分利用空间。
 */
function getMultiDayBarOffset(date) {
  const cells = monthGridCells.value;
  const idx = cells.findIndex(c => c.date === date);
  if (idx === -1) return 0;
  const row = Math.floor(idx / 7);
  const col = idx % 7;
  let maxSlot = -1;
  for (const bar of visibleMultiDayEventBars.value) {
    if (bar.row === row && bar.startCol <= col && bar.endCol >= col) {
      if (bar.slot > maxSlot) maxSlot = bar.slot;
    }
  }
  return (maxSlot + 1) * ITEM_LINE_H;
}

/** 覆盖该格的可见跨日程条占用的 slot 行数（用于兜底计算） */
function getRowBarSlotCount(date) {
  const cells = monthGridCells.value;
  const idx = cells.findIndex(c => c.date === date);
  if (idx === -1) return 0;
  const row = Math.floor(idx / 7);
  const col = idx % 7;
  let maxSlot = -1;
  for (const bar of visibleMultiDayEventBars.value) {
    if (bar.row === row && bar.startCol <= col && bar.endCol >= col && bar.slot > maxSlot) {
      maxSlot = bar.slot;
    }
  }
  return maxSlot + 1;
}

/**
 * 根据格子实际行高动态计算可容纳的单日程数量。
 * 行高由 ResizeObserver 监听，行高不足时自动减少可见 item。
 */
function getVisibleSingleDayCount(date) {
  const barOffset = getMultiDayBarOffset(date);
  if (rowHeight.value === 0) {
    // ResizeObserver 尚未触发时的兜底
    return Math.max(0, MAX_VISIBLE_ITEMS - getRowBarSlotCount(date));
  }
  const available = rowHeight.value - CELL_PADDING_Y - DATE_HEADER_H - barOffset;
  const fit = Math.floor(available / ITEM_LINE_H);
  return Math.max(0, Math.min(MAX_VISIBLE_ITEMS, fit));
}

/** 被隐藏的单日程数量 */
function getHiddenSingleDayCount(date) {
  const singles = getSingleDayEventsForDate(date);
  const visible = getVisibleSingleDayCount(date);
  return Math.max(0, singles.length - visible);
}

/** 被隐藏的跨日程条数量（slot 超出可见范围且覆盖该格） */
function getHiddenBarCountForDate(date) {
  const cells = monthGridCells.value;
  const idx = cells.findIndex(c => c.date === date);
  if (idx === -1) return 0;
  const row = Math.floor(idx / 7);
  const col = idx % 7;
  return multiDayEventBars.value.filter(bar =>
    bar.row === row &&
    bar.startCol <= col && bar.endCol >= col &&
    bar.slot > maxVisibleBarSlot.value
  ).length;
}

/** 格子中被隐藏的日程总数（单日程 + 跨日程条），用于 +n 显示 */
function getHiddenEventCount(date) {
  return getHiddenSingleDayCount(date) + getHiddenBarCountForDate(date);
}

/** 格子是否需要显示 +n */
function shouldShowMore(date) {
  return getHiddenEventCount(date) > 0;
}

// ========== 周视图 ==========
const hourPx = 48;
const totalDayHeight = 24 * hourPx;
const nowY = ref(0);
let nowTimer = null;

const weekDays = computed(() => {
  const now = new Date();
  const currentDay = now.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  const targetMonday = new Date(thisMonday);
  targetMonday.setDate(targetMonday.getDate() + weekOffset.value * 7);

  const dayNames = weekDayLabels.value;
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(targetMonday);
    d.setDate(targetMonday.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({
      date: dateStr,
      dayName: dayNames[i],
      dayNumber: d.getDate(),
      isToday: isTodayStr(dateStr),
    });
  }
  return days;
});

const isCurrentWeek = computed(() => weekOffset.value === 0);

// 今日在周视图中的列索引（0=周一 … 6=周日），用于定位蓝色时间线加粗段
const todayColIndex = computed(() => weekDays.value.findIndex(d => d.isToday));

/** 今日列的加粗蓝色线段位置 */
function nowBoldStyle() {
  const idx = todayColIndex.value;
  if (idx < 0) return {};
  return {
    left: `calc(56px + ${idx} * (100% - 56px) / 7)`,
    width: `calc((100% - 56px) / 7)`,
  };
}

// 全天行展示当日全部任务（含跨日 + 定时），作为当日任务清单
const ALLDAY_ITEM_H = 20;   // 单个 item 占用高度（含 gap）
const ALLDAY_BASE_MIN_H = 56; // 全天行最小高度（已调高）

function getDayEventsForAllDayRow(date) {
  return scheduleStore.getEventsForDateRange(date, date);
}

/** 全天行单元格高度：随 item 数量增长，并始终预留至少一个空位以便点击 */
function allDayCellStyle(date) {
  const count = getDayEventsForAllDayRow(date).length;
  const minH = Math.max(ALLDAY_BASE_MIN_H, (count + 1) * ALLDAY_ITEM_H + 8);
  return { minHeight: minH + 'px' };
}

function onAllDayCellClick(date) {
  openCreateModal(date, date, undefined, undefined, true);
}

function timedEventStyle(evt) {
  const s = timeToMin(evt.startTime || '00:00');
  const e = timeToMin(evt.endTime || '23:59');
  const top = (s / 60) * hourPx;
  const height = Math.max(((e - s) / 60) * hourPx, 22);
  const dc = getEventDisplayColor(evt);
  return {
    top: `${top}px`,
    height: `${height}px`,
    backgroundColor: dc + (evt.completed ? '18' : '40'),
    borderLeftColor: dc,
    color: dc,
  };
}

function updateNowY() {
  const now = new Date();
  nowY.value = (now.getHours() * 60 + now.getMinutes()) / 60 * hourPx;
}

function onWeekScroll() {}

function scrollToNow() {
  if (!weekScrollRef.value) return;
  const now = new Date();
  // 统一定位到当前时间点
  const y = (now.getHours() - 1) * hourPx;
  weekScrollRef.value.scrollTop = Math.max(0, y);
}

// ========== 年视图 ==========
const yearMonths = computed(() => {
  const year = viewYear.value;
  const months = [];
  for (let m = 0; m < 12; m++) {
    const firstDay = getFirstDayOfWeek(year, m);
    const daysInMonth = getDaysInMonth(year, m);
    const prevMonth = m === 0 ? 11 : m - 1;
    const prevYear = m === 0 ? year - 1 : year;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
    const cells = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: daysInPrevMonth - i, isCurrentMonth: false, isToday: false, hasEvent: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = formatDate(year, m, day);
      const events = scheduleStore.getEventsForDateRange(date, date);
      cells.push({ day, isCurrentMonth: true, isToday: isTodayStr(date), hasEvent: events.length > 0 });
    }
    const remaining = 42 - cells.length;
    for (let day = 1; day <= remaining; day++) {
      cells.push({ day, isCurrentMonth: false, isToday: false, hasEvent: false });
    }
    months.push({ monthIndex: m, label: monthNames.value[m], cells });
  }
  return months;
});

// ========== 事件查询 ==========
function getEventsForDate(date) {
  return scheduleStore.getEventsForDateRange(date, date);
}

function getSingleDayEventsForDate(date) {
  return getEventsForDate(date).filter(e => e.start === e.end);
}

function getTimedEventsForDate(date) {
  return scheduleStore.getEventsForDateRange(date, date).filter(e => !e.allDay);
}

// ========== 导航 ==========
function navigatePrev() {
  if (currentView.value === 'month') {
    viewMonth.value--;
    if (viewMonth.value < 0) {
      viewMonth.value = 11;
      viewYear.value--;
    }
  } else if (currentView.value === 'week') {
    weekOffset.value--;
  } else {
    viewYear.value--;
  }
}

function navigateNext() {
  if (currentView.value === 'month') {
    viewMonth.value++;
    if (viewMonth.value > 11) {
      viewMonth.value = 0;
      viewYear.value++;
    }
  } else if (currentView.value === 'week') {
    weekOffset.value++;
  } else {
    viewYear.value++;
  }
}

function navigateToday() {
  const now = new Date();
  viewYear.value = now.getFullYear();
  viewMonth.value = now.getMonth();
  weekOffset.value = 0;
}

function switchView(view) {
  // 周↔月切换时同步日期，确保周视图创建的日程在月视图中可见
  if (view === 'month' && currentView.value === 'week') {
    // 当前周用今日所在月份；跨月周用周末（较新）所在月份，避免显示旧月
    const refDay = isCurrentWeek.value
      ? (weekDays.value.find(d => d.isToday) || weekDays.value[6])
      : weekDays.value[6];
    if (refDay) {
      const d = new Date(refDay.date);
      viewYear.value = d.getFullYear();
      viewMonth.value = d.getMonth();
    }
  } else if (view === 'week' && currentView.value === 'month') {
    const now = new Date();
    const currentDay = now.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    const targetMonday = new Date(viewYear.value, viewMonth.value, 1);
    const diffDays = Math.round((targetMonday - thisMonday) / 86400000);
    weekOffset.value = Math.round(diffDays / 7);
  }
  currentView.value = view;
  if (view === 'week') {
    nextTick(scrollToNow);
  }
}

function onYearMonthClick(monthIndex) {
  viewMonth.value = monthIndex;
  currentView.value = 'month';
}

// ========== 月视图拖拽选择 ==========
const isDragging = ref(false);
const dragCompleted = ref(false);
const selectionStart = ref(null);
const selectionEnd = ref(null);

function onCellClick(date) {
  if (dragCompleted.value) {
    dragCompleted.value = false;
    return;
  }
  openCreateModal(date);
}

function onCellMouseDown(date, event) {
  if (event.button !== 0) return; // 仅左键可拖拽
  isDragging.value = true;
  selectionStart.value = date;
  selectionEnd.value = date;
}

function onCellMouseEnter(date) {
  if (isDragging.value && selectionStart.value) {
    selectionEnd.value = date;
  }
}

function onCellMouseUp(date) {
  if (isDragging.value && selectionStart.value) {
    selectionEnd.value = date;
    const start = selectionStart.value < date ? selectionStart.value : date;
    const end = selectionStart.value < date ? date : selectionStart.value;
    isDragging.value = false;
    selectionStart.value = null;
    selectionEnd.value = null;
    if (start !== end) {
      dragCompleted.value = true;
      openCreateModal(start, end);
    }
  }
}

function onGridMouseUp() {
  if (isDragging.value) {
    isDragging.value = false;
    selectionStart.value = null;
    selectionEnd.value = null;
  }
}

// ========== 周视图拖拽选择 ==========
const weekTimeDrag = ref({
  active: false,
  startDate: '',
  startHour: -1,
  endHour: -1,
});

function onWeekCellClick(date, hour) {
  if (weekTimeDrag.value.active) return;
  const startTime = `${String(hour).padStart(2, '0')}:00`;
  const endHour = hour + 1;
  const endTime = endHour >= 24 ? '23:59' : `${String(endHour).padStart(2, '0')}:00`;
  openCreateModal(date, date, startTime, endTime, false);
}

function onWeekCellMouseDown(date, hour, event) {
  if (event && event.button !== 0) return; // 仅左键可拖拽
  weekTimeDrag.value = {
    active: true,
    startDate: date,
    startHour: hour,
    endHour: hour,
  };
}

function onWeekCellMouseEnter(hour) {
  if (!weekTimeDrag.value.active) return;
  weekTimeDrag.value.endHour = hour;
}

function onWeekCellMouseUp() {
  if (!weekTimeDrag.value.active) return;
  const { startDate, startHour, endHour } = weekTimeDrag.value;
  const minHour = Math.min(startHour, endHour);
  const maxHour = Math.max(startHour, endHour);
  const startTime = `${String(minHour).padStart(2, '0')}:00`;
  const endTime = maxHour >= 23 ? '23:59' : `${String(maxHour + 1).padStart(2, '0')}:00`;
  weekTimeDrag.value.active = false;
  openCreateModal(startDate, startDate, startTime, endTime, false);
}

// ========== 事件交互 ==========
function onEventClick(event) {
  router.push(`/schedule/${event.id}`);
}

// ========== 创建弹窗 ==========
const eventModalRef = ref(null);

function openCreateModal(startDate, endDate, startTime, endTime, allDay) {
  eventModalRef.value?.open({ start: startDate, end: endDate, startTime, endTime, allDay });
}

async function onModalSave(eventData) {
  await scheduleStore.addEvent(eventData);
}

function openAIAssistant() {
  alert('Friday AI 助理功能即将上线！');
}

// ========== 右键菜单 ==========
const contextMenuVisible = ref(false);
const contextMenuEvent = ref(null);
const contextMenuPos = ref({ x: 0, y: 0 });

function onEventRightClick(e, evt) {
  e.stopPropagation();
  contextMenuEvent.value = evt;
  contextMenuPos.value = { x: e.clientX, y: e.clientY };
  contextMenuVisible.value = true;
}

async function onCtxToggleComplete(evt) {
  if (!evt) return;
  await scheduleStore.updateEvent(evt.id, { completed: !evt.completed });
  contextMenuVisible.value = false;
}

function onCtxViewDetail(evt) {
  if (!evt) return;
  contextMenuVisible.value = false;
  closeMorePanel();
  router.push(`/schedule/${evt.id}`);
}

// ========== +n 日程面板 ==========
const morePanelVisible = ref(false);
const morePanelDate = ref(null);
const morePanelPos = ref({ x: 0, y: 0 });

const morePanelEvents = computed(() => {
  if (!morePanelDate.value) return [];
  return getEventsForDate(morePanelDate.value);
});

function onMoreClick(date, event) {
  morePanelDate.value = date;
  const panelWidth = 260;
  const panelHeight = 360;
  let x = event.clientX;
  let y = event.clientY;
  if (x + panelWidth > window.innerWidth) x = window.innerWidth - panelWidth - 8;
  if (y + panelHeight > window.innerHeight) y = window.innerHeight - panelHeight - 8;
  morePanelPos.value = { x, y };
  morePanelVisible.value = true;
}

function closeMorePanel() {
  morePanelVisible.value = false;
  morePanelDate.value = null;
}

function onPanelEventClick(event) {
  closeMorePanel();
  onEventClick(event);
}

function onPanelEventRightClick(e, evt) {
  e.stopPropagation();
  contextMenuEvent.value = evt;
  contextMenuPos.value = { x: e.clientX, y: e.clientY };
  contextMenuVisible.value = true;
}

async function toggleEventComplete(evt) {
  await scheduleStore.updateEvent(evt.id, { completed: !evt.completed });
}

// ========== 生命周期 ==========
watch(currentView, (v) => {
  if (v === 'week') {
    nextTick(scrollToNow);
  }
});

onMounted(() => {
  scheduleStore.loadEvents();
  updateNowY();
  nowTimer = setInterval(updateNowY, 60000);
  if (monthGridRef.value) {
    gridResizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        rowHeight.value = entry.contentRect.height / 6;
      }
    });
    gridResizeObserver.observe(monthGridRef.value);
  }
});

onUnmounted(() => {
  if (nowTimer) {
    clearInterval(nowTimer);
    nowTimer = null;
  }
  gridResizeObserver?.disconnect();
  gridResizeObserver = null;
});

onDeactivated(() => {
  contextMenuVisible.value = false;
  morePanelVisible.value = false;
});
</script>

<style scoped>
.schedule-calendar {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px 24px;
  overflow: hidden;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-secondary);
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s;
}

.nav-btn:hover {
  background: var(--bg-hover);
}

.today-btn {
  padding: 0 14px;
  height: 32px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.today-btn:hover {
  background: var(--bg-hover);
}

.current-date-label {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-left: 8px;
}

.view-switcher {
  display: flex;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 2px;
}

.view-btn {
  padding: 5px 14px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.view-btn.active {
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.view-btn:hover:not(.active) {
  color: var(--text-primary);
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 32px;
  border: none;
  background: #1a1a1a;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.create-btn:hover {
  background: #000000;
}

.ai-assistant-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 32px;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.ai-assistant-btn:hover {
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.calendar-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ========== Month View ========== */
.month-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.weekday-cell {
  padding: 8px 0;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, minmax(0, 1fr));
  flex: 1;
  min-height: 0;
  border-left: 1px solid var(--border-color);
  border-top: 1px solid var(--border-color);
  position: relative;
}

.month-cell {
  border-right: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  padding: 4px 6px;
  min-height: 0;
  overflow: hidden;
  cursor: pointer;
  transition: background 0.1s;
  position: relative;
  display: flex;
  flex-direction: column;
}

.month-cell:nth-child(7n) {
  border-right: none;
}

.month-cell:hover {
  background: transparent;
}

.month-cell.other-month {
  opacity: 0.4;
}

.month-cell.is-today .cell-date {
  background: var(--accent-color);
  color: white;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.month-cell.is-today .cell-date.is-month-start {
  width: auto;
  min-width: 22px;
  padding: 0 6px;
  border-radius: 11px;
}

.month-cell.is-selected {
  background: var(--accent-light);
}

.month-cell.is-dragging.is-selected {
  background: var(--accent-light);
}

.cell-date {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.cell-date-container {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 2px;
  position: relative;
}

.cell-holiday {
  margin-left: auto;
  font-size: 12px;
  color: #16a34a;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70px;
  line-height: 1.2;
  text-align: right;
}

.cell-holiday.lunar-holiday {
  color: #16a34a;
}

.cell-events {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.cell-event {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 4px;
  font-size: 11px;
  line-height: 1.2;
  height: 15px;
  flex-shrink: 0;
  border-radius: 3px;
  border-left: 2px solid;
  color: var(--text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
}

.cell-event:hover {
  opacity: 0.95;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.cell-event.is-completed {
  font-weight: 400;
  opacity: 0.65;
}

.cell-event.is-incomplete {
  font-weight: 700;
  opacity: 1.0;
}

.cell-more {
  position: absolute;
  bottom: 2px;
  right: 5px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  z-index: 5;
  user-select: none;
}

.cell-more:hover {
  color: var(--accent-color);
}

/* ========== Multi-day Event Bar Overlay ========== */
.multi-day-bar {
  position: absolute;
  height: 16px;
  padding: 1px 6px;
  font-size: 11px;
  border-radius: 3px;
  border-left: 2px solid;
  color: var(--text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
  z-index: 2;
  display: flex;
  align-items: center;
  transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
  pointer-events: auto;
}

.multi-day-bar:hover {
  opacity: 0.95;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.multi-day-bar.is-completed {
  opacity: 0.65;
}

.multi-day-bar.is-completed .multi-day-bar-title {
  font-weight: 400;
}

.multi-day-bar.is-incomplete .multi-day-bar-title {
  font-weight: 700;
}

.multi-day-bar-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ========== Week View ========== */
.week-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.wk-header {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
  z-index: 5;
}

.wk-gutter-head {
  width: 56px;
  flex-shrink: 0;
}

.wk-header-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  flex: 1;
  padding-right: 8px;
}

.wk-head-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0 10px;
  gap: 2px;
  min-width: 0;
}

.wk-head-weekday {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

.wk-head-date {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.wk-head-date-today {
  background: var(--accent-color);
  color: white;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.wk-allday {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.wk-gutter-allday {
  width: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 10px;
  font-size: 10px;
  color: var(--text-tertiary);
  font-weight: 500;
}

.wk-allday-cols {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  flex: 1;
  padding-right: 8px;
}

.wk-allday-col {
  border-left: 1px solid var(--border-color);
  padding: 4px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 56px;
  min-width: 0;
  cursor: pointer;
  transition: background 0.1s;
}

.wk-allday-col:hover {
  background: var(--bg-hover);
}

.wk-allday-evt {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  border-left: 3px solid;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: opacity 0.15s;
}

.wk-allday-evt:hover {
  opacity: 0.85;
}

.wk-allday-evt.is-completed {
  opacity: 0.6;
  font-weight: 400;
}

.wk-allday-evt.is-incomplete {
  opacity: 1;
  font-weight: 600;
}

.wk-scroll {
  flex: 1;
  overflow-y: scroll;
  overflow-x: hidden;
  position: relative;
}

.wk-scroll::-webkit-scrollbar {
  width: 8px;
}

.wk-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.wk-scroll::-webkit-scrollbar-thumb {
  background-color: var(--border-color);
  border-radius: 4px;
}

.wk-scroll::-webkit-scrollbar-thumb:hover {
  background-color: var(--text-tertiary);
}

.wk-scroll::-webkit-scrollbar-corner {
  background: transparent;
}

.wk-body {
  display: flex;
  position: relative;
}

.wk-gutter-times {
  width: 56px;
  flex-shrink: 0;
  position: relative;
}

.wk-gutter-hour {
  position: absolute;
  right: 10px;
  transform: translateY(-7px);
  font-size: 10px;
  color: var(--text-tertiary);
  font-weight: 500;
  line-height: 1;
}

.wk-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  flex: 1;
}

.wk-col {
  border-left: 1px solid var(--border-color);
  position: relative;
  min-width: 0;
}

.wk-today-col {
  background: color-mix(in srgb, var(--accent-color) 4%, transparent);
}

.wk-cell {
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.1s;
  position: relative;
}

.wk-cell:hover {
  background: var(--bg-hover);
}

.wk-cell-selected {
  background: var(--accent-light) !important;
}

.wk-cell-half {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  border-bottom: 1px dashed color-mix(in srgb, var(--border-color) 60%, transparent);
}

.wk-evt-layer {
  position: absolute;
  top: 0;
  left: 3px;
  right: 3px;
  pointer-events: none;
  z-index: 2;
}

.wk-evt {
  position: absolute;
  left: 0;
  right: 0;
  border-radius: 5px;
  border-left: 3px solid;
  padding: 3px 8px;
  overflow: hidden;
  cursor: pointer;
  pointer-events: auto;
  transition: opacity 0.15s, box-shadow 0.15s;
}

.wk-evt:hover {
  opacity: 0.9;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.wk-evt-title {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wk-evt-time {
  font-size: 10px;
  opacity: 0.8;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wk-now {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 10;
  pointer-events: none;
}

/* 非今日列的淡色时间线（横跨整周） */
.wk-now-line {
  position: absolute;
  left: 56px;
  right: 0;
  top: -1px;
  height: 3px;
  background: var(--accent-color);
  opacity: 0.35;
}

/* 今日列的加粗时间线段 */
.wk-now-bold {
  position: absolute;
  top: -1px;
  height: 3px;
  background: var(--accent-color);
  z-index: 1;
}

/* ========== Year View ========== */
.year-view {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 12px;
  height: 100%;
  overflow-y: auto;
}

.year-month-card {
  background: var(--bg-secondary);
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
}

.year-month-card:hover {
  background: var(--bg-hover);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.year-month-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
  text-align: center;
}

.year-month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.year-weekday-label {
  font-size: 9px;
  color: var(--text-tertiary);
  text-align: center;
  padding: 1px 0;
}

.year-day-cell {
  text-align: center;
  padding: 2px 0;
}

.year-day-number {
  font-size: 10px;
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
}

.year-day-cell.other-month .year-day-number {
  color: var(--text-tertiary);
}

.year-day-cell.is-today .year-day-number {
  background: var(--accent-color);
  color: white;
}

.year-day-cell.has-event .year-day-number {
  font-weight: 700;
}

.year-day-cell.has-event::after {
  content: '';
  display: block;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--accent-color);
  margin: 0 auto;
}
</style>
