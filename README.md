# Happy Friday Lite

[中文](README.zh-CN.md)

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
