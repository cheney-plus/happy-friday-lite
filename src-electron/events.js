export const CONFIG_CHANGED = 'config-changed'
// 备份进度：主进程在 worker 线程打包过程中向渲染进程推送进度
export const BACKUP_PROGRESS = 'backup-progress'
export const CHAT_CHUNK = 'chat-chunk'
export const CHAT_REASONING_CHUNK = 'chat-reasoning-chunk'
export const CHAT_DONE = 'chat-done'
export const CHAT_ERROR = 'chat-error'
export const SESSION_TITLE_UPDATED = 'session-title-updated'
export const NOTE_AI_CHUNK = 'note-ai-chunk'
export const NOTE_AI_DONE = 'note-ai-done'
export const NOTE_AI_ERROR = 'note-ai-error'
export const NOTE_FIM_RESULT = 'note-fim-result'

// ========== 知识库文件监听事件 ==========
// 当 knowledge/ 目录下的文件/文件夹发生外部变更（新增/删除/重命名）时，
// 由主进程 fileWatcher.js 推送给渲染进程，触发当前视图按需刷新。
export const KB_DIRECTORY_CHANGED = 'kb-directory-changed'

// ========== Agent 相关事件 ==========
// 流式正文/思考分片复用 CHAT_CHUNK / CHAT_REASONING_CHUNK / CHAT_DONE / CHAT_ERROR，
// 这样前端流式渲染逻辑可最大化复用。以下为 Agent 专有事件：
//   - AGENT_TOOL_CALL: 工具调用开始（前端展示工具气泡）
//   - AGENT_TOOL_RESULT: 工具调用结果
//   - AGENT_TOOL_APPROVAL: 触发人机交互审批
export const AGENT_TOOL_CALL = 'agent-tool-call'
export const AGENT_TOOL_RESULT = 'agent-tool-result'
export const AGENT_TOOL_APPROVAL = 'agent-tool-approval'
