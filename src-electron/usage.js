/**
 * 大模型 Token 用量统计
 * ===================
 * 记录每次 LLM 调用的 token 消耗，并提供按时间范围、按模型的聚合统计。
 *
 * 存储：数据目录下的 usage.json，结构为 { records: UsageRecord[] }
 *   - 为避免无限增长，最多保留最近 20000 条记录
 *
 * 数据来源：llm.js 在 streamChat / streamRound / streamNoteAI 完成后调用 recordUsage
 */

import fs from 'fs'
import path from 'path'
import { getDataDir } from './config.js'
import { AppError } from './error.js'

const MAX_RECORDS = 20000

function getUsagePath() {
  const dir = getDataDir()
  if (!dir) {
    throw AppError.config('Data directory not initialized')
  }
  return path.join(dir, 'usage.json')
}

function loadStore() {
  const file = getUsagePath()
  if (!fs.existsSync(file)) {
    return { records: [] }
  }
  try {
    const content = fs.readFileSync(file, 'utf-8')
    const parsed = JSON.parse(content)
    if (!parsed || !Array.isArray(parsed.records)) {
      return { records: [] }
    }
    return parsed
  } catch (e) {
    console.error('[Usage] Failed to load usage store, resetting:', e.message)
    return { records: [] }
  }
}

function saveStore(store) {
  const file = getUsagePath()
  try {
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(file, JSON.stringify(store, null, 2), 'utf-8')
  } catch (e) {
    console.error('[Usage] Failed to save usage store:', e.message)
  }
}

/**
 * 记录一次 LLM 调用的 token 用量
 * @param {Object} record
 *   - modelId: 模型 ID（自定义模型的 id 字段）
 *   - modelName: 模型名称（如 deepseek-chat）
 *   - provider: 厂商标识（qwen / deepseek / ...）
 *   - providerLabel: 厂商显示名（如 DeepSeek）
 *   - promptTokens: 输入 token 数
 *   - completionTokens: 输出 token 数
 *   - totalTokens: 总 token 数
 *   - reasoningTokens: 思考 token 数（可选）
 *   - source: 调用来源（chat / note_ai / agent / rag / title / fim）
 */
export function recordUsage(record) {
  if (!record) return
  const promptTokens = Number(record.promptTokens) || 0
  const completionTokens = Number(record.completionTokens) || 0
  const totalTokens = Number(record.totalTokens) || (promptTokens + completionTokens)

  // 全为 0 的记录无意义，跳过
  if (totalTokens <= 0 && !record.modelName) return

  const store = loadStore()
  store.records.push({
    id: `usage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    modelId: record.modelId || '',
    modelName: record.modelName || '',
    provider: record.provider || '',
    providerLabel: record.providerLabel || '',
    promptTokens,
    completionTokens,
    totalTokens,
    reasoningTokens: Number(record.reasoningTokens) || 0,
    source: record.source || 'chat'
  })

  // 容量限制：保留最近 MAX_RECORDS 条
  if (store.records.length > MAX_RECORDS) {
    store.records = store.records.slice(-MAX_RECORDS)
  }

  saveStore(store)
}

function getRangeStart(range) {
  const now = Date.now()
  switch (range) {
    case 'today': {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }
    case '7d':
      return now - 7 * 24 * 60 * 60 * 1000
    case '30d':
      return now - 30 * 24 * 60 * 60 * 1000
    case 'all':
    default:
      return 0
  }
}

/**
 * 获取用量统计
 * @param {string} range - today | 7d | 30d | all
 * @returns {Object} 聚合统计结果
 */
export function getUsageStats(range = 'all') {
  const store = loadStore()
  const startTs = getRangeStart(range)
  const records = store.records.filter(r => r.ts >= startTs)

  let totalPrompt = 0
  let totalCompletion = 0
  let totalTokens = 0
  let totalReasoning = 0
  let totalRequests = records.length

  // 按模型聚合
  const modelMap = new Map()
  // 按日期聚合（YYYY-MM-DD）
  const dayMap = new Map()
  // 按来源聚合：预初始化所有已知来源（含 title 归并到 chat），即使为 0 也显示
  const sourceMap = new Map([
    ['chat', { source: 'chat', promptTokens: 0, completionTokens: 0, totalTokens: 0, requests: 0 }],
    ['agent', { source: 'agent', promptTokens: 0, completionTokens: 0, totalTokens: 0, requests: 0 }],
    ['rag', { source: 'rag', promptTokens: 0, completionTokens: 0, totalTokens: 0, requests: 0 }],
    ['note_ai', { source: 'note_ai', promptTokens: 0, completionTokens: 0, totalTokens: 0, requests: 0 }],
    ['fim', { source: 'fim', promptTokens: 0, completionTokens: 0, totalTokens: 0, requests: 0 }]
  ])

  for (const r of records) {
    totalPrompt += r.promptTokens
    totalCompletion += r.completionTokens
    totalTokens += r.totalTokens
    totalReasoning += r.reasoningTokens || 0

    // 模型聚合 key：provider + modelName（同一模型多次配置也算同一）
    const modelKey = `${r.providerLabel || r.provider || '未知'}|${r.modelName || '未知'}`
    if (!modelMap.has(modelKey)) {
      modelMap.set(modelKey, {
        provider: r.provider,
        providerLabel: r.providerLabel || r.provider || '未知',
        modelName: r.modelName || '未知',
        modelId: r.modelId || '',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        reasoningTokens: 0,
        requests: 0
      })
    }
    const m = modelMap.get(modelKey)
    m.promptTokens += r.promptTokens
    m.completionTokens += r.completionTokens
    m.totalTokens += r.totalTokens
    m.reasoningTokens += r.reasoningTokens || 0
    m.requests += 1

    // 日期聚合
    const day = new Date(r.ts)
    const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { date: dayKey, promptTokens: 0, completionTokens: 0, totalTokens: 0, requests: 0 })
    }
    const d = dayMap.get(dayKey)
    d.promptTokens += r.promptTokens
    d.completionTokens += r.completionTokens
    d.totalTokens += r.totalTokens
    d.requests += 1

    // 来源聚合：标题生成(title)归并到对话(chat)
    const src = r.source === 'title' ? 'chat' : (r.source || 'chat')
    if (!sourceMap.has(src)) {
      sourceMap.set(src, { source: src, promptTokens: 0, completionTokens: 0, totalTokens: 0, requests: 0 })
    }
    const s = sourceMap.get(src)
    s.promptTokens += r.promptTokens
    s.completionTokens += r.completionTokens
    s.totalTokens += r.totalTokens
    s.requests += 1
  }

  const byModel = Array.from(modelMap.values()).sort((a, b) => b.totalTokens - a.totalTokens)
  const byDay = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  const bySource = Array.from(sourceMap.values()).sort((a, b) => b.totalTokens - a.totalTokens)

  return {
    range,
    summary: {
      totalPrompt,
      totalCompletion,
      totalTokens,
      totalReasoning,
      totalRequests
    },
    byModel,
    byDay,
    bySource
  }
}

/**
 * 清空所有用量记录
 */
export function clearUsage() {
  saveStore({ records: [] })
  return true
}
