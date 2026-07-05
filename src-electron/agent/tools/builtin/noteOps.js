/**
 * 内置工具：笔记操作（search_notes / get_note / create_note / update_note）
 * =====================================================================
 * 设计参考：Agent智能体设计.md 2.9 内置工具清单
 *
 * 调用 src-electron/db.js 笔记接口。
 * - search_notes / get_note: 只读，无需审批
 * - create_note / update_note: 写操作，需人机审批
 */

import { z } from 'zod'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { registerTool } from '../registry.js'

// HTML → Markdown 转换器（用于将笔记的 HTML 内容转为 LLM 友好的 Markdown）
const turndownService = new TurndownService({
  headingStyle: 'atx',     // # 风格标题
  codeBlockStyle: 'fenced', // ``` 风格代码块
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**'
})
// 保留 <br> 转换为换行
turndownService.addRule('lineBreak', {
  filter: 'br',
  replacement: () => '\n'
})

const htmlToMarkdown = (html) => {
  if (!html) return ''
  try {
    return turndownService.turndown(html).trim()
  } catch (_e) {
    // 转换失败时回退到纯文本（剥离标签）
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  }
}

// ========== search_notes ==========

const searchNotesSchema = z.object({
  query: z.string().describe('搜索关键词，会在笔记标题和正文中匹配')
})

async function searchNotesHandler(args, ctx) {
  const { query } = args
  ctx.logger.info(`[search_notes] query="${query}"`)

  // 动态导入 db.js
  const { searchNotes } = await import('../../../db.js')

  // 项目 db.js searchNotes 使用 LIKE '%query%' 模糊匹配
  // 为提升命中率，分词后再各自检索并去重
  const tokens = query
    .split(/[\s,，、]+/)
    .map(t => t.trim())
    .filter(Boolean)

  const queries = [query, ...tokens]
  const seen = new Set()
  const merged = []

  for (const q of queries) {
    const results = searchNotes(q)
    for (const note of results) {
      if (!seen.has(note.id)) {
        seen.add(note.id)
        merged.push(note)
      }
    }
    if (merged.length >= 20) break
  }

  ctx.logger.info(`[search_notes] 命中 ${merged.length} 条笔记`)

  if (merged.length === 0) {
    return `未找到包含 "${query}" 的笔记。`
  }

  // 只返回摘要，避免上下文过长
  return merged
    .map(
      n =>
        `【笔记 ${n.id}】${n.title}\n${(n.contentText || '').slice(0, 200)}${n.contentText && n.contentText.length > 200 ? '...' : ''}`
    )
    .join('\n\n')
}

registerTool({
  name: 'search_notes',
  description: '搜索用户的笔记。根据关键词在笔记标题和正文中查找匹配项。仅搜索未删除的笔记。',
  schema: searchNotesSchema,
  handler: searchNotesHandler,
  meta: { requireApproval: false }
})

// ========== get_note ==========

const getNoteSchema = z.object({
  noteId: z.string().describe('笔记 ID')
})

async function getNoteHandler(args, ctx) {
  const { noteId } = args
  ctx.logger.info(`[get_note] noteId=${noteId}`)

  const { getNote } = await import('../../../db.js')
  const note = getNote(noteId)

  if (!note) {
    return `未找到笔记: ${noteId}`
  }

  // 数据库中 note.content 是 HTML 格式，转为 Markdown 便于 LLM 阅读和用户理解
  const markdownContent = htmlToMarkdown(note.content)
  return `【笔记 ${note.id}】${note.title}\n\n${markdownContent}`
}

registerTool({
  name: 'get_note',
  description: '根据笔记 ID 获取笔记完整内容。',
  schema: getNoteSchema,
  handler: getNoteHandler,
  meta: { requireApproval: false }
})

// ========== create_note ==========

const createNoteSchema = z.object({
  title: z.string().describe('笔记标题'),
  content: z.string().describe('笔记正文内容（Markdown 格式）'),
  knowledgeBaseId: z
    .string()
    .optional()
    .describe('所属知识库 ID（可选，不指定则不归属任何知识库）'),
  notebookId: z
    .string()
    .optional()
    .describe('所属笔记本 ID（可选）')
})

async function createNoteHandler(args, ctx) {
  const { title, content, knowledgeBaseId = null, notebookId = null } = args
  ctx.logger.info(`[create_note] title="${title}", kbId=${knowledgeBaseId}`)

  const { importNote } = await import('../../../db.js')
  // 将 Markdown 转为 HTML 存入 content 字段（编辑器期望 HTML 格式）
  const htmlContent = content ? marked.parse(content) : ''
  // 从 HTML 提取纯文本用于搜索
  const contentText = htmlContent.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

  const note = importNote(knowledgeBaseId, notebookId, title, htmlContent, contentText)
  ctx.logger.info(`[create_note] 已创建笔记: id=${note.id}`)
  return `已创建笔记: id=${note.id}, title="${title}"`
}

registerTool({
  name: 'create_note',
  description: '创建一条新笔记。支持 Markdown 格式内容。',
  schema: createNoteSchema,
  handler: createNoteHandler,
  meta: { requireApproval: true } // 写操作需审批
})

// ========== update_note ==========

const updateNoteSchema = z.object({
  noteId: z.string().describe('要更新的笔记 ID'),
  title: z.string().optional().describe('新标题（可选）'),
  content: z.string().optional().describe('新正文内容（可选，Markdown 格式）')
})

async function updateNoteHandler(args, ctx) {
  const { noteId, title, content } = args
  ctx.logger.info(`[update_note] noteId=${noteId}`)

  const { getNote, updateNote } = await import('../../../db.js')
  const existing = getNote(noteId)
  if (!existing) {
    return `未找到笔记: ${noteId}`
  }

  const newTitle = title !== undefined ? title : existing.title
  // 如果提供了新内容，将 Markdown 转为 HTML；否则保留原有 HTML
  let htmlContent
  if (content !== undefined) {
    htmlContent = content ? marked.parse(content) : ''
  } else {
    htmlContent = existing.content
  }
  const contentText = htmlContent.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

  const updated = updateNote(noteId, newTitle, htmlContent, contentText)
  ctx.logger.info(`[update_note] 已更新笔记: ${noteId}`)
  return `已更新笔记: id=${noteId}, title="${newTitle}"`
}

registerTool({
  name: 'update_note',
  description: '更新已有笔记的标题或内容。只需传需要修改的字段。',
  schema: updateNoteSchema,
  handler: updateNoteHandler,
  meta: { requireApproval: true } // 写操作需审批
})
