/**
 * 内置工具：日程操作（list_events / create_event / update_event / delete_event）
 * =================================================================
 * 设计参考：Agent智能体设计.md 2.9 内置工具清单
 *
 * 调用 src-electron/db.js 日程接口。
 * - list_events: 只读，无需审批
 * - create_event / update_event / delete_event: 写操作，需人机审批
 *
 * 优先级取值：urgent（紧急）/ important（重要）/ minor（次要）
 */

import { z } from 'zod/v3'
import { registerTool } from '../registry.js'

// 优先级枚举（与 src/store/modules/schedule.js EVENT_PRIORITIES 保持一致）
const PRIORITY_ENUM = z
  .enum(['urgent', 'important', 'minor'])
  .describe('优先级：urgent 紧急 / important 重要 / minor 次要')

// ========== list_events ==========

const listEventsSchema = z.object({
  startDate: z
    .string()
    .optional()
    .describe('查询起始日期（YYYY-MM-DD，可选）'),
  endDate: z
    .string()
    .optional()
    .describe('查询结束日期（YYYY-MM-DD，可选）')
})

async function listEventsHandler(args, ctx) {
  const { startDate, endDate } = args
  ctx.logger.info(`[list_events] range=${startDate || 'ALL'} ~ ${endDate || 'ALL'}`)

  const { getScheduleEvents, getScheduleEventsByDateRange } = await import('../../../db.js')

  let events
  if (startDate && endDate) {
    events = getScheduleEventsByDateRange(startDate, endDate)
  } else {
    events = getScheduleEvents()
  }

  ctx.logger.info(`[list_events] 命中 ${events.length} 条日程`)

  if (events.length === 0) {
    return '当前没有日程事件。'
  }

  const priorityLabel = { urgent: '紧急', important: '重要', minor: '次要' }

  return events
    .map(
      e =>
        `【日程 ${e.id}】${e.title}\n` +
        `  日期: ${e.start}${e.end && e.end !== e.start ? ' ~ ' + e.end : ''}\n` +
        `  时间: ${e.startTime || '全天'}${e.endTime ? ' ~ ' + e.endTime : ''}\n` +
        `  优先级: ${priorityLabel[e.priority] || e.priority || '重要'}\n` +
        (e.description ? `  描述: ${e.description}\n` : '') +
        `  状态: ${e.completed ? '已完成' : '未完成'}`
    )
    .join('\n\n')
}

registerTool({
  name: 'list_events',
  description: '查询用户的日程事件。可按日期范围筛选，不传则返回全部日程。',
  schema: listEventsSchema,
  handler: listEventsHandler,
  meta: { requireApproval: false }
})

// ========== create_event ==========

const createEventSchema = z.object({
  title: z.string().describe('日程标题'),
  startDate: z.string().describe('开始日期（YYYY-MM-DD）'),
  endDate: z
    .string()
    .optional()
    .describe('结束日期（YYYY-MM-DD，可选，默认与开始日期相同）'),
  startTime: z
    .string()
    .optional()
    .describe('开始时间（HH:mm，可选，不传则为全天事件）'),
  endTime: z
    .string()
    .optional()
    .describe('结束时间（HH:mm，可选）'),
  description: z.string().optional().describe('日程描述（可选）'),
  allDay: z.boolean().optional().describe('是否全天事件（默认根据是否传 startTime 判断）'),
  priority: PRIORITY_ENUM.optional().describe('优先级（默认 important）')
})

async function createEventHandler(args, ctx) {
  const { title, startDate, endDate, startTime, endTime, description, allDay, priority } = args
  ctx.logger.info(`[create_event] title="${title}", date=${startDate}, priority=${priority || 'important'}`)

  const { createScheduleEvent } = await import('../../../db.js')

  // 如果未传 allDay，根据是否传 startTime 推断
  const isAllDay = allDay !== undefined ? allDay : !startTime

  const event = createScheduleEvent({
    title,
    startDate,
    endDate: endDate || startDate,
    startTime: startTime || '',
    endTime: endTime || '',
    description: description || '',
    allDay: isAllDay,
    priority: priority || 'important'
  })

  ctx.logger.info(`[create_event] 已创建日程: id=${event.id}`)
  return `已创建日程: id=${event.id}, title="${title}", date=${startDate}, priority=${priority || 'important'}`
}

registerTool({
  name: 'create_event',
  description: '创建一条新的日程事件。',
  schema: createEventSchema,
  handler: createEventHandler,
  meta: { requireApproval: true } // 写操作需审批
})

// ========== update_event ==========

const updateEventSchema = z.object({
  eventId: z.string().describe('要更新的日程 ID'),
  title: z.string().optional().describe('新标题（可选）'),
  startDate: z.string().optional().describe('新开始日期（可选）'),
  endDate: z.string().optional().describe('新结束日期（可选）'),
  startTime: z.string().optional().describe('新开始时间（可选）'),
  endTime: z.string().optional().describe('新结束时间（可选）'),
  description: z.string().optional().describe('新描述（可选）'),
  completed: z.boolean().optional().describe('是否标记为已完成（可选）'),
  priority: PRIORITY_ENUM.optional().describe('新优先级（可选）')
})

async function updateEventHandler(args, ctx) {
  const { eventId, ...updates } = args
  ctx.logger.info(`[update_event] eventId=${eventId}`)

  const { getScheduleEvent, updateScheduleEvent } = await import('../../../db.js')
  const existing = getScheduleEvent(eventId)
  if (!existing) {
    return `未找到日程: ${eventId}`
  }

  // 适配 db.js 的参数命名（startDate/endDate 而非 start/end）
  const dbUpdates = {}
  if (updates.title !== undefined) dbUpdates.title = updates.title
  if (updates.startDate !== undefined) dbUpdates.startDate = updates.startDate
  if (updates.endDate !== undefined) dbUpdates.endDate = updates.endDate
  if (updates.startTime !== undefined) dbUpdates.startTime = updates.startTime
  if (updates.endTime !== undefined) dbUpdates.endTime = updates.endTime
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.completed !== undefined) dbUpdates.completed = updates.completed
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority

  const updated = updateScheduleEvent(eventId, dbUpdates)
  if (!updated) {
    return `更新日程失败: ${eventId}`
  }

  ctx.logger.info(`[update_event] 已更新日程: ${eventId}`)
  return `已更新日程: id=${eventId}`
}

registerTool({
  name: 'update_event',
  description: '更新已有日程事件的属性。只需传需要修改的字段。',
  schema: updateEventSchema,
  handler: updateEventHandler,
  meta: { requireApproval: true } // 写操作需审批
})

// ========== delete_event ==========

const deleteEventSchema = z.object({
  eventId: z.string().describe('要删除的日程 ID')
})

async function deleteEventHandler(args, ctx) {
  const { eventId } = args
  ctx.logger.info(`[delete_event] eventId=${eventId}`)

  const { getScheduleEvent, deleteScheduleEvent } = await import('../../../db.js')
  const existing = getScheduleEvent(eventId)
  if (!existing) {
    return `未找到日程: ${eventId}`
  }

  deleteScheduleEvent(eventId)
  ctx.logger.info(`[delete_event] 已删除日程: ${eventId} (${existing.title})`)
  return `已删除日程: id=${eventId}, title="${existing.title}"`
}

registerTool({
  name: 'delete_event',
  description: '删除指定的日程事件。需用户审批后执行。',
  schema: deleteEventSchema,
  handler: deleteEventHandler,
  meta: { requireApproval: true } // 删除操作需审批
})
