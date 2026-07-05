/**
 * 内置工具：知识库检索（retrieve_knowledge）
 * ============================================
 * 设计参考：Agent智能体设计.md 2.9 内置工具清单
 *
 * 调用 src-electron/rag/index.js 的 searchKnowledgeBase 检索知识库。
 *
 * 安全约束（项目硬约束）：
 *   - 仅检索 personal/local 知识库
 *   - Agent 目录（kbCategoryId === 'agent'）不参与向量化与检索
 */

import { z } from 'zod'
import { registerTool } from '../registry.js'

// 工具参数 schema
const schema = z.object({
  query: z
    .string()
    .describe('用于在知识库中检索的查询文本，需将用户问题转化为准确的检索词'),
  kbName: z
    .string()
    .optional()
    .describe('指定知识库名称（可选，不指定则检索全部知识库）'),
  topK: z
    .number()
    .optional()
    .describe('返回结果数量，默认 5')
})

// 工具处理函数
async function handler(args, ctx) {
  const { query, kbName = '', topK = 5 } = args
  ctx.logger.info(`[retrieve_knowledge] query="${query}", kbName="${kbName || '全部'}", topK=${topK}`)

  try {
    // 动态导入 rag/index.js，避免循环依赖
    const { searchKnowledgeBase } = await import('../../../rag/index.js')

    // 检索范围限定为 personal/local 知识库，符合项目硬约束
    // 注：agent 目录不参与向量化，searchKnowledgeBase 内部已自动跳过
    const results = await searchKnowledgeBase(
      query,
      kbName || '',
      '',         // kbCategoryId 留空，检索全部（不含 agent）
      topK,
      0.5,        // 置信度阈值
      ''          // folderPath
    )

    if (!results || results.length === 0) {
      return '未在知识库中检索到相关内容。'
    }

    // 格式化检索结果
    const formatted = results.map((r, idx) => {
      const source = r.source ? `\n[来源: ${r.source}]` : ''
      const confidence = `\n[置信度: ${(r.confidence * 100).toFixed(1)}%]`
      return `【知识片段 ${idx + 1}】${confidence}${source}\n${r.content}`
    }).join('\n\n')

    ctx.logger.info(`[retrieve_knowledge] 检索返回 ${results.length} 条结果`)
    return formatted
  } catch (e) {
    ctx.logger.error(`[retrieve_knowledge] 检索失败: ${e.message}`)
    return `知识库检索失败: ${e.message}`
  }
}

// 注册工具
registerTool({
  name: 'retrieve_knowledge',
  description:
    '从用户的个人/本地知识库中检索相关文档、笔记或文件内容。' +
    '当问题涉及知识库中可能有的特定信息时调用。' +
    '注意：Agent 工作区目录不参与RAG检索。',
  schema,
  handler,
  meta: {
    requireApproval: false // 检索是只读操作，无需审批
  }
})
