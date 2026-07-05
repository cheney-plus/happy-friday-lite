/**
 * 内置工具：HTTP 请求（requests_get / requests_post / requests_put / requests_delete / requests_patch）
 * ====================================================================================================
 * 设计参考：Agent智能体设计.md 2.9 内置工具清单
 *
 * 提供 REST API 调用能力，使用 Node.js 内置 fetch。
 * - GET：只读，无需审批
 * - POST/PUT/DELETE/PATCH：写操作，需人机审批
 *
 * 灵感来源：langchain-community 的 RequestsGetTool / RequestsPostTool 等，
 * 但本项目直接使用 fetch 实现，避免引入额外依赖（axios/requests）。
 */

import { z } from 'zod'
import { registerTool } from '../registry.js'

// 默认 UA：模拟主流浏览器，避免被部分站点拦截
const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
// 默认超时：30 秒
const DEFAULT_TIMEOUT_MS = 30000
// 响应体最大长度：32KB（避免撑爆 LLM 上下文）
const MAX_RESPONSE_BODY = 32 * 1024

/**
 * 通用 HTTP 请求函数
 * @param {Object} opts
 * @param {string} opts.method HTTP 方法
 * @param {string} opts.url URL
 * @param {Object} [opts.headers] 请求头
 * @param {Object} [opts.params] URL query 参数（自动拼接）
 * @param {Object|string} [opts.body] 请求体（JSON 对象自动序列化）
 * @param {number} [opts.timeoutMs] 超时
 * @param {Object} [ctx] 工具上下文（用于日志）
 * @returns {Promise<string>}
 */
async function doRequest({ method, url, headers, params, body, timeoutMs = DEFAULT_TIMEOUT_MS }, ctx) {
  ctx.logger.info(`[requests_${method.toLowerCase()}] url=${url}`)

  // 1. 规范化 URL + query 参数
  let finalUrl = (url || '').trim()
  if (!/^https?:\/\//i.test(finalUrl)) {
    finalUrl = 'https://' + finalUrl
  }
  if (params && typeof params === 'object' && Object.keys(params).length > 0) {
    const u = new URL(finalUrl)
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        u.searchParams.append(k, String(v))
      }
    }
    finalUrl = u.toString()
  }

  // 2. 构造请求头
  const finalHeaders = {
    'User-Agent': DEFAULT_UA,
    Accept: 'application/json, text/plain, */*',
    ...(headers || {})
  }

  // 3. 处理请求体
  let reqBody = undefined
  if (body !== undefined && body !== null && method.toUpperCase() !== 'GET') {
    if (typeof body === 'string') {
      reqBody = body
      // 字符串 body 不自动设置 Content-Type，让调用方通过 headers 指定
    } else if (typeof body === 'object') {
      reqBody = JSON.stringify(body)
      // 仅当调用方未显式设置 Content-Type 时才补默认 JSON 类型
      const headerKeys = Object.keys(finalHeaders).map(k => k.toLowerCase())
      if (!headerKeys.includes('content-type')) {
        finalHeaders['Content-Type'] = 'application/json'
      }
    }
  }

  ctx.logger.info(`[requests_${method.toLowerCase()}] finalUrl=${finalUrl}, hasBody=${!!reqBody}`)

  // 4. 发起请求（带超时控制）
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetch(finalUrl, {
      method: method.toUpperCase(),
      headers: finalHeaders,
      body: reqBody,
      redirect: 'follow',
      signal: controller.signal
    })
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') {
      return `请求超时（${timeoutMs}ms）：${finalUrl}`
    }
    ctx.logger.error(`[requests_${method.toLowerCase()}] 请求失败: ${e.message}`)
    return `请求失败: ${e.message}`
  }
  clearTimeout(timer)

  // 5. 解析响应体
  const contentType = response.headers.get('content-type') || ''
  let respBody = ''
  try {
    if (contentType.includes('application/json')) {
      // JSON 响应：直接读 text，保持原始格式（便于后续 JSON 工具解析）
      respBody = await response.text()
    } else {
      respBody = await response.text()
    }
  } catch (e) {
    respBody = `（响应体读取失败: ${e.message}）`
  }

  // 6. 截断响应体
  const truncated = respBody.length > MAX_RESPONSE_BODY
  if (truncated) {
    respBody = respBody.slice(0, MAX_RESPONSE_BODY) + `\n... (响应已截断，共 ${respBody.length} 字符)`
  }

  // 7. 组装输出
  const statusLine = `HTTP ${response.status} ${response.statusText || ''}`.trim()
  const urlLine = `最终 URL：${response.url || finalUrl}`
  const typeLine = `Content-Type：${contentType || '(未知)'}`

  const output = [
    statusLine,
    urlLine,
    typeLine,
    '',
    '响应体：',
    respBody
  ].join('\n')

  ctx.logger.info(`[requests_${method.toLowerCase()}] 完成, status=${response.status}, bodyLen=${respBody.length}`)
  return output
}

// ========== requests_get ==========

const getSchema = z.object({
  url: z.string().describe('请求 URL（http/https，可省略协议前缀）'),
  params: z
    .record(z.string())
    .optional()
    .describe('URL query 参数（键值对，会自动拼接到 URL）'),
  headers: z
    .record(z.string())
    .optional()
    .describe('自定义请求头（键值对）'),
  timeoutMs: z.number().optional().describe('超时（毫秒），默认 30000')
})

async function getHandler(args, ctx) {
  return doRequest({ method: 'GET', ...args }, ctx)
}

registerTool({
  name: 'requests_get',
  description:
    '发送 HTTP GET 请求获取数据。支持自定义请求头和 query 参数。' +
    '适用于调用 REST API、获取网页/JSON 数据等只读场景。',
  schema: getSchema,
  handler: getHandler,
  meta: { requireApproval: false }
})

// ========== requests_post ==========

const postSchema = z.object({
  url: z.string().describe('请求 URL'),
  body: z
    .any()
    .optional()
    .describe('请求体（对象会自动序列化为 JSON；字符串原样发送）'),
  params: z.record(z.string()).optional().describe('URL query 参数'),
  headers: z.record(z.string()).optional().describe('自定义请求头'),
  timeoutMs: z.number().optional().describe('超时（毫秒），默认 30000')
})

async function postHandler(args, ctx) {
  return doRequest({ method: 'POST', ...args }, ctx)
}

registerTool({
  name: 'requests_post',
  description:
    '发送 HTTP POST 请求创建资源或提交数据。' +
    '请求体为对象时会自动以 JSON 形式发送，也可传字符串发送表单/原始数据。需用户审批。',
  schema: postSchema,
  handler: postHandler,
  meta: { requireApproval: true }
})

// ========== requests_put ==========

const putSchema = postSchema

async function putHandler(args, ctx) {
  return doRequest({ method: 'PUT', ...args }, ctx)
}

registerTool({
  name: 'requests_put',
  description:
    '发送 HTTP PUT 请求更新整个资源。请求体规则同 requests_post。需用户审批。',
  schema: putSchema,
  handler: putHandler,
  meta: { requireApproval: true }
})

// ========== requests_patch ==========

const patchSchema = postSchema

async function patchHandler(args, ctx) {
  return doRequest({ method: 'PATCH', ...args }, ctx)
}

registerTool({
  name: 'requests_patch',
  description:
    '发送 HTTP PATCH 请求对资源进行部分更新。请求体规则同 requests_post。需用户审批。',
  schema: patchSchema,
  handler: patchHandler,
  meta: { requireApproval: true }
})

// ========== requests_delete ==========

const deleteSchema = z.object({
  url: z.string().describe('请求 URL'),
  params: z.record(z.string()).optional().describe('URL query 参数'),
  headers: z.record(z.string()).optional().describe('自定义请求头'),
  timeoutMs: z.number().optional().describe('超时（毫秒），默认 30000')
})

async function deleteHandler(args, ctx) {
  return doRequest({ method: 'DELETE', ...args }, ctx)
}

registerTool({
  name: 'requests_delete',
  description: '发送 HTTP DELETE 请求删除资源。需用户审批后执行。',
  schema: deleteSchema,
  handler: deleteHandler,
  meta: { requireApproval: true }
})
