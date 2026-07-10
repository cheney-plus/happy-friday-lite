# Happy Friday Lite

一个基于 Electron + Vue 3 的桌面端个人知识智能助手。集成 AI Agent、RAG 知识检索、富文本笔记、日程日历于一体，所有数据本地存储，隐私优先。

## ✨ 核心功能

### 🤖 Friday 智能助手
- 基于 [DeepAgent SDK](https://github.com/frost-beta/deepagents) + LangChain 构建的智能体
- 内置 12+ 工具：知识库检索、笔记/日程操作、文件读写、Shell 执行、Python REPL、HTTP 请求、网页抓取、JSON 处理、计算器等
- 支持 Human-in-the-Loop（HITL）：敏感操作需用户确认
- 支持 SKILL 技能系统：从 `SKILL/` 目录加载 Markdown 技能描述
- 支持子 Agent（subagents）与跨会话记忆（SQLite + InMemoryStore）

### 📚 知识库
- 个人知识库 / 本地知识库 / Agent 知识库三类
- RAG 全流程：文档加载 → 分块（父子分块策略）→ 向量化 → 向量检索
- 基于 [Zvec](https://github.com/zvec/zvec) 向量数据库，多知识库向量统一存储、按 `kb_type` 区分
- 文件监听 + 定时增量索引，支持手动触发更新
- 支持多格式文档：PDF、Word、Excel、Markdown、HTML、EPUB、纯文本

### 📝 笔记
- 基于 [TipTap](https://tiptap.dev/) 的富文本编辑器
- 支持代码块（语法高亮）、表格、任务列表、图片、链接等
- AI FIM（Fill-in-the-Middle）补全
- 版本历史与差异对比

### 📅 日程
- 基于 [Schedule-X](https://schedule-x.so/) 的日历视图
- 农历显示支持
- Friday 助手可自然语言创建/修改日程

### 🎨 其他特性
- 主题：浅色 / 深色 / 跟随系统
- 国际化：简体中文 / English
- 数据自动备份
- 多标签页界面

## 🖼️ 截图

> TODO: 添加应用截图

## 🚀 快速开始

### 环境要求

- Node.js >= 20（推荐 22）
- npm >= 10
- macOS / Windows / Linux

### 安装依赖

```bash
npm install --legacy-peer-deps
```

### 开发模式运行

```bash
# 仅前端
npm run dev

# Electron + 前端（自动启动 Electron）
npm run electron:dev
```

### 构建发布包

```bash
# 下载 Python 运行时（首次构建需要）
npm run python:download

# 构建当前平台安装包
npm run electron:build

# 构建 arm64
npm run electron:build:arm64
```

构建产物输出至 `release/` 目录。

## 📦 下载安装

前往 [Releases](../../releases) 页面下载对应平台的安装包：

| 平台 | 产物 |
|------|------|
| macOS (Apple Silicon) | `*-mac-arm64.dmg` |
| macOS (Intel) | `*-mac-x64.dmg` |
| Windows | `*-win-x64-setup.exe` |
| Linux | `*-linux-*.AppImage` |

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 42 |
| 前端框架 | Vue 3 + Vite 6 |
| 状态管理 | Pinia |
| 路由 | Vue Router |
| 国际化 | Vue I18n |
| 富文本编辑 | TipTap |
| 日历 | Schedule-X |
| AI Agent | DeepAgents + LangChain |
| 向量数据库 | Zvec |
| 本地数据库 | SQLite (sql.js) |
| Python 运行时 | 内置便携版 Python（用于 Agent 的 python_repl 工具） |

## 📂 项目结构

```
happy-friday-lite/
├── main.js                  # Electron 主进程入口
├── preload.cjs              # 预加载脚本
├── src/                     # Vue 前端源码
│   ├── components/          # 通用组件（chat / layout）
│   ├── views/               # 页面视图
│   │   ├── friday/          # Friday 助手
│   │   ├── knowledge/       # 知识库
│   │   ├── note/            # 笔记
│   │   ├── schedule/        # 日程
│   │   ├── history/         # 历史版本
│   │   └── settings/        # 设置
│   ├── store/               # Pinia 状态模块
│   ├── i18n/                # 国际化资源
│   └── router/              # 路由配置
├── src-electron/            # Electron 后端
│   ├── agent/               # Agent 核心（工具/技能/子Agent/权限/记忆）
│   ├── rag/                 # RAG 流程（加载/分块/向量化/检索）
│   ├── db.js                # SQLite 数据库
│   ├── llm.js               # LLM 适配
│   └── python-env.js        # Python 运行时环境
├── python/                  # Python 运行时下载脚本
├── scripts/                 # 构建辅助脚本
└── .github/workflows/       # CI 构建工作流
```

## 🔧 配置 AI 模型

首次使用需在「设置 → 模型配置」中填入：

- API Base URL（如 `https://api.openai.com/v1`）
- API Key
- 模型名称

支持任何兼容 OpenAI 接口的大模型服务（OpenAI / DeepSeek / 通义千问 / 智谱 / Kimi / 豆包等）。

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request。请确保：

1. 提交前代码可正常构建运行
2. 遵循现有代码风格
3. 新增功能请同步更新相关文档

## 📄 开源协议

本项目采用 [PolyForm Noncommercial License 1.0.0](./LICENSE) 开源协议。

- ✅ 允许：个人使用、学习研究、修改代码、分发源码
- ❌ 禁止：任何形式的商业使用
- ⚠️ 要求：使用或分发时必须保留原作者署名与版权声明

详情请阅读 [LICENSE](./LICENSE) 文件。

## 🙏 致谢

- [Electron](https://www.electronjs.org/)
- [Vue.js](https://vuejs.org/)
- [LangChain](https://github.com/langchain-ai/langchain)
- [DeepAgents](https://github.com/frost-beta/deepagents)
- [TipTap](https://tiptap.dev/)
- [Schedule-X](https://schedule-x.so/)
- [Zvec](https://github.com/zvec/zvec)

## 📧 联系方式

如有问题或建议，欢迎通过 [Issues](../../issues) 反馈或者邮箱（chenjie.plus@qq.com）联系我。
