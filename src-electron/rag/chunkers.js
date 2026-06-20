import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import crypto from 'crypto'

/**
 * 分块策略：
 * 1. 笔记文档 (.note)：结构感知分块，按标题层级分割
 * 2. 其他文档：父子分块 (Small-to-Big)，子块用于向量检索，父块用于 LLM 上下文
 */

// 父子分块参数
const PARENT_CHUNK_SIZE = 2000
const PARENT_CHUNK_OVERLAP = 200
const CHILD_CHUNK_SIZE = 400
const CHILD_CHUNK_OVERLAP = 50

// 笔记分块参数（结构感知）
const NOTE_CHUNK_SIZE = 800
const NOTE_CHUNK_OVERLAP = 100

function generateUuid() {
  return crypto.randomUUID()
}

/**
 * 父子分块策略 (Small-to-Big)
 * 用小块做向量检索（精准命中），召回后用其所属的大块喂给 LLM（上下文完整）
 * 返回: { parentDocs, childDocs }
 *   - parentDocs: 父块数组，每个包含 uuid 和 content
 *   - childDocs: 子块数组，metadata 中注入 docId 指向父块 uuid
 */
export async function parentChildSplit(rawDocs) {
  const parentSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: PARENT_CHUNK_SIZE,
    chunkOverlap: PARENT_CHUNK_OVERLAP
  })

  const childSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHILD_CHUNK_SIZE,
    chunkOverlap: CHILD_CHUNK_OVERLAP
  })

  // 先将原始文档切成父块
  const parentDocs = await parentSplitter.splitDocuments(rawDocs)

  const parentRecords = [] // { uuid, docId, content, metadata }
  const childDocs = []      // Document[]，metadata 含 docId 指向父块

  // 为每个父块生成 uuid，并切子块
  for (const parent of parentDocs) {
    const parentId = generateUuid()
    // 逻辑文档ID：同一来源文件的所有父块共享同一个 docId
    const logicalDocId = parent.metadata.source || 'unknown'

    parentRecords.push({
      uuid: parentId,
      docId: logicalDocId,
      content: parent.pageContent,
      sourcePath: parent.metadata.source,
      fileType: parent.metadata.fileType,
      fileSize: parent.metadata.fileSize,
      fileCreatedAt: parent.metadata.fileCreatedAt,
      fileModifiedAt: parent.metadata.fileModifiedAt,
      extraMetadata: {
        title: parent.metadata.title,
        noteId: parent.metadata.noteId
      }
    })

    // 切子块
    const children = await childSplitter.splitDocuments([parent])
    for (const child of children) {
      childDocs.push({
        ...child,
        metadata: {
          ...child.metadata,
          docId: parentId // 子块 metadata 注入 docId 指向父块
        }
      })
    }
  }

  return { parentDocs: parentRecords, childDocs }
}

/**
 * 笔记结构感知分块策略
 * 笔记是 markdown 格式，按标题层级（#, ##, ###）进行分割
 * 每个标题段落作为一个独立块，保留标题层级上下文
 */
export async function noteStructureAwareSplit(rawDocs) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: NOTE_CHUNK_SIZE,
    chunkOverlap: NOTE_CHUNK_OVERLAP,
    separators: ['\n## ', '\n### ', '\n#### ', '\n\n', '\n', ' ', '']
  })

  const chunks = await splitter.splitDocuments(rawDocs)

  // 笔记分块直接作为子块（无需父子分块），metadata 中 docId 指向自身
  const childDocs = []
  for (const chunk of chunks) {
    const parentId = generateUuid()
    childDocs.push({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        docId: parentId // 笔记块自身就是父块，docId 指向自身
      }
    })
  }

  // 笔记的父块就是子块本身（结构感知分块后无需再聚合）
  const parentDocs = childDocs.map(c => ({
    uuid: c.metadata.docId,
    docId: c.metadata.source || 'unknown',
    content: c.pageContent,
    sourcePath: c.metadata.source,
    fileType: c.metadata.fileType,
    fileSize: c.metadata.fileSize,
    fileCreatedAt: c.metadata.fileCreatedAt,
    fileModifiedAt: c.metadata.fileModifiedAt,
    extraMetadata: {
      title: c.metadata.title,
      noteId: c.metadata.noteId
    }
  }))

  return { parentDocs, childDocs }
}

/**
 * 主分块入口：根据文件类型选择分块策略
 * @param {Array} rawDocs - 加载后的 Document 数组
 * @param {string} fileType - 文件类型
 * @returns {Promise<{parentDocs: Array, childDocs: Array}>}
 */
export async function splitDocuments(rawDocs, fileType) {
  if (fileType === 'note') {
    // 笔记使用结构感知分块
    return noteStructureAwareSplit(rawDocs)
  }
  // 其他文档使用父子分块
  return parentChildSplit(rawDocs)
}
