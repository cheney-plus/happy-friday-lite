/**
 * 内置工具：笔记操作
 *
 * 设计参考：src/views/knowledge/agent/Agent智能体设计.md §5.3
 *
 * 工具清单：
 *   - search_notes: 搜索笔记（无需审批）
 *   - get_note: 获取笔记详情（无需审批）
 *   - create_note: 创建新笔记（需审批，会修改用户数据）
 *
 * 复用 src-electron/db.js 的笔记接口。
 */

import { registerTool } from '../registry.js'
import { logger } from '../../logger.js'

const log = logger.scope('Note')

// 搜索笔记：在所有笔记中按关键词搜索
//
// 实现说明：
//   db.searchNotes 内部使用 LIKE '%query%' 整串匹配。LLM 传来的 query 经常
//   会在中文之间插入空格（如 "教师张三" → "教师 张三"），导致 LIKE 匹配失败。
//   为提高召回率，这里对 query 做分词增强：
//     1. 按空格/逗号/顿号切分为多个关键词
//     2. 对每个关键词单独调用 db.searchNotes
//     3. 同时也用原始 query 调一次（保留整串匹配能力）
//     4. 按 note.id 合并去重
//   这样既能命中 "教师张三"（无空格），也能命中只含 "张三" 或 "教师" 的笔记。
registerTool({
  name: 'search_notes',
  description:
    '在用户的所有笔记中按关键词搜索。返回匹配的笔记列表（标题和摘要）。' +
    '用于查找用户已有的笔记内容。不会修改笔记。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词',
      },
    },
    required: ['query'],
  },
  meta: {
    requireApproval: false,
    category: 'note',
  },
  handler: async (args, ctx) => {
    const { query } = args
    log.info(`搜索笔记: query="${query}"`)

    // 切分关键词：按空格、逗号、顿号、分号切分，过滤空串
    const tokens = (query || '')
      .split(/[\s,，；;]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    // 候选查询集合：原始 query + 各分词
    // 若原始 query 本身就是单关键词（无分词），则集合只含一项，避免重复查询
    const candidates = new Set()
    candidates.add(query)
    for (const t of tokens) candidates.add(t)

    log.info(`搜索笔记: 分词=${JSON.stringify([...candidates])}`)

    // 对每个候选关键词调用 db.searchNotes，合并去重
    const merged = new Map() // noteId -> note
    for (const q of candidates) {
      let notes = []
      try {
        notes = ctx.db.searchNotes(q) || []
      } catch (e) {
        log.warn(`搜索笔记异常: q="${q}", error=${e.message}`)
        continue
      }
      log.info(`搜索笔记: q="${q}" 命中 ${notes.length} 条`)
      for (const n of notes) {
        if (!merged.has(n.id)) merged.set(n.id, n)
      }
    }

    const notes = [...merged.values()]
    if (notes.length === 0) {
      log.info('未找到匹配笔记')
      return '未找到匹配的笔记。'
    }
    const formatted = notes.slice(0, 10).map((n, idx) => {
      const preview = (n.contentText || '').slice(0, 100)
      return `【笔记 ${idx + 1}】ID: ${n.id}\n标题: ${n.title}\n摘要: ${preview}...`
    }).join('\n\n')
    log.info(`找到 ${notes.length} 条笔记（去重后）`)
    return formatted
  },
})

// 获取笔记详情
registerTool({
  name: 'get_note',
  description: '按笔记 ID 获取笔记完整内容。需要先通过 search_notes 拿到笔记 ID。',
  parameters: {
    type: 'object',
    properties: {
      noteId: {
        type: 'string',
        description: '笔记 ID',
      },
    },
    required: ['noteId'],
  },
  meta: {
    requireApproval: false,
    category: 'note',
  },
  handler: async (args, ctx) => {
    const { noteId } = args
    log.info(`获取笔记: noteId=${noteId}`)
    const note = ctx.db.getNote(noteId)
    if (!note) {
      return `未找到笔记: ${noteId}`
    }
    return `标题: ${note.title}\n\n内容:\n${note.contentText || note.content || '(空)'}`
  },
})

// 创建新笔记（需审批）
registerTool({
  name: 'create_note',
  description:
    '创建一篇新笔记并保存到用户的笔记库。会修改用户数据，需要用户确认。' +
    '适用于用户要求"记笔记"、"保存到笔记"等场景。',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '笔记标题',
      },
      content: {
        type: 'string',
        description: '笔记正文内容（Markdown 格式）',
      },
    },
    required: ['title', 'content'],
  },
  meta: {
    requireApproval: true,
    category: 'note',
  },
  handler: async (args, ctx) => {
    const { title, content } = args
    log.info(`创建笔记: title="${title}"`)
    const note = ctx.db.importNote(
      null, // knowledgeBaseId
      null, // notebookId
      title,
      content, // content (HTML)
      content  // contentText (plain)
    )
    log.info(`笔记已创建: id=${note.id}`)
    return `笔记已创建成功。\nID: ${note.id}\n标题: ${note.title}`
  },
})
