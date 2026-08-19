# Happy Friday Lite

[English](#english) | [中文](#中文)

<a id="english"></a>

An Electron + Vue 3 desktop personal knowledge assistant that combines an AI agent, RAG knowledge retrieval, rich-text notes, and a calendar. All data is stored locally with privacy as a priority.

## ✨ Key Features

### 🤖 Friday AI Assistant

- Built with [DeepAgent SDK](https://github.com/frost-beta/deepagents) and LangChain
- 12+ built-in tools: knowledge-base search, note and schedule management, file operations, shell execution, Python REPL, HTTP requests, web scraping, JSON processing, calculator, and more
- Human-in-the-Loop (HITL) support for approval before sensitive operations
- SKILL system that loads Markdown skill descriptions from the `SKILL/` directory
- Subagents and cross-session memory powered by SQLite and InMemoryStore

### 📚 Knowledge Base

- Personal, local, and agent knowledge bases
- Full RAG pipeline: document loading -> parent-child chunking -> embedding -> vector search
- Unified [Zvec](https://github.com/zvec/zvec) vector storage, separated by `kb_type`
- File watching, scheduled incremental indexing, and manual updates
- PDF, Word, Excel, Markdown, HTML, EPUB, and plain-text support

### 📝 Notes

- [TipTap](https://tiptap.dev/) rich-text editor
- Syntax-highlighted code blocks, tables, task lists, images, links, and more
- AI Fill-in-the-Middle (FIM) completion
- Version history and diff comparison

### 📅 Schedule

- [Schedule-X](https://schedule-x.so/) calendar view with lunar calendar support
- Create and update schedules with natural language through Friday

### 🎨 More

- Light, dark, and system themes
- Simplified Chinese and English localization
- Automatic data backups and a multi-tab interface

## 🖼️ Screenshots

### Friday AI Assistant

![Friday assistant home](docs/resource/1.png)

![Friday chat and code execution](docs/resource/1.1.png)

### Knowledge Base

![Knowledge base file cards](docs/resource/4.png)

### Notes

![Rich-text note editor](docs/resource/3.png)

### Schedule

![Schedule calendar](docs/resource/5.png)

### Automated Tasks

![Automated tasks](docs/resource/6.png)

### DeepSeek Harness

![DeepSeek Harness](docs/resource/7.png)

### Settings

![Settings and feature overview](docs/resource/8.png)

## 🚀 Quick Start

### Requirements

- Node.js >= 20 (22 recommended)
- npm >= 10
- macOS, Windows, or Linux

### Install Dependencies

```bash
npm install --legacy-peer-deps
```

### Run in Development

```bash
# Frontend only
npm run dev

# Electron + frontend (starts Electron automatically)
npm run electron:dev
```

### Build a Release Package

```bash
# Build an installer for the current platform
npm run electron:build

# Build for arm64
npm run electron:build:arm64
```

Build artifacts are written to `release/`.

> Configure Python under **Settings -> General -> Python Environment**. Use **Auto Detect** to find an installed interpreter, or select its executable manually. The AI assistant can install missing dependencies from `python/requirements.txt` using pip/pip3.

## 📦 Download

Download the installer for your platform from [Releases](../../releases):

| Platform | Artifact |
| --- | --- |
| macOS (Apple Silicon) | `*-mac-arm64.dmg` |
| macOS (Intel) | `*-mac-x64.dmg` |
| Windows | `*-win-x64-setup.exe` |
| Linux | `*-linux-*.AppImage` |

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| Desktop framework | Electron 42 |
| Frontend framework | Vue 3 + Vite 6 |
| State management | Pinia |
| Routing | Vue Router |
| Internationalization | Vue I18n |
| Rich-text editor | TipTap |
| Calendar | Schedule-X |
| AI agent | DeepAgents + LangChain |
| Vector database | Zvec |
| Local database | SQLite (sql.js) |
| Python runtime | Bundled portable Python for the Agent `python_repl` tool |

## 📂 Project Structure

```text
happy-friday-lite/
├── main.js                  # Electron main-process entry
├── preload.cjs              # Preload script
├── src/                     # Vue frontend source
│   ├── components/          # Shared components (chat / layout)
│   ├── views/               # Page views
│   │   ├── friday/          # Friday assistant
│   │   ├── knowledge/       # Knowledge base
│   │   ├── note/            # Notes
│   │   ├── schedule/        # Schedule
│   │   ├── history/         # Version history
│   │   └── settings/        # Settings
│   ├── store/               # Pinia state modules
│   ├── i18n/                # Localization resources
│   └── router/              # Router configuration
├── src-electron/            # Electron backend
│   ├── agent/               # Agent core (tools / skills / subagents / permissions / memory)
│   ├── rag/                 # RAG pipeline (loading / chunking / embedding / retrieval)
│   ├── db.js                # SQLite database
│   ├── llm.js               # LLM adapter
│   └── python-env.js        # Python runtime environment
├── python/                  # Python runtime download scripts
├── scripts/                 # Build helper scripts
└── .github/workflows/       # CI build workflows
```

## 🔧 Configure an AI Model

On first use, go to **Settings -> Model Configuration** and enter an API Base URL (for example, `https://api.openai.com/v1`), API key, and model name.

Any OpenAI-compatible provider is supported, including OpenAI, DeepSeek, Qwen, Zhipu AI, Kimi, and Doubao.

## 🤝 Contributing

Issues and pull requests are welcome. Please ensure the project builds successfully, changes follow the existing code style, and documentation is updated with new features.

## 📄 License

This project is released under the [PolyForm Noncommercial License 1.0.0](./LICENSE).

- ✅ Allowed: personal use, learning and research, modifying the code, and distributing the source code
- ❌ Prohibited: commercial use in any form
- ⚠️ Required: retain the original author's attribution and copyright notice when using or distributing the project

Read [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

- [Electron](https://www.electronjs.org/)
- [Vue.js](https://vuejs.org/)
- [LangChain](https://github.com/langchain-ai/langchain)
- [DeepAgents](https://github.com/frost-beta/deepagents)
- [TipTap](https://tiptap.dev/)
- [Schedule-X](https://schedule-x.so/)
- [Zvec](https://github.com/zvec/zvec)

## 📧 Contact

For questions or suggestions, open an [Issue](../../issues) or email chenjie.plus@qq.com.

---

<a id="中文"></a>

# Happy Friday Lite

[English](#english) | [中文](#中文)

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
- RAG 全流程：文档加载 -> 分块（父子分块策略）-> 向量化 -> 向量检索
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

### Friday 智能助手

![Friday 智能助手首页](docs/resource/1.png)

![Friday 对话与代码执行](docs/resource/1.1.png)

### 知识库

![知识库文件卡片](docs/resource/4.png)

### 笔记

![笔记富文本编辑](docs/resource/3.png)

### 日程

![日程日历](docs/resource/5.png)

### 自动化任务

![自动化任务](docs/resource/6.png)

### DeepSeek Harness

![DeepSeek Harness](docs/resource/7.png)

### 设置

![设置与功能介绍](docs/resource/8.png)

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
# 构建当前平台安装包
npm run electron:build

# 构建 arm64
npm run electron:build:arm64
```

构建产物输出至 `release/` 目录。

> 说明：请在「设置 -> 通用 -> Python 环境」中配置 Python 环境：
> 1. 点击「自动检测」自动发现系统已安装的 Python；或手动选择 Python 可执行文件路径；
> 2. 缺失的依赖库可由 AI 助手通过对话自动安装（基于 `python/requirements.txt`，通过 pip/pip3 安装）。

## 📦 下载安装

前往 [Releases](../../releases) 页面下载对应平台的安装包：

| 平台 | 产物 |
| --- | --- |
| macOS (Apple Silicon) | `*-mac-arm64.dmg` |
| macOS (Intel) | `*-mac-x64.dmg` |
| Windows | `*-win-x64-setup.exe` |
| Linux | `*-linux-*.AppImage` |

## 🛠️ 技术栈

| 层级 | 技术 |
| --- | --- |
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

```text
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

首次使用需在「设置 -> 模型配置」中填入 API Base URL（如 `https://api.openai.com/v1`）、API Key 和模型名称。

支持任何兼容 OpenAI 接口的大模型服务（OpenAI / DeepSeek / 通义千问 / 智谱 / Kimi / 豆包等）。

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request。请确保项目可正常构建运行、遵循现有代码风格，并在新增功能时同步更新相关文档。

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
