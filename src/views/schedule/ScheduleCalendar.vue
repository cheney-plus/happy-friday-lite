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
        <div class="month-grid" @mouseup="onGridMouseUp">
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
              <div class="cell-date">{{ cell.day }}</div>
              <div v-if="getHolidayForDate(cell.date)" :class="['cell-holiday', { 'lunar-holiday': getHolidayForDate(cell.date)?.isLunar }]">
                {{ getHolidayForDate(cell.date)?.holiday }}
              </div>
            </div>
            <div class="cell-events">
              <div
                v-for="event in getEventsForDate(cell.date).slice(0, 3)"
                :key="event.id"
                class="cell-event"
                :style="{ backgroundColor: getEventDisplayColor(event) + '18', color: getEventDisplayColor(event), borderLeftColor: getEventDisplayColor(event) }"
                @click.stop="onEventClick(event)"
                @contextmenu.prevent.stop="onEventRightClick($event, event)"
              >
                <span class="event-dot" :style="{ backgroundColor: getEventDisplayColor(event) }"></span>
                {{ event.title }}
              </div>
              <div v-if="getEventsForDate(cell.date).length > 3" class="cell-more">
                +{{ getEventsForDate(cell.date).length - 3 }}
              </div>
            </div>
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
        <div class="wk-allday" v-if="hasAllDayEvents">
          <div class="wk-gutter-allday">{{ t('schedule.allDay') }}</div>
          <div class="wk-allday-cols">
            <div
              v-for="day in weekDays"
              :key="day.date"
              :class="['wk-allday-col', { 'wk-today-col': day.isToday }]"
            >
              <div
                v-for="evt in getAllDayEventsForDate(day.date)"
                :key="evt.id"
                class="wk-allday-evt"
                :style="{ backgroundColor: getEventDisplayColor(evt) + '22', color: getEventDisplayColor(evt), borderLeftColor: getEventDisplayColor(evt) }"
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
                  @mousedown.prevent="onWeekCellMouseDown(day.date, h - 1)"
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
              <div class="wk-now-dot"></div>
              <div class="wk-now-line"></div>
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

    <Teleport to="body">
      <div v-if="modalVisible" class="event-modal-overlay" @click.self="closeModal">
        <div class="event-modal">
          <div class="modal-header">
            <h3>{{ isEditMode ? t('schedule.editEvent') : t('schedule.createEvent') }}</h3>
            <button class="modal-close-btn" @click="closeModal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>{{ t('schedule.eventTitle') }}</label>
              <input
                ref="titleInputRef"
                v-model="formData.title"
                type="text"
                class="form-input"
                :placeholder="t('schedule.eventTitlePlaceholder')"
                @keydown.enter="saveEvent"
              />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>{{ t('schedule.startDate') }}</label>
                <input v-model="formData.start" type="date" class="form-input" />
              </div>
              <div class="form-group">
                <label>{{ t('schedule.endDate') }}</label>
                <input v-model="formData.end" type="date" class="form-input" :min="formData.start" />
              </div>
            </div>
            <div class="form-group">
              <div class="checkbox-row">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="formData.allDay" class="checkbox-input" />
                  <span class="checkbox-custom"></span>
                  {{ t('schedule.allDay') }}
                </label>
                <label :class="['checkbox-label', { disabled: isCreatePast }]">
                  <input type="checkbox" v-model="formData.reminder" class="checkbox-input" :disabled="isCreatePast" />
                  <span class="checkbox-custom"></span>
                  {{ t('schedule.reminder') }}
                </label>
              </div>
            </div>
            <div v-if="!formData.allDay" class="form-row">
              <div class="form-group">
                <label>{{ t('schedule.startTime') }}</label>
                <input v-model="formData.startTime" type="time" class="form-input" />
              </div>
              <div class="form-group">
                <label>{{ t('schedule.endTime') }}</label>
                <input v-model="formData.endTime" type="time" class="form-input" />
              </div>
            </div>
            <div class="form-group">
              <label>{{ t('schedule.description') }}</label>
              <textarea
                v-model="formData.description"
                class="form-textarea"
                :placeholder="t('schedule.descriptionPlaceholder')"
                rows="3"
              ></textarea>
            </div>
            <div class="form-group">
              <label>{{ t('schedule.color') }}</label>
              <div class="color-picker">
                <div
                  v-for="color in EVENT_COLORS"
                  :key="color"
                  :class="['color-option', { active: formData.color === color }]"
                  :style="{ backgroundColor: color }"
                  @click="formData.color = color"
                >
                  <svg v-if="formData.color === color" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button v-if="isEditMode" class="btn btn-danger" @click="deleteEvent">{{ t('schedule.delete') }}</button>
            <div class="footer-spacer"></div>
            <button class="btn btn-secondary" @click="closeModal">{{ t('schedule.cancel') }}</button>
            <button class="btn btn-primary" @click="saveEvent" :disabled="!formData.title.trim()">{{ t('schedule.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="contextMenuVisible" class="ctx-overlay" @click="contextMenuVisible = false" @contextmenu.prevent>
        <div class="ctx-menu" :style="{ left: contextMenuPos.x + 'px', top: contextMenuPos.y + 'px' }">
          <div v-if="contextMenuEvent" class="ctx-item" @click="toggleComplete()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="contextMenuEvent.completed ? 'var(--text-tertiary)' : '#16a34a'" stroke-width="2">
              <polyline v-if="!contextMenuEvent.completed" points="20 6 9 17 4 12"></polyline>
              <circle v-else cx="12" cy="12" r="10"></circle>
            </svg>
            {{ contextMenuEvent.completed ? t('schedule.markUncomplete') : t('schedule.markComplete') }}
          </div>
          <div class="ctx-item danger" @click="goToDetail()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            {{ t('schedule.viewDetail') }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, reactive, nextTick, onMounted, onUnmounted, watch, onDeactivated } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useScheduleStore, EVENT_COLORS } from '@/store/modules/schedule';
import ScheduleTaskList from './ScheduleTaskList.vue';

const { t, locale } = useI18n();
const router = useRouter();
const scheduleStore = useScheduleStore();

const currentView = ref('month');
const viewYear = ref(new Date().getFullYear());
const viewMonth = ref(new Date().getMonth());
const modalVisible = ref(false);
const isEditMode = ref(false);
const editingEventId = ref(null);
const titleInputRef = ref(null);
const weekScrollRef = ref(null);

const isDragging = ref(false);
const dragCompleted = ref(false);
const selectionStart = ref(null);
const selectionEnd = ref(null);

const weekTimeDrag = ref({
  active: false,
  startDate: '',
  startHour: -1,
  endHour: -1,
});

const nowY = ref(0);
let nowTimer = null;

const weekOffset = ref(0);

const hourPx = 48;
const totalDayHeight = 24 * hourPx;

const INTERNATIONAL_HOLIDAYS = {
  '01-01': '元旦',
  '02-14': '情人节',
  '03-08': '妇女节',
  '03-12': '植树节',
  '04-01': '愚人节',
  '04-22': '地球日',
  '05-01': '劳动节',
  '05-04': '青年节',
  '06-01': '儿童节',
  '07-01': '建党节',
  '08-01': '建军节',
  '09-10': '教师节',
  '10-01': '国庆节',
  '10-31': '万圣节',
  '11-11': '光棍节',
  '12-24': '平安夜',
  '12-25': '圣诞节',
};

const LUNAR_HOLIDAYS = {
  '01-01': '春节',
  '01-15': '元宵节',
  '02-02': '龙抬头',
  '05-05': '端午节',
  '07-07': '七夕节',
  '07-15': '中元节',
  '08-15': '中秋节',
  '09-09': '重阳节',
  '12-08': '腊八节',
  '12-23': '小年',
  '12-30': '除夕',
};

const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
];

function getLunarMonthDays(year, month) {
  return (LUNAR_INFO[year - 1900] & (0x10000 >> month)) ? 30 : 29;
}

function getLunarYearDays(year) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (LUNAR_INFO[year - 1900] & i) ? 1 : 0;
  }
  return sum + getLeapMonthDays(year);
}

function getLeapMonth(year) {
  return LUNAR_INFO[year - 1900] & 0xf;
}

function getLeapMonthDays(year) {
  if (getLeapMonth(year)) {
    return (LUNAR_INFO[year - 1900] & 0x10000) ? 30 : 29;
  }
  return 0;
}

function solarToLunar(year, month, day) {
  const baseDate = new Date(1900, 0, 31);
  const targetDate = new Date(year, month - 1, day);
  let offset = Math.floor((targetDate.getTime() - baseDate.getTime()) / 86400000);

  let lunarYear = 1900;
  let yearDays = 0;
  while (lunarYear < 2101 && offset > 0) {
    yearDays = getLunarYearDays(lunarYear);
    offset -= yearDays;
    lunarYear++;
  }
  if (offset < 0) {
    offset += yearDays;
    lunarYear--;
  }

  let lunarMonth = 1;
  let leapMonth = getLeapMonth(lunarYear);
  let isLeap = false;
  let monthDays = 0;

  while (lunarMonth < 13 && offset > 0) {
    if (leapMonth > 0 && lunarMonth === (leapMonth + 1) && !isLeap) {
      --lunarMonth;
      isLeap = true;
      monthDays = getLeapMonthDays(lunarYear);
    } else {
      monthDays = getLunarMonthDays(lunarYear, lunarMonth);
    }

    if (isLeap && lunarMonth === (leapMonth + 1)) {
      isLeap = false;
    }
    offset -= monthDays;
    lunarMonth++;
  }

  if (offset === 0 && leapMonth > 0 && lunarMonth === leapMonth + 1) {
    if (isLeap) {
      isLeap = false;
    } else {
      isLeap = true;
      --lunarMonth;
    }
  }

  if (offset < 0) {
    offset += monthDays;
    --lunarMonth;
  }

  const lunarDay = offset + 1;
  return { lunarMonth, lunarDay };
}

function getHolidayForDate(dateStr) {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);

  const solarKey = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (INTERNATIONAL_HOLIDAYS[solarKey]) {
    return { holiday: INTERNATIONAL_HOLIDAYS[solarKey], isLunar: false };
  }

  const lunar = solarToLunar(year, month, day);
  const lunarKey = `${String(lunar.lunarMonth).padStart(2, '0')}-${String(lunar.lunarDay).padStart(2, '0')}`;
  if (LUNAR_HOLIDAYS[lunarKey]) {
    return { holiday: LUNAR_HOLIDAYS[lunarKey], isLunar: true };
  }

  return null;
}

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

const isZh = computed(() => locale.value === 'zh-CN');

const isCreatePast = computed(() => {
  if (!formData.end) return false;
  const today = new Date().toISOString().split('T')[0];
  return formData.end < today;
});

const views = computed(() => [
  { key: 'month', label: t('schedule.month') },
  { key: 'week', label: t('schedule.week') },
  { key: 'year', label: t('schedule.year') },
  { key: 'list', label: t('schedule.list') },
]);

const weekDayLabels = computed(() => {
  return [t('schedule.monday'), t('schedule.tuesday'), t('schedule.wednesday'), t('schedule.thursday'), t('schedule.friday'), t('schedule.saturday'), t('schedule.sunday')];
});

const weekDayMiniLabels = computed(() => {
  if (isZh.value) return ['一', '二', '三', '四', '五', '六', '日'];
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
});

const monthNames = computed(() => [
  t('schedule.january'), t('schedule.february'), t('schedule.march'),
  t('schedule.april'), t('schedule.may'), t('schedule.june'),
  t('schedule.july'), t('schedule.august'), t('schedule.september'),
  t('schedule.october'), t('schedule.november'), t('schedule.december'),
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

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isTodayStr(dateStr) {
  return dateStr === new Date().toISOString().split('T')[0];
}

function formatHour(h) {
  if (isZh.value) {
    return h === 0 ? '' : `${h}:00`;
  }
  if (h === 0) return '';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function timeToMin(time) {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
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
    backgroundColor: dc + '18',
    borderLeftColor: dc,
    color: dc,
  };
}

function getEventDisplayColor(evt) {
  if (evt.completed) return '#16a34a';
  const today = new Date().toISOString().split('T')[0];
  if (evt.end < today) return '#ef4444';
  return evt.color;
}

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

const isCurrentWeek = computed(() => {
  return weekOffset.value === 0;
});

const hasAllDayEvents = computed(() => {
  const dates = weekDays.value.map(d => d.date);
  return scheduleStore.events.some(e => e.allDay && dates.some(d => d >= e.start && d <= e.end));
});

function getAllDayEventsForDate(date) {
  return scheduleStore.getEventsForDateRange(date, date).filter(e => e.allDay);
}

function getTimedEventsForDate(date) {
  return scheduleStore.getEventsForDateRange(date, date).filter(e => !e.allDay);
}

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

function getEventsForDate(date) {
  return scheduleStore.getEventsForDateRange(date, date);
}

function isDateInRange(date, start, end) {
  if (!start || !end) return false;
  const s = start < end ? start : end;
  const e = start < end ? end : start;
  return date >= s && date <= e;
}

function updateNowY() {
  const now = new Date();
  nowY.value = (now.getHours() * 60 + now.getMinutes()) / 60 * hourPx;
}

function onWeekScroll() {
}

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
  currentView.value = view;
  if (view === 'week') {
    nextTick(() => {
      scrollToNow();
    });
  }
}

function scrollToNow() {
  if (!weekScrollRef.value) return;
  const now = new Date();
  const y = (now.getHours() - 1) * hourPx;
  weekScrollRef.value.scrollTop = Math.max(0, y);
}

function onCellClick(date) {
  if (dragCompleted.value) {
    dragCompleted.value = false;
    return;
  }
  openCreateModal(date);
}

function onCellMouseDown(date, _event) {
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

function onWeekCellClick(date, hour) {
  if (weekTimeDrag.value.active) return;
  const startTime = `${String(hour).padStart(2, '0')}:00`;
  const endHour = hour + 1;
  const endTime = endHour >= 24 ? '23:59' : `${String(endHour).padStart(2, '0')}:00`;
  openCreateModal(date, date, startTime, endTime, false);
}

function onWeekCellMouseDown(date, hour) {
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

function onEventClick(event) {
  router.push(`/schedule/${event.id}`);
}

const contextMenuVisible = ref(false);
const contextMenuEvent = ref(null);
const contextMenuPos = ref({ x: 0, y: 0 });

function onEventRightClick(e, evt) {
  e.stopPropagation();
  contextMenuEvent.value = evt;
  contextMenuPos.value = { x: e.clientX, y: e.clientY };
  contextMenuVisible.value = true;
}

async function toggleComplete() {
  if (!contextMenuEvent.value) return;
  await scheduleStore.updateEvent(contextMenuEvent.value.id, { completed: !contextMenuEvent.value.completed });
  contextMenuVisible.value = false;
}

function goToDetail() {
  if (!contextMenuEvent.value) return;
  contextMenuVisible.value = false;
  router.push(`/schedule/${contextMenuEvent.value.id}`);
}

function onYearMonthClick(monthIndex) {
  viewMonth.value = monthIndex;
  currentView.value = 'month';
}

function openAIAssistant() {
  alert('Friday AI 助理功能即将上线！');
}

function openCreateModal(startDate, endDate, startTime, endTime, allDay) {
  isEditMode.value = false;
  editingEventId.value = null;
  const date = startDate || new Date().toISOString().split('T')[0];
  formData.title = '';
  formData.start = date;
  formData.end = endDate || date;
  formData.allDay = allDay !== undefined ? allDay : true;
  formData.startTime = startTime || '09:00';
  formData.endTime = endTime || '10:00';
  formData.description = '';
  formData.color = EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)];
  modalVisible.value = true;
  nextTick(() => {
    titleInputRef.value?.focus();
  });
}

function closeModal() {
  modalVisible.value = false;
  isEditMode.value = false;
  editingEventId.value = null;
}

async function saveEvent() {
  if (!formData.title.trim()) return;
  if (isEditMode.value && editingEventId.value) {
    await scheduleStore.updateEvent(editingEventId.value, {
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
  } else {
    await scheduleStore.addEvent({
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
  }
  closeModal();
}

async function deleteEvent() {
  if (editingEventId.value) {
    await scheduleStore.removeEvent(editingEventId.value);
    closeModal();
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape' && modalVisible.value) {
    closeModal();
  }
}

watch(currentView, (v) => {
  if (v === 'week') {
    nextTick(scrollToNow);
  }
});

onMounted(() => {
  scheduleStore.loadEvents();
  document.addEventListener('keydown', handleKeydown);
  updateNowY();
  nowTimer = setInterval(updateNowY, 60000);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  if (nowTimer) {
    clearInterval(nowTimer);
    nowTimer = null;
  }
});

onDeactivated(() => {
  contextMenuVisible.value = false;
  modalVisible.value = false;
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
  grid-template-rows: repeat(6, 1fr);
  flex: 1;
  border-left: 1px solid var(--border-color);
  border-top: 1px solid var(--border-color);
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
}

.month-cell:nth-child(7n) {
  border-right: none;
}

.month-cell:hover {
  background: var(--bg-hover);
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
  position: absolute;
  top: -2px;
  right: 0;
  font-size: 10px;
  color: #f59e0b;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60px;
  line-height: 1.2;
  text-align: right;
}

.cell-holiday.lunar-holiday {
  color: #ef4444;
}

.cell-events {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cell-event {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 4px;
  font-size: 11px;
  border-radius: 3px;
  border-left: 2px solid;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: opacity 0.15s;
}

.cell-event:hover {
  opacity: 0.8;
}

.event-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cell-more {
  font-size: 10px;
  color: var(--text-secondary);
  padding: 0 4px;
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
  display: flex;
  flex: 1;
  padding-right: 8px;
}

.wk-head-day {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0 10px;
  gap: 2px;
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
  min-height: 28px;
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
  display: flex;
  flex: 1;
  padding-right: 8px;
}

.wk-allday-col {
  flex: 1;
  border-left: 1px solid var(--border-color);
  padding: 3px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 24px;
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
  display: flex;
  flex: 1;
}

.wk-col {
  flex: 1;
  border-left: 1px solid var(--border-color);
  position: relative;
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
  display: flex;
  align-items: center;
}

.wk-now-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-color);
  flex-shrink: 0;
  margin-left: 52px;
}

.wk-now-line {
  flex: 1;
  height: 2px;
  background: var(--accent-color);
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

/* ========== Event Modal ========== */
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
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group label {
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

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px !important;
  color: var(--text-primary) !important;
  user-select: none;
}

.checkbox-label.disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.checkbox-row {
  display: flex;
  gap: 20px;
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

.btn-danger {
  background: #dc2626;
  color: white;
}

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
  background: white;
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
  background-color: #f5f5f5;
}

.ctx-item.danger:hover {
  background-color: #fef2f2;
  color: #ef4444;
}
</style>
