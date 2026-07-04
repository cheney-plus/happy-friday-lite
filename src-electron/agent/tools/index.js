/**
 * Agent 工具聚合入口
 *
 * 设计参考：src/views/knowledge/agent/Agent智能体设计.md §5.4
 *
 * 用户新增工具只需：
 *   1. 在 tools/builtin/ 下新增工具文件（参考已有实现）
 *   2. 在本文件 import 该工具文件
 *   3. 即可在 Agent 中使用，无需改动其他代码
 */

// 导入内置工具（导入即注册，registerTool 在模块加载时执行）
import './builtin/knowledgeBase.js'
import './builtin/noteOps.js'
import './builtin/scheduleOps.js'
import './builtin/fileOps.js'

// 用户后期可在此追加新工具，例如：
// import './builtin/emailSender.js'

export {
  registerTool,
  listRegisteredTools,
  buildToolDefinitions,
  buildApprovalSet,
  getTool,
  executeTool,
} from './registry.js'
