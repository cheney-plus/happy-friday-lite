# Agent 智能体设计（后端）

> 基于 LangChain Deep Agents SDK（JS 版），为知识库模块打造一个**简单、核心、可扩展**的 Agent 智能体。
> 本文档仅描述需求、设计决策与任务计划，不含具体实现代码。

---

## 一、需求

### 1.1 核心诉求

1. **引入 DeepAgent 框架**：在 `src-electron/agent/` 中实现统一 Agent 调用入口
2. **权限沙箱**：大模型只能操作 `{userData}/knowledge/agent/` 目录内的文件与执行指令
3. **本地磁盘后端**：采用 `FilesystemBackend`（本地磁盘）作为文件系统后端
4. **人机交互**：危险命令（写入/删除/shell 执行等）需用户审批后才执行
5. **自动加载 Skill**：自动读取 `agent/SKILL/` 目录下的 `.md` 文件作为技能
6. **可扩展 Tool 注册**：用户后期只需写一个 Tool 文件并注册即可使用，无需改动核心代码
7. **日志与注释**：关键位置打印日志，代码加中文注释
8. **记忆持久化**：参考项目已有 SQLite 实现（`src-electron/db.js`），跨会话持久化记忆
9. **复用项目大模型**：对接 `src-electron/llm.js` 中已有的 provider 配置（qwen/deepseek/zhipu/kimi/doubao/minimax/other）

### 1.2 DeepAgent 内置能力对应

| DeepAgent 能力 | 本设计落点 |
|---------------|----------|
| Take actions（工具/文件/代码执行） | `FilesystemBackend` + 自定义 Tool 调用项目接口 |
| Connect to data（记忆/技能/领域知识） | `SkillsMiddleware` 自动加载 SKILL 目录 + SQLite 持久化记忆 |
| Manage growing context（摘要/卸载） | DeepAgent 内置 `compact_conversation` 工具 + offload 落盘 |
| Parallelize tasks（派发子 Agent） | DeepAgent 内置 `task` 工具与 subagents 配置 |
| Stay in the loop（人机审批） | `interrupt_on` + IPC 推送 + 渲染进程弹窗审批 |
| Improve over time（记忆/技能/提示改进） | `/memories/` 路径写入 + `AGENTS.md` 全局指令 |

### 1.3 范围边界

- 仅设计**后端**（`src-electron/agent/`），不含前端 UI
- Agent 仅服务于全局对话（`FridayChat.vue`中的 Agent 模式）
- Agent 智能体目录（`kbCategoryId === 'agent'`）不参与向量化与 RAG 检索（沿用项目硬约束）

---

## 二、设计决策

### 2.1 整体架构

```
渲染进程 (Vue)
    │  IPC (preload.cjs)
    ▼
主进程 (Electron)
┌─────────────────────────────────────────┐
│  src-electron/agent/                     │
│    index.js        ← Agent 创建入口      │
│    backend.js      ← 后端装配            │
│    permissions.js  ← 权限规则            │
│    modelAdapter.js ← 模型适配            │
│    skills.js       ← Skill 加载          │
│    memory.js       ← 记忆持久化          │
│    humanInTheLoop.js ← 审批处理          │
│    ipc.js          ← IPC 通道            │
│    logger.js       ← 日志                │
│    tools/          ← 可扩展工具集        │
│      registry.js   ← 注册中心            │
│      builtin/      ← 内置工具            │
└─────────────────────────────────────────┘
    │  复用
    ▼
src-electron/llm.js / db.js / config.js / rag/
    │
    ▼
本地磁盘 {userData}/knowledge/agent/
```

**关键决策**：
- Agent 引擎**运行在主进程**：直接访问 `fs` / `db` / 现有 LLM 实现，避免渲染进程阻塞
- **沙箱边界 = `rootDir`**：`FilesystemBackend.rootDir` 锁定为 `{userData}/knowledge/agent/`
- **模型复用项目配置**：通过 `modelAdapter.js` 把用户在「设置→模型」中配置的 provider/baseUrl/apiKey/modelName 适配为 LangChain `BaseChatModel`

### 2.2 后端装配 `backend.js`

采用 `CompositeBackend` 路由，分离「项目文件」「跨会话记忆」：

| 路径前缀 | 后端 | 用途 | 持久化 |
|---------|------|------|--------|
| `/memories/` | `StoreBackend` | 跨会话记忆 | SQLite `agent_memories` 表 |
| 其他 | `FilesystemBackend` | Agent 工作文件、SKILL、沙盒区 | 本地磁盘 |
| 内部 offload | `StateBackend`（默认） | `conversation_history`、tool 结果 | langgraph checkpointer |

**决策**：`FilesystemBackend.virtualMode = false`，直接读写本地磁盘（满足「文件系统后端本地磁盘实现」诉求）。

### 2.3 权限规则 `permissions.js`

通过 `FilesystemPermission` 细粒度控制：

| 路径 | 读 | 写 | 说明 |
|------|---|---|------|
| `/SKILL/**` | allow | **interrupt** | Skill 写入需审批，防止 Agent 篡改技能 |
| `/沙盒区/**` | allow | allow | Agent 工作区，自由读写 |
| `/memories/**` | allow | allow | Agent 自我成长 |
| `/AGENTS.md` | allow | **interrupt** | 全局指令修改需审批 |
| 其他 | 默认拒绝 | 默认拒绝 | `FilesystemBackend` 默认行为 |

### 2.4 模型适配 `modelAdapter.js`

复用项目 `src-electron/llm.js` 中已有的 provider 配置。所有 provider 均走 OpenAI 兼容协议，直接用 `ChatOpenAI` 透传 `baseUrl/apiKey/modelName`，并通过 `model.bind()` 注入思考模式差异化参数（`enable_thinking`/`thinking`/`reasoning_split`）。

### 2.5 Skills 加载 `skills.js`

- `skills=["/SKILL/"]` 传给 `createDeepAgent`，由 `SkillsMiddleware` 自动扫描 `.md` 文件
- 维护 `_index.json` 索引文件供前端展示
- SKILL 目录已在前端 `DEFAULT_CATEGORIES` 预留（`{ id: 'rag-thinking', name: 'SKILL', protected: true }`）

**Skill 文件约定**：Markdown 格式，首行 `# 标题`，第二行 `> 描述`，后续为工作流程与输出格式说明。

### 2.6 记忆持久化 `memory.js`

参考项目 SQLite 实现，新增三张表：

| 表 | 用途 |
|----|------|
| `agent_threads` | Agent 会话（与 `sessions` 表独立，避免污染对话历史） |
| `agent_memories` | 跨会话记忆（与 `StoreBackend` 双向同步） |
| `agent_tool_logs` | 工具调用审计日志（「改进」能力的数据源） |

**同步策略**：`StoreBackend` 在主进程内为 `InMemoryStore`，`memory.js` 在 `agent.invoke` 前后做 `load → put` 双向同步，确保记忆落 SQLite。

### 2.7 子 Agent `subagents.js`

预置一个通用「researcher」子 Agent 用于并行调研。用户可在 `subagents.js` 中追加自定义子 Agent，无需改动核心代码。

### 2.8 人机交互 `humanInTheLoop.js`

流程：
```
LLM 调用危险工具 → DeepAgent interrupt 暂停 → IPC 推送审批事件
→ 渲染进程弹窗 → 用户 approve/reject/edit → IPC 回传决策
→ 构造 Command({ resume }) → Agent 恢复执行
```

**危险命令识别**（针对 `execute` 工具）：
- 白名单：`ls/cat/pwd/echo/grep/find/wc/head/tail` 等只读命令
- 黑名单：`rm -rf /`、`mkfs`、`dd if=`、`shutdown` 等
- 不在白名单的命令默认触发审批

### 2.9 可扩展 Tool 注册体系 `tools/registry.js`（核心）

**目标**：写代码 → 注册 → 即用，无需改动 Agent 核心。

**注册接口** `registerTool({ name, description, schema, handler, meta })`：
- `name`：工具名（唯一）
- `description`：给 LLM 看的描述
- `schema`：Zod schema 描述参数
- `handler`：`async (args, ctx) => string`，执行逻辑
- `meta.requireApproval`：是否需要人机审批（自动加入 `interrupt_on`）

**聚合接口**：
- `buildLangChainTools(ctx)`：把所有注册项转为 LangChain tool 数组，并自动包装日志与审计
- `buildInterruptConfig()`：自动收集 `requireApproval=true` 的工具生成 `interrupt_on` 配置

**Tool Context（ctx）** 提供：
- `db`：`src-electron/db.js` 实例
- `dataDir` / `agentRootDir`：项目目录
- `mainWindow`：Electron 主窗口
- `threadId`：当前会话 ID
- `logger`：统一日志器
- `emit(event, payload)`：便捷推送 IPC 事件

**内置工具清单**：

| 工具名 | 说明 | requireApproval |
|-------|------|----------------|
| `retrieve_knowledge` | 调用 `rag/index.js` 检索知识库 | false |
| `create_note` / `update_note` / `search_notes` | 调用 `db.js` 笔记接口 | true |
| `create_event` / `update_event` / `list_events` | 调用 `db.js` 日程接口 | true |
| `list_agent_files` / `read_agent_file` / `write_agent_file` | 限定 agent 目录的文件操作 | read=false / write=true |
| `execute_command` | 受限 shell 执行（白名单 + 危险审批） | true |

**用户扩展方式**：
1. 在 `tools/builtin/` 下新增文件，调用 `registerTool()`
2. 在 `tools/index.js` 中追加一行 `import './builtin/xxx.js'`
3. 完成，Agent 启动时自动加载

### 2.10 IPC 通信 `ipc.js`

沿用项目 `ipcMain.handle` + `mainWindow.webContents.send` 模式：

| 通道 | 方向 | 说明 |
|------|------|------|
| `agent-invoke` | 渲染→主 | 发起 Agent 调用 |
| `agent-stream-chunk` | 主→渲染 | 流式输出分片 |
| `agent-tool-call` / `agent-tool-result` | 主→渲染 | 工具调用通知 |
| `agent-tool-approval` | 主→渲染 | 触发审批 |
| `agent-tool-approval-resume` | 渲染→主 | 审批决策回传 |
| `agent-done` / `agent-error` | 主→渲染 | 完成/错误 |
| `agent-stop` | 渲染→主 | 取消当前调用 |
| `agent-list-skills` / `agent-list-tools` / `agent-list-threads` | 渲染→主 | 元信息查询 |

**流式响应**：订阅 `agent.streamEvents`，按 `on_chat_model_stream` / `on_tool_start` / `on_tool_end` / `on_interrupt` 分发到上述通道。

**取消机制**：复用项目 `src-electron/cancellation.js` 的 `CancellationTokens`。

### 2.11 日志策略 `logger.js`

- **前缀**：统一 `[Agent]`，子模块加二级前缀（如 `[Agent][Tool]`、`[Agent][HITL]`）
- **关键位置必打**：
  - Agent 创建：model、rootDir
  - 工具注册：工具名
  - 工具调用前后：自动打印 args/result/duration（由 `registry.js` 包装层统一处理）
  - Skill 加载：数量
  - 权限审批：工具名
  - IPC 调用：通道名、requestId
  - 错误：error.stack
- 关键工具调用同时落库到 `agent_tool_logs` 表，便于后期审计与「改进」能力

---

## 三、与现有项目的集成

### 3.1 复用清单

| 现有模块 | 复用方式 |
|---------|---------|
| `src-electron/llm.js` | `modelAdapter.js` 复用 `buildApiUrl` 与 provider 差异化参数 |
| `src-electron/db.js` | `memory.js` 直接调用 `queryAllRaw` 新增表；工具直接调用笔记/日程接口 |
| `src-electron/config.js` | 读取用户配置的模型信息 |
| `src-electron/events.js` | 新增 `AGENT_*` 事件常量 |
| `src-electron/cancellation.js` | Agent 取消机制复用 `CancellationTokens` |
| `src-electron/rag/index.js` | `retrieve_knowledge` 工具直接调用 `searchKnowledgeBase` |

### 3.2 改动点

1. `package.json`：新增依赖 `deepagents`、`@langchain/openai`、`@langchain/langgraph-checkpoint`、`zod`
2. `src-electron/db.js`：`initDatabase` 中追加 `agent_threads/agent_memories/agent_tool_logs` 三张表
3. `src-electron/commands.js`：在 `registerCommands` 末尾调用 `registerAgentCommands(mainWindow)`
4. `src-electron/events.js`：追加 `AGENT_*` 事件常量
5. `preload.cjs`：在 `electronAPI` 上挂载 `agent` 子对象

---

## 四、安全约束

1. **沙箱边界**：`FilesystemBackend.rootDir` 锁定，超出路径由后端自身拒绝
2. **Shell 执行**：仅允许白名单命令；危险命令强制审批；`cwd` 锁定为 `沙盒区/`
3. **网络**：默认不提供 `web_search/fetch_url`；如需联网由用户显式注册并提供 API Key
4. **RAG 隔离**：Agent 目录不参与向量化，`retrieve_knowledge` 工具检索范围限定为 `personal/local` 知识库，符合项目硬约束

---

## 五、任务计划

> 仅作设计参考，按依赖顺序排列，不含时间估算。

### 阶段 1：基础设施
- [ ] T1.1 安装依赖：`deepagents` / `@langchain/openai` / `@langchain/langgraph-checkpoint` / `zod`
- [ ] T1.2 实现 `logger.js`（统一日志前缀与级别）
- [ ] T1.3 实现 `modelAdapter.js`（项目模型 → LangChain ChatModel，含思考模式适配）
- [ ] T1.4 在 `db.js` 中新增 `agent_threads/agent_memories/agent_tool_logs` 三张表
- [ ] T1.5 在 `events.js` 中追加 `AGENT_*` 事件常量

### 阶段 2：Agent 核心
- [ ] T2.1 实现 `backend.js`（CompositeBackend 装配：FilesystemBackend + StoreBackend）
- [ ] T2.2 实现 `permissions.js`（SKILL/沙盒区/memories/AGENTS.md 权限规则）
- [ ] T2.3 实现 `skills.js`（SKILL 目录扫描 + `_index.json` 索引生成）
- [ ] T2.4 实现 `memory.js`（三张表的 CRUD + StoreBackend 双向同步）
- [ ] T2.5 实现 `subagents.js`（预置 researcher 子 Agent）
- [ ] T2.6 实现 `humanInTheLoop.js`（interrupt 捕获 + Command resume）
- [ ] T2.7 实现 `index.js`（`createDeepAgent` 装配入口）

### 阶段 3：可扩展工具体系
- [ ] T3.1 实现 `tools/registry.js`（registerTool / buildLangChainTools / buildInterruptConfig）
- [ ] T3.2 实现 5 个内置工具：
  - [ ] T3.2.1 `knowledgeBase.js`（retrieve_knowledge）
  - [ ] T3.2.2 `noteOps.js`（create/update/search_notes）
  - [ ] T3.2.3 `scheduleOps.js`（create/update/list_events）
  - [ ] T3.2.4 `fileOps.js`（list/read/write_agent_files）
  - [ ] T3.2.5 `shellExec.js`（execute_command + 白名单/黑名单）
- [ ] T3.3 实现 `tools/index.js`（聚合 import 所有 builtin 工具）
- [ ] T3.4 编写 `tools/README.md`（用户注册新 Tool 指南）

### 阶段 4：IPC 与集成
- [ ] T4.1 实现 `ipc.js`（注册所有 IPC 通道 + 流式响应分发）
- [ ] T4.2 在 `commands.js` 中调用 `registerAgentCommands(mainWindow)`
- [ ] T4.3 更新 `preload.cjs` 暴露 `electronAPI.agent.*`
- [ ] T4.4 端到端联调：发起调用 → 流式输出 → 工具调用 → 审批 → 完成

### 阶段 5：完善与扩展
- [ ] T5.1 编写示例 Skill 文件（research.md / summarize.md）
- [ ] T5.2 编写 `AGENTS.md` 全局指令（项目约定与约束）
- [ ] T5.3 完善代码中文注释与关键位置日志
- [ ] T5.4 接入 `agent_tool_logs` 审计能力（供后期「改进」使用）

---

## 六、附录

### 6.1 DeepAgent SDK 关键 API 速查

| API | 用途 |
|-----|------|
| `createDeepAgent({ model, tools, backend, skills, permissions, interruptOn, subagents, checkpointer })` | 创建主 Agent |
| `agent.streamEvents(input, config)` | 流式订阅事件 |
| `agent.invoke(new Command({ resume }), config)` | 恢复 HITL |
| `CompositeBackend(default, routes)` | 路由多后端 |
| `FilesystemBackend({ rootDir, virtualMode })` | 本地磁盘后端 |
| `StoreBackend({ namespace })` | 跨会话存储后端 |
| `FilesystemPermission({ operations, paths, mode })` | 权限规则（mode: allow/deny/interrupt） |

### 6.2 参考文档

- Deep Agents JS Backends: https://docs.langchain.com/oss/javascript/deepagents/backends
- Deep Agents JS Skills: https://docs.langchain.com/oss/javascript/deepagents/skills
- Deep Agents JS Subagents: https://docs.langchain.com/oss/javascript/deepagents/subagents
- Deep Agents JS Human-in-the-loop: https://docs.langchain.com/oss/javascript/deepagents/human-in-the-loop
- Deep Agents JS Permissions: https://docs.langchain.com/oss/javascript/deepagents/permissions
- Deep Agents JS Overview: https://docs.langchain.com/oss/javascript/deepagents/overview
