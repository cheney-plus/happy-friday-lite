/**
 * 内置工具：Agent 沙盒文件操作
 *
 * 设计参考：src/views/knowledge/agent/Agent智能体设计.md §5.3、§10.1
 *
 * 工具清单：
 *   - list_agent_files: 列出 agent 目录文件（无需审批）
 *   - read_agent_file:  读取 agent 目录文件（无需审批）
 *   - write_agent_file: 写入 agent 目录文件（需审批）
 *
 * 沙箱边界：所有操作限定在 {userData}/knowledge/agent/ 目录下，
 * 防止路径穿越攻击（.. 拼接）。
 */

import fs from 'fs'
import path from 'path'
import { registerTool } from '../registry.js'
import { logger } from '../../logger.js'

const log = logger.scope('File')

/**
 * 安全解析相对路径，防止路径穿越
 * @param {string} agentRootDir agent 根目录绝对路径
 * @param {string} relativePath 用户传入的相对路径
 * @returns {string|null} 解析后的绝对路径，非法返回 null
 */
function resolveSafePath(agentRootDir, relativePath) {
  if (!relativePath || typeof relativePath !== 'string') return null
  // 标准化路径，防止 .. 穿越
  const resolved = path.resolve(agentRootDir, relativePath)
  // 必须在 agentRootDir 之内
  if (!resolved.startsWith(agentRootDir + path.sep) && resolved !== agentRootDir) {
    return null
  }
  return resolved
}

// 列出 agent 目录文件
registerTool({
  name: 'list_agent_files',
  description:
    '列出 Agent 工作区（沙盒）中指定目录下的文件和子目录。' +
    '不传路径则列出根目录。Agent 工作区是 Agent 自己的文件系统，与用户的知识库隔离。',
  parameters: {
    type: 'object',
    properties: {
      dirPath: {
        type: 'string',
        description: '相对路径（如 "" 表示根目录，"沙盒区" 表示沙盒区子目录），可选',
      },
    },
  },
  meta: {
    requireApproval: false,
    category: 'file',
  },
  handler: async (args, ctx) => {
    const relPath = args.dirPath || ''
    const absPath = resolveSafePath(ctx.agentRootDir, relPath)
    if (!absPath) {
      return '错误：非法路径'
    }
    log.info(`列出文件: dir="${relPath}"`)

    if (!fs.existsSync(absPath)) {
      return `目录不存在: ${relPath}`
    }

    try {
      const entries = fs.readdirSync(absPath, { withFileTypes: true })
      const items = entries
        .filter((e) => !e.name.startsWith('.'))
        .map((e) => ({
          name: e.name,
          type: e.isDirectory() ? 'dir' : 'file',
          size: e.isFile() ? fs.statSync(path.join(absPath, e.name)).size : 0,
        }))

      if (items.length === 0) {
        return `目录为空: ${relPath || '/'}`
      }

      const formatted = items.map((i) => {
        const type = i.type === 'dir' ? '[目录]' : `[文件 ${i.size}B]`
        return `${type} ${i.name}`
      }).join('\n')

      log.info(`列出 ${items.length} 项`)
      return `目录 ${relPath || '/'} 内容：\n${formatted}`
    } catch (e) {
      log.error(`列出文件失败: ${e.message}`)
      return `读取目录失败: ${e.message}`
    }
  },
})

// 读取 agent 目录文件
registerTool({
  name: 'read_agent_file',
  description:
    '读取 Agent 工作区（沙盒）中指定文件的内容。' +
    '路径为相对路径（如 "沙盒区/notes.md"）。仅能读取 Agent 工作区内文件。',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: '文件相对路径（如 "沙盒区/notes.md"）',
      },
    },
    required: ['filePath'],
  },
  meta: {
    requireApproval: false,
    category: 'file',
  },
  handler: async (args, ctx) => {
    const absPath = resolveSafePath(ctx.agentRootDir, args.filePath)
    if (!absPath) {
      return '错误：非法路径'
    }
    log.info(`读取文件: ${args.filePath}`)

    if (!fs.existsSync(absPath)) {
      return `文件不存在: ${args.filePath}`
    }

    try {
      const stat = fs.statSync(absPath)
      if (stat.isDirectory()) {
        return `路径是目录，不是文件: ${args.filePath}`
      }
      // 限制读取文件大小（10MB）
      if (stat.size > 10 * 1024 * 1024) {
        return `文件过大（${stat.size} 字节），超过 10MB 限制`
      }
      const content = fs.readFileSync(absPath, 'utf-8')
      log.info(`读取成功: ${content.length} 字符`)
      return content
    } catch (e) {
      log.error(`读取文件失败: ${e.message}`)
      return `读取文件失败: ${e.message}`
    }
  },
})

// 写入 agent 目录文件（需审批）
registerTool({
  name: 'write_agent_file',
  description:
    '向 Agent 工作区（沙盒）写入或覆盖文件。会修改文件，需要用户确认。' +
    '适用于 Agent 保存工作成果、记录中间产物等场景。' +
    '如果父目录不存在会自动创建。',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: '文件相对路径（如 "沙盒区/notes.md"）',
      },
      content: {
        type: 'string',
        description: '要写入的文件内容',
      },
    },
    required: ['filePath', 'content'],
  },
  meta: {
    requireApproval: true,
    category: 'file',
  },
  handler: async (args, ctx) => {
    const absPath = resolveSafePath(ctx.agentRootDir, args.filePath)
    if (!absPath) {
      return '错误：非法路径'
    }
    log.info(`写入文件: ${args.filePath}, ${args.content.length} 字符`)

    try {
      // 父目录不存在则自动创建
      const parentDir = path.dirname(absPath)
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true })
      }
      fs.writeFileSync(absPath, args.content, 'utf-8')
      log.info(`写入成功: ${absPath}`)
      return `文件已写入成功: ${args.filePath}`
    } catch (e) {
      log.error(`写入文件失败: ${e.message}`)
      return `写入文件失败: ${e.message}`
    }
  },
})
