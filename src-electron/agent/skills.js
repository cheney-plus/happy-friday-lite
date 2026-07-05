/**
 * Skills 加载
 * ============
 * 设计参考：Agent智能体设计.md 2.5
 *
 * - 通过 `skills=["/SKILL/"]` 传给 `createDeepAgent`，由 `SkillsMiddleware` 自动扫描 .md 文件
 * - 维护 `_index.json` 索引文件供前端展示
 * - SKILL 目录路径：{userData}/knowledge/agent/SKILL/
 *
 * Skill 文件约定（兼容两种格式）：
 *   1. YAML front matter（deep-agents 风格）：
 *      ---
 *      name: skill-name
 *      description: 技能描述
 *      ---
 *      # 正文
 *   2. 简单 Markdown：
 *      # 标题
 *      > 描述
 *      正文
 */

import fs from 'fs'
import path from 'path'
import { getAgentRootDir } from './backend.js'
import { createLogger } from './logger.js'

const log = createLogger('Skills')

/**
 * 获取 SKILL 目录路径
 * @returns {string}
 */
export function getSkillDir() {
  return path.join(getAgentRootDir(), 'SKILL')
}

/**
 * 确保 SKILL 目录存在
 */
export function ensureSkillDir() {
  const skillDir = getSkillDir()
  if (!fs.existsSync(skillDir)) {
    fs.mkdirSync(skillDir, { recursive: true })
    log.info(`已创建 SKILL 目录: ${skillDir}`)
  }
}

/**
 * 从 Markdown 内容中解析 Skill 元数据
 * 支持两种格式：YAML front matter 和 简单 Markdown
 * @param {string} content 文件内容
 * @param {string} fileName 文件名（用于 fallback）
 * @returns {{ name: string, description: string }}
 */
export function parseSkillMetadata(content, fileName) {
  // 格式 1：YAML front matter
  const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (yamlMatch) {
    const yaml = yamlMatch[1]
    const nameMatch = yaml.match(/^name:\s*(.+)$/m)
    const descMatch = yaml.match(/^description:\s*(.+)$/m)
    if (nameMatch) {
      return {
        name: nameMatch[1].trim(),
        description: descMatch ? descMatch[1].trim() : ''
      }
    }
  }

  // 格式 2：简单 Markdown（# 标题 + > 描述）
  const lines = content.split('\n')
  let name = ''
  let description = ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (!name && trimmed.startsWith('# ')) {
      name = trimmed.slice(2).trim()
    } else if (!description && trimmed.startsWith('>')) {
      description = trimmed.replace(/^>\s?/, '').trim()
    }
    if (name && description) break
  }

  // Fallback：用文件名作为名称
  if (!name) {
    name = fileName.replace(/\.md$/i, '')
  }

  return { name, description }
}

/**
 * 扫描 SKILL 目录，加载所有 .md 技能文件
 * 支持两种组织方式：
 *   1. 顶层 .md 文件：/SKILL/my-skill.md
 *   2. 子目录 + SKILL.md：/SKILL/my-skill/SKILL.md
 * @returns {Array<{ name, description, path, fileName }>}
 */
export function listSkills() {
  ensureSkillDir()
  const skillDir = getSkillDir()
  const skills = []

  if (!fs.existsSync(skillDir)) return skills

  const entries = fs.readdirSync(skillDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      // 顶层 .md 文件
      const filePath = path.join(skillDir, entry.name)
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const meta = parseSkillMetadata(content, entry.name)
        skills.push({
          name: meta.name,
          description: meta.description,
          path: `/SKILL/${entry.name}`,
          fileName: entry.name
        })
      } catch (e) {
        log.warn(`读取 Skill 文件失败: ${entry.name}`, e.message)
      }
    } else if (entry.isDirectory()) {
      // 子目录：查找 SKILL.md
      const skillMdPath = path.join(skillDir, entry.name, 'SKILL.md')
      if (fs.existsSync(skillMdPath)) {
        try {
          const content = fs.readFileSync(skillMdPath, 'utf-8')
          const meta = parseSkillMetadata(content, `SKILL.md`)
          skills.push({
            name: meta.name || entry.name,
            description: meta.description,
            path: `/SKILL/${entry.name}/SKILL.md`,
            fileName: `${entry.name}/SKILL.md`
          })
        } catch (e) {
          log.warn(`读取 Skill 文件失败: ${entry.name}/SKILL.md`, e.message)
        }
      }
    }
  }

  return skills
}

/**
 * 生成 SKILL 索引文件 _index.json（供前端展示）
 * @returns {Array} skills 列表
 */
export function generateSkillIndex() {
  const skills = listSkills()
  const skillDir = getSkillDir()
  const indexPath = path.join(skillDir, '_index.json')

  try {
    fs.writeFileSync(indexPath, JSON.stringify(skills, null, 2), 'utf-8')
    log.info(`已生成 SKILL 索引: ${indexPath}（${skills.length} 个技能）`)
  } catch (e) {
    log.warn(`生成 SKILL 索引失败:`, e.message)
  }

  return skills
}

/**
 * 获取 Skill 注入到系统提示词的文本
 * @returns {string}
 */
export function buildSkillsPromptSection() {
  const skills = listSkills()
  if (skills.length === 0) return ''

  const lines = skills.map(s => `- ${s.name}: ${s.description}`)
  return `\n\n## 可用技能（Skills）\n你可以通过读取以下技能文件来了解工作流程：\n${lines.join('\n')}\n`
}
