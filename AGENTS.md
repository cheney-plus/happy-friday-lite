# AGENTS.md

面向 AI 编码助手的项目指南。修改本仓库前请先阅读本文件。

## 项目概述

Happy Friday Lite —— 基于 Electron 42 + Vue 3 的桌面端个人知识智能助手，集成 AI Agent（Friday）、RAG 知识检索、富文本笔记、绘图、日程日历、Office 套件。所有数据本地存储。

- 技术栈：Electron 42 / Vue 3 / Vite 6 / Pinia / LangChain + DeepAgents / Zvec 向量库 / sql.js (SQLite)
- 语言：纯 JavaScript（无 TypeScript），ESM 为主
- Node >= 20（推荐 22），npm >= 10

## 常用命令

```bash
# 安装依赖（必须带 --legacy-peer-deps，否则安装失败）
npm install --legacy-peer-deps

# 仅前端开发（Vite，端口 5173）
npm run dev

# Electron + 前端联调（完整应用）
npm run electron:dev

# 前端构建验证（改完代码至少跑这个确认可编译）
npm run build

# 运行测试（node:test，无 npm test 脚本）
node --test scripts/tests/
node --test scripts/*.test.cjs

# 构建安装包（macOS arm64 示例，产物在 release/）
npm run electron:build:mac
```

无 ESLint/Prettier 配置，请遵循现有代码风格：2 空格缩进、单引号、无分号。

## 架构

双进程模型，边界必须清晰：

```
渲染进程 (src/)                    主进程 (main.js + src-electron/)
┌──────────────────┐   preload    ┌─────────────────────────────┐
│ Vue 3 SPA        │◄──preload.cjs◄┤ ipcMain.handle 注册各域命令  │
│ src/views/       │  window.     │ src-electron/               │
│ src/store/       │  electronAPI │ ├── agent/  Friday 智能体   │
│ src/services/    │              │ ├── rag/    RAG 流水线      │
│ electron.js ─────┼──invoke─────►│ ├── db.js   SQLite          │
└──────────────────┘              │ └── office/ Office 桥接     │
                                  └─────────────────────────────┘
```

- **渲染进程永不直接 import electron**，一律通过 `preload.cjs` 暴露的 `window.electronAPI`，前端封装在 `src/services/electron.js`
- **IPC 模式**：主进程按域用 `ipcMain.handle('域-命令', handler)` 注册（如 `src-electron/agent/ipc.js` 的 `registerAgentCommands`）；主进程推送事件用 `mainWindow.webContents.send(通道, payload)`
- **新增 IPC 命令**：主进程注册 handler → preload.cjs 转发 → 前端 services 封装，三层都要加

### Agent 子系统（src-electron/agent/）

- 工具统一走注册表模式：`registerTool({ name, description, schema, handler, meta })`，见 `src-electron/agent/tools/registry.js`，内置工具在 `tools/builtin/`
- `schema` 必须是**纯 z.object**（需审批的工具会用 `.extend` 注入 riskAssessment，refine/and 包装会报错）
- `meta.requireApproval: true` 的工具自动进入 HITL 审批流程（humanInTheLoop.js），**不得绕过或弱化**
- 工具 description 是写给 LLM 的提示词，用中文、写清用途/参数含义/副作用
- Agent 文件系统权限白名单见 `agent/permissions.js`：仅 `/SKILL/**`、`/memories/**`、`/SANDBOX{,/**}` 可写；LLM 生成的文件只允许落在 SANDBOX
- 跨会话记忆是文件系统实现（/memories/*.md），Agent 通过 edit_file 写入即持久化，无数据库同步

### RAG 子系统（src-electron/rag/）

流水线：loaders（多格式解析）→ chunkers（父子分块）→ embeddings → vectorstore（Zvec）。多知识库向量统一存储，按 `kb_type` 区分，勿破坏该约定。

### 数据库（src-electron/db.js）

sql.js 内存库 + 防抖落盘。**每条写操作（INSERT/UPDATE/DELETE）之后必须调用 `saveDb()`**，否则数据丢失。表结构在 `initDatabase()` 中以 `CREATE TABLE IF NOT EXISTS` 维护，改表需考虑已有用户的迁移。

## 关键约定

- **注释与日志用中文**（现有代码即如此）；commit message 简洁中文或英文均可
- **所有用户可见文案必须走 i18n**：`src/i18n/locales/` 下 zh-CN 与 en-US 两份都要加，缺一会显示 key
- **Pinia store 按域拆分**在 `src/store/modules/`，新功能新建模块而非塞进 index.js
- **新增 Agent 工具**：在 `tools/builtin/` 新建文件并 registerTool，不要在 ipc.js 里内联定义
- 敏感信息（API Key 等）只存 SQLite 配置表，**严禁写入日志或 send 到渲染进程之外的任何地方**

## 陷阱与红线

1. `resources/office/` 是 `vendor/happyoffice` 子模块的**构建产物**（`npm run office:build` 生成），严禁手改；改 Office 功能去 vendor 子模块
2. `package.json` 的 `build.files` 是显式白名单：新增运行时必需的根目录文件/资源必须同步加入，否则打包含不上
3. `postinstall` 里的修复脚本（fix-langgraph-sdk、fix-dsh-directory-picker-electron、dedupe-nested-deps）是必需的补丁，**不要删除或跳过**
4. 原生模块（sharp、@zvec、@deepseek-ai/*）是平台相关 optionalDependencies，不能跨架构打包；改动后跑 `node scripts/verify-packaged-native-modules.mjs x64`
5. `preload.cjs` 必须保持 CJS（.cjs 后缀），主进程/渲染进程均为 ESM（`"type": "module"`）
6. 不要在渲染进程代码里引用 Node API 或 electron 模块

## 完成任务前

1. `npm run build` 确认前端可编译
2. 涉及 scripts/ 或构建流程：跑 `node --test scripts/tests/`
3. 涉及 Agent 工具/IPC：用 `npm run electron:dev` 手动冒烟验证对应功能
4. 新增功能同步更新 README.md 与 README.zh-CN.md（两份都要）
