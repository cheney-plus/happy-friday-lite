/**
 * 后端装配
 * ==========
 * 设计参考：Agent智能体设计.md 2.2
 *
 * 采用 CompositeBackend 路由，分离「项目文件」「跨会话记忆」：
 *   /memories/  → StoreBackend   跨会话记忆（InMemoryStore + SQLite 双向同步）
 *   其他        → FilesystemBackend Agent 工作文件、SKILL、沙盒区（本地磁盘）
 *
 * 决策：FilesystemBackend.virtualMode = true，路径被沙箱化为虚拟绝对路径，
 *      rootDir 锁定 {userData}/knowledge/agent/ 作为边界。
 *      这样 SkillsMiddleware 调用 backend.ls('/SKILL/') 才能正确解析为 {rootDir}/SKILL/。
 */

import fs from 'fs'
import path from 'path'
import { FilesystemBackend, StoreBackend, CompositeBackend } from 'deepagents'
import { InMemoryStore } from '@langchain/langgraph'
import { getDataDir } from '../config.js'
import { createLogger } from './logger.js'

const log = createLogger('Backend')

// 单例 InMemoryStore：供 StoreBackend 使用，并在 memory.js 中与 SQLite 双向同步
let sharedStore = null
// 单例后端实例：避免每次创建 Agent 都重新装配
let sharedBackend = null

/**
 * 获取 Agent 工作根目录（沙箱边界）
 * 路径：{dataDir}/knowledge/agent
 */
export function getAgentRootDir() {
  const dataDir = getDataDir()
  return path.join(dataDir, 'knowledge', 'agent')
}

/**
 * 获取共享 InMemoryStore 实例
 * 用于 StoreBackend 与 memory.js 双向同步
 * @returns {InMemoryStore}
 */
export function getSharedStore() {
  if (!sharedStore) {
    sharedStore = new InMemoryStore()
    log.info('已创建共享 InMemoryStore')
  }
  return sharedStore
}

/**
 * 装配 CompositeBackend
 * - 默认后端：FilesystemBackend（rootDir = {userData}/knowledge/agent/，virtualMode=true）
 * - /memories/ 路由：StoreBackend（namespace='memories'）
 *
 * 目录结构（rootDir 下）：
 *   /SKILL/       Skill 文件（前端管理，Agent 只读）
 *   /memories/    跨会话记忆（StoreBackend，Agent 读写）
 *   /SANDBOX/     Agent 工作区（所有 LLM 生成的文件均存放于此，permissions 强制约束）
 *
 * @returns {CompositeBackend}
 */
export function buildBackend() {
  if (sharedBackend) return sharedBackend

  const rootDir = getAgentRootDir()
  // 确保沙箱根目录存在
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true })
    log.info(`已创建 Agent 沙箱目录: ${rootDir}`)
  }

  // 确保 SANDBOX 工作区目录存在（Agent 所有生成文件的默认存放位置）
  const sandboxDir = path.join(rootDir, 'SANDBOX')
  if (!fs.existsSync(sandboxDir)) {
    fs.mkdirSync(sandboxDir, { recursive: true })
    log.info(`已创建 Agent 工作区: ${sandboxDir}`)
  }

  // 默认后端：本地磁盘文件系统（virtualMode=true 沙箱化为虚拟路径）
  // virtualMode=true 时，/SKILL/ 会被解析为 {rootDir}/SKILL/，而非系统根目录 /SKILL/
  const fsBackend = new FilesystemBackend({
    rootDir,
    virtualMode: true
  })

  // /memories/ 路由：跨会话记忆存储
  const storeBackend = new StoreBackend({
    store: getSharedStore(),
    namespace: 'memories'
  })

  // 组合后端：路径前缀 /memories/ 走 StoreBackend，其他走 FilesystemBackend
  sharedBackend = new CompositeBackend(fsBackend, {
    '/memories/': storeBackend
  })

  log.info(`后端装配完成: rootDir=${rootDir}, routes=[/memories/→StoreBackend]`)
  return sharedBackend
}
