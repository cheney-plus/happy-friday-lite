/**
 * 内置工具：Agent 文件操作（list_agent_files / read_agent_file / write_agent_file）
 * ============================================================================
 * 设计参考：Agent智能体设计.md 2.9 内置工具清单
 *
 * 限定在 Agent 目录（{userData}/knowledge/agent/）内的文件操作。
 * - list_agent_files / read_agent_file: 只读，无需审批
 * - write_agent_file: 写操作，需人机审批
 *
 * 注意：DeepAgent SDK 内置的 ls/read_file/write_file/edit_file 工具
 *      已经通过 FilesystemBackend 实现沙箱化，这些自定义工具是对外暴露的便捷接口，
 *      便于前端统一展示和审计。
 */

import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { registerTool } from '../registry.js'

/**
 * 安全解析路径：确保目标路径在 Agent 沙箱目录内
 * @param {string} ctx_agentRootDir Agent 沙箱根目录
 * @param {string} relativePath 相对路径
 * @returns {string} 绝对路径
 */
function safeResolvePath(agentRootDir, relativePath) {
  // 标准化相对路径：去除开头的 / 或 ./
  const cleanPath = (relativePath || '').replace(/^[/]+/, '')
  const absPath = path.resolve(agentRootDir, cleanPath)
  // 确保解析后的路径仍在 agentRootDir 内
  if (!absPath.startsWith(agentRootDir)) {
    throw new Error(`路径越界: ${relativePath}（仅允许访问 Agent 沙箱目录）`)
  }
  return absPath
}

// ========== list_agent_files ==========

const listFilesSchema = z.object({
  dirPath: z
    .string()
    .optional()
    .describe('要列出的目录路径（相对于 Agent 工作区，默认根目录）')
})

async function listFilesHandler(args, ctx) {
  const { dirPath = '' } = args
  ctx.logger.info(`[list_agent_files] dir="${dirPath || '/'}"`)

  const absPath = safeResolvePath(ctx.agentRootDir, dirPath)
  if (!fs.existsSync(absPath)) {
    return `目录不存在: ${dirPath}`
  }

  const stat = fs.statSync(absPath)
  if (!stat.isDirectory()) {
    return `路径不是目录: ${dirPath}`
  }

  const entries = fs.readdirSync(absPath, { withFileTypes: true })
  const result = entries.map(e => {
    const isDir = e.isDirectory()
    return `${isDir ? '[DIR]  ' : '[FILE] '} ${e.name}${isDir ? '/' : ''}`
  })

  ctx.logger.info(`[list_agent_files] 列出 ${result.length} 个条目`)
  return `目录 ${dirPath || '/'}:\n${result.join('\n')}`
}

registerTool({
  name: 'list_agent_files',
  description: '列出 Agent 工作区内指定目录的文件和子目录。',
  schema: listFilesSchema,
  handler: listFilesHandler,
  meta: { requireApproval: false }
})

// ========== read_agent_file ==========

const readFileSchema = z.object({
  filePath: z.string().describe('要读取的文件路径（相对于 Agent 工作区）')
})

async function readFileHandler(args, ctx) {
  const { filePath } = args
  ctx.logger.info(`[read_agent_file] file="${filePath}"`)

  const absPath = safeResolvePath(ctx.agentRootDir, filePath)
  if (!fs.existsSync(absPath)) {
    return `文件不存在: ${filePath}`
  }

  const stat = fs.statSync(absPath)
  if (stat.isDirectory()) {
    return `路径是目录，不是文件: ${filePath}`
  }

  // 限制文件大小（避免读取超大文件撑爆上下文）
  const MAX_SIZE = 1024 * 1024 // 1MB
  if (stat.size > MAX_SIZE) {
    return `文件过大（${stat.size} 字节），最大支持 ${MAX_SIZE} 字节`
  }

  const content = fs.readFileSync(absPath, 'utf-8')
  ctx.logger.info(`[read_agent_file] 读取 ${content.length} 字符`)
  return content
}

registerTool({
  name: 'read_agent_file',
  description: '读取 Agent 工作区内指定文件的内容。',
  schema: readFileSchema,
  handler: readFileHandler,
  meta: { requireApproval: false }
})

// ========== write_agent_file ==========

const writeFileSchema = z.object({
  filePath: z.string().describe('要写入的文件路径（相对于 Agent 工作区）'),
  content: z.string().describe('文件内容')
})

async function writeFileHandler(args, ctx) {
  const { filePath, content } = args
  ctx.logger.info(`[write_agent_file] file="${filePath}", size=${content.length}`)

  const absPath = safeResolvePath(ctx.agentRootDir, filePath)

  // 确保父目录存在
  const parentDir = path.dirname(absPath)
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true })
  }

  fs.writeFileSync(absPath, content, 'utf-8')
  ctx.logger.info(`[write_agent_file] 已写入: ${filePath}`)
  return `已写入文件: ${filePath}（${content.length} 字符）`
}

registerTool({
  name: 'write_agent_file',
  description: '在 Agent 工作区内写入或覆盖文件。需用户审批后执行。',
  schema: writeFileSchema,
  handler: writeFileHandler,
  meta: { requireApproval: true } // 写操作需审批
})
