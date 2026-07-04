import { defineStore } from 'pinia'
import { electronService } from '@/services/electron'

// 马卡龙色系：每色相仅保留一个，完成/未完成通过透明度区分深浅
export const EVENT_COLORS = [
  '#E53935', // 珊瑚红
  '#FB8C00', // 杏黄
  '#558B2F', // 橄榄
  '#43A047', // 薄荷绿
  '#00897B', // 青绿
  '#1E88E5', // 海蓝
  '#5C6BC0', // 靛蓝
  '#8E24AA', // 紫罗兰
  '#D81B60', // 莓粉
  '#8D6E63', // 摩卡
  '#546E7A', // 灰蓝
]

// 日程优先级：urgent 紧急 / important 重要 / minor 次要
export const EVENT_PRIORITIES = ['urgent', 'important', 'minor']
export const DEFAULT_EVENT_PRIORITY = 'important'

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
          completed: event.completed,
          priority: event.priority
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
          completed: merged.completed,
          priority: merged.priority
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
