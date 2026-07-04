# Agent 智能体设计

> 基于 LangChain Deep Agents SDK（`deepagents` JS 版）为知识库模块打造的通用 Agent 智能体。
> 目标：在 `src/views/knowledge/agent` 目录中引入受限沙箱化的 Agent，统一对接本项目已有大模型与持久化能力，并提供可扩展的 Tool 注册机制。

---

## 一、设计目标与范围

### 1.1 核心诉求

| # | 诉求 | 设计落点 |
|---|------|---------|
| 1 | 引入 DeepAgent 框架，统一 Agent 调用模型 | `src-electron/agent/index.js` 封装 `createDeepAgent` |
| 2 | 权限限定：大模型只能在该目录中操作文件与执行指令 | `FilesystemBackend(rootDir=agentDir)` + `FilesystemPermission` 规则 |
| 3 | 后端采用文件系统后端（本地磁盘） | `CompositeBackend`：默认 `FilesystemBackend`，`/memories/` 走 `StoreBackend` |
| 4 | 危险命令人机交互 | `interrupt_on` + IPC 推送 `agent-tool-approval` 事件 + 渲染进程弹窗 |
| 5 | 自动使用 `SKILL` 目录中的 skill | `skills=["/SKILL/"]` 参数 + `SkillsMiddleware` 自动发现 |
| 6 | 可扩展 Tool 注册接口（写代码→注册即可用） | `tools/registry.js` 暴露 `registerTool()`，Agent 启动时聚合 |
| 7 | 关键位置打印日志 + 中文代码注释 | `logger.js` 统一封装，前缀 `[Agent]` |
| 8 | 记忆参考本项目已有持久化实现 | 复用 `src-electron/db.js`（sql.js）新增 `agent_memories` / `agent_threads` 表 |
| 9 | 结合本项目大模型相关实现 | `modelAdapter.js` 复用 `src-electron/llm.js` 中的 provider 配置（qwen/deepseek/zhipu/kimi/doubao/minimax/other） |

### 1.2 DeepAgent 内置能力对应

Deep Agents 提供的 6 项内置能力在本设计中的对应关系：

```
Take actions in an environment  → FilesystemBackend + 自定义 Tool（执行项目接口）
Connect to your data            → SkillsMiddleware + Memory（SQLite 持久化）
Manage growing context          → compact_conversation 工具 + CompositeBackend offload
Parallelize tasks               → Subagents（task 工具，可派发隔离上下文子 Agent）
Stay in the loop                → interrupt_on + 渲染进程 ToolApprovalDialog
Improve over time               → /memories/ 路径写入 + AGENTS.md 全局指令
```

### 1.3 范围边界

- **本设计仅产出架构与接口规约**，不包含具体实现代码。
- Agent 仅服务于知识库模块（`src/views/knowledge`），不接管全局对话（`FridayChat.vue`）。
- 工作区（`kbCategoryId === 'agent'`）不参与向量化与 RAG 检索（沿用现有约束）。

---

## 二、整体架构

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│  渲染进程 (Vue 3)                                            │
│  src/views/knowledge/agent/                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ AgentWorkspace.vue  ←→ useAgent.js (IPC 调用)        │    │
│  │   ├─ AgentChatDialog.vue     流式对话                │    │
│  │   ├─ ToolApprovalDialog.vue  人机交互审批            │    │
│  │   ├─ SkillCard.vue           Skill 展示              │    │
│  │   └─ AgentSidebar.vue        会话/技能/记忆切换      │    │
│  └─────────────────────────────────────────────────────┘    │
│                         ↕ IPC (preload.cjs 桥接)             │
┌─────────────────────────────────────────────────────────────┐
│  主进程 (Electron)                                           │
│  src-electron/agent/                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ index.js          createDeepAgent 封装入口           │    │
│  │ backend.js        CompositeBackend 装配              │    │
│  │ permissions.js    路径白名单 + interrupt 权限规则     │    │
│  │ modelAdapter.js   项目模型配置 → LangChain ChatModel │    │
│  │ memory.js         agent_memories 表 + 跨会话记忆     │    │
│  │ skills.js         SKILL 目录扫描与热加载             │    │
│  │ subagents.js      子 Agent 定义                      │    │
│  │ humanInTheLoop.js 审批事件分发与 resume              │    │
│  │ tools/            可扩展工具集（注册中心）           │    │
│  │ logger.js         统一日志                          │    │
│  │ ipc.js            IPC 通道注册                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                         ↕ 复用                              │
│  src-electron/llm.js / db.js / config.js / events.js        │
└─────────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────────┐
│  本地磁盘 (userData/knowledge/agent/)                       │
│  SKILL/  memories/  conversation_history/  沙盒区/  AGENTS.md│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 关键决策

1. **Agent 引擎运行在主进程**：避免渲染进程阻塞，且能直接访问 `fs` / `db` / 现有 LLM 实现。
2. **DeepAgent SDK 通过 ESM 引入**：与项目 `"type": "module"` 一致；新增依赖 `deepagents`、`@langchain/langgraph-checkpoint`。
3. **模型复用项目配置**：用户在「设置→模型」页配置的 `provider/baseUrl/apiKey/modelName` 通过 `modelAdapter.js` 适配为 LangChain `BaseChatModel`。
4. **沙箱边界 = `rootDir`**：`FilesystemBackend` 的 `rootDir` 锁定为 `{userData}/knowledge/agent/`，所有内置文件工具（`ls/read_file/write_file/edit_file/glob/grep`）仅能操作此目录。
5. **记忆持久化双轨**：短期对话 offload 落本地磁盘；跨会话记忆落 SQLite `agent_memories` 表（与现有 `sessions/messages/notes` 同库）。

---

## 三、目录结构

### 3.1 代码目录

```
src/views/knowledge/agent/                       # 前端 Agent 模块
├── Agent智能体设计.md                            # 本文档
├── components/
│   ├── AgentChatDialog.vue                      # Agent 对话窗口（流式渲染）
│   ├── AgentMessage.vue                         # 消息展示（区分 user/assistant/tool）
│   ├── ToolApprovalDialog.vue                   # 工具审批人机交互弹窗
│   ├── SkillCard.vue                            # Skill 元信息卡片
│   └── AgentSidebar.vue                         # 子侧边栏（会话/Skill/记忆切换）
├── composables/
│   ├── useAgent.js                              # Agent 调用与状态管理
│   ├── useAgentStream.js                        # 流式分片处理（订阅 IPC 事件）
│   └── useToolApproval.js                       # 工具审批交互（响应 interrupt）
├── views/
│   └── AgentWorkspace.vue                       # Agent 工作区主视图（路由页）
└── constants.js                                 # Agent 模块常量（事件名、路由等）

src-electron/agent/                              # 后端 Agent 引擎
├── index.js                                     # createDeepAgent 封装入口
├── backend.js                                   # CompositeBackend 装配
├── permissions.js                               # 文件系统权限规则
├── modelAdapter.js                              # 项目模型 → LangChain ChatModel
├── memory.js                                    # 记忆持久化（agent_memories 表）
├── skills.js                                    # SKILL 目录扫描与加载
├── subagents.js                                 # 子 Agent 配置
├── humanInTheLoop.js                            # 人机交互审批处理
├── logger.js                                    # 统一日志器
├── ipc.js                                       # IPC 通道注册
└── tools/                                       # 可扩展工具集
    ├── index.js                                 # 工具聚合（启动时收集所有注册项）
    ├── registry.js                              # 工具注册器（用户后期注册入口）
    ├── builtin/                                 # 内置工具
    │   ├── knowledgeBase.js                     # 知识库 RAG 检索
    │   ├── noteOps.js                           # 笔记 CRUD
    │   ├── scheduleOps.js                       # 日程 CRUD
    │   ├── fileOps.js                           # Agent 目录文件操作
    │   └── shellExec.js                         # 受限 shell 执行（白名单）
    └── README.md                                # 「如何编写并注册新 Tool」说明
```

### 3.2 磁盘目录（运行时由 Agent 自动初始化）

```
{userData}/knowledge/agent/                      # FilesystemBackend.rootDir
├── AGENTS.md                                    # Agent 全局指令（项目约定/约束）
├── SKILL/                                       # 技能目录（受保护，受 SkillsMiddleware 加载）
│   ├── _index.json                              # Skill 元信息索引（自动生成）
│   ├── research.md                              # 示例：研究技能
│   ├── summarize.md                             # 示例：总结技能
│   └── ...
├── memories/                                    # 跨会话记忆（StoreBackend 路由）
│   ├── project_memory.md                        # 项目级记忆
│   └── user_profile.md                          # 用户偏好
├── conversation_history/                        # 对话 offload 落盘
│   └── {thread_id}.md
└── 沙盒区/                                      # Agent 写入文件的工作区（默认 cwd）
    └── ...
```

> **说明**：`SKILL/` 与 `沙盒区/` 已在 `src/views/knowledge/constants/index.js` 的 `DEFAULT_CATEGORIES` 中预留（`{ id: 'rag-thinking', name: 'SKILL', protected: true }` 和 `{ id: 'rag-sandbox', name: '沙盒区', protected: true }`），无需用户手动创建。

---

## 四、核心模块设计

### 4.1 Backend（后端装配）`backend.js`

采用 `CompositeBackend` 路由，分离「项目文件」「内部状态」「跨会话记忆」：

```js
// 伪代码示意（非最终实现）
import { CompositeBackend, FilesystemBackend, StateBackend, StoreBackend } from 'deepagents'
import { InMemoryStore } from '@langchain/langgraph-checkpoint'
import path from 'path'

export function createAgentBackend(agentRootDir) {
  // 1. 主文件系统后端：限定 rootDir 为 agent 目录
  //    virtualMode=false：直接读写本地磁盘（用户需求：文件系统后端本地磁盘实现）
  const fsBackend = new FilesystemBackend({ rootDir: agentRootDir, virtualMode: false })

  // 2. 跨会话记忆后端：/memories/ 路由到 StoreBackend
  const store = new InMemoryStore() // 主进程内常驻；落盘由 memory.js 同步到 SQLite

  // 3. 组合：默认走 FilesystemBackend；/memories/ 走 StoreBackend
  return {
    backend: new CompositeBackend(fsBackend, {
      '/memories/': new StoreBackend({ namespace: () => ['agent', 'memories'] }),
    }),
    store,
  }
}
```

**路由策略**：

| 路径前缀 | 后端 | 用途 | 持久化 |
|---------|------|------|--------|
| `/memories/` | `StoreBackend` | 跨会话记忆 | SQLite `agent_memories` 表 |
| 其他 | `FilesystemBackend` | Agent 工作文件、SKILL、沙盒区 | 本地磁盘 |
| 内部 offload | `StateBackend`（默认） | `conversation_history`、tool 结果 | langgraph checkpointer |

### 4.2 权限规则 `permissions.js`

通过 `FilesystemPermission` 限定读写路径，配合 `mode: 'interrupt'` 实现关键操作审批：

```js
// 伪代码示意
export const agentPermissions = [
  // 1. SKILL 目录：允许读取，写入需人机交互
  { operations: ['read'],  paths: ['/SKILL/**'],  mode: 'allow' },
  { operations: ['write'], paths: ['/SKILL/**'],  mode: 'interrupt' },

  // 2. 沙盒区：自由读写（Agent 工作区）
  { operations: ['read', 'write'], paths: ['/沙盒区/**'], mode: 'allow' },

  // 3. memories 目录：允许写入（Agent 自我成长）
  { operations: ['read', 'write'], paths: ['/memories/**'], mode: 'allow' },

  // 4. AGENTS.md：写入需审批
  { operations: ['write'], paths: ['/AGENTS.md'], mode: 'interrupt' },

  // 5. 其他路径：默认拒绝（deepagents 默认行为）
]
```

> **注**：`FilesystemBackend(rootDir)` 已天然限定根目录，权限规则在此基础上做细粒度控制。

### 4.3 模型适配 `modelAdapter.js`

复用项目 `src-electron/llm.js` 中的 provider 配置（`qwen/deepseek/zhipu/kimi/doubao/minimax/other`），适配为 LangChain `BaseChatModel`：

```js
// 伪代码示意
import { ChatOpenAI } from '@langchain/openai'

export function toLangChainModel(projectModel) {
  // 项目所有 provider 均走 OpenAI 兼容协议（chat/completions），
  // 直接用 ChatOpenAI 即可；baseUrl + apiKey + modelName 透传
  return new ChatOpenAI({
    modelName: projectModel.modelName,
    openAIApiKey: projectModel.apiKey,
    configuration: { baseURL: buildApiUrl(projectModel.baseUrl, projectModel.provider) },
    streaming: true,
  })
}

function buildApiUrl(baseUrl, provider) {
  // 复用 src-electron/llm.js 的同名函数逻辑
  if (provider === 'other') return baseUrl.replace(/\/+$/, '')
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`
}
```

**思考模式适配**：项目已实现 `enable_thinking`/`thinking`/`reasoning_split` 等 provider 差异化参数，`modelAdapter.js` 需通过 `model.bind({ ...providerParams })` 注入。

### 4.4 Skills 加载 `skills.js`

DeepAgent `SkillsMiddleware` 会扫描指定目录下的 `.md` 文件作为 skill。本设计将 `{agentDir}/SKILL/` 作为唯一 skill 源：

```js
// 伪代码示意
import fs from 'fs'
import path from 'path'

export function loadSkillPaths(agentRootDir) {
  const skillDir = path.join(agentRootDir, 'SKILL')
  if (!fs.existsSync(skillDir)) {
    fs.mkdirSync(skillDir, { recursive: true })
  }
  // 返回 deepagents skills 参数所需路径
  return ['/SKILL/']
}

// 自动创建 _index.json，列出所有可用 skill 元信息（供前端展示）
export function buildSkillIndex(agentRootDir) {
  const skillDir = path.join(agentRootDir, 'SKILL')
  const entries = fs.readdirSync(skillDir).filter(f => f.endsWith('.md'))
  const index = entries.map(name => {
    const content = fs.readFileSync(path.join(skillDir, name), 'utf-8')
    const title = (content.match(/^#\s+(.+)$/m) || [])[1] || name
    const desc = (content.match(/^>\s*(.+)$/m) || [])[1] || ''
    return { file: name, title, desc }
  })
  fs.writeFileSync(path.join(skillDir, '_index.json'), JSON.stringify(index, null, 2))
  return index
}
```

**Skill 文件约定**：

```markdown
# 研究助手

> 当用户要求调研某个主题时启用。

## 工作流程
1. 调用 retrieve_knowledge 工具检索知识库
2. 如需外部信息，调用 web_search（若已注册）
3. 综合输出研究报告

## 输出格式
- Markdown
- 包含来源引用
```

### 4.5 记忆持久化 `memory.js`

参考项目已有 SQLite 实现（`src-electron/db.js`），新增 `agent_memories` 与 `agent_threads` 表：

```sql
-- agent_threads：Agent 会话（与 sessions 表独立，避免污染对话历史）
CREATE TABLE IF NOT EXISTS agent_threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '新 Agent 会话',
  status TEXT NOT NULL DEFAULT 'active',  -- active / completed / interrupted
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- agent_memories：跨会话记忆（与 StoreBackend 同步）
CREATE TABLE IF NOT EXISTS agent_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  namespace TEXT NOT NULL,           -- 'agent:memories'
  key TEXT NOT NULL,                 -- 记忆键名（如 'project_memory'）
  value TEXT NOT NULL,               -- 记忆内容（Markdown）
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(namespace, key)
);

-- agent_tool_logs：工具调用日志（审计与「改进」能力的数据源）
CREATE TABLE IF NOT EXISTS agent_tool_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  args TEXT,                         -- JSON
  result TEXT,                       -- JSON（截断后）
  status TEXT NOT NULL,              -- success / failed / approved / rejected
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_namespace ON agent_memories(namespace);
CREATE INDEX IF NOT EXISTS idx_agent_tool_logs_thread_id ON agent_tool_logs(thread_id);
```

**与 StoreBackend 的同步**：`StoreBackend` 在主进程内为 `InMemoryStore`，`memory.js` 在 `agent.invoke` 前后做 `load → put` 双向同步，确保记忆落 SQLite。

### 4.6 Subagents `subagents.js`

预置一个「通用子 Agent」用于并行任务派发，遵循 DeepAgent `SubAgent` 字段规约：

```js
// 伪代码示意
export const defaultSubagents = [
  {
    name: 'researcher',
    description: '用于并行调研某个子主题，返回结构化研究结果。当主任务可拆分为多个独立子调研时调用。',
    systemPrompt: '你是一个研究助手。仅使用检索工具，输出 Markdown 格式的研究简报。',
    // tools 省略 → 继承主 Agent 工具集
    // model 省略 → 继承主 Agent 模型
    skills: ['/SKILL/research.md'],  // 子 Agent 独立加载研究 skill
    // permissions 继承主 Agent
  },
]
```

> **后续扩展**：用户可在 `subagents.js` 中追加自定义子 Agent，无需改动核心代码。

### 4.7 人机交互 `humanInTheLoop.js`

DeepAgent 通过 `interrupt_on` + checkpointer 实现 HITL。本设计的流程：

```
Agent 调用危险工具（write_file/edit_file/execute/自定义标记工具）
        ↓
DeepAgent 触发 interrupt（checkpointer 暂停）
        ↓
humanInTheLoop.js 捕获 interrupt → 通过 IPC 推送 'agent-tool-approval' 事件
        ↓
渲染进程 ToolApprovalDialog 弹窗 → 用户 approve/reject/edit
        ↓
渲染进程 IPC 回传 'agent-tool-approval-resume' → humanInTheLoop.js 构造 Command(resume)
        ↓
Agent 恢复执行
```

```js
// 伪代码示意
import { Command } from '@langchain/langgraph'

export function buildInterruptConfig() {
  return {
    // 内置危险操作
    write_file: true,
    edit_file: true,
    delete: true,
    execute: true,                  // shell 执行
    // 自定义工具按需在 registry.js 中通过 meta.requireApproval 标记
  }
}

export async function resumeFromApproval(agent, threadId, interruptId, decision) {
  // decision: { type: 'approve' } | { type: 'reject', reason } | { type: 'edit', editedAction }
  const resume = { [interruptId]: { decisions: [decision] } }
  return await agent.invoke(new Command({ resume }), { configurable: { thread_id: threadId } })
}
```

**危险命令识别**（针对 `execute` 工具）：

```js
// shellExec.js 中预置白名单与黑名单
const SHELL_WHITELIST = ['ls', 'cat', 'pwd', 'echo', 'grep', 'find', 'wc', 'head', 'tail']
const SHELL_BLACKLIST = ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:', 'shutdown', 'reboot']

export function isDangerousCommand(cmd) {
  if (SHELL_BLACKLIST.some(p => cmd.includes(p))) return true
  const base = cmd.trim().split(/\s+/)[0]
  return !SHELL_WHITELIST.includes(base)
}
```

---

## 五、可扩展 Tool 注册体系（核心）

### 5.1 设计目标

用户后期只需写一个 Tool 文件并注册，无需改动 Agent 核心。**写代码 → 注册 → 即用**。

### 5.2 注册接口 `tools/registry.js`

```js
// 伪代码示意
import { tool } from 'langchain'
import { z } from 'zod'

const _registry = []

/**
 * 注册一个 Agent 工具
 * @param {Object} opts
 * @param {string} opts.name         工具名（唯一）
 * @param {string} opts.description  工具描述（给 LLM 看）
 * @param {Object} opts.schema       Zod schema，描述参数
 * @param {Function} opts.handler    async ({...args}, ctx) => string
 * @param {Object} [opts.meta]       元信息：{ requireApproval?: boolean, category?: string }
 */
export function registerTool(opts) {
  if (_registry.some(t => t.name === opts.name)) {
    throw new Error(`[Agent] 工具 "${opts.name}" 已注册`)
  }
  _registry.push(opts)
  console.log(`[Agent] 工具已注册: ${opts.name}`)
}

/**
 * 聚合所有注册工具为 LangChain tool 数组（供 createDeepAgent 使用）
 */
export function buildLangChainTools(ctx) {
  return _registry.map(t => tool(
    async (args) => {
      console.log(`[Agent][Tool] ${t.name} 调用, args=`, args)
      const start = Date.now()
      try {
        const result = await t.handler(args, ctx)
        const duration = Date.now() - start
        console.log(`[Agent][Tool] ${t.name} 完成, 耗时 ${duration}ms`)
        // 记录到 agent_tool_logs
        await ctx.db.logToolCall({ toolName: t.name, args, result, status: 'success', durationMs: duration })
        return result
      } catch (e) {
        console.error(`[Agent][Tool] ${t.name} 失败:`, e)
        await ctx.db.logToolCall({ toolName: t.name, args, result: e.message, status: 'failed', durationMs: Date.now() - start })
        throw e
      }
    },
    {
      name: t.name,
      description: t.description,
      schema: t.schema,
    }
  ))
}

/**
 * 构造 interrupt_on 配置：所有 meta.requireApproval=true 的工具自动加入
 */
export function buildInterruptConfig() {
  const cfg = {}
  for (const t of _registry) {
    if (t.meta?.requireApproval) cfg[t.name] = true
  }
  return cfg
}

export function listRegisteredTools() {
  return _registry.map(t => ({ name: t.name, description: t.description, category: t.meta?.category }))
}
```

### 5.3 内置工具清单 `tools/builtin/`

| 文件 | 工具名 | 说明 | requireApproval |
|------|--------|------|----------------|
| `knowledgeBase.js` | `retrieve_knowledge` | 复用 `src-electron/rag/index.js` 的 `searchKnowledgeBase` | false |
| `noteOps.js` | `create_note` / `update_note` / `search_notes` | 调用 `src-electron/db.js` 笔记接口 | true |
| `scheduleOps.js` | `create_event` / `update_event` / `list_events` | 调用 `src-electron/db.js` 日程接口 | true |
| `fileOps.js` | `list_agent_files` / `read_agent_file` / `write_agent_file` | 限定 agent 目录的文件操作 | false（read）/ true（write） |
| `shellExec.js` | `execute_command` | 受限 shell 执行（白名单 + 危险命令审批） | true |

### 5.4 用户注册示例（后期扩展）

用户只需在 `tools/builtin/` 下新增文件，并在 `tools/index.js` 中 import 即可：

```js
// tools/builtin/emailSender.js（用户后期编写）
import { registerTool } from '../registry.js'
import { z } from 'zod'

registerTool({
  name: 'send_email',
  description: '发送邮件给指定收件人。',
  schema: z.object({
    to: z.string().describe('收件人邮箱'),
    subject: z.string().describe('邮件主题'),
    body: z.string().describe('邮件正文'),
  }),
  handler: async ({ to, subject, body }, ctx) => {
    // 调用项目已有邮件接口或外部 API
    // ctx 提供 db / dataDir / mainWindow 等
    return `邮件已发送至 ${to}`
  },
  meta: { requireApproval: true, category: 'communication' },
})
```

```js
// tools/index.js（仅追加一行 import）
import './builtin/knowledgeBase.js'
import './builtin/noteOps.js'
import './builtin/scheduleOps.js'
import './builtin/fileOps.js'
import './builtin/shellExec.js'
import './builtin/emailSender.js'  // ← 用户新增
```

### 5.5 Tool Context（ctx）

`handler(args, ctx)` 中的 `ctx` 提供以下能力：

```js
{
  db,                // src-electron/db.js 实例（直接调用项目持久化层）
  dataDir,           // 项目 userData 目录
  agentRootDir,      // agent 目录绝对路径
  mainWindow,        // Electron 主窗口（可推送事件）
  threadId,          // 当前 Agent 会话 ID
  logger,            // 统一日志器
  emit(event, payload), // 便捷推送 IPC 事件
}
```

---

## 六、IPC 通信与流式响应

### 6.1 IPC 通道清单

新增 IPC 通道（在 `src-electron/agent/ipc.js` 中注册，沿用 `ipcMain.handle` 模式）：

| 通道 | 方向 | 说明 |
|------|------|------|
| `agent-invoke` | 渲染→主 | 发起 Agent 调用（含 message、threadId、model） |
| `agent-stream-chunk` | 主→渲染 | 流式输出分片（订阅 deepagent streamEvents） |
| `agent-tool-call` | 主→渲染 | 工具调用开始通知（前端展示工具气泡） |
| `agent-tool-result` | 主→渲染 | 工具调用结果通知 |
| `agent-tool-approval` | 主→渲染 | 触发人机交互审批 |
| `agent-tool-approval-resume` | 渲染→主 | 用户审批决策回传 |
| `agent-done` | 主→渲染 | Agent 本轮完成 |
| `agent-error` | 主→渲染 | Agent 错误 |
| `agent-stop` | 渲染→主 | 取消当前 Agent 调用 |
| `agent-list-skills` | 渲染→主 | 列出 SKILL 目录下所有 skill |
| `agent-list-tools` | 渲染→主 | 列出已注册工具（供前端展示） |
| `agent-list-threads` | 渲染→主 | 列出历史会话 |
| `agent-get-memory` | 渲染→主 | 读取指定 key 的记忆 |

### 6.2 流式响应实现

复用项目现有 `mainWindow.webContents.send` + `events.js` 事件名常量模式：

```js
// 伪代码示意
export async function invokeAgent(mainWindow, { requestId, threadId, message, model }) {
  const agent = await getOrCreateAgent(model)
  const config = { configurable: { thread_id: threadId } }

  // 订阅 deepagent streamEvents
  const stream = agent.streamEvents(
    { messages: [{ role: 'user', content: message }] },
    { ...config, version: 'v3' }
  )

  for await (const event of stream) {
    if (event.event === 'on_chat_model_stream') {
      // 流式文本分片
      mainWindow.webContents.send('agent-stream-chunk', {
        requestId, threadId, content: event.data.chunk.content
      })
    } else if (event.event === 'on_tool_start') {
      mainWindow.webContents.send('agent-tool-call', {
        requestId, threadId, toolName: event.name, input: event.data.input
      })
    } else if (event.event === 'on_tool_end') {
      mainWindow.webContents.send('agent-tool-result', {
        requestId, threadId, toolName: event.name, output: event.data.output
      })
    } else if (event.event === 'on_interrupt') {
      // 暂停并等待审批
      mainWindow.webContents.send('agent-tool-approval', {
        requestId, threadId,
        interruptId: event.data.interruptId,
        actionRequest: event.data.actionRequests[0],
      })
      // 阻塞等待 resume（通过 Promise 挂起，由 agent-tool-approval-resume 触发 resolve）
    }
  }

  mainWindow.webContents.send('agent-done', { requestId, threadId })
}
```

### 6.3 取消机制

复用项目 `src-electron/cancellation.js` 的 `CancellationTokens` 模式，在 `agent.streamEvents` 迭代中检查 `cancelToken.cancelled`，触发时调用 `agent.stream` 的 abort。

---

## 七、日志策略 `logger.js`

### 7.1 日志规范

- **前缀**：统一 `[Agent]`，子模块加二级前缀（如 `[Agent][Backend]`、`[Agent][Tool]`）
- **级别**：`debug / info / warn / error`
- **关键位置必打**：
  - Agent 创建（`index.js`）：`[Agent] 创建 Agent, model=${model.modelName}, rootDir=${agentRootDir}`
  - 工具注册（`registry.js`）：`[Agent][Tool] 工具已注册: ${name}`
  - 工具调用前后（`registry.js` 包装层）：自动打印 args/result/duration
  - Skill 加载（`skills.js`）：`[Agent][Skill] 加载 ${count} 个 skill`
  - 权限审批（`humanInTheLoop.js`）：`[Agent][HITL] 触发审批, tool=${name}`
  - IPC 调用（`ipc.js`）：`[Agent][IPC] ${channel}, requestId=${requestId}`
  - 错误：`[Agent] 错误: ${error.stack}`

### 7.2 实现

```js
// 伪代码示意
const PREFIX = '[Agent]'

export const logger = {
  debug: (...a) => console.debug(PREFIX, ...a),
  info:  (...a) => console.info(PREFIX, ...a),
  warn:  (...a) => console.warn(PREFIX, ...a),
  error: (...a) => console.error(PREFIX, ...a),
  scope: (tag) => ({
    debug: (...a) => console.debug(`${PREFIX}[${tag}]`, ...a),
    info:  (...a) => console.info(`${PREFIX}[${tag}]`, ...a),
    warn:  (...a) => console.warn(`${PREFIX}[${tag}]`, ...a),
    error: (...a) => console.error(`${PREFIX}[${tag}]`, ...a),
  }),
}
```

> 同时将关键工具调用落库到 `agent_tool_logs` 表，便于后期「改进」能力的数据分析。

---

## 八、前端模块设计

### 8.1 路由集成

在 `src/router/index.js` 中新增：

```js
{
  path: '/knowledge/agent',
  name: 'AgentWorkspace',
  component: () => import('@/views/knowledge/agent/views/AgentWorkspace.vue')
}
```

并在 `KbSidebar.vue` 中，当用户点击「Agent智能体」分类下的项目时跳转至该路由。

### 8.2 组件职责

| 组件 | 职责 |
|------|------|
| `AgentWorkspace.vue` | 主容器，三栏布局：左（会话列表）/ 中（对话区）/ 右（Skill/记忆面板） |
| `AgentChatDialog.vue` | 对话主体，订阅 `agent-stream-chunk` 渲染流式响应；展示工具调用气泡 |
| `AgentMessage.vue` | 单条消息渲染，支持 `user/assistant/tool` 三种角色样式 |
| `ToolApprovalDialog.vue` | 审批弹窗，收到 `agent-tool-approval` 事件时弹出，展示工具名/参数，提供「批准/拒绝/编辑」按钮 |
| `SkillCard.vue` | 展示 SKILL 目录下技能元信息（标题、描述、文件名） |
| `AgentSidebar.vue` | 子侧边栏，切换「会话 / 技能 / 记忆」三个 Tab |

### 8.3 状态管理

通过 `composables/useAgent.js` 管理前端状态：

```js
// 伪代码示意
export function useAgent() {
  const api = window.electronAPI
  const threads = ref([])
  const currentThread = ref(null)
  const messages = ref([])
  const streaming = ref(false)
  const pendingApproval = ref(null)  // 待审批的工具调用

  // 订阅 IPC 事件
  useAgentStream({ messages, streaming })
  useToolApproval({ pendingApproval })

  async function invoke(message) { /* 调用 api.invoke('agent-invoke', {...}) */ }
  async function resumeApproval(decision) { /* 调用 api.invoke('agent-tool-approval-resume', {...}) */ }
  async function stop() { /* 调用 api.invoke('agent-stop', {...}) */ }

  return { threads, currentThread, messages, streaming, pendingApproval, invoke, resumeApproval, stop }
}
```

---

## 九、与现有项目的集成点

### 9.1 复用清单

| 现有模块 | 复用方式 |
|---------|---------|
| `src-electron/llm.js` | `modelAdapter.js` 复用 `buildApiUrl` 逻辑与 provider 差异化参数 |
| `src-electron/db.js` | `memory.js` 直接调用 `queryAllRaw` 新增表；`tools/builtin/noteOps.js` 等调用现有笔记/日程接口 |
| `src-electron/config.js` | 读取用户配置的模型信息 |
| `src-electron/events.js` | 新增 Agent 相关事件常量（`AGENT_*`） |
| `src-electron/cancellation.js` | Agent 取消机制复用 `CancellationTokens` |
| `src-electron/rag/index.js` | `retrieve_knowledge` 工具直接调用 `searchKnowledgeBase` |
| `preload.cjs` | 暴露 `electronAPI.agent.*` 方法 |

### 9.2 改动点

1. **`package.json`**：新增依赖 `deepagents`、`@langchain/openai`、`@langchain/langgraph-checkpoint`、`zod`
2. **`src-electron/db.js`**：`initDatabase` 中追加 `agent_threads/agent_memories/agent_tool_logs` 三张表的 `CREATE TABLE`
3. **`src-electron/commands.js`**：在 `registerCommands` 末尾调用 `registerAgentCommands(mainWindow)`（来自 `agent/ipc.js`）
4. **`src-electron/events.js`**：追加 `AGENT_STREAM_CHUNK`/`AGENT_TOOL_CALL`/`AGENT_TOOL_RESULT`/`AGENT_TOOL_APPROVAL`/`AGENT_DONE`/`AGENT_ERROR` 常量
5. **`preload.cjs`**：在 `electronAPI` 上挂载 `agent` 子对象
6. **`src/router/index.js`**：新增 `/knowledge/agent` 路由
7. **`src/views/knowledge/constants/index.js`**：`DEFAULT_CATEGORIES` 中已有 `agent` 分类与 `SKILL/沙盒区` 预设，无需改动

---

## 十、安全与约束

### 10.1 沙箱边界

- **文件系统**：`FilesystemBackend.rootDir = {userData}/knowledge/agent/`，超出此目录的路径操作由 `FilesystemBackend` 自身拒绝
- **Shell 执行**：`execute` 工具仅允许白名单命令；危险命令强制 HITL 审批；`cwd` 锁定为 `沙盒区/`
- **网络**：默认不提供 `web_search/fetch_url` 工具；如需联网能力，由用户显式注册并提供 API Key

### 10.2 危险命令人机交互流程

```
LLM 调用 execute_command({ command: 'rm -rf 沙盒区/old' })
        ↓
registry.js 包装层检测 isDangerousCommand('rm -rf 沙盒区/old') === true
        ↓
deepagent interrupt_on.execute 触发暂停
        ↓
主进程推送 'agent-tool-approval' 事件 → 渲染进程弹窗
        ↓
用户决策：
  - approve → resume with { type: 'approve' }
  - reject  → resume with { type: 'reject', reason: '用户拒绝' }
  - edit    → resume with { type: 'edit', editedAction: { args: { command: 'rm -rf 沙盒区/old_backup' } } }
```

### 10.3 与 RAG 知识库的隔离

- Agent 智能体目录（`kbCategoryId === 'agent'`）不参与向量化（沿用 `commands.js` 中的 `isAgentKb` 判断）
- `retrieve_knowledge` 工具检索范围限定为 `personal/local` 知识库，不检索 `agent` 目录
- Zvec 共享 collection 中 `kb_type` 不包含 `agent`，符合项目硬约束

---

## 十一、实施路线（建议）

> 仅作设计参考，不包含时间估算。

### 阶段 1：基础设施
- 安装依赖、新增 `src-electron/agent/` 骨架
- 实现 `logger.js` / `modelAdapter.js` / `backend.js` / `permissions.js`
- 在 `db.js` 中新增三张表

### 阶段 2：Agent 核心
- 实现 `index.js`（`createDeepAgent` 装配）
- 实现 `skills.js` / `memory.js` / `subagents.js`
- 实现 `tools/registry.js` + 5 个内置工具
- 实现 `ipc.js` 与 `humanInTheLoop.js`

### 阶段 3：前端 UI
- 实现 `AgentWorkspace.vue` 及子组件
- 接入流式响应与审批弹窗
- 路由与 `KbSidebar` 联动

### 阶段 4：扩展与优化
- 补充 Skill 示例文件
- 完善 `tools/README.md` 注册指南
- 接入 `agent_tool_logs` 审计面板

---

## 十二、附录

### 12.1 DeepAgent SDK 关键 API 速查

| API | 用途 |
|-----|------|
| `createDeepAgent({ model, tools, backend, skills, permissions, interruptOn, subagents, checkpointer })` | 创建主 Agent |
| `agent.streamEvents(input, config)` | 流式订阅事件 |
| `agent.invoke(new Command({ resume }), config)` | 恢复 HITL |
| `CompositeBackend(default, routes)` | 路由多后端 |
| `FilesystemBackend({ rootDir, virtualMode })` | 本地磁盘后端 |
| `StoreBackend({ namespace })` | 跨会话存储后端 |
| `FilesystemPermission({ operations, paths, mode })` | 权限规则 |
| `tool(fn, { name, description, schema })` | 定义 LangChain 工具 |

### 12.2 项目模型 provider 适配表

| provider | baseUrl 拼接 | 思考参数 |
|----------|-------------|---------|
| `qwen` | `{baseUrl}/chat/completions` | `enable_thinking` |
| `minimax` | `{baseUrl}/chat/completions` | `reasoning_split` |
| `deepseek/zhipu/kimi/doubao` | `{baseUrl}/chat/completions` | `thinking: { type }` |
| `other` | `{baseUrl}`（完整 URL） | 不发送 |

### 12.3 参考文档

- Deep Agents JS Backends: https://docs.langchain.com/oss/javascript/deepagents/backends
- Deep Agents JS Customization: https://docs.langchain.com/oss/javascript/deepagents/customization
- Deep Agents JS Skills: https://docs.langchain.com/oss/javascript/deepagents/skills
- Deep Agents JS Subagents: https://docs.langchain.com/oss/javascript/deepagents/subagents
- Deep Agents JS Human-in-the-loop: https://docs.langchain.com/oss/javascript/deepagents/human-in-the-loop
- Deep Agents JS Permissions: https://docs.langchain.com/oss/javascript/deepagents/permissions
- Deep Agents JS Memory: https://docs.langchain.com/oss/javascript/deepagents/memory
- Deep Agents JS Overview: https://docs.langchain.com/oss/javascript/deepagents/overview
