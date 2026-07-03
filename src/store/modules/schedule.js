import { defineStore } from 'pinia'
import { electronService } from '@/services/electron'

// 深色马卡龙色系：完成日程使用（picker 默认显示），字体加粗
export const EVENT_COLORS = [
  '#D81B60', // 莓粉深
  '#8E24AA', // 紫罗兰深
  '#1E88E5', // 海蓝深
  '#43A047', // 薄荷深
  '#FB8C00', // 杏黄深
  '#F4511E', // 蜜桃深
  '#E53935', // 珊瑚深
  '#2E7D32', // 嫩绿深
  '#6A1B9A', // 兰花紫深
  '#546E7A', // 灰蓝深
  // 以下为中等色调，在白色与深色主题下均可见
  '#00897B', // 青绿
  '#5C6BC0', // 靛蓝
  '#00ACC1', // 青色
  '#AD1457', // 树莓
  '#8D6E63', // 摩卡
  '#558B2F', // 橄榄
]


// 浅色马卡龙色系：未完成日程使用，字体稍淡
export const EVENT_COLORS_LIGHT = [
  '#F4798F', // 莓粉
  '#BB8FCE', // 紫罗兰
  '#5DADE2', // 海蓝
  '#7DCEA0', // 薄荷
  '#F5B041', // 杏黄
  '#EB984E', // 蜜桃
  '#F1948A', // 珊瑚
  '#52BE80', // 嫩绿
  '#A569BD', // 兰花紫
  '#85929E', // 灰蓝
  // 以下为中等色调，在白色与深色主题下均可见
  '#76D7C4', // 青绿浅
  '#9FA8DA', // 靛蓝浅
  '#80DEEA', // 青色浅
  '#F06292', // 树莓浅
  '#BCAAA4', // 摩卡浅
  '#C0CA28', // 橄榄浅
]

// 深 ↔ 浅 互查表
const DARK_TO_LIGHT = {};
const LIGHT_TO_DARK = {};
EVENT_COLORS.forEach((dark, i) => {
  DARK_TO_LIGHT[dark] = EVENT_COLORS_LIGHT[i];
  LIGHT_TO_DARK[EVENT_COLORS_LIGHT[i]] = dark;
});

// 根据完成状态返回显示色：已完成 → 浅色；未完成 → 深色
export function getColorByStatus(color, completed) {
  if (completed) {
    return DARK_TO_LIGHT[color] || color;
  }
  return LIGHT_TO_DARK[color] || color;
}

export const useScheduleStore = defineStore('schedule', {
  state: () => ({
    events: [],
    selectedDate: new Date().toISOString().split('T')[0],
    currentView: 'month',
    loading: false
  }),

  getters: {
    getEventsForDateRange(state) {
      return (start, end) => {
        return state.events.filter(e => e.start <= end && e.end >= start)
      }
    },

    getEventById(state) {
      return (id) => {
        return state.events.find(e => e.id === id)
      }
    }
  },

  actions: {
    async loadEvents() {
      this.loading = true
      try {
        this.events = await electronService.invoke('get_schedule_events') || []
      } catch (e) {
        console.error('Failed to load schedule events:', e)
        this.events = []
      } finally {
        this.loading = false
      }
    },

    async addEvent(event) {
      try {
        const newEvent = await electronService.invoke('create_schedule_event', {
          title: event.title,
          startDate: event.start,
          endDate: event.end,
          startTime: event.startTime,
          endTime: event.endTime,
          allDay: event.allDay,
          description: event.description,
          color: event.color,
          reminder: event.reminder,
          completed: event.completed
        })
        this.events.push(newEvent)
        return newEvent
      } catch (e) {
        console.error('Failed to create schedule event:', e)
        throw e
      }
    },

    async updateEvent(id, updates) {
      const existing = this.events.find(e => e.id === id)
      if (!existing) return

      const merged = { ...existing, ...updates }
      try {
        await electronService.invoke('update_schedule_event', {
          eventId: id,
          title: merged.title,
          startDate: merged.start,
          endDate: merged.end,
          startTime: merged.startTime,
          endTime: merged.endTime,
          allDay: merged.allDay,
          description: merged.description,
          color: merged.color,
          reminder: merged.reminder,
          completed: merged.completed
        })
        const idx = this.events.findIndex(e => e.id === id)
        if (idx >= 0) {
          this.events[idx] = { ...this.events[idx], ...updates }
        }
      } catch (e) {
        console.error('Failed to update schedule event:', e)
        throw e
      }
    },

    async removeEvent(id) {
      try {
        await electronService.invoke('delete_schedule_event', { eventId: id })
        this.events = this.events.filter(e => e.id !== id)
      } catch (e) {
        console.error('Failed to delete schedule event:', e)
        throw e
      }
    },

    setSelectedDate(date) {
      this.selectedDate = date
    },

    setCurrentView(view) {
      this.currentView = view
    }
  }
})
