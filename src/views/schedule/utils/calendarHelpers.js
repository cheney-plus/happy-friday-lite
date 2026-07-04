/**
 * 日程模块通用工具：日期计算、格式化、事件颜色
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

// ========== 纯日期函数 ==========

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfWeek(year, month) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isTodayStr(dateStr) {
  return dateStr === new Date().toISOString().split('T')[0];
}

export function timeToMin(time) {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isDateInRange(date, start, end) {
  if (!start || !end) return false;
  const s = start < end ? start : end;
  const e = start < end ? end : start;
  return date >= s && date <= e;
}

// ========== 事件颜色 ==========
// 完成/未完成使用同一颜色，仅透明度不同：已完成 18（淡），未完成 40（深）

/** 返回事件的主题色（不随完成状态变化） */
export function getEventDisplayColor(evt) {
  return evt.color;
}

/** 返回事件背景色 = 主题色 + 透明度 */
export function getEventBgColor(evt) {
  return evt.color + (evt.completed ? '18' : '40');
}

// ========== 需要国际化的工具 ==========

/**
 * 提供依赖 i18n 的日历辅助函数
 */
export function useCalendarHelpers() {
  const { locale, t } = useI18n();
  const isZh = computed(() => locale.value === 'zh-CN');

  function formatHour(h) {
    if (isZh.value) {
      return h === 0 ? '' : `${h}:00`;
    }
    if (h === 0) return '';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  }

  function getMonthDayLabel(dateStr) {
    const m = parseInt(dateStr.slice(5, 7));
    const d = parseInt(dateStr.slice(8, 10));
    if (isZh.value) {
      return `${m}月${d}日`;
    }
    const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
    return `${monthAbbr} ${d}`;
  }

  const weekDayLabels = computed(() => [
    t('schedule.monday'), t('schedule.tuesday'), t('schedule.wednesday'),
    t('schedule.thursday'), t('schedule.friday'), t('schedule.saturday'), t('schedule.sunday'),
  ]);

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

  return { isZh, formatHour, getMonthDayLabel, weekDayLabels, weekDayMiniLabels, monthNames };
}
