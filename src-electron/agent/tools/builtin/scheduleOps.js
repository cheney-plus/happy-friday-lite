/**
 * 内置工具：日程操作
 *
 * 设计参考：src/views/knowledge/agent/Agent智能体设计.md §5.3
 *
 * 工具清单：
 *   - list_events: 列出日程（无需审批）
 *   - create_event: 创建日程（需审批，会修改用户数据）
 *
 * 复用 src-electron/db.js 的日程接口。
 */

import { registerTool } from '../registry.js'
import { logger } from '../../logger.js'

const log = logger.scope('Schedule')

// 列出日程：返回指定日期范围内的日程
registerTool({
  name: 'list_events',
  description:
    '列出用户在指定日期范围内的日程安排。' +
    '不传日期则返回所有日程。用于查询用户的日程、会议、提醒等。',
  parameters: {
    type: 'object',
    properties: {
      startDate: {
        type: 'string',
        description: '开始日期（YYYY-MM-DD），可选',
      },
      endDate: {
        type: 'string',
        description: '结束日期（YYYY-MM-DD），可选',
      },
    },
  },
  meta: {
    requireApproval: false,
    category: 'schedule',
  },
  handler: async (args, ctx) => {
    const { startDate, endDate } = args
    log.info(`列出日程: startDate="${startDate || '无'}", endDate="${endDate || '无'}"`)

    let events
    if (startDate && endDate) {
      events = ctx.db.getScheduleEventsByDateRange(startDate, endDate)
    } else {
      events = ctx.db.getScheduleEvents()
    }

    if (!events || events.length === 0) {
      log.info('无日程')
      return '该时间范围内没有日程安排。'
    }

    const formatted = events.slice(0, 20).map((e, idx) => {
      const timeStr = e.allDay ? '全天' : `${e.startTime || ''}-${e.endTime || ''}`
      const completed = e.completed ? ' [已完成]' : ''
      return `【日程 ${idx + 1}】${e.start} ${timeStr} | ${e.title}${completed}\n描述: ${e.description || '(无)'}`
    }).join('\n\n')

    log.info(`返回 ${events.length} 条日程`)
    return formatted
  },
})

// 创建日程（需审批）
registerTool({
  name: 'create_event',
  description:
    '创建一个新的日程安排并保存到用户的日历。会修改用户数据，需要用户确认。' +
    '适用于用户要求"添加日程"、"安排会议"、"设置提醒"等场景。',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '日程标题',
      },
      startDate: {
        type: 'string',
        description: '开始日期（YYYY-MM-DD）',
      },
      endDate: {
        type: 'string',
        description: '结束日期（YYYY-MM-DD），单日日程则与 startDate 相同',
      },
      startTime: {
        type: 'string',
        description: '开始时间（HH:mm），全天日程留空',
      },
      endTime: {
        type: 'string',
        description: '结束时间（HH:mm），全天日程留空',
      },
      allDay: {
        type: 'boolean',
        description: '是否全天日程',
      },
      description: {
        type: 'string',
        description: '日程描述/备注',
      },
    },
    required: ['title', 'startDate', 'endDate'],
  },
  meta: {
    requireApproval: true,
    category: 'schedule',
  },
  handler: async (args, ctx) => {
    log.info(`创建日程: title="${args.title}", date=${args.startDate}`)
    const event = ctx.db.createScheduleEvent({
      title: args.title,
      startDate: args.startDate,
      endDate: args.endDate,
      startTime: args.startTime || '',
      endTime: args.endTime || '',
      allDay: !!args.allDay,
      description: args.description || '',
    })
    log.info(`日程已创建: id=${event.id}`)
    return `日程已创建成功。\nID: ${event.id}\n标题: ${event.title}\n日期: ${event.start}${event.allDay ? ' (全天)' : ` ${event.startTime}-${event.endTime}`}`
  },
})
