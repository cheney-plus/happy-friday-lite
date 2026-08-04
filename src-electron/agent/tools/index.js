/**
 * 工具聚合入口
 * =============
 * 设计参考：Agent智能体设计.md 2.9 / 3.3
 *
 * 在此处 import 所有 builtin 工具文件，触发它们的 registerTool() 调用。
 * 用户扩展新工具时，只需：
 *   1. 在 tools/builtin/ 下新增文件，调用 registerTool()
 *   2. 在此处追加一行 import './builtin/xxx.js'
 *   3. 完成，Agent 启动时自动加载
 */

// 知识库检索工具
import './builtin/knowledgeBase.js'

// 笔记操作工具（search/get/create/update）
import './builtin/noteOps.js'

// 日程操作工具（list/create/update/delete）
import './builtin/scheduleOps.js'

// Agent 文件操作工具（list/read/write）
import './builtin/fileOps.js'

// Shell 命令执行工具
import './builtin/shellExec.js'

// 系统信息工具（当前时间）
import './builtin/systemOps.js'

// 数学计算工具（包装 @langchain/community 的 Calculator）
import './builtin/calculator.js'

// Python 代码执行工具（使用项目内置 Python 运行时）
import './builtin/pythonRepl.js'

// Python 包安装工具（通过 pip/pip3 安装第三方库，含 ensurepip 引导）
import './builtin/pipInstall.js'

// HTTP 请求工具（GET/POST/PUT/DELETE/PATCH）
import './builtin/httpRequests.js'

// JSON 处理工具（parse/extract/format）
import './builtin/jsonOps.js'

// 网页正文抓取工具
import './builtin/webpageScraper.js'

// 文件转 Markdown 工具（PDF/Word/PPT/Excel/HTML/CSV/JSON/XML/EPub → Markdown，支持 PDF OCR）
import './builtin/markitdown.js'

// 用户头像替换工具（从内置头像库随机选取；口令可解锁稀有头像）
import './builtin/avatarOps.js'

// 用户可在下方追加自定义工具导入：
// import './builtin/myCustomTool.js'
