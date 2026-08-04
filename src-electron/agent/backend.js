/**
 * 后端装配
 * ==========
 * 设计参考：Agent智能体设计.md 2.2 / LangChain Deep Agents memory
 *
 * 采用 FilesystemBackend 统一承载 Agent 沙箱内的所有文件：
 *   /SKILL/     Skill 文件（前端管理，Agent 可读写）
 *   /memories/  跨会话记忆（SOUL.md / USER.md / MEMORY.md / Agent.md，磁盘文件）
 *   /SANDBOX/   Agent 工作区（所有 LLM 生成的文件均存放于此）
 *
 * 决策：记忆文件采用「filesystem-backed memory」（Deep Agents 官方推荐模式），
 *      真实落盘于 {rootDir}/memories/ 下，由 createDeepAgent 的 memory: 参数在
 *      启动时加载进系统提示词，Agent 亦可通过 edit_file 自主更新。
 *      相比早期 InMemoryStore + SQLite 双向同步方案，磁盘文件对本单用户本地应用
 *      更直观、可调试、可在记忆管理界面直接编辑，且无易失性 / 时序问题。
 *
 * FilesystemBackend.virtualMode = true，路径被沙箱化为虚拟绝对路径，
 * rootDir 锁定 {userData}/knowledge/agent/ 作为边界。
 * 这样 SkillsMiddleware 调用 backend.ls('/SKILL/') 才能正确解析为 {rootDir}/SKILL/。
 */

import fs from 'fs'
import path from 'path'
import { FilesystemBackend, CompositeBackend } from 'deepagents'
import { InMemoryStore } from '@langchain/langgraph'
import { getDataDir } from '../config.js'
import { createLogger } from './logger.js'

const log = createLogger('Backend')

// 单例 InMemoryStore：作为 LangGraph BaseStore 供 createDeepAgent 使用（checkpointer 等）
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
 * 作为 LangGraph BaseStore 供 createDeepAgent 使用
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
 * 装配后端（FilesystemBackend，virtualMode=true）
 *
 * 目录结构（rootDir 下）：
 *   /SKILL/       Skill 文件（前端管理，Agent 可读写）
 *   /memories/    跨会话记忆（磁盘文件，Agent 读写，由 memory: 参数加载进系统提示词）
 *   /SANDBOX/     Agent 工作区（所有 LLM 生成的文件均存放于此，permissions 强制约束）
 *
 * @returns {FilesystemBackend|CompositeBackend}
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

  // 当前所有路径统一走 FilesystemBackend。
  // 保留 CompositeBackend 形态以便未来按路径前缀挂载其他后端（如 StoreBackend）。
  // 注意：CompositeBackend 构造器对 routes 执行 Object.entries，必须传入空对象而非 undefined。
  sharedBackend = new CompositeBackend(fsBackend, {})

  log.info(`后端装配完成: rootDir=${rootDir}, routes=[]（全部走 FilesystemBackend）`)
  return sharedBackend
}

