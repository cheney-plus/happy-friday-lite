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
        <div class="view-dropdown-wrapper" ref="viewDropdownRef">
          <button class="view-dropdown-trigger" @click.stop="toggleViewDropdown">
            <span class="view-trigger-label">{{ currentViewLabel }}</span>
            <svg class="view-trigger-arrow" :class="{ expanded: showViewDropdown }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <Transition name="view-dropdown">
            <div v-if="showViewDropdown" class="view-dropdown-panel" @click.stop>
              <div
                v-for="view in views"
                :key="view.key"
                :class="['view-dropdown-item', { active: currentView === view.key }]"
                @click="selectView(view.key)"
              >
                <svg v-if="currentView === view.key" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span v-else style="width:14px"></span>
                <span class="view-dropdown-item-label">{{ view.label }}</span>
              </div>
            </div>
          </Transition>
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
              <div v-if="monthHolidayByDate.get(cell.date)" :class="['cell-holiday', { 'lunar-holiday': monthHolidayByDate.get(cell.date)?.isLunar }]">
                {{ monthHolidayByDate.get(cell.date)?.holiday }}
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
                <span class="cell-event-title">{{ event.title }}</span>
                <span class="cell-event-priority" :class="priorityClass(event.priority)" :title="priorityLabel(event.priority)"></span>
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
            <span class="multi-day-bar-priority" :class="priorityClass(bar.event.priority)" :title="priorityLabel(bar.event.priority)"></span>
          </div>
        </div>
      </div>

      <!-- Week View -->
      <div v-else-if="currentView === 'week'" class="week-view">
        <div class="wk-header">
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
        <div class="wk-scroll">
          <!-- 周视图主体：跨日与单日日程统一在同一区域，跨日日程作为连续色条悬浮于列顶部 -->
          <div class="wk-cols" @mouseup="onWeekGridMouseUp">
            <div
              v-for="(day, dayIdx) in weekDays"
              :key="day.date"
              :class="['wk-day-col', {
                'wk-today-col': day.isToday,
                'is-selected': isDateInRange(day.date, weekDayDrag.startDate, weekDayDrag.endDate),
                'is-dragging': weekDayDrag.active
              }]"
              :style="{ paddingTop: weekBarOffsetByDate[dayIdx] + 'px' }"
              @mousedown.prevent="onWeekDayMouseDown(day.date, $event)"
              @mouseenter="onWeekDayMouseEnter(day.date)"
              @mouseup="onWeekDayMouseUp(day.date)"
              @click="onWeekDayClick(day.date)"
            >
              <div class="wk-day-events">
                <div
                  v-for="evt in getWeekSingleDayEvents(day.date)"
                  :key="evt.id"
                  :class="['wk-card', evt.completed ? 'is-completed' : 'is-incomplete']"
                  :style="{ backgroundColor: getEventBgColor(evt) }"
                  @click.stop="onEventClick(evt)"
                  @contextmenu.prevent.stop="onEventRightClick($event, evt)"
                >
                  <div class="wk-card-head">
                    <span class="wk-card-title">{{ evt.title }}</span>
                    <span v-if="evt.reminder" class="wk-card-reminder" :title="t('schedule.reminder')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    </span>
                    <span class="wk-priority-tag" :class="priorityClass(evt.priority)">{{ priorityLabel(evt.priority) }}</span>
                  </div>
                  <div class="wk-card-meta">
                    <span v-if="evt.allDay" class="wk-card-allday">{{ t('schedule.allDay') }}</span>
                    <span v-else class="wk-card-time">{{ evt.startTime }} - {{ evt.endTime }}</span>
                  </div>
                  <div v-if="evt.description" class="wk-card-desc">{{ evt.description }}</div>
                </div>
              </div>
            </div>
            <!-- 跨日日程：连续横跨多列的色条，与单日卡片同处一个区域 -->
            <div
              v-for="bar in weekMultiDayBars"
              :key="'wmd-' + bar.event.id"
              :class="['wk-mday-bar', bar.event.completed ? 'is-completed' : 'is-incomplete']"
              :style="weekBarStyle(bar)"
              @click.stop="onEventClick(bar.event)"
              @contextmenu.prevent.stop="onEventRightClick($event, bar.event)"
            >
              <span class="wk-mday-bar-title">{{ bar.event.title }}</span>
              <span class="wk-mday-bar-date">{{ formatWeekBarDateRange(bar.event) }}</span>
              <span class="wk-priority-tag" :class="priorityClass(bar.event.priority)">{{ priorityLabel(bar.event.priority) }}</span>
            </div>
            <!-- 本周无日程时的居中提示（不阻挡点击，仍可点空白创建） -->
            <div v-if="!weekHasEvents" class="wk-empty">
              {{ isCurrentWeek ? t('schedule.noEventsWeek') : t('schedule.noEvents') }}
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

    <!-- Friday 日程助理 -->
    <FridayAssistant v-model:visible="showAssistant" />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch, onDeactivated, onActivated } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useScheduleStore, DEFAULT_EVENT_PRIORITY } from '@/store/modules/schedule';
import { useAppStore } from '@/store';
import ScheduleTaskList from './ScheduleTaskList.vue';
import EventFormModal from './components/EventFormModal.vue';
import EventContextMenu from './components/EventContextMenu.vue';
import MoreEventsPanel from './components/MoreEventsPanel.vue';
import FridayAssistant from './components/FridayAssistant.vue';
import { getHolidayForDate } from './utils/lunarCalendar';
import {
  useCalendarHelpers,
  getDaysInMonth,
  getFirstDayOfWeek,
  formatDate,
  isTodayStr,
  isDateInRange,
  getEventBgColor,
  getEventDisplayColor,
} from './utils/calendarHelpers';

const { t } = useI18n();
const router = useRouter();
const scheduleStore = useScheduleStore();
const appStore = useAppStore();

const { isZh, getMonthDayLabel, weekDayLabels, weekDayMiniLabels, monthNames } = useCalendarHelpers();

// ========== 视图状态 ==========
// 初始视图取自设置：打开日程时默认显示用户配置的视图
const currentView = ref(appStore.scheduleDefaultView === 'week' ? 'week' : 'month');
// 记录上次已知的默认视图，用于在 keep-alive 重新激活时检测设置是否变更
const lastDefaultView = ref(appStore.scheduleDefaultView);
const viewYear = ref(new Date().getFullYear());
const viewMonth = ref(new Date().getMonth());
const weekOffset = ref(0);
const showAssistant = ref(false);

const views = computed(() => [
  { key: 'month', label: t('schedule.month') },
  { key: 'week', label: t('schedule.week') },
  { key: 'year', label: t('schedule.year') },
  { key: 'list', label: t('schedule.list') },
]);

const currentViewLabel = computed(() => {
  const v = views.value.find(item => item.key === currentView.value);
  return v ? v.label : '';
});

// ========== 视图下拉 ==========
const showViewDropdown = ref(false);
const viewDropdownRef = ref(null);

function toggleViewDropdown() {
  showViewDropdown.value = !showViewDropdown.value;
}

function selectView(key) {
  switchView(key);
  showViewDropdown.value = false;
}

function onViewDocClick(e) {
  if (viewDropdownRef.value && !viewDropdownRef.value.contains(e.target)) {
    showViewDropdown.value = false;
  }
}

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

// 预计算月视图各格事件数据（一次 store 调用，避免模板与计算属性中重复查询）
const monthEventsByDate = computed(() => {
  const map = new Map();
  for (const cell of monthGridCells.value) {
    map.set(cell.date, scheduleStore.getEventsForDateRange(cell.date, cell.date));
  }
  return map;
});

const monthSingleDayEventsByDate = computed(() => {
  const map = new Map();
  for (const [date, events] of monthEventsByDate.value) {
    map.set(date, events.filter(e => e.start === e.end));
  }
  return map;
});

// 日期 → 格子索引映射，替代 O(n) 的 findIndex
const monthCellIndexByDate = computed(() => {
  const map = new Map();
  monthGridCells.value.forEach((c, i) => map.set(c.date, i));
  return map;
});

// ========== 跨日日程条 ==========
const multiDayEventBars = computed(() => {
  const cells = monthGridCells.value;
  if (cells.length === 0) return [];

  const firstDate = cells[0].date;
  const lastDate = cells[cells.length - 1].date;
  const indexByDate = monthCellIndexByDate.value;

  const multiDayEvents = new Map();
  for (const events of monthEventsByDate.value.values()) {
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

    const startIdx = indexByDate.get(startDate);
    const endIdx = indexByDate.get(endDate);
    if (startIdx === undefined || endIdx === undefined) continue;

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
 * 预计算各格的跨日程条占用情况（一次扫描，避免模板逐格调用时 O(n²) 重复扫描）。
 * barSlotByDate: 覆盖该格的可见色条最大 slot（决定单日程偏移）
 * hiddenBarCountByDate: 覆盖该格但被隐藏的色条数（slot 超出可见范围）
 */
const monthCellBarMeta = computed(() => {
  const cells = monthGridCells.value;
  const visibleBars = visibleMultiDayEventBars.value;
  const allBars = multiDayEventBars.value;
  const maxSlot = maxVisibleBarSlot.value;

  const barSlotByDate = new Map();
  const hiddenBarCountByDate = new Map();

  for (const bar of visibleBars) {
    for (let col = bar.startCol; col <= bar.endCol; col++) {
      const idx = bar.row * 7 + col;
      const date = cells[idx]?.date;
      if (!date) continue;
      const cur = barSlotByDate.get(date);
      if (cur === undefined || bar.slot > cur) barSlotByDate.set(date, bar.slot);
    }
  }

  for (const bar of allBars) {
    if (bar.slot <= maxSlot) continue;
    for (let col = bar.startCol; col <= bar.endCol; col++) {
      const idx = bar.row * 7 + col;
      const date = cells[idx]?.date;
      if (!date) continue;
      hiddenBarCountByDate.set(date, (hiddenBarCountByDate.get(date) || 0) + 1);
    }
  }

  return { barSlotByDate, hiddenBarCountByDate };
});

// 预计算各格节日（避免模板中对同一日期重复调用 lunar 计算）
const monthHolidayByDate = computed(() => {
  const map = new Map();
  for (const cell of monthGridCells.value) {
    map.set(cell.date, getHolidayForDate(cell.date));
  }
  return map;
});

/** 计算某格的跨日程条偏移量（基于预计算映射，O(1)） */
function getMultiDayBarOffset(date) {
  const slot = monthCellBarMeta.value.barSlotByDate.get(date);
  if (slot === undefined) return 0;
  return (slot + 1) * ITEM_LINE_H;
}

/**
 * 根据格子实际行高动态计算可容纳的单日程数量。
 * 行高由 ResizeObserver 监听，行高不足时自动减少可见 item。
 */
function getVisibleSingleDayCount(date) {
  const barOffset = getMultiDayBarOffset(date);
  if (rowHeight.value === 0) {
    // ResizeObserver 尚未触发时的兜底
    return Math.max(0, MAX_VISIBLE_ITEMS - barOffset / ITEM_LINE_H);
  }
  const available = rowHeight.value - CELL_PADDING_Y - DATE_HEADER_H - barOffset;
  const fit = Math.floor(available / ITEM_LINE_H);
  return Math.max(0, Math.min(MAX_VISIBLE_ITEMS, fit));
}

/** 被隐藏的单日程数量 */
function getHiddenSingleDayCount(date) {
  const singles = monthSingleDayEventsByDate.value.get(date) || [];
  const visible = getVisibleSingleDayCount(date);
  return Math.max(0, singles.length - visible);
}

/** 格子中被隐藏的日程总数（单日程 + 跨日程条），用于 +n 显示 */
function getHiddenEventCount(date) {
  const hiddenBars = monthCellBarMeta.value.hiddenBarCountByDate.get(date) || 0;
  return getHiddenSingleDayCount(date) + hiddenBars;
}

/** 格子是否需要显示 +n */
function shouldShowMore(date) {
  return getHiddenEventCount(date) > 0;
}

// ========== 周视图 ==========
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

/** 当前查看的周是否没有任何日程（含跨日与单日） */
const weekHasEvents = computed(() => {
  const days = weekDays.value;
  if (days.length === 0) return true;
  const weekStart = days[0].date;
  const weekEnd = days[6].date;
  return scheduleStore.events.some(e => e.end >= weekStart && e.start <= weekEnd);
});

/**
 * 周视图跨日日程条：每个跨日事件（start !== end）渲染为一条连续横跨多列的色条。
 * 通过贪心算法分配垂直槽位以避免重叠，类似月视图的 multi-day-bar。
 */
const weekMultiDayBars = computed(() => {
  const days = weekDays.value;
  if (days.length === 0) return [];
  const weekStart = days[0].date;
  const weekEnd = days[6].date;
  const dateIndex = new Map();
  days.forEach((d, i) => dateIndex.set(d.date, i));

  const seen = new Set();
  const segs = [];
  for (const evt of scheduleStore.events) {
    if (evt.start === evt.end) continue; // 单日事件不在此处理
    if (evt.end < weekStart || evt.start > weekEnd) continue;
    if (seen.has(evt.id)) continue;
    seen.add(evt.id);
    const vs = evt.start < weekStart ? weekStart : evt.start;
    const ve = evt.end > weekEnd ? weekEnd : evt.end;
    const startCol = dateIndex.get(vs);
    const endCol = dateIndex.get(ve);
    if (startCol === undefined || endCol === undefined) continue;
    segs.push({ event: evt, startCol, endCol });
  }

  // 按起始列排序后贪心分配槽位
  segs.sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);
  const activeEndCols = [];
  for (const seg of segs) {
    let slot = -1;
    for (let i = 0; i < activeEndCols.length; i++) {
      if (activeEndCols[i] < seg.startCol) { slot = i; break; }
    }
    if (slot === -1) {
      slot = activeEndCols.length;
      activeEndCols.push(seg.endCol);
    } else {
      activeEndCols[slot] = seg.endCol;
    }
    seg.slot = slot;
  }
  return segs;
});

/**
 * 单日日程（start === end）按日期分组，并按"未完成 → 优先级 → 全天 → 时间"排序，
 * 使重要的未完成事项优先展示在卡片列顶部。
 */
const weekSingleDayEventsByDate = computed(() => {
  const map = new Map();
  const pr = { urgent: 0, important: 1, minor: 2 };
  for (const day of weekDays.value) {
    const evts = scheduleStore
      .getEventsForDateRange(day.date, day.date)
      .filter(e => e.start === e.end)
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const pa = pr[a.priority || DEFAULT_EVENT_PRIORITY] ?? 1;
        const pb = pr[b.priority || DEFAULT_EVENT_PRIORITY] ?? 1;
        if (pa !== pb) return pa - pb;
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
    map.set(day.date, evts);
  }
  return map;
});

function getWeekSingleDayEvents(date) {
  return weekSingleDayEventsByDate.value.get(date) || [];
}

/** 跨日色条的日期范围标签，如 "8月1日 - 8月3日" / "Aug 1 - Aug 3" */
function formatWeekBarDateRange(evt) {
  const s = getMonthDayLabel(evt.start);
  const e = getMonthDayLabel(evt.end);
  return s === e ? s : `${s} - ${e}`;
}

// 跨日色条尺寸常量（与 CSS 中 .wk-mday-bar 高度对应）
const WK_BAR_H = 30;
const WK_BAR_GAP = 4;
const WK_BASE_PAD = 6;

/**
 * 各日期列顶部为跨日色条预留的偏移量（数组，按列索引 0..6）。
 * 覆盖该列的色条按槽位占据顶部空间，单日卡片在偏移量之下排布，避免与色条重叠。
 */
const weekBarOffsetByDate = computed(() => {
  const days = weekDays.value;
  const bars = weekMultiDayBars.value;
  const offsets = [];
  for (let i = 0; i < days.length; i++) {
    let maxSlot = -1;
    for (const bar of bars) {
      if (i >= bar.startCol && i <= bar.endCol && bar.slot > maxSlot) {
        maxSlot = bar.slot;
      }
    }
    offsets.push(WK_BASE_PAD + (maxSlot + 1) * (WK_BAR_H + WK_BAR_GAP));
  }
  return offsets;
});

/** 跨日色条定位样式：按起止列与槽位绝对定位，连续横跨多列 */
function weekBarStyle(bar) {
  const span = bar.endCol - bar.startCol + 1;
  return {
    left: `calc(${bar.startCol * (100 / 7)}% + 4px)`,
    width: `calc(${span * (100 / 7)}% - 8px)`,
    top: `${WK_BASE_PAD + bar.slot * (WK_BAR_H + WK_BAR_GAP)}px`,
    height: `${WK_BAR_H}px`,
    backgroundColor: getEventBgColor(bar.event),
  };
}

// ========== 年视图 ==========
// 预计算本年度有事件的日期集合（单次扫描 events，避免年视图 504 次 store 调用）
const yearEventDates = computed(() => {
  const year = viewYear.value;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const set = new Set();
  for (const e of scheduleStore.events) {
    if (e.end < yearStart || e.start > yearEnd) continue;
    const start = e.start < yearStart ? yearStart : e.start;
    const end = e.end > yearEnd ? yearEnd : e.end;
    const d = new Date(start + 'T00:00:00');
    const endMs = new Date(end + 'T00:00:00').getTime();
    while (d.getTime() <= endMs) {
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      d.setDate(d.getDate() + 1);
    }
  }
  return set;
});

const yearMonths = computed(() => {
  const year = viewYear.value;
  const eventDates = yearEventDates.value;
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
      cells.push({ day, isCurrentMonth: true, isToday: isTodayStr(date), hasEvent: eventDates.has(date) });
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

// 月视图优先使用预计算映射（O(1)），避免每个格子在模板渲染时重复调用 store
function getSingleDayEventsForDate(date) {
  return monthSingleDayEventsByDate.value.get(date) || getEventsForDate(date).filter(e => e.start === e.end);
}

// 优先级标识：仅 urgent / minor 用强色圆点区分，important 用淡色保持视觉简洁
function priorityClass(p) {
  return `priority-${p || DEFAULT_EVENT_PRIORITY}`;
}

function priorityLabel(p) {
  const key = p || DEFAULT_EVENT_PRIORITY;
  if (key === 'urgent') return t('schedule.priorityUrgent');
  if (key === 'minor') return t('schedule.priorityMinor');
  return t('schedule.priorityImportant');
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
    // 查看月份包含今日时锚定今日（切到本周），否则锚定该月 1 号
    const isCurrentMonth = now.getFullYear() === viewYear.value && now.getMonth() === viewMonth.value;
    const targetDate = isCurrentMonth
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(viewYear.value, viewMonth.value, 1);
    // 取目标日期所在周的周一，确保 diffDays 为 7 的倍数
    const targetDay = targetDate.getDay();
    const targetMondayOffset = targetDay === 0 ? -6 : 1 - targetDay;
    const targetMonday = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + targetMondayOffset);
    const diffDays = Math.round((targetMonday - thisMonday) / 86400000);
    weekOffset.value = Math.round(diffDays / 7);
  }
  currentView.value = view;
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

// ========== 周视图拖拽选择（按天，跨日创建全天日程） ==========
const weekDayDrag = ref({ active: false, startDate: '', endDate: '', completed: false });

function onWeekDayMouseDown(date, event) {
  if (event && event.button !== 0) return; // 仅左键可拖拽
  weekDayDrag.value = { active: true, startDate: date, endDate: date, completed: false };
}

function onWeekDayMouseEnter(date) {
  if (!weekDayDrag.value.active) return;
  weekDayDrag.value.endDate = date;
}

function onWeekDayMouseUp(date) {
  if (!weekDayDrag.value.active) return;
  const start = weekDayDrag.value.startDate;
  const end = date || weekDayDrag.value.endDate;
  const s = start < end ? start : end;
  const e = start < end ? end : start;
  weekDayDrag.value.active = false;
  weekDayDrag.value.startDate = '';
  weekDayDrag.value.endDate = '';
  if (s !== e) {
    weekDayDrag.value.completed = true;
    openCreateModal(s, e, undefined, undefined, true);
  }
}

function onWeekGridMouseUp() {
  if (weekDayDrag.value.active) {
    weekDayDrag.value.active = false;
    weekDayDrag.value.startDate = '';
    weekDayDrag.value.endDate = '';
  }
}

function onWeekDayClick(date) {
  // 拖拽刚结束产生的 mouseup 会紧接着触发 click，这里跳过避免误创建
  if (weekDayDrag.value.completed) {
    weekDayDrag.value.completed = false;
    return;
  }
  openCreateModal(date, date, undefined, undefined, true);
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
  showAssistant.value = !showAssistant.value;
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
  if (v === 'month') {
    nextTick(setupGridObserver);
  }
});

function setupGridObserver() {
  gridResizeObserver?.disconnect();
  gridResizeObserver = null;
  if (monthGridRef.value) {
    // 立即测量一次，避免 v-if 重建 DOM 后 rowHeight 仍为 0 导致 +n 失效
    rowHeight.value = monthGridRef.value.clientHeight / 6;
    gridResizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        rowHeight.value = entry.contentRect.height / 6;
      }
    });
    gridResizeObserver.observe(monthGridRef.value);
  }
}

onMounted(() => {
  scheduleStore.loadEvents();
  nextTick(setupGridObserver);
  document.addEventListener('click', onViewDocClick);
});

onUnmounted(() => {
  gridResizeObserver?.disconnect();
  gridResizeObserver = null;
  document.removeEventListener('click', onViewDocClick);
});

onDeactivated(() => {
  contextMenuVisible.value = false;
  morePanelVisible.value = false;
  showViewDropdown.value = false;
  showAssistant.value = false;
});

// keep-alive 重新激活时刷新日程数据（onMounted 仅首次挂载时执行一次）
onActivated(() => {
  scheduleStore.loadEvents();
  // 若设置中的默认视图已变更（例如在设置页修改后返回），则同步切换到新默认视图
  if (appStore.scheduleDefaultView !== lastDefaultView.value) {
    lastDefaultView.value = appStore.scheduleDefaultView;
    currentView.value = appStore.scheduleDefaultView === 'week' ? 'week' : 'month';
  }
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

.view-dropdown-wrapper {
  position: relative;
}

.view-dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  height: 28px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  line-height: 1;
}

.view-dropdown-trigger:hover {
  border-color: var(--text-tertiary);
  background: var(--bg-secondary);
}

.view-trigger-label {
  white-space: nowrap;
}

.view-trigger-arrow {
  transition: transform 0.2s ease;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.view-trigger-arrow.expanded {
  transform: rotate(180deg);
}

.view-dropdown-panel {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  z-index: 100;
  padding: 3px;
  min-width: 88px;
}

.view-dropdown-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.12s;
  white-space: nowrap;
}

.view-dropdown-item:hover {
  background-color: var(--bg-hover);
}

.view-dropdown-item.active {
  background: var(--accent-light);
  color: var(--accent-color);
  font-weight: 600;
}

.view-dropdown-item-label {
  flex: 1;
}

.view-dropdown-enter-active {
  animation: viewDropdownIn 0.15s ease-out;
}

.view-dropdown-leave-active {
  animation: viewDropdownIn 0.12s ease-in reverse;
}

@keyframes viewDropdownIn {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
  background: #1a1a1a;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.ai-assistant-btn:hover {
  background: #000000;
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
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
}

.cell-event-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.cell-event-priority {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
  background: transparent;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--text-tertiary) 60%, transparent);
}

.cell-event-priority.priority-urgent {
  background: #ef4444;
  box-shadow: none;
}
.cell-event-priority.priority-important {
  background: #f59e0b;
  box-shadow: none;
}
.cell-event-priority.priority-minor {
  background: #64748b;
  box-shadow: none;
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
  cursor: pointer;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 5px;
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
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.multi-day-bar-priority {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #f59e0b;
}

.multi-day-bar-priority.priority-urgent { background: #ef4444; }
.multi-day-bar-priority.priority-important { background: #f59e0b; }
.multi-day-bar-priority.priority-minor { background: #64748b; }

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
  background: var(--bg-primary);
  z-index: 5;
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

.wk-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  /* 始终预留滚动条槽位，与表头 padding-right:8px 对齐，
     避免无滚动条时正文列与表头列错位 */
  scrollbar-gutter: stable;
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

/* ---- 跨日日程条（悬浮于列顶部，连续横跨多列） ---- */
.wk-mday-bar {
  position: absolute;
  z-index: 2;
  box-sizing: border-box;
  border-radius: 8px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
}

.wk-mday-bar:hover {
  opacity: 0.95;
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.14);
}

.wk-mday-bar.is-completed {
  opacity: 0.6;
}

.wk-mday-bar.is-incomplete .wk-mday-bar-title {
  font-weight: 700;
}

.wk-mday-bar.is-completed .wk-mday-bar-title {
  font-weight: 400;
  text-decoration: line-through;
}

.wk-mday-bar-title {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wk-mday-bar-date {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ---- 单日日程卡片列 ---- */
.wk-cols {
  position: relative;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: 1fr;
  min-height: 100%;
}

.wk-day-col {
  padding: 0 4px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  cursor: pointer;
  transition: background 0.1s;
}

.wk-day-col:hover:not(:has(.wk-card:hover)) {
  background: var(--bg-hover);
}

.wk-today-col {
  background: color-mix(in srgb, var(--accent-color) 4%, transparent);
}

.wk-today-col:hover:not(:has(.wk-card:hover)) {
  background: color-mix(in srgb, var(--accent-color) 7%, transparent);
}

.wk-day-col.is-selected,
.wk-day-col.is-dragging.is-selected {
  background: var(--accent-light);
}

.wk-day-events {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 0 12px;
}

/* ---- 富信息日程卡片 ---- */
.wk-card {
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
}

.wk-card:hover {
  opacity: 0.95;
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.14);
}

.wk-card.is-completed {
  opacity: 0.6;
}

.wk-card.is-completed .wk-card-title {
  text-decoration: line-through;
  font-weight: 400;
}

.wk-card.is-incomplete .wk-card-title {
  font-weight: 600;
}

.wk-card-head {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.wk-card-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.3;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wk-card-reminder {
  flex-shrink: 0;
  color: var(--text-tertiary);
  display: inline-flex;
}

.wk-card-meta {
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}

.wk-card-time {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wk-card-allday {
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--text-tertiary) 18%, transparent);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.wk-card-desc {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-tertiary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 优先级文字标签（卡片 + 跨日条共用） */
.wk-priority-tag {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  flex-shrink: 0;
}

.wk-priority-tag.priority-urgent {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.14);
}

.wk-priority-tag.priority-important {
  color: #d97706;
  background: rgba(245, 158, 11, 0.14);
}

.wk-priority-tag.priority-minor {
  color: #64748b;
  background: rgba(100, 116, 139, 0.14);
}

/* ---- 空状态提示 ---- */
.wk-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  color: var(--text-tertiary);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.3px;
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
