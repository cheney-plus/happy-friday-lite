/**
 * 附件上下文构造模块
 * ====================
 * 前端只构造简洁的引用格式（用户气泡 + 数据库存储）：
 *   {text}\n\n---\n用户引用【笔记】：xxx\n用户引用【文档】：yyy
 *
 * 后端根据附件元数据 attachments 和对话模式 mode 构造 LLM 提示：
 *   - Agent 模式：不读取内容，只列出名称（Agent 自主调用工具读取）
 *   - chat/memoryless 模式：读取完整内容注入 LLM（每条 ≤ 2,500 字符）
 */

import fs from 'fs'
import * as db from './db.js'

const MAX_LLM_CONTENT_LENGTH = 2500

const truncateForLlm = (content) => {
  if (!content) return '(空内容)'
  if (content.length <= MAX_LLM_CONTENT_LENGTH) return content
  return content.slice(0, MAX_LLM_CONTENT_LENGTH) + `\n...(内容已截断，共 ${content.length} 字符)`
}

// 读取附件内容
// - note: 通过 noteId 从数据库读取 contentText
// - file: 通过 path 从磁盘读取
const readAttachmentContent = (att) => {
  if (att.kind === 'note') {
    if (!att.noteId) return ''
    const note = db.getNote(att.noteId)
    return note?.contentText || note?.content || ''
  }
  if (att.kind === 'file') {
    if (!att.path || !fs.existsSync(att.path)) return '(文件不存在)'
    try {
      return fs.readFileSync(att.path, 'utf-8')
    } catch (e) {
      return `(读取失败: ${e.message})`
    }
  }
  return ''
}

/**
 * 根据模式构造 LLM 消息（替换 userMessage 中的简洁引用块为完整 LLM 提示）
 *
 * @param {string} userMessage - 用户消息（含简洁引用块 `---\n用户引用【笔记】：xxx`）
 * @param {Array} attachments - 附件元数据 [{ kind: 'note'|'file', name, noteId?, path? }]
 * @param {string} mode - 对话模式：'agent' | 'chat' | 'memoryless'
 * @returns {string} LLM 消息（含完整引用提示）
 */
export const buildLlmMessage = (userMessage, attachments, mode) => {
  if (!attachments || attachments.length === 0) return userMessage

  // 提取 --- 之前的文本部分
  const separator = '\n\n---\n'
  const sepIdx = userMessage.indexOf(separator)
  const textPart = sepIdx >= 0 ? userMessage.slice(0, sepIdx) : userMessage

  const isAgent = mode === 'agent'
  const prompt = isAgent
    ? '💡 用户在本条消息中 @ 引用了以下内容，请使用工具读取这些内容后进行回答：'
    : '💡 用户在本条消息中 @ 引用了以下内容，请优先参考这些内容进行回答：'

  const parts = []
  for (const att of attachments) {
    const label = att.kind === 'note'
      ? `【📝 笔记】${att.name}`
      : `【📄 知识库文件】${att.name}`

    if (isAgent) {
      // Agent 模式：只列名称，由 Agent 自主调用工具读取内容
      parts.push(label)
    } else {
      // chat/memoryless 模式：读取完整内容注入 LLM（≤ 2,500 字符）
      const content = readAttachmentContent(att)
      parts.push(`${label}\n${truncateForLlm(content)}`)
    }
  }

  return `${textPart}\n\n---\n${prompt}\n\n${parts.join(isAgent ? '\n' : '\n\n')}\n---`
}
