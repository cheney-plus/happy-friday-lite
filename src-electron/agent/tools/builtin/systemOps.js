/**
 * 内置工具：系统信息（get_current_time）
 * =================================================
 * 设计参考：Agent智能体设计.md 2.9 内置工具清单
 *
 * 提供 Agent 获取当前系统时间的能力，便于日程创建/时间相关推理。
 * 只读，无需审批。
 */

import { z } from 'zod'
import { registerTool } from '../registry.js'

// ========== get_current_time ==========

const getCurrentTimeSchema = z.object({}).describe('无需参数，返回当前系统时间')

async function getCurrentTimeHandler(_args, ctx) {
  const now = new Date()

  // 各格式化字段
  const iso = now.toISOString()
  // toLocaleString 默认时区为系统时区
  const local = now.toLocaleString('zh-CN', { hour12: false })
  const date = now.toISOString().slice(0, 10) // YYYY-MM-DD
  const time = now.toTimeString().slice(0, 5) // HH:mm（本地时区）
  const weekday = now.toLocaleString('zh-CN', { weekday: 'long' })

  // 时区信息（如 Asia/Shanghai）
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  ctx.logger.info(`[get_current_time] ${iso} (${tz})`)

  return [
    `当前系统时间：${local} ${weekday}`,
    `ISO 8601：${iso}`,
    `日期：${date}`,
    `时间：${time}`,
    `时区：${tz}`
  ].join('\n')
}

registerTool({
  name: 'get_current_time',
  description:
    '获取当前系统时间。返回本地时间、ISO 8601 时间、日期、时间和时区信息。在创建日程或需要时间推理时使用。',
  schema: getCurrentTimeSchema,
  handler: getCurrentTimeHandler,
  meta: { requireApproval: false }
})
