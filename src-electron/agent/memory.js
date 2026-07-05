/**
 * 记忆持久化
 * ===========
 * 设计参考：Agent智能体设计.md 2.6
 *
 * 三张表的 CRUD：
 *   - agent_threads: Agent 会话（与 sessions 表独立）
 *   - agent_memories: 跨会话记忆（与 StoreBackend 双向同步）
 *   - agent_tool_logs: 工具调用审计日志
 *
 * 同步策略：
 *   StoreBackend 在主进程内为 InMemoryStore，memory.js 在 agent.invoke 前后
 *   做 load → put 双向同步，确保记忆落 SQLite。
 */

import crypto from 'crypto'
import { queryAllRaw } from '../db.js'
import { getSharedStore } from './backend.js'
import { createLogger } from './logger.js'

const log = createLogger('Memory')

function generateId() {
  return crypto.randomUUID()
}

function nowISO() {
  return new Date().toISOString()
}

// ========== agent_threads 表 CRUD ==========

/**
 * 创建 Agent 会话
 * @param {string} [title] 会话标题
 * @returns {{ id, title, createdAt, updatedAt }}
 */
export function createThread(title = '新 Agent 会话') {
  const id = generateId()
  const now = nowISO()
  queryAllRaw(
    'INSERT INTO agent_threads (id, title, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
    [id, title, now, now]
  )
  log.info(`创建会话: id=${id}, title=${title}`)
  return { id, title, createdAt: now, updatedAt: now }
}

/**
 * 获取会话
 * @param {string} threadId
 * @returns {Object|null}
 */
export function getThread(threadId) {
  const rows = queryAllRaw('SELECT * FROM agent_threads WHERE id = ?', [threadId])
  return rows.length > 0 ? rows[0] : null
}

/**
 * 更新会话标题
 * @param {string} threadId
 * @param {string} title
 */
export function updateThreadTitle(threadId, title) {
  queryAllRaw('UPDATE agent_threads SET title = ?, updatedAt = ? WHERE id = ?', [
    title,
    nowISO(),
    threadId
  ])
}

/**
 * 更新会话时间戳
 * @param {string} threadId
 */
export function touchThread(threadId) {
  queryAllRaw('UPDATE agent_threads SET updatedAt = ? WHERE id = ?', [nowISO(), threadId])
}

// ========== agent_memories 表 CRUD ==========

/**
 * 写入一条记忆到 SQLite
 * @param {Object} args { threadId?, namespace, key, value }
 * @returns {{ id, threadId, namespace, key, value, createdAt, updatedAt }}
 */
export function putMemory({ threadId = null, namespace = 'memories', key, value }) {
  // 查找是否已存在相同 (threadId, namespace, key)
  const existing = queryAllRaw(
    'SELECT id FROM agent_memories WHERE threadId IS ? AND namespace = ? AND `key` = ?',
    [threadId, namespace, key]
  )

  const now = nowISO()
  if (existing.length > 0) {
    const id = existing[0].id
    queryAllRaw(
      'UPDATE agent_memories SET value = ?, updatedAt = ? WHERE id = ?',
      [value, now, id]
    )
    return { id, threadId, namespace, key, value, updatedAt: now }
  }

  const id = generateId()
  queryAllRaw(
    'INSERT INTO agent_memories (id, threadId, namespace, `key`, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, threadId, namespace, key, value, now, now]
  )
  return { id, threadId, namespace, key, value, createdAt: now, updatedAt: now }
}

/**
 * 查询记忆
 * @param {Object} args { threadId?, namespace }
 * @returns {Array}
 */
export function listMemories({ threadId = null, namespace = 'memories' } = {}) {
  if (threadId) {
    return queryAllRaw(
      'SELECT * FROM agent_memories WHERE threadId = ? AND namespace = ? ORDER BY updatedAt DESC',
      [threadId, namespace]
    )
  }
  return queryAllRaw(
    'SELECT * FROM agent_memories WHERE threadId IS NULL AND namespace = ? ORDER BY updatedAt DESC',
    [namespace]
  )
}

// ========== agent_tool_logs 表 CRUD ==========

/**
 * 记录工具调用审计日志
 * @param {Object} args { threadId?, requestId?, toolName, arguments, output, status, durationMs }
 * @returns {Object}
 */
export function logToolCall({
  threadId = null,
  requestId = null,
  toolName,
  arguments: args,
  output,
  status = 'success',
  durationMs = 0
}) {
  const id = generateId()
  const now = nowISO()
  const argsStr = typeof args === 'string' ? args : JSON.stringify(args || {})
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output || {})

  queryAllRaw(
    'INSERT INTO agent_tool_logs (id, threadId, requestId, toolName, arguments, output, status, durationMs, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, threadId, requestId, toolName, argsStr, outputStr, status, durationMs, now]
  )
  return { id, threadId, requestId, toolName, status, durationMs, createdAt: now }
}

/**
 * 查询工具调用日志
 * @param {Object} args { threadId?, toolName?, limit? }
 * @returns {Array}
 */
export function listToolLogs({ threadId = null, toolName = null, limit = 100 } = {}) {
  let sql = 'SELECT * FROM agent_tool_logs WHERE 1=1'
  const params = []
  if (threadId) {
    sql += ' AND threadId = ?'
    params.push(threadId)
  }
  if (toolName) {
    sql += ' AND toolName = ?'
    params.push(toolName)
  }
  sql += ' ORDER BY createdAt DESC LIMIT ?'
  params.push(limit)
  return queryAllRaw(sql, params)
}

// ========== StoreBackend 双向同步 ==========

/**
 * 从 SQLite 加载记忆到 InMemoryStore
 * 在 agent.invoke 前调用，确保 Agent 能读到历史记忆
 * @param {string} [threadId]
 */
export async function loadMemoriesToStore(threadId = null) {
  const store = getSharedStore()
  const memories = listMemories({ threadId, namespace: 'memories' })
  for (const m of memories) {
    try {
      // StoreBackend 使用 (namespace, key) 寻址，value 为字符串
      await store.put(['memories'], m.key, { content: m.value })
    } catch (e) {
      log.warn(`加载记忆到 Store 失败: key=${m.key}`, e.message)
    }
  }
  log.info(`已加载 ${memories.length} 条记忆到 InMemoryStore`)
}

/**
 * 从 InMemoryStore 同步记忆到 SQLite
 * 在 agent.invoke 后调用，确保新写入的记忆落盘
 * @param {string} [threadId]
 */
export async function syncStoreToSQLite(threadId = null) {
  const store = getSharedStore()
  try {
    // 列出 StoreBackend 中 /memories/ 命名空间下的所有 key
    const items = await store.search(['memories'])
    let synced = 0
    for (const item of items) {
      // item.value 是 { content: string } 结构
      const value = item.value?.content ?? JSON.stringify(item.value ?? {})
      putMemory({ threadId, namespace: 'memories', key: item.key, value })
      synced++
    }
    log.info(`已同步 ${synced} 条记忆到 SQLite`)
  } catch (e) {
    log.warn(`同步 Store 到 SQLite 失败:`, e.message)
  }
}
