/**
 * 内置工具：JSON 处理（json_parse / json_extract / json_format）
 * ============================================================
 * 设计参考：Agent智能体设计.md 2.9 内置工具清单
 *
 * 提供 JSON 解析、值提取、格式化能力，便于处理 requests_get/post 等工具返回的 JSON 响应。
 * 全部为纯字符串处理，无副作用，无需审批。
 *
 * - json_parse: 解析 JSON 字符串并返回验证结果与顶层结构概览
 * - json_extract: 按点路径（a.b.c）或 JSONPath 简化语法提取值
 * - json_format: 美化/压缩 JSON 字符串
 */

import { z } from 'zod'
import { registerTool } from '../registry.js'

// 输出最大长度（避免大对象撑爆上下文）
const MAX_OUTPUT = 16 * 1024

/**
 * 安全截断输出
 */
function truncate(str) {
  if (str.length > MAX_OUTPUT) {
    return str.slice(0, MAX_OUTPUT) + `\n... (输出已截断，共 ${str.length} 字符)`
  }
  return str
}

/**
 * 沿路径在对象中取值
 * 支持：
 *   - 点路径：a.b.c
 *   - 数组下标：a[0].b、a.b[2]
 *   - 通配符：a[*].b（返回数组）
 *   - 顶层 $ 可省略
 * @param {any} obj 解析后的对象
 * @param {string} expr 路径表达式
 * @returns {{ value: any, ok: boolean, reason?: string }}
 */
function extractByPath(obj, expr) {
  if (!expr || expr === '$') return { value: obj, ok: true }

  // 规范化：去掉开头的 $.
  let p = expr.trim()
  if (p.startsWith('$.')) p = p.slice(2)
  else if (p.startsWith('$')) p = p.slice(1)

  // 解析 tokens：a.b[0].c → ['a', 'b', 0, 'c']
  const tokens = []
  let i = 0
  while (i < p.length) {
    const ch = p[i]
    if (ch === '.') {
      i++
      continue
    }
    if (ch === '[') {
      const end = p.indexOf(']', i)
      if (end === -1) return { value: undefined, ok: false, reason: `括号未闭合: ${p.slice(i)}` }
      const inner = p.slice(i + 1, end).trim()
      if (inner === '*') {
        tokens.push({ type: 'wildcard' })
      } else if (/^-?\d+$/.test(inner)) {
        tokens.push({ type: 'index', value: parseInt(inner, 10) })
      } else {
        // 字符串 key，如 ['foo bar']
        tokens.push({ type: 'key', value: inner.replace(/^['"]|['"]$/g, '') })
      }
      i = end + 1
    } else {
      // 普通键名（直到 . 或 [）
      let j = i
      while (j < p.length && p[j] !== '.' && p[j] !== '[') j++
      tokens.push({ type: 'key', value: p.slice(i, j) })
      i = j
    }
  }

  let current = obj
  for (const tok of tokens) {
    if (tok.type === 'wildcard') {
      if (!Array.isArray(current)) {
        return { value: undefined, ok: false, reason: `通配符 [*] 仅可用于数组，实际类型: ${typeof current}` }
      }
      // 后续必须还有 token；把后续路径应用到每个元素，合并结果
      const remaining = tokens.slice(tokens.indexOf(tok) + 1)
      if (remaining.length === 0) {
        return { value: current, ok: true }
      }
      // 重建剩余表达式递归处理
      const remainingExpr = remaining
        .map(t => {
          if (t.type === 'key') return t.value
          if (t.type === 'index') return `[${t.value}]`
          return '[*]'
        })
        .join('.')
      const results = []
      for (const item of current) {
        const r = extractByPath(item, remainingExpr)
        if (r.ok && r.value !== undefined) results.push(r.value)
      }
      return { value: results, ok: true }
    }
    if (tok.type === 'index') {
      if (!Array.isArray(current)) {
        return { value: undefined, ok: false, reason: `下标 [${tok.value}] 仅可用于数组，实际类型: ${typeof current}` }
      }
      const idx = tok.value < 0 ? current.length + tok.value : tok.value
      if (idx < 0 || idx >= current.length) {
        return { value: undefined, ok: false, reason: `下标越界: [${tok.value}]（数组长度 ${current.length}）` }
      }
      current = current[idx]
    } else if (tok.type === 'key') {
      if (current === null || typeof current !== 'object') {
        return { value: undefined, ok: false, reason: `无法在 ${current === null ? 'null' : typeof current} 上访问属性 "${tok.value}"` }
      }
      if (!(tok.value in current)) {
        return { value: undefined, ok: false, reason: `属性不存在: "${tok.value}"` }
      }
      current = current[tok.value]
    }
  }

  return { value: current, ok: true }
}

// ========== json_parse ==========

const parseSchema = z.object({
  jsonStr: z.string().describe('待解析的 JSON 字符串')
})

async function parseHandler(args, ctx) {
  const { jsonStr } = args
  ctx.logger.info(`[json_parse] inputLen=${jsonStr.length}`)

  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    ctx.logger.warn(`[json_parse] 解析失败: ${e.message}`)
    return `JSON 解析失败: ${e.message}\n\n原始字符串（前 200 字符）：\n${jsonStr.slice(0, 200)}`
  }

  // 结构概览
  const type = Array.isArray(parsed) ? 'array' : parsed === null ? 'null' : typeof parsed
  let summary = ''
  if (type === 'array') {
    summary = `类型：数组，长度 ${parsed.length}`
    if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
      summary += `，元素键：${Object.keys(parsed[0]).join(', ')}`
    }
  } else if (type === 'object') {
    summary = `类型：对象，键数量 ${Object.keys(parsed).length}，键：${Object.keys(parsed).join(', ')}`
  } else {
    summary = `类型：${type}，值：${String(parsed)}`
  }

  ctx.logger.info(`[json_parse] 解析成功, type=${type}`)
  return truncate(`JSON 解析成功。\n${summary}\n\n解析后内容：\n${JSON.stringify(parsed, null, 2)}`)
}

registerTool({
  name: 'json_parse',
  description:
    '解析 JSON 字符串并返回结构概览（类型、键名、长度）。' +
    '用于验证一段字符串是否为合法 JSON，或查看 JSON 顶层结构。',
  schema: parseSchema,
  handler: parseHandler,
  meta: { requireApproval: false }
})

// ========== json_extract ==========

const extractSchema = z.object({
  jsonStr: z.string().describe('JSON 字符串'),
  path: z
    .string()
    .describe(
      '提取路径，支持点语法 a.b.c、数组下标 a[0].b、通配符 a[*].b。' +
      '可省略前导 $.。例如 "data.users[0].name"'
    )
})

async function extractHandler(args, ctx) {
  const { jsonStr, path } = args
  ctx.logger.info(`[json_extract] path="${path}"`)

  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    return `JSON 解析失败: ${e.message}`
  }

  const result = extractByPath(parsed, path)
  if (!result.ok) {
    ctx.logger.warn(`[json_extract] 提取失败: ${result.reason}`)
    return `提取失败: ${result.reason}`
  }

  ctx.logger.info(`[json_extract] 提取成功`)
  const valueStr =
    typeof result.value === 'string'
      ? result.value
      : JSON.stringify(result.value, null, 2)
  return truncate(`路径 "${path}" 的值：\n${valueStr}`)
}

registerTool({
  name: 'json_extract',
  description:
    '从 JSON 字符串中按路径提取值。支持点语法（a.b.c）、数组下标（a[0].b）和通配符（a[*].b）。' +
    '适用于从 API 响应中快速取出需要的字段。',
  schema: extractSchema,
  handler: extractHandler,
  meta: { requireApproval: false }
})

// ========== json_format ==========

const formatSchema = z.object({
  jsonStr: z.string().describe('JSON 字符串'),
  indent: z
    .number()
    .optional()
    .describe('缩进空格数（默认 2）。传 0 表示压缩为单行')
})

async function formatHandler(args, ctx) {
  const { jsonStr, indent = 2 } = args
  ctx.logger.info(`[json_format] indent=${indent}, inputLen=${jsonStr.length}`)

  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    return `JSON 解析失败: ${e.message}`
  }

  const formatted =
    indent === 0 ? JSON.stringify(parsed) : JSON.stringify(parsed, null, indent)
  ctx.logger.info(`[json_format] 完成, outputLen=${formatted.length}`)
  return truncate(formatted)
}

registerTool({
  name: 'json_format',
  description:
    '格式化 JSON 字符串。可美化（默认缩进 2 空格）或压缩（indent=0 时为单行）。' +
    '适用于把紧凑 JSON 转为可读形式，或反之减小体积。',
  schema: formatSchema,
  handler: formatHandler,
  meta: { requireApproval: false }
})
