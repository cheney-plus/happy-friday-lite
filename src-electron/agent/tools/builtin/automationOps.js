/**
 * 内置工具：自动化任务管理（查询 / 创建 / 更新 / 删除）。
 * 写操作通过 automation.js 保持调度时间与任务配置一致。
 */

import { z } from 'zod/v3'
import { registerTool } from '../registry.js'

const triggerType = z
  .enum(['daily', 'weekly', 'monthly', 'interval', 'once'])
  .describe('触发类型：daily 每天 / weekly 每周 / monthly 每月 / interval 间隔 / once 一次性')

const triggerConfig = z.object({
  time: z.string().optional().describe('每天、每周、每月任务的触发时间，格式 HH:mm'),
  weekdays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional().describe('每周任务的执行星期'),
  day: z.number().int().min(1).max(31).optional().describe('每月任务的执行日期（1 至 31）'),
  value: z.number().int().positive().optional().describe('间隔任务的数量'),
  unit: z.enum(['minutes', 'hours', 'days']).optional().describe('间隔任务的单位'),
  dateTime: z.string().optional().describe('一次性任务的本地日期时间，格式 YYYY-MM-DDTHH:mm')
}).describe('触发配置，字段需与 triggerType 对应')

function formatModelName(task, models = []) {
  if (!task.modelId) return '当前默认模型'
  const model = models.find(item => item.id === task.modelId)
  if (!model) return `已不可用的模型 (${task.modelId})`
  return [model.providerLabel, model.modelName].filter(Boolean).join(' ') || task.modelId
}

function taskSummary(task, models) {
  const schedule = JSON.stringify(task.triggerConfig || {})
  return `【自动化任务 ${task.id}】${task.name}\n  状态: ${task.enabled ? '已启用' : '已停用'}\n  触发: ${task.triggerType} ${schedule}\n  下次执行: ${task.nextRunAt || '无'}\n  模型: ${formatModelName(task, models)}\n  指令: ${task.instruction}`
}

function notifyAutomationUpdated(ctx) {
  if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
    ctx.mainWindow.webContents.send('automation-updated')
  }
}

const listSchema = z.object({
  enabled: z.boolean().optional().describe('可选。只返回启用或停用的任务')
})

async function listHandler(args, ctx) {
  const { getAutomationTasks } = await import('../../../db.js')
  const { loadConfig } = await import('../../../config.js')
  const tasks = getAutomationTasks().filter(task => args.enabled === undefined || task.enabled === args.enabled)
  const models = loadConfig().customModels || []
  ctx.logger.info(`[list_automation_tasks] count=${tasks.length}`)
  return tasks.length ? tasks.map(task => taskSummary(task, models)).join('\n\n') : '当前没有匹配的自动化任务。'
}

registerTool({
  name: 'list_automation_tasks',
  description: '查询本地自动化任务，返回任务 ID、启用状态、触发计划、下次执行时间和任务指令。',
  schema: listSchema,
  handler: listHandler,
  meta: { requireApproval: false, exposedViaMcp: true }
})

const createSchema = z.object({
  name: z.string().min(1).max(80).describe('任务名称'),
  instruction: z.string().min(1).max(2000).describe('任务执行指令'),
  triggerType,
  triggerConfig,
  modelId: z.string().optional().describe('可选。设置中已配置的模型 ID；不传则使用当前默认模型'),
  enabled: z.boolean().optional().describe('是否立即启用，默认 true')
})

async function createHandler(args, ctx) {
  const { enabled = true, ...taskArgs } = args
  const { createAutomationTask, updateAutomationTask } = await import('../../../automation.js')
  const { loadConfig } = await import('../../../config.js')
  const created = createAutomationTask(taskArgs)
  const task = enabled ? created : updateAutomationTask(created.id, { enabled: false })
  ctx.logger.info(`[create_automation_task] id=${task.id}`)
  return `已创建自动化任务。\n${taskSummary(task, loadConfig().customModels || [])}`
}

registerTool({
  name: 'create_automation_task',
  description: '创建本地自动化任务。请根据触发类型传入匹配的触发配置。',
  schema: createSchema,
  handler: createHandler,
  meta: { requireApproval: true, exposedViaMcp: true }
})

const updateSchema = z.object({
  taskId: z.string().describe('要更新的自动化任务 ID'),
  name: z.string().min(1).max(80).optional().describe('新任务名称'),
  instruction: z.string().min(1).max(2000).optional().describe('新任务指令'),
  modelId: z.string().optional().describe('新模型 ID'),
  enabled: z.boolean().optional().describe('启用或停用任务'),
  triggerType: triggerType.optional().describe('新触发类型；更改时应同时提供 triggerConfig'),
  triggerConfig: triggerConfig.optional().describe('新触发配置；更改触发类型时必填')
})

async function updateHandler(args, ctx) {
  const { taskId, ...updates } = args
  const { getAutomationTask } = await import('../../../db.js')
  const { updateAutomationTask } = await import('../../../automation.js')
  const { loadConfig } = await import('../../../config.js')
  if (!getAutomationTask(taskId)) return `未找到自动化任务: ${taskId}`
  const task = updateAutomationTask(taskId, updates)
  if (!task) return `更新自动化任务失败: ${taskId}`
  ctx.logger.info(`[update_automation_task] id=${taskId}`)
  return `已更新自动化任务。\n${taskSummary(task, loadConfig().customModels || [])}`
}

registerTool({
  name: 'update_automation_task',
  description: '更新自动化任务。只需传入要变更的字段；修改触发类型时必须同时传入完整的 triggerConfig。',
  schema: updateSchema,
  handler: updateHandler,
  meta: { requireApproval: true, exposedViaMcp: true }
})

const deleteSchema = z.object({
  taskId: z.string().describe('要删除的自动化任务 ID')
})

async function deleteHandler(args, ctx) {
  const { getAutomationTask, deleteAutomationTask } = await import('../../../db.js')
  const task = getAutomationTask(args.taskId)
  if (!task) return `未找到自动化任务: ${args.taskId}`
  deleteAutomationTask(args.taskId)
  notifyAutomationUpdated(ctx)
  ctx.logger.info(`[delete_automation_task] id=${args.taskId}`)
  return `已删除自动化任务: id=${task.id}, name="${task.name}"`
}

registerTool({
  name: 'delete_automation_task',
  description: '删除指定的自动化任务。此操作不可恢复。',
  schema: deleteSchema,
  handler: deleteHandler,
  meta: { requireApproval: true, exposedViaMcp: true }
})
