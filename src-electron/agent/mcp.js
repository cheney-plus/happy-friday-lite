/**
 * MCP（Model Context Protocol）支持
 * =================================
 *
 * 两部分能力：
 *
 * 1. MCP 客户端：添加 / 删除 / 刷新 / 展示外部 MCP 服务器
 *    - remote：streamable_http / sse
 *    - stdio：本地子进程
 *    连接后调用 listTools() 抓取该服务器暴露的工具列表，落盘到 mcp_servers.json。
 *
 * 2. 本机 MCP 服务：把 src-electron/agent/tools/builtin 下的所有内置工具，
 *    以 streamable_http MCP server 形式暴露给本地其他应用调用。
 *    采用「主进程内 http server」（绑定 127.0.0.1），复用已初始化的 db / python /
 *    工具注册表，避免 stdio 子进程在生产环境无法读取 app.asar 的问题。
 *
 * 设计参考：https://docs.langchain.com/oss/javascript/langchain/mcp
 *           与 @modelcontextprotocol/sdk 官方 stateless streamable http 示例。
 *
 * 存储：{dataDir}/mcp_servers.json  形如 { servers: [{ name, type, config, tools, status, error }] }
 * 本机服务端口/开关：持久化到 config.json 的 mcp.localPort / mcp.localEnabled
 */

import fs from 'fs'
import path from 'path'
import http from 'http'
import { randomBytes } from 'crypto'
import { createLogger } from './logger.js'
import { getDataDir, loadConfig, saveConfig } from '../config.js'
import { getAgentRootDir } from './backend.js'
import { listRegisteredTools } from './tools/registry.js'
// 触发 builtin 工具注册副作用（registerTool），确保 listRegisteredTools() 返回全部内置工具
import './tools/index.js'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { tool } from '@langchain/core/tools'
import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'

const log = createLogger('MCP')

const SERVER_NAME = 'happy-friday'
const SERVER_VERSION = '1.7.0'
const LOCAL_PORT_PREFERRED = 17891
const CONNECT_TIMEOUT_MS = 20000 // 连接 + listTools 超时

// ============================================================
// 存储：mcp_servers.json 读写
// ============================================================

function getMcpConfigPath() {
  return path.join(getDataDir(), 'mcp_servers.json')
}

function readStore() {
  try {
    const raw = fs.readFileSync(getMcpConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.servers)) return parsed
  } catch (_e) {
    /* 文件不存在或损坏，返回空存储 */
  }
  return { servers: [] }
}

function writeStore(store) {
  try {
    fs.writeFileSync(getMcpConfigPath(), JSON.stringify(store, null, 2), 'utf-8')
  } catch (e) {
    log.warn(`写入 MCP 配置失败: ${e.message}`)
  }
}

export function listMcpServers() {
  return readStore().servers
}

// ============================================================
// 类型探测 / 配置归一化
// ============================================================

/**
 * 根据用户粘贴的 Claude-Desktop 风格配置探测传输类型
 * @param {Object} cfg mcpServers[name] 的内容
 * @returns {'streamable_http' | 'sse' | 'stdio' | null}
 */
function detectType(cfg) {
  if (!cfg || typeof cfg !== 'object') return null
  if (cfg.url) {
    const t = (cfg.type || '').toLowerCase()
    if (t === 'sse') return 'sse'
    return 'streamable_http'
  }
  if (cfg.command) return 'stdio'
  return null
}

/** 归一化存储配置：仅保留对应类型需要的字段 */
function normalizeConfig(type, cfg) {
  if (type === 'stdio') {
    return { command: cfg.command, args: cfg.args || [], env: cfg.env || undefined }
  }
  return { type: cfg.type, url: cfg.url, headers: cfg.headers || undefined }
}

// ============================================================
// MCP 客户端：连接外部服务器并抓取工具列表
// ============================================================

function buildTransport(entry) {
  const { type, config } = entry
  if (type === 'stdio') {
    // SDK 会把 env 与 getDefaultEnvironment()（含 PATH 等）合并，故只需传用户 env
    return new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: config.env
    })
  }
  const headers = config.headers || undefined
  if (type === 'sse') {
    return new SSEClientTransport(config.url, {
      requestInit: headers ? { headers } : undefined,
      eventSourceInit: headers ? { headers } : undefined
    })
  }
  // streamable_http
  return new StreamableHTTPClientTransport(config.url, {
    requestInit: headers ? { headers } : undefined
  })
}

/**
 * 连接一个 MCP 服务器并抓取其工具列表
 * @param {{ type: string, config: Object }} entry
 * @returns {Promise<{ tools: Array<{name,description}> }>}
 */
async function connectAndListTools(entry) {
  const transport = buildTransport(entry)
  const client = new Client({ name: SERVER_NAME, version: SERVER_VERSION })
  try {
    await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, 'connect')
    const result = await withTimeout(client.listTools(), CONNECT_TIMEOUT_MS, 'listTools')
    const tools = (result?.tools || []).map(t => ({
      name: t.name,
      description: t.description || ''
    }))
    return { tools }
  } finally {
    try {
      await client.close()
    } catch (_e) {
      /* 关闭失败忽略：close() 内部已对 stdio 子进程做 SIGTERM→SIGKILL 兜底 */
    }
  }
}

/**
 * 添加 MCP 服务器（支持一次粘贴多个）
 * @param {string} jsonString Claude-Desktop 风格 JSON
 * @returns {Promise<{ success: boolean, added: Array, errors: Array }>}
 */
export async function addMcpServers(jsonString) {
  let parsed
  try {
    parsed = JSON.parse(jsonString)
  } catch (_e) {
    return { success: false, error: 'invalidJson' }
  }
  const mcpServers = parsed?.mcpServers
  if (!mcpServers || typeof mcpServers !== 'object') {
    return { success: false, error: 'noServers' }
  }

  const store = readStore()
  const existing = new Set(store.servers.map(s => s.name))
  const added = []
  const errors = []

  for (const [name, cfg] of Object.entries(mcpServers)) {
    if (existing.has(name)) {
      errors.push({ name, error: 'duplicate' })
      continue
    }
    const type = detectType(cfg)
    if (!type) {
      errors.push({ name, error: 'invalidConfig' })
      continue
    }
    const entry = {
      name,
      type,
      config: normalizeConfig(type, cfg),
      tools: [],
      status: 'loading'
    }
    // 尝试连接并抓取工具：连接失败也保存（标记 error），便于后续刷新重试
    try {
      const { tools } = await connectAndListTools(entry)
      entry.tools = tools
      entry.status = 'connected'
    } catch (e) {
      entry.status = 'error'
      entry.error = friendlyError(e)
      log.warn(`连接 MCP 服务器 ${name} 失败: ${e.message}`)
    }
    store.servers.push(entry)
    existing.add(name)
    added.push(entry)
  }

  writeStore(store)
  // 服务器列表变更，重置 Agent MCP 客户端缓存
  invalidateAgentMcpClient()
  return { success: added.length > 0, added, errors }
}

/**
 * 删除一个 MCP 服务器
 * @param {string} name
 */
export function deleteMcpServer(name) {
  const store = readStore()
  const before = store.servers.length
  store.servers = store.servers.filter(s => s.name !== name)
  if (store.servers.length === before) {
    return { success: false, error: 'notFound' }
  }
  writeStore(store)
  invalidateAgentMcpClient()
  return { success: true }
}

/**
 * 重新连接并刷新工具列表
 * @param {string} name
 */
export async function refreshMcpServer(name) {
  const store = readStore()
  const entry = store.servers.find(s => s.name === name)
  if (!entry) return { success: false, error: 'notFound' }
  entry.status = 'loading'
  delete entry.error
  try {
    const { tools } = await connectAndListTools(entry)
    entry.tools = tools
    entry.status = 'connected'
    delete entry.error
  } catch (e) {
    entry.status = 'error'
    entry.error = friendlyError(e)
    log.warn(`刷新 MCP 服务器 ${name} 失败: ${e.message}`)
  }
  writeStore(store)
  invalidateAgentMcpClient()
  return { success: entry.status === 'connected', server: entry }
}

// ============================================================
// Agent MCP 工具加载：把外部 MCP 服务器的工具转为 LangChain 工具
// ============================================================
//
// 设计要点：
//   - 使用 @langchain/mcp-adapters 的 MultiServerMCPClient 管理多服务器连接，
//     它负责 JSON schema → Zod schema 转换、连接生命周期、工具调用转发。
//   - 客户端缓存：跨 invoke 复用，避免每条消息都重连 / 重新 spawn stdio 进程。
//   - 服务器变更（add/delete/refresh）时调用 invalidateAgentMcpClient() 重置缓存，
//     下次 loadAgentMcpTools() 会用最新配置重建客户端。
//   - onConnectionError: 'ignore' + throwOnLoadError: false：
//     单个服务器故障不影响 Agent 使用其余工具。

let agentMcpClient = null

/**
 * 把存储的 MCP 服务器条目转为 MultiServerMCPClient 配置
 * 存储的 type 'streamable_http' 映射为 transport 'http'
 */
function buildAgentMcpConfig() {
  const mcpServers = {}
  for (const s of listMcpServers()) {
    if (s.type === 'stdio') {
      mcpServers[s.name] = {
        transport: 'stdio',
        command: s.config.command,
        args: s.config.args || [],
        ...(s.config.env ? { env: s.config.env } : {})
      }
    } else if (s.type === 'sse') {
      mcpServers[s.name] = {
        transport: 'sse',
        url: s.config.url,
        ...(s.config.headers ? { headers: s.config.headers } : {})
      }
    } else {
      // streamable_http → http
      mcpServers[s.name] = {
        transport: 'http',
        url: s.config.url,
        ...(s.config.headers ? { headers: s.config.headers } : {})
      }
    }
  }
  return {
    mcpServers,
    // 单个服务器连接失败时跳过而非整体抛错，保证 Agent 仍可用
    throwOnLoadError: false,
    onConnectionError: 'ignore',
    // 工具名加前缀避免与内置工具冲突：mcp__服务器名__工具名
    prefixToolNameWithServerName: true,
    additionalToolNamePrefix: 'mcp'
  }
}

/**
 * 加载所有已添加 MCP 服务器的工具，返回 LangChain DynamicStructuredTool[]
 * 供 createAgent 合并进 Agent 工具集。客户端缓存复用，跨 invoke 不重连。
 *
 * @returns {Promise<Array>} LangChain 工具数组（无服务器时返回空数组）
 */
export async function loadAgentMcpTools() {
  if (!listMcpServers().length) {
    return []
  }
  if (!agentMcpClient) {
    agentMcpClient = new MultiServerMCPClient(buildAgentMcpConfig())
  }
  try {
    const tools = await agentMcpClient.getTools()
    log.info(`Agent 加载 ${tools.length} 个 MCP 工具`)
    return tools
  } catch (e) {
    log.warn(`加载 MCP 工具失败: ${e.message}`)
    return []
  }
}

/**
 * 重置 Agent MCP 客户端缓存（关闭连接、置空）
 * 在 addMcpServers / deleteMcpServer / refreshMcpServer 后调用，
 * 使下次 loadAgentMcpTools() 用最新配置重建客户端。
 */
export function invalidateAgentMcpClient() {
  if (agentMcpClient) {
    agentMcpClient.close().catch(() => {})
    agentMcpClient = null
  }
}

/**
 * 关闭所有 Agent MCP 连接（应用退出时调用）
 */
export async function closeAgentMcpConnections() {
  if (agentMcpClient) {
    try {
      await agentMcpClient.close()
    } catch (_e) {
      /* ignore */
    }
    agentMcpClient = null
  }
}

// ============================================================
// 本机 MCP 服务：把内置工具暴露为 streamable_http server
// ============================================================

let toolSpecsCache = null

/**
 * 把注册表中的工具定义转为 MCP 工具规格（含 JSON schema）
 * 仅暴露标记了 meta.exposedViaMcp=true 的应用功能工具（笔记 / 日程 / 知识库），
 * 系统级工具（shell / python / pip / markitdown / get_current_time 等）不对外暴露。
 * 缓存：内置工具集在运行期不变
 */
function getToolSpecs() {
  if (toolSpecsCache) return toolSpecsCache
  toolSpecsCache = listRegisteredTools()
    .filter((def) => def.meta?.exposedViaMcp === true)
    .map((def) => {
      let inputSchema = { type: 'object', properties: {} }
      try {
        // 用 @langchain/core 把 Zod schema 转为 JSON schema（兼容 zod / zod/v3）
        const lcTool = tool(async () => '', {
          name: def.name,
          description: def.description,
          schema: def.schema
        })
        const fn = convertToOpenAIFunction(lcTool)
        // 去掉 $schema（MCP inputSchema 不需要），保留其余字段
        if (fn?.parameters) {
          const { $schema, ...rest } = fn.parameters
          inputSchema = rest
        }
      } catch (e) {
        log.warn(`工具 ${def.name} schema 转换失败: ${e.message}`)
      }
      return { name: def.name, description: def.description, inputSchema, def }
    })
  const total = listRegisteredTools().length
  log.info(`本机 MCP 服务暴露 ${toolSpecsCache.length}/${total} 个应用功能工具（已过滤系统工具）`)
  return toolSpecsCache
}

/**
 * 构造单次工具调用的 ctx
 * - 每次调用生成唯一 requestId / threadId（避免与审计/审批映射冲突）
 * - autoApprove=true：MCP 模式下无前端审批通道，跳过 execute_command 的审批
 * - emit 为空函数：无前端可推送工具调用事件
 */
function buildMcpCtx() {
  const id = `mcp-${Date.now()}-${randomBytes(4).toString('hex')}`
  return {
    logger: log,
    dataDir: getDataDir(),
    agentRootDir: getAgentRootDir(),
    threadId: id,
    requestId: id,
    mainWindow: null,
    emit: () => {},
    autoApprove: true,
    db: null
  }
}

/**
 * 工厂：每个请求新建一个低层 Server（stateless 模式不可跨请求复用 connect）
 * 必须声明 capabilities.tools，否则客户端看不到工具能力
 */
function buildLocalServer() {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getToolSpecs().map(s => ({
      name: s.name,
      description: s.description,
      inputSchema: s.inputSchema
    }))
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request?.params?.name
    const args = request?.params?.arguments || {}
    const spec = getToolSpecs().find(s => s.name === name)
    if (!spec) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true
      }
    }
    const ctx = buildMcpCtx()
    try {
      const result = await spec.def.handler(args, ctx)
      const text = typeof result === 'string' ? result : JSON.stringify(result)
      return { content: [{ type: 'text', text }] }
    } catch (e) {
      log.warn(`MCP 工具 ${name} 执行失败: ${e.message}`)
      return {
        content: [{ type: 'text', text: `Error: ${e.message}` }],
        isError: true
      }
    }
  })

  return server
}

let localHttpServer = null
let localPort = null

function getConfiguredPort() {
  try {
    return loadConfig()?.mcp?.localPort || null
  } catch (_e) {
    return null
  }
}

function persistLocalConfig({ port, enabled }) {
  try {
    const cfg = loadConfig() || {}
    cfg.mcp = { ...(cfg.mcp || {}), localPort: port, localEnabled: enabled }
    saveConfig(cfg)
  } catch (e) {
    log.warn(`持久化本机 MCP 配置失败: ${e.message}`)
  }
}

function startListening(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => reject(err)
    server.once('error', onError)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onError)
      resolve(server.address().port)
    })
  })
}

/** 读取 req 请求体为字符串 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

/** 校验 Host 头：仅允许 127.0.0.1 / localhost / [::1]，防 DNS rebinding */
function isLocalHost(hostHeader) {
  if (!hostHeader) return false
  const host = hostHeader.split(':')[0].toLowerCase()
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]'
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** 处理一条本机 MCP HTTP 请求 */
async function handleHttpRequest(req, res) {
  // Host 头校验
  if (!isLocalHost(req.headers.host || '')) {
    sendJson(res, 403, { jsonrpc: '2.0', error: { code: -32600, message: 'Forbidden: non-local Host' } })
    return
  }
  // 仅接受 POST（stateless streamable http）
  if (req.method !== 'POST') {
    sendJson(res, 405, { jsonrpc: '2.0', error: { code: -32600, message: 'Method Not Allowed' } })
    return
  }
  // 解析请求体
  let parsedBody
  try {
    const raw = await readBody(req)
    parsedBody = raw ? JSON.parse(raw) : undefined
  } catch (e) {
    sendJson(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: `Parse error: ${e.message}` } })
    return
  }
  // 每请求新建 Server + transport（stateless）
  const server = buildLocalServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  })
  res.on('close', () => {
    try { transport.close() } catch (_e) { /* ignore */ }
    try { server.close() } catch (_e) { /* ignore */ }
  })
  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, parsedBody)
  } catch (e) {
    log.warn(`本机 MCP handleRequest 异常: ${e.message}`)
    if (!res.headersSent) {
      sendJson(res, 500, { jsonrpc: '2.0', error: { code: -32603, message: e.message } })
    }
  }
}

/**
 * 启动本机 MCP HTTP 服务
 */
export async function startLocalMcpServer() {
  if (localHttpServer) return { success: true, port: localPort }
  localHttpServer = http.createServer((req, res) => {
    handleHttpRequest(req, res).catch((e) => {
      log.warn(`本机 MCP 请求处理异常: ${e.message}`)
      if (!res.headersSent) {
        sendJson(res, 500, { jsonrpc: '2.0', error: { code: -32603, message: e.message } })
      }
    })
  })
  let port
  try {
    port = await startListening(localHttpServer, getConfiguredPort() || LOCAL_PORT_PREFERRED)
  } catch (_e) {
    // 首选端口被占用 → 让 OS 分配空闲端口
    port = await startListening(localHttpServer, 0)
  }
  localPort = port
  persistLocalConfig({ port, enabled: true })
  log.info(`本机 MCP 服务已启动: http://127.0.0.1:${port}/mcp（暴露 ${getToolSpecs().length} 个工具）`)
  return { success: true, port }
}

/**
 * 停止本机 MCP HTTP 服务
 */
export async function stopLocalMcpServer() {
  if (!localHttpServer) {
    persistLocalConfig({ port: localPort, enabled: false })
    return { success: true }
  }
  await new Promise((resolve) => localHttpServer.close(() => resolve()))
  localHttpServer = null
  persistLocalConfig({ port: localPort, enabled: false })
  log.info('本机 MCP 服务已停止')
  return { success: true }
}

/**
 * 应用启动时按 config.mcp.localEnabled 决定是否自动拉起本机 MCP 服务
 * 供 main.js 启动流程调用；失败仅记录日志，不阻塞主流程
 */
export async function autoStartLocalIfEnabled() {
  try {
    const enabled = loadConfig()?.mcp?.localEnabled
    if (enabled) {
      await startLocalMcpServer()
    }
  } catch (e) {
    log.warn(`自动启动本机 MCP 服务失败: ${e.message}`)
  }
}

export function getLocalMcpStatus() {
  return {
    running: !!localHttpServer,
    port: localPort,
    url: localPort ? `http://127.0.0.1:${localPort}/mcp` : null,
    toolCount: getToolSpecs().length
  }
}

/**
 * 返回可复制的本机 MCP 服务 JSON 配置
 */
export function getLocalMcpConfig() {
  const status = getLocalMcpStatus()
  const port = status.port || getConfiguredPort() || LOCAL_PORT_PREFERRED
  const json = JSON.stringify(
    {
      mcpServers: {
        'happy-friday': {
          type: 'streamable_http',
          url: `http://127.0.0.1:${port}/mcp`
        }
      }
    },
    null,
    2
  )
  return {
    json,
    url: status.url || `http://127.0.0.1:${port}/mcp`,
    port,
    toolCount: status.toolCount,
    running: status.running
  }
}

// ============================================================
// 工具函数
// ============================================================

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    )
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

/** 把底层错误转成对用户友好的提示 */
function friendlyError(e) {
  const msg = e?.message || String(e)
  if (msg.includes('ENOENT') || msg.includes('spawn')) {
    return `无法启动命令（命令不存在或不在 PATH 中）：${msg}`
  }
  return msg
}
