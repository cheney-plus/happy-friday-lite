/**
 * 内置工具：知识库 RAG 检索
 *
 * 设计参考：src/views/knowledge/agent/Agent智能体设计.md §5.3
 *
 * 工具名：retrieve_knowledge
 * 行为：复用 src-electron/rag/index.js 的 searchKnowledgeBase
 * 约束：检索范围限定为 personal/local 知识库，不检索 agent 目录（项目硬约束）
 */

import { registerTool } from '../registry.js'
import { logger } from '../../logger.js'

const log = logger.scope('KB')

registerTool({
  name: 'retrieve_knowledge',
  description:
    '从用户的个人知识库（personal）和本地知识库（local）中检索相关文档、笔记或文件内容。' +
    '当问题涉及用户私有资料、笔记内容、已上传文档时调用。' +
    '注意：不会检索 Agent 工作区的内容。返回检索到的文本片段及来源信息。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '用于在知识库中检索的查询文本，应是凝练后的检索关键词或问题',
      },
      kbName: {
        type: 'string',
        description: '可选：指定在哪个知识库中检索（如"我的笔记"、"我的书籍"）。留空检索全部。',
      },
    },
    required: ['query'],
  },
  meta: {
    requireApproval: false,
    category: 'knowledge',
  },
  handler: async (args, ctx) => {
    const { query, kbName } = args
    log.info(`检索知识库: query="${query}", kbName="${kbName || '全部'}"`)

    // 复用项目已有 RAG 实现
    // 检索范围限定为 personal/local，agent 目录不参与向量化（项目硬约束）
    // 路径推算：本文件位于 src-electron/agent/tools/builtin/，
    //   需回到 src-electron/ 下找 rag/，故用 ../../../rag/
    const { searchKnowledgeBase } = await import('../../../rag/index.js')
    const results = await searchKnowledgeBase(
      query,
      kbName || '',
      '', // kbCategoryId 留空：由 searchKnowledgeBase 根据 kbName 匹配，或检索全部
      5,  // topK
      0.5, // scoreThreshold
      ''   // folderPath
    )

    if (!results || results.length === 0) {
      log.info('检索无结果')
      return '未在知识库中检索到相关内容。'
    }

    // 格式化检索结果，供 LLM 引用
    const formatted = results.map((r, idx) => {
      const source = r.source ? `\n[来源: ${r.source}]` : ''
      const confidence = `\n[置信度: ${(r.confidence * 100).toFixed(1)}%]`
      return `【知识片段 ${idx + 1}】${confidence}${source}\n${r.content}`
    }).join('\n\n')

    log.info(`检索返回 ${results.length} 条结果`)
    return formatted
  },
})
