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
import path from 'path'
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
 * @param {Object} [options] 额外选项
 * @param {string} [options.folderPath] 用户当前所在的工作区虚拟路径（相对于 Agent 根目录）
 * @returns {Promise<Object>} DeepAgent 实例
 */
export async function createAgent(modelConfig, options = {}) {
  const { folderPath = '' } = options
  log.info('====== 开始创建 DeepAgent ======')
  if (folderPath) {
    log.info(`用户当前工作目录（虚拟路径）: ${folderPath}`)
  }

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
      '- 执行 Python 代码（python_repl，仅限预装库：pandas/numpy/scipy/matplotlib/seaborn/plotly/openpyxl/xlrd/xlwt/xlsxwriter/requests/beautifulsoup4/lxml/python-dateutil/pytz/PyYAML/jieba/sympy/rich/tabulate/markitdown[all] + 标准库；脚本统一存于 SANDBOX/tmpscript/，输出文件须存于 SANDBOX/ 自建子目录）\n' +
      '- 调用 REST API（requests_get / requests_post / requests_put / requests_patch / requests_delete）\n' +
      '- 处理 JSON 数据（json_parse / json_extract / json_format）\n' +
      '- 抓取网页正文（fetch_webpage_text，自动去除导航/广告等非正文内容）\n\n' +
      '## 文件存放约束（强制）\n' +
      `Agent 工作区根目录绝对路径：${rootDir}\n` +
      `SANDBOX 绝对路径：${path.join(rootDir, 'SANDBOX')}（python_repl 脚本目录与输出目录均在此之下）\n\n` +
      'Agent 工作区根目录下只有以下子目录有特殊用途，**严禁**在其他位置创建文件：\n' +
      '- `/SKILL/`：技能文件（只读，由前端管理，Agent 不可写入）\n' +
      '- `/memories/`：跨会话记忆（Agent 可读写，用于长期记忆）\n' +
      '- `/SANDBOX/`：**Agent 工作区，所有 LLM 生成的文件（write_file、Python 输出、shell 重定向等）必须存放于此**\n\n' +
      '权限规则已强制约束：写入 `/SKILL/` 或根目录其他位置会被拒绝。\n' +
      '在 `/SANDBOX/` 下按任务组织子目录，例如：\n' +
      '  - `/SANDBOX/tmpscript/`（python_repl 脚本文件统一存放处，由工具自动保存为 .py，执行后保留不删除，禁止在此目录产生输出文件）\n' +
      '  - `/SANDBOX/data/process/input.json`\n' +
      '  - `/SANDBOX/exports/sheet.xlsx`\n' +
      '注意：python_repl 产生任何输出文件（xlsx/csv/png/json 等）时，必须通过 workDir 参数指定 SANDBOX/ 下的自建子目录作为输出目录；无输出文件的纯计算执行 cwd 落在 `/SANDBOX/tmpscript/`。\n\n' +
      '调用 write_file / edit_file 时，路径必须以 `/SANDBOX/` 开头；其他路径会被权限层拒绝。\n\n' +
      (folderPath
        ? `## 用户当前工作目录\n用户正在 Agent 工作区的以下位置浏览：\`${folderPath === '/' ? '/' : folderPath}\`（相对于 Agent 根目录的虚拟路径）\n\n` +
          '用户在此目录下打开了对话窗口，可能希望对当前目录或其中的文件/文件夹执行操作。\n' +
          '当用户的请求涉及"当前目录"、"这个文件夹"、"这里的文件"等指代时，应理解为指此目录。\n' +
          '若用户在消息中通过 @ 附件指定了具体文件或文件夹，则以 @ 指定的路径为准。\n\n'
        : '') +
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
 * @param {Object} runtimeCtx 运行时上下文 { mainWindow, requestId, threadId, dataDir, folderPath }
 * @returns {Promise<{ agent, rootDir }>}
 */
export async function createAgentWithContext(modelConfig, runtimeCtx) {
  const { agent, toolCtx, rootDir } = await createAgent(modelConfig, {
    folderPath: runtimeCtx?.folderPath || ''
  })

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
