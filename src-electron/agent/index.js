/**
 * Agent 创建入口
 * ===============
 * 设计参考：Agent智能体设计.md 2.1 / 2.10 / 阶段 2.7
 *
 * 使用 DeepAgent SDK 的 createDeepAgent API 装配 Agent。
 *
 * 关键装配点：
 *   - model: 通过 modelAdapter.js 把项目模型配置适配为 LangChain ChatOpenAI
 *   - backend: 通过 backend.js 装配 CompositeBackend（FilesystemBackend + StoreBackend）
 *   - permissions: 通过 permissions.js 配置文件系统权限规则
 *   - tools: 通过 tools/registry.js 构建已注册的 LangChain 工具集
 *   - interruptOn: 通过 tools/registry.js 自动收集 requireApproval=true 的工具
 *   - skills: 通过 skills.js 加载 SKILL 目录
 *   - subagents: 通过 subagents.js 装配预置子 Agent
 *   - checkpointer: MemorySaver，支持 HITL 暂停/恢复
 *   - store: InMemoryStore，跨会话记忆
 */

import { createDeepAgent } from 'deepagents'
import { MemorySaver } from '@langchain/langgraph'
import { createLogger } from './logger.js'
import { createLangChainModel } from './modelAdapter.js'
import { buildBackend, getAgentRootDir, getSharedStore } from './backend.js'
import { buildPermissions } from './permissions.js'
import { ensureSkillDir, listSkills } from './skills.js'
import { buildSubagents } from './subagents.js'
import { buildLangChainTools, buildInterruptConfig } from './tools/registry.js'
// 触发 builtin 工具注册
import './tools/index.js'

const log = createLogger('Core')

// 单例 checkpointer：每个 thread_id 独立，但复用同一个 MemorySaver 实例
let sharedCheckpointer = null

/**
 * 获取共享 MemorySaver 实例
 * @returns {MemorySaver}
 */
export function getCheckpointer() {
  if (!sharedCheckpointer) {
    sharedCheckpointer = new MemorySaver()
    log.info('已创建共享 MemorySaver (checkpointer)')
  }
  return sharedCheckpointer
}

/**
 * 创建 DeepAgent 实例
 *
 * @param {Object} modelConfig 项目模型配置（provider/baseUrl/apiKey/modelName/enableThinking）
 * @returns {Promise<Object>} DeepAgent 实例
 */
export async function createAgent(modelConfig) {
  log.info('====== 开始创建 DeepAgent ======')

  // 1. 确保 SKILL 目录和沙箱目录存在
  ensureSkillDir()

  // 2. 创建模型
  const model = createLangChainModel(modelConfig)
  log.info(`模型创建完成: ${modelConfig.modelName}`)

  // 3. 装配后端
  const backend = buildBackend()
  const rootDir = getAgentRootDir()
  log.info(`后端装配完成: rootDir=${rootDir}`)

  // 4. 装配权限规则
  const permissions = buildPermissions()

  // 5. 构建工具集（注册的 builtin + 自定义工具）
  // 工具上下文（ctx）会通过闭包传递给每个 tool handler
  // 注：requestId/threadId/mainWindow 在每次 invoke 时动态注入（见 ipc.js）
  // 这里先用空值构建，运行时通过 ctx 注入
  const toolCtx = {
    db: null, // 将在 ipc.js 中动态填充
    dataDir: null,
    agentRootDir: rootDir,
    mainWindow: null,
    threadId: null,
    requestId: null,
    logger: createLogger('Tool'),
    emit: () => {} // 占位，运行时覆盖
  }
  const tools = buildLangChainTools(toolCtx)
  log.info(`工具集构建完成: ${tools.length} 个工具`)

  // 6. 构建 interruptOn 配置（需审批的工具）
  const interruptOn = buildInterruptConfig()
  log.info(`interruptOn 配置: ${Object.keys(interruptOn).join(', ') || '无'}`)

  // 7. 加载 SKILL
  // SkillsMiddleware 会通过 backend.ls('/SKILL/') 自动加载 Skill 元信息并注入系统提示词
  // 这里仅用于日志统计
  const skills = listSkills()
  log.info(`SKILL 加载完成: ${skills.length} 个技能`)

  // 8. 装配子 Agent
  const subagents = buildSubagents()

  // 9. 创建 DeepAgent
  const agent = await createDeepAgent({
    model,
    tools,
    backend,
    permissions,
    interruptOn,
    subagents,
    checkpointer: getCheckpointer(),
    store: getSharedStore(),
    skills: ['/SKILL/'],
    systemPrompt:
      '你是 Friday Agent，一个集成在 Happy Friday Lite 知识库应用中的智能助手。\n\n' +
      '## 核心能力\n' +
      '- 检索用户的个人/本地知识库（retrieve_knowledge）\n' +
      '- 管理笔记（search_notes / get_note / create_note / update_note）\n' +
      '- 管理日程（list_events / create_event / update_event）\n' +
      '- 操作 Agent 工作区文件（list_agent_files / read_agent_file / write_agent_file）\n' +
      '- 执行受限 shell 命令（execute_command）\n' +
      '- 执行 Python 代码（python_repl，已预装 pandas/numpy/requests/beautifulsoup4/openpyxl/markitdown 等库）\n' +
      '- 调用 REST API（requests_get / requests_post / requests_put / requests_patch / requests_delete）\n' +
      '- 处理 JSON 数据（json_parse / json_extract / json_format）\n' +
      '- 抓取网页正文（fetch_webpage_text，自动去除导航/广告等非正文内容）\n\n' +
      '## 文件存放约束（强制）\n' +
      'Agent 工作区根目录下只有以下子目录有特殊用途，**严禁**在其他位置创建文件：\n' +
      '- `/SKILL/`：技能文件（只读，由前端管理，Agent 不可写入）\n' +
      '- `/memories/`：跨会话记忆（Agent 可读写，用于长期记忆）\n' +
      '- `/SANDBOX/`：**Agent 工作区，所有 LLM 生成的文件（write_file、Python 输出、shell 重定向等）必须存放于此**\n\n' +
      '权限规则已强制约束：写入 `/SKILL/` 或根目录其他位置会被拒绝。\n' +
      '在 `/SANDBOX/` 下建议按任务组织子目录，例如：\n' +
      '  - `/SANDBOX/20260705-1/report.md`（python_repl 默认工作目录）\n' +
      '  - `/SANDBOX/data/process/input.json`\n' +
      '  - `/SANDBOX/exports/sheet.xlsx`\n\n' +
      '调用 write_file / edit_file 时，路径必须以 `/SANDBOX/` 开头；其他路径会被权限层拒绝。\n\n' +
      '## 行为准则\n' +
      '1. 优先使用工具获取信息，避免凭空回答\n' +
      '2. 写操作（创建笔记/日程/文件、执行 Python 代码、POST/PUT/PATCH/DELETE 请求）需用户审批后执行\n' +
      '3. 涉及用户隐私的信息不得外泄\n' +
      '4. 用中文回答用户问题\n' +
      '5. 所有文件操作路径必须位于 `/SANDBOX/` 下（memories 除外）\n'
  })

  log.info('====== DeepAgent 创建完成 ======')
  return { agent, toolCtx, rootDir }
}

/**
 * 创建带上下文的 Agent（用于每次 invoke）
 * 在 createAgent 基础上，注入运行时 ctx（mainWindow/requestId/threadId 等）
 *
 * @param {Object} modelConfig 项目模型配置
 * @param {Object} runtimeCtx 运行时上下文 { mainWindow, requestId, threadId, dataDir }
 * @returns {Promise<{ agent, rootDir }>}
 */
export async function createAgentWithContext(modelConfig, runtimeCtx) {
  const { agent, toolCtx, rootDir } = await createAgent(modelConfig)

  // 动态注入运行时上下文
  Object.assign(toolCtx, {
    db: await import('../db.js'),
    dataDir: runtimeCtx.dataDir,
    mainWindow: runtimeCtx.mainWindow,
    threadId: runtimeCtx.threadId,
    requestId: runtimeCtx.requestId,
    // 便捷推送 IPC 事件
    emit: (event, payload) => {
      runtimeCtx.mainWindow?.webContents?.send(event, payload)
    }
  })

  return { agent, rootDir }
}
