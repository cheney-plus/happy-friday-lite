# Agent 内置工具文档

本文档列出 Agent 智能体当前注册的所有内置工具，供开发与排查参考。

## 概览

| 工具名 | 类别 | 是否需审批 | 实现文件 | 一句话功能 |
| --- | --- | --- | --- | --- |
| `retrieve_knowledge` | knowledge | 否 | [builtin/knowledgeBase.js](./builtin/knowledgeBase.js) | 从个人/本地知识库 RAG 检索 |
| `search_notes` | note | 否 | [builtin/noteOps.js](./builtin/noteOps.js) | 按关键词搜索用户笔记 |
| `get_note` | note | 否 | [builtin/noteOps.js](./builtin/noteOps.js) | 按 ID 获取笔记完整内容 |
| `create_note` | note | **是** | [builtin/noteOps.js](./builtin/noteOps.js) | 创建新笔记 |
| `list_events` | schedule | 否 | [builtin/scheduleOps.js](./builtin/scheduleOps.js) | 列出日程（可按日期范围） |
| `create_event` | schedule | **是** | [builtin/scheduleOps.js](./builtin/scheduleOps.js) | 创建新日程 |
| `list_agent_files` | file | 否 | [builtin/fileOps.js](./builtin/fileOps.js) | 列出 Agent 沙盒目录 |
| `read_agent_file` | file | 否 | [builtin/fileOps.js](./builtin/fileOps.js) | 读取 Agent 沙盒文件 |
| `write_agent_file` | file | **是** | [builtin/fileOps.js](./builtin/fileOps.js) | 写入 Agent 沙盒文件 |

**审批工具共 3 个**：`create_note`、`create_event`、`write_agent_file`。这些工具会修改用户数据，触发 HITL 弹窗（[ToolApprovalDialog](../../components/chat/ToolApprovalDialog.vue)），用户批准后才会真正执行。

---

## 1. retrieve_knowledge

**类别**：knowledge  
**审批**：否  
**实现**：[builtin/knowledgeBase.js](./builtin/knowledgeBase.js)

**描述**：从用户的个人知识库（personal）和本地知识库（local）中检索相关文档、笔记或文件内容。当问题涉及用户私有资料、笔记内容、已上传文档时调用。**不会检索 Agent 工作区内容**（项目硬约束：agent 目录不参与向量化）。返回检索到的文本片段及来源信息。

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `query` | string | 是 | 用于在知识库中检索的查询文本，应是凝练后的检索关键词或问题 |
| `kbName` | string | 否 | 指定在哪个知识库中检索（如"我的笔记"、"我的书籍"）。留空检索全部 |

**返回**：格式化的检索片段列表，每条包含序号、置信度、来源、内容；无结果时返回"未在知识库中检索到相关内容。"

**调用链路**：`handler` → `import('../../../rag/index.js')` → `searchKnowledgeBase(query, kbName, '', 5, 0.5, '')`

**注意事项**：
- 相对路径推算：本文件位于 `src-electron/agent/tools/builtin/`，需回到 `src-electron/` 下找 `rag/`，故用 `../../../rag/`
- 检索范围由 `searchKnowledgeBase` 内部按 `kb_type` 标量过滤，仅命中 `personal` 与 `local`

---

## 2. search_notes

**类别**：note  
**审批**：否  
**实现**：[builtin/noteOps.js](./builtin/noteOps.js)

**描述**：在用户的所有笔记中按关键词搜索。返回匹配的笔记列表（标题和摘要）。不会修改笔记。

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `query` | string | 是 | 搜索关键词 |

**返回**：最多 10 条笔记，每条包含 ID、标题、100 字摘要；无结果时返回"未找到匹配的笔记。"

**实现要点（查询增强）**：
- `db.searchNotes` 内部使用 `LIKE '%query%'` 整串匹配，LLM 经常会在中文之间插入空格（如 "教师张三" → "教师 张三"），导致 LIKE 匹配失败
- 本工具对 query 做分词增强：
  1. 按空格/逗号/顿号/分号切分为多个 token
  2. 对原始 query + 各 token 分别调用 `db.searchNotes`
  3. 按 `note.id` 合并去重
- 这样既能命中"教师张三"（无空格），也能命中只含"张三"或"教师"的笔记

**日志**：
```
[Agent][Note] 搜索笔记: query="教师 张三"
[Agent][Note] 搜索笔记: 分词=["教师 张三","教师","张三"]
[Agent][Note] 搜索笔记: q="教师 张三" 命中 0 条
[Agent][Note] 搜索笔记: q="教师" 命中 X 条
[Agent][Note] 搜索笔记: q="张三" 命中 Y 条
[Agent][Note] 找到 Z 条笔记（去重后）
```

---

## 3. get_note

**类别**：note  
**审批**：否  
**实现**：[builtin/noteOps.js](./builtin/noteOps.js)

**描述**：按笔记 ID 获取笔记完整内容。需要先通过 `search_notes` 拿到笔记 ID。

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `noteId` | string | 是 | 笔记 ID |

**返回**：`标题: xxx\n\n内容:\nxxx`；未找到时返回"未找到笔记: {noteId}"

**调用链路**：`ctx.db.getNote(noteId)`

---

## 4. create_note

**类别**：note  
**审批**：**是**（会修改用户数据）  
**实现**：[builtin/noteOps.js](./builtin/noteOps.js)

**描述**：创建一篇新笔记并保存到用户的笔记库。适用于用户要求"记笔记"、"保存到笔记"等场景。

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 笔记标题 |
| `content` | string | 是 | 笔记正文内容（Markdown 格式） |

**返回**：`笔记已创建成功。\nID: xxx\n标题: xxx`

**调用链路**：`ctx.db.importNote(null, null, title, content, content)`
- 第 1 个 `null`：`knowledgeBaseId`（不归属任何知识库）
- 第 2 个 `null`：`notebookId`（不归属任何笔记本）
- 第 3 个参数 `content`：HTML 内容（这里直接传 Markdown，后续可考虑转换）
- 第 4 个参数 `content`：纯文本内容

---

## 5. list_events

**类别**：schedule  
**审批**：否  
**实现**：[builtin/scheduleOps.js](./builtin/scheduleOps.js)

**描述**：列出用户在指定日期范围内的日程安排。不传日期则返回所有日程。用于查询用户的日程、会议、提醒等。

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `startDate` | string | 否 | 开始日期（YYYY-MM-DD） |
| `endDate` | string | 否 | 结束日期（YYYY-MM-DD） |

**返回**：最多 20 条日程，每条包含日期、时间、标题、是否完成、描述；无结果时返回"该时间范围内没有日程安排。"

**调用链路**：
- 同时传 `startDate` 和 `endDate`：`ctx.db.getScheduleEventsByDateRange(start, end)`
- 否则：`ctx.db.getScheduleEvents()`（全部日程）

---

## 6. create_event

**类别**：schedule  
**审批**：**是**（会修改用户数据）  
**实现**：[builtin/scheduleOps.js](./builtin/scheduleOps.js)

**描述**：创建一个新的日程安排并保存到用户的日历。适用于用户要求"添加日程"、"安排会议"、"设置提醒"等场景。

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 日程标题 |
| `startDate` | string | 是 | 开始日期（YYYY-MM-DD） |
| `endDate` | string | 是 | 结束日期（YYYY-MM-DD），单日日程则与 startDate 相同 |
| `startTime` | string | 否 | 开始时间（HH:mm），全天日程留空 |
| `endTime` | string | 否 | 结束时间（HH:mm），全天日程留空 |
| `allDay` | boolean | 否 | 是否全天日程 |
| `description` | string | 否 | 日程描述/备注 |

**返回**：`日程已创建成功。\nID: xxx\n标题: xxx\n日期: xxx (全天/HH:mm-HH:mm)`

**调用链路**：`ctx.db.createScheduleEvent({ title, startDate, endDate, startTime, endTime, allDay, description })`

---

## 7. list_agent_files

**类别**：file  
**审批**：否  
**实现**：[builtin/fileOps.js](./builtin/fileOps.js)

**描述**：列出 Agent 工作区（沙盒）中指定目录下的文件和子目录。不传路径则列出根目录。Agent 工作区是 Agent 自己的文件系统，与用户的知识库隔离。

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `dirPath` | string | 否 | 相对路径（如 `""` 表示根目录，`"沙盒区"` 表示沙盒区子目录） |

**返回**：`目录 xxx 内容：\n[目录] xxx\n[文件 123B] xxx`；目录不存在/为空时返回相应提示

**沙盒边界**：所有路径在 `resolveSafePath` 中校验，必须位于 `{userData}/knowledge/agent/` 之内，防止 `..` 路径穿越。

---

## 8. read_agent_file

**类别**：file  
**审批**：否  
**实现**：[builtin/fileOps.js](./builtin/fileOps.js)

**描述**：读取 Agent 工作区（沙盒）中指定文件的内容。仅能读取 Agent 工作区内文件。

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `filePath` | string | 是 | 文件相对路径（如 `"沙盒区/notes.md"`） |

**返回**：文件原始文本内容；错误情况返回"文件不存在/路径是目录/文件过大/读取失败"等提示

**限制**：
- 单文件大小上限 **10MB**，超过则拒绝读取
- 路径必须是文件，不能是目录

---

## 9. write_agent_file

**类别**：file  
**审批**：**是**（会修改文件）  
**实现**：[builtin/fileOps.js](./builtin/fileOps.js)

**描述**：向 Agent 工作区（沙盒）写入或覆盖文件。适用于 Agent 保存工作成果、记录中间产物等场景。如果父目录不存在会自动创建。

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `filePath` | string | 是 | 文件相对路径（如 `"沙盒区/notes.md"`） |
| `content` | string | 是 | 要写入的文件内容 |

**返回**：`文件已写入成功: xxx`；失败时返回"写入文件失败: xxx"

**调用链路**：
1. `resolveSafePath` 校验路径在沙盒内
2. `path.dirname` 取父目录，`fs.mkdirSync(parentDir, { recursive: true })` 自动创建
3. `fs.writeFileSync(absPath, content, 'utf-8')` 写入

---

## 工具注册机制

### 注册 API

工具通过 [registry.js](./registry.js) 暴露的 `registerTool` 函数注册：

```js
registerTool({
  name: 'tool_name',           // 工具唯一名（LLM 调用时使用）
  description: '...',           // 工具描述（LLM 据此决定是否调用）
  parameters: {                 // JSON Schema 描述参数
    type: 'object',
    properties: { ... },
    required: [...]
  },
  meta: {
    requireApproval: false,     // 是否需要 HITL 审批
    category: 'note'            // 工具类别，用于分组
  },
  handler: async (args, ctx) => {
    // args: LLM 传来的参数对象
    // ctx: Agent 上下文，包含 { db, dataDir, agentRootDir, threadId, mainWindow, logger }
    return '工具执行结果字符串'
  }
})
```

### 自动聚合

[tools/index.js](./index.js) 通过 side-effect import 自动加载所有 `builtin/` 下的工具模块：

```js
import './builtin/knowledgeBase.js'
import './builtin/noteOps.js'
import './builtin/scheduleOps.js'
import './builtin/fileOps.js'
```

### 添加新工具的步骤

1. 在 `src-electron/agent/tools/builtin/` 下新建文件（或追加到已有文件）
2. 在文件中 `import { registerTool } from '../registry.js'` 并调用 `registerTool({...})`
3. 在 [tools/index.js](./index.js) 中添加 `import './builtin/yourNewFile.js'`
4. 重启 Electron 主进程，新工具会自动出现在 `agent-list-tools` 返回列表中

### 审批流程（HITL）

1. Agent Loop 调用工具前检查 `meta.requireApproval`
2. 若需审批，通过 `agent-tool-approval` 事件发送工具名+参数到前端
3. 前端弹出 [ToolApprovalDialog](../../components/chat/ToolApprovalDialog.vue)
4. 用户批准 → 前端调用 `agent-tool-approval-resume` IPC，决策 `{ type: 'approve' }`
5. 用户拒绝 → 决策 `{ type: 'reject', reason: '...' }`，工具跳过执行，Agent 收到拒绝原因

---

## 共享上下文（ctx）

所有工具 handler 接收的 `ctx` 对象包含：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `db` | object | `src-electron/db.js` 导出的数据库接口（`searchNotes`、`getNote`、`importNote`、`getScheduleEvents` 等） |
| `dataDir` | string | 应用数据目录绝对路径（`{userData}` 或 dev 下的 `app-data`） |
| `agentRootDir` | string | Agent 沙盒根目录，`{dataDir}/knowledge/agent/` |
| `threadId` | string | 当前会话 ID（对应 `sessions` 表的 id） |
| `mainWindow` | BrowserWindow | Electron 主窗口，用于发送事件到渲染进程 |
| `logger` | object | Agent 统一日志器，建议用 `logger.scope('XXX')` 创建子作用域 |

---

## 相关文件索引

- 工具注册中心：[registry.js](./registry.js)
- 工具聚合入口：[index.js](./index.js)
- Agent 主循环：[agent/index.js](../index.js)
- IPC 处理：[agent/ipc.js](../ipc.js)
- 日志模块：[agent/logger.js](../logger.js)
- 设计文档：[Agent智能体设计.md](../../../views/knowledge/agent/Agent智能体设计.md)
