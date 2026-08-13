/**
 * Local DeepAgent automation scheduler.
 *
 * LangGraph deployments expose `client.crons.create(...)`; this Electron app has
 * no deployment service, so tasks and run records are persisted locally and a
 * minute scheduler invokes the existing DeepAgent factory directly.
 */

import { createLogger } from './agent/logger.js'
import { createAgentWithContext } from './agent/index.js'
import { getDataDir, loadConfig } from './config.js'
import { CHAT_CHUNK, CHAT_DONE, CHAT_ERROR } from './events.js'
import * as db from './db.js'

const log = createLogger('Automation')
const WEEKDAY_TO_CRON = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
const activeTaskIds = new Set()
const activeRuns = new Map()
let timer = null
let alignmentTimer = null
let mainWindow = null

function parseTime(time) {
  const [hours = '0', minutes = '0'] = String(time || '00:00').split(':')
  return { hour: Math.min(23, Math.max(0, Number(hours) || 0)), minute: Math.min(59, Math.max(0, Number(minutes) || 0)) }
}

export function buildCronExpression(triggerType, triggerConfig = {}) {
  const { hour, minute } = parseTime(triggerConfig.time)
  if (triggerType === 'daily') return `${minute} ${hour} * * *`
  if (triggerType === 'weekly') {
    const days = (triggerConfig.weekdays || []).map(day => WEEKDAY_TO_CRON[day]).filter(Number.isInteger)
    return `${minute} ${hour} * * ${days.length ? days.join(',') : '*'}`
  }
  if (triggerType === 'monthly') return `${minute} ${hour} ${Math.min(31, Math.max(1, Number(triggerConfig.day) || 1))} * *`
  return null
}

export function getNextRunAt(task, from = new Date()) {
  const config = task.triggerConfig || {}
  if (task.triggerType === 'once') {
    const scheduled = new Date(config.dateTime)
    return Number.isNaN(scheduled.getTime()) || scheduled <= from ? null : scheduled.toISOString()
  }
  if (task.triggerType === 'interval') {
    const unitMs = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 }[config.unit] || 3_600_000
    const intervalMs = Math.max(1, Number(config.value) || 1) * unitMs
    const previous = task.lastRunAt ? new Date(task.lastRunAt).getTime() : null
    const next = previous && previous > from.getTime() - intervalMs ? previous + intervalMs : from.getTime() + intervalMs
    return new Date(next).toISOString()
  }
  const { hour, minute } = parseTime(config.time)
  const cursor = new Date(from)
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)
  for (let i = 0; i < 366 * 24 * 60; i += 1) {
    const dayOfWeek = cursor.getDay()
    const dayOfMonth = cursor.getDate()
    const weeklyMatch = task.triggerType !== 'weekly' || (config.weekdays || []).some(day => WEEKDAY_TO_CRON[day] === dayOfWeek)
    const monthlyMatch = task.triggerType !== 'monthly' || dayOfMonth === Math.min(31, Math.max(1, Number(config.day) || 1))
    if (cursor.getHours() === hour && cursor.getMinutes() === minute && weeklyMatch && monthlyMatch) return cursor.toISOString()
    cursor.setMinutes(cursor.getMinutes() + 1)
  }
  return null
}

function modelForTask(task) {
  const config = loadConfig()
  const models = config.customModels || []
  return models.find(model => model.id === task.modelId) || models.find(model => model.id === config.selectedModelId) || models[0] || null
}

function emitUpdated() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('automation-updated')
}

function emitStream(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

export function getActiveAutomationRun(runId) {
  const activeRun = activeRuns.get(runId)
  if (!activeRun) return null
  return {
    requestId: activeRun.requestId,
    sessionId: activeRun.sessionId,
    output: activeRun.output,
    segments: activeRun.segments
  }
}

async function runAgent(task, trigger) {
  if (activeTaskIds.has(task.id)) return null
  const model = modelForTask(task)
  const session = db.createSession(task.name, 'agent')
  const instruction = `执行自动化任务（${trigger === 'manual' ? '手动触发' : '定时触发'}）：${task.instruction}`
  db.saveMessage(session.id, 'user', instruction)
  db.updateSessionTimestamp(session.id)
  if (!model?.apiKey || !model?.baseUrl || !model?.modelName) {
    const run = db.createAutomationRun({ taskId: task.id, taskName: task.name, sessionId: session.id, trigger })
    const error = '未配置任务所需的大模型，请在设置中重新选择模型。'
    db.saveMessage(session.id, 'assistant', error)
    db.completeAutomationRun(run.id, { status: 'failed', error })
    emitUpdated()
    return run
  }

  activeTaskIds.add(task.id)
  const run = db.createAutomationRun({ taskId: task.id, taskName: task.name, sessionId: session.id, trigger })
  const requestId = `automation_${run.id}`
  const activeRun = { requestId, sessionId: session.id, output: '', segments: [] }
  activeRuns.set(run.id, activeRun)
  emitUpdated()
  try {
    const segments = activeRun.segments
    let currentTextSegment = null
    const appendText = (content) => {
      if (!content) return
      if (!currentTextSegment) {
        currentTextSegment = { type: 'text', content }
        segments.push(currentTextSegment)
      } else {
        currentTextSegment.content += content
      }
      activeRun.output += content
      emitStream(CHAT_CHUNK, { requestId, sessionId: session.id, content })
    }
    const completeTool = (payload) => {
      const toolSegment = [...segments].reverse().find(segment => segment.type === 'tool' && segment.toolCallId === payload.toolCallId)
      if (toolSegment) {
        toolSegment.status = payload.status === 'error' ? 'error' : 'success'
        toolSegment.output = payload.output || ''
      }
    }
    const { agent } = await createAgentWithContext({ ...model, enableThinking: false }, {
      mainWindow,
      requestId,
      threadId: session.id,
      dataDir: getDataDir(),
      folderPath: '',
      unattended: true,
      emit: (event, payload) => {
        if (event === 'agent-tool-call') {
          currentTextSegment = null
          segments.push({
            type: 'tool',
            toolCallId: payload.toolCallId,
            toolName: payload.toolName,
            arguments: payload.arguments,
            status: 'running',
            output: '',
            requireApproval: false
          })
          emitStream('agent-tool-call', payload)
        } else if (event === 'agent-tool-result') {
          completeTool(payload)
          emitStream('agent-tool-result', payload)
        }
      }
    })
    const stream = await agent.streamEvents({
      messages: [{
        role: 'user',
        content: `你正在执行用户已授权的无人值守本地自动化任务。严格只执行以下任务指令范围内的操作，不要扩展目标或暴露用户数据。\n\n任务名称：${task.name}\n任务指令：${task.instruction}\n\n完成后给出简洁的执行结果。`
      }]
    }, { version: 'v2', configurable: { thread_id: session.id } })
    for await (const event of stream) {
      if (event.event === 'on_chat_model_stream') {
        const content = event.data?.chunk?.content
        const text = typeof content === 'string'
          ? content
          : Array.isArray(content) ? content.map(item => typeof item === 'string' ? item : (item?.text || '')).join('') : ''
        appendText(text)
      }
    }
    const assistantMessage = db.saveMessage(session.id, 'assistant', activeRun.output, segments.length ? { segments } : null)
    db.updateSessionTimestamp(session.id)
    db.completeAutomationRun(run.id, { status: 'success', output: activeRun.output })
    emitStream(CHAT_DONE, {
      requestId,
      sessionId: session.id,
      fullContent: activeRun.output,
      reasoningContent: '',
      messageId: assistantMessage.id
    })
  } catch (error) {
    log.error(`Automation task failed: ${task.id}: ${error.message}`)
    const errorMessage = error.message || String(error)
    const assistantMessage = db.saveMessage(session.id, 'assistant', errorMessage)
    db.updateSessionTimestamp(session.id)
    db.completeAutomationRun(run.id, { status: 'failed', error: errorMessage })
    emitStream(CHAT_ERROR, { requestId, sessionId: session.id, error: errorMessage })
    // Keep a completed failure readable from the shared Friday session.
    emitStream(CHAT_DONE, { requestId, sessionId: session.id, fullContent: errorMessage, reasoningContent: '', messageId: assistantMessage.id })
  } finally {
    activeTaskIds.delete(task.id)
    activeRuns.delete(run.id)
    const current = db.getAutomationTask(task.id)
    if (current) {
      const lastRunAt = new Date().toISOString()
      const completedOneTimeTask = current.triggerType === 'once' && trigger === 'schedule'
      const nextRunAt = completedOneTimeTask
        ? null
        : current.triggerType === 'once'
          ? current.nextRunAt
          : getNextRunAt({ ...current, lastRunAt }, new Date())
      db.updateAutomationTask(task.id, {
        lastRunAt,
        nextRunAt,
        enabled: completedOneTimeTask ? false : current.enabled
      })
    }
    emitUpdated()
  }
  return run
}

async function tick() {
  const now = new Date()
  const tasks = db.getAutomationTasks().filter(task => task.enabled && task.nextRunAt && new Date(task.nextRunAt) <= now)
  for (const task of tasks) {
    // Claim the due occurrence before starting asynchronous work. This makes each
    // 15-second scheduler check resilient to edits made near a minute boundary.
    const nextRunAt = task.triggerType === 'once'
      ? null
      : getNextRunAt({ ...task, lastRunAt: now.toISOString() }, now)
    db.updateAutomationTask(task.id, {
      nextRunAt,
      enabled: task.triggerType === 'once' ? false : task.enabled
    })
    runAgent(task, 'schedule')
  }
}

export function startAutomationScheduler(window) {
  mainWindow = window
  if (timer || alignmentTimer) return
  tick().catch(error => log.error(`Scheduler startup tick failed: ${error.message}`))
  const millisecondsToNextQuarter = 15_000 - (Date.now() % 15_000)
  alignmentTimer = setTimeout(() => {
    alignmentTimer = null
    tick().catch(error => log.error(`Scheduler tick failed: ${error.message}`))
    timer = setInterval(() => tick().catch(error => log.error(`Scheduler tick failed: ${error.message}`)), 15_000)
  }, millisecondsToNextQuarter)
  log.info('Local automation scheduler started')
}

export function stopAutomationScheduler() {
  if (timer) clearInterval(timer)
  if (alignmentTimer) clearTimeout(alignmentTimer)
  timer = null
  alignmentTimer = null
  mainWindow = null
}

export function createAutomationTask(args) {
  const triggerConfig = args.triggerConfig || {}
  const task = db.createAutomationTask({
    ...args,
    triggerConfig,
    cronExpression: buildCronExpression(args.triggerType, triggerConfig)
  })
  const nextRunAt = getNextRunAt(task)
  const saved = db.updateAutomationTask(task.id, { nextRunAt })
  emitUpdated()
  return saved
}

export function updateAutomationTask(taskId, args) {
  const existing = db.getAutomationTask(taskId)
  if (!existing) return null
  const merged = { ...existing, ...args, triggerConfig: args.triggerConfig || existing.triggerConfig }
  const cronExpression = buildCronExpression(merged.triggerType, merged.triggerConfig)
  const nextRunAt = merged.enabled === false ? null : getNextRunAt(merged)
  const saved = db.updateAutomationTask(taskId, { ...args, cronExpression, nextRunAt })
  emitUpdated()
  return saved
}

export async function runAutomationTaskNow(taskId) {
  const task = db.getAutomationTask(taskId)
  if (!task) throw new Error('自动化任务不存在')
  return runAgent(task, 'manual')
}
