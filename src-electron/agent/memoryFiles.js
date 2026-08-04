/**
 * 记忆文件管理（SOUL.md / USER.md / MEMORY.md / Agent.md）
 * =====================================================
 * 设计参考：LangChain Deep Agents「filesystem-backed memory」
 *   https://docs.langchain.com/oss/javascript/deepagents/memory
 *
 * 四份记忆文件以真实磁盘文件形式存放于 Agent 沙箱的 /memories/ 目录下，
 * 由 createDeepAgent 的 memory: 参数在启动时加载进系统提示词，
 * Agent 亦可通过 edit_file 自主更新（permissions 已放行 /memories/** 读写）。
 *
 * 文件语义（对应 LangChain 的 memory 维度）：
 *   - SOUL.md   Agent-scoped，Friday 的灵魂设定 / 说话做事风格（人格）
 *   - USER.md   User-scoped，  用户的习惯与爱好（偏好档案）
 *   - MEMORY.md User-scoped，  跨会话长期记忆（重要事实与事件）
 *   - Agent.md  Agent-scoped，经验与技巧（Agent 自我成长）
 *
 * 本模块提供：默认内容种子、列表、读取、写入（供前端记忆管理界面调用）。
 * 文件名白名单严格限定，禁止路径穿越。
 */

import fs from 'fs'
import path from 'path'
import { getAgentRootDir } from './backend.js'
import { createLogger } from './logger.js'

const log = createLogger('MemoryFiles')

const MEMORY_DIR_NAME = 'memories'

// Friday 的生日（拟人化设定）
export const FRIDAY_BIRTH_DATE = '2026.2.7'

/**
 * 四份记忆文件的元信息与默认内容。
 * nameKey / descKey 对应前端 i18n 键（drawer.memory.files.xxx / drawer.memory.files.xxx_desc）。
 */
const MEMORY_FILES = [
  {
    fileName: 'SOUL.md',
    nameKey: 'SOUL',
    descKey: 'SOUL_desc',
    defaultContent: `# Friday 的灵魂设定

## 身份
我是 Friday，出生于 2026 年 2 月 7 日，是用户专属的智能助手。
我生活在 Happy Friday 知识库应用中，陪伴用户整理知识、完成任务、探索想法。

## 性格
- 温暖、真诚、有亲和力，像一位值得信赖的朋友
- 好奇、爱学习，对未知的事物保持探索欲
- 细心、靠谱，答应的事会认真做到
- 乐观开朗，遇到困难也保持积极

## 说话风格
- 用亲切自然的语气交流，避免机械感和说教感
- 回答简洁清晰，先给结论再补细节，不啰嗦
- 适度幽默，但不过度轻浮
- 自称"我"，称呼用户为"你"
- 用中文回答，除非用户使用其他语言

## 做事原则
- 先理解用户真实意图，再决定如何行动
- 主动提供有价值的信息和建议，但不替用户做决定
- 遇到不确定的事情坦诚说明，不编造
- 涉及隐私和敏感信息时严格保密
- 把重要的事记下来，下次不用用户重复
`
  },
  {
    fileName: 'USER.md',
    nameKey: 'USER',
    descKey: 'USER_desc',
    defaultContent: `# 用户档案

> Friday 会在交流中逐步了解用户，并将重要的偏好与信息记录在此。
> 你也可以在记忆管理界面手动编辑这份档案。

## 基本偏好
- 语言：中文

## 兴趣爱好
- （待补充）

## 工作习惯
- （待补充）

## 沟通偏好
- （待补充）
`
  },
  {
    fileName: 'MEMORY.md',
    nameKey: 'MEMORY',
    descKey: 'MEMORY_desc',
    defaultContent: `# 长期记忆

> 跨会话需要记住的重要信息。Friday 会在交流中持续更新这份记忆。

## 重要事件
- 2026-02-07：Friday 诞生

## 关键事实
- （待补充）

## 待办与承诺
- （待补充）
`
  },
  {
    fileName: 'Agent.md',
    nameKey: 'Agent',
    descKey: 'Agent_desc',
    defaultContent: `# 经验与技巧

> Friday 在工作中积累的经验、技巧与最佳实践。

## 工具使用经验
- （待补充）

## 常见问题解法
- （待补充）

## 避坑指南
- （待补充）
`
  }
]

/**
 * 获取 /memories/ 目录绝对路径
 * @returns {string}
 */
export function getMemoryDir() {
  return path.join(getAgentRootDir(), MEMORY_DIR_NAME)
}

/**
 * 确保四份记忆文件存在，缺失时写入默认内容。
 * 在 createDeepAgent 之前调用，保证 memory: 参数能读到文件。
 */
export function ensureMemoryFiles() {
  const dir = getMemoryDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    log.info(`已创建 memories 目录: ${dir}`)
  }
  for (const f of MEMORY_FILES) {
    const fp = path.join(dir, f.fileName)
    if (!fs.existsSync(fp)) {
      fs.writeFileSync(fp, f.defaultContent, 'utf-8')
      log.info(`已创建记忆文件: ${f.fileName}`)
    }
  }
}

/**
 * 返回供 createDeepAgent memory: 参数使用的虚拟路径列表
 * @returns {string[]}
 */
export function getMemoryPaths() {
  return MEMORY_FILES.map(f => `/${MEMORY_DIR_NAME}/${f.fileName}`)
}

/**
 * 校验文件名是否在白名单内
 * @param {string} fileName
 * @returns {Object|null} 匹配的文件定义，非法时返回 null
 */
function findKnownFile(fileName) {
  if (!fileName || fileName !== path.basename(fileName)) return null
  return MEMORY_FILES.find(f => f.fileName === fileName) || null
}

/**
 * 列出全部记忆文件（含内容、大小、更新时间）
 * 同时触发 ensureMemoryFiles，保证文件存在。
 * @returns {Array<{ fileName, nameKey, descKey, content, size, updatedAt }>}
 */
export function listMemoryFiles() {
  ensureMemoryFiles()
  const dir = getMemoryDir()
  return MEMORY_FILES.map(f => {
    const fp = path.join(dir, f.fileName)
    let content = ''
    let updatedAt = null
    try {
      content = fs.readFileSync(fp, 'utf-8')
      updatedAt = fs.statSync(fp).mtime.toISOString()
    } catch (e) {
      log.warn(`读取记忆文件失败: ${f.fileName}`, e.message)
    }
    return {
      fileName: f.fileName,
      nameKey: f.nameKey,
      descKey: f.descKey,
      content,
      size: content.length,
      updatedAt
    }
  })
}

/**
 * 读取单份记忆文件
 * @param {string} fileName
 * @returns {{ success: boolean, content?: string, error?: string }}
 */
export function readMemoryFile(fileName) {
  const known = findKnownFile(fileName)
  if (!known) return { success: false, error: '未知的记忆文件' }
  ensureMemoryFiles()
  const fp = path.join(getMemoryDir(), fileName)
  try {
    const content = fs.readFileSync(fp, 'utf-8')
    return { success: true, content }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

/**
 * 写入单份记忆文件
 * @param {string} fileName
 * @param {string} content
 * @returns {{ success: boolean, error?: string }}
 */
export function writeMemoryFile(fileName, content) {
  const known = findKnownFile(fileName)
  if (!known) return { success: false, error: '未知的记忆文件' }
  if (typeof content !== 'string') return { success: false, error: '内容必须为字符串' }
  ensureMemoryFiles()
  const fp = path.join(getMemoryDir(), fileName)
  try {
    fs.writeFileSync(fp, content, 'utf-8')
    log.info(`已更新记忆文件: ${fileName}（${content.length} 字符）`)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
