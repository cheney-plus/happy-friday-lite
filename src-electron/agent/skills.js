/**
 * Skills 加载
 * ============
 * 设计参考：Agent智能体设计.md 2.5
 *
 * - 通过 `skills=["/SKILL/"]` 传给 `createDeepAgent`，由 `SkillsMiddleware` 自动扫描 .md 文件
 * - 维护 `_index.json` 索引文件供前端展示
 * - SKILL 目录路径：{userData}/knowledge/agent/SKILL/
 *
 * 内置技能同步：
 *   - ensureSkillDir() 在创建 SKILL 目录后调用 syncBuiltinSkills()
 *   - syncBuiltinSkills() 将 public/skills/* 下的每个技能目录（含 SKILL.md 及脚本/模板）
 *     同步到用户的 SKILL/ 目录，作为默认内置技能供 Agent 使用
 *   - 内置技能始终覆盖更新（确保版本一致）；用户自建技能不受影响
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
import { fileURLToPath } from 'url'
import { getAgentRootDir } from './backend.js'
import { createLogger } from './logger.js'

const log = createLogger('Skills')

// 当前文件所在目录（src-electron/agent/）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 内置技能源目录：项目根目录下的 public/skills/
// 开发环境：{项目根}/public/skills/
// 打包环境：{app根}/public/skills/（需在 electron-builder files 中包含）
const BUILTIN_SKILLS_SRC_DIR = path.resolve(__dirname, '..', '..', '..', 'public', 'skills')

/**
 * 获取 SKILL 目录路径
 * @returns {string}
 */
export function getSkillDir() {
  return path.join(getAgentRootDir(), 'SKILL')
}

/**
 * 确保 SKILL 目录存在，并同步内置技能
 */
export function ensureSkillDir() {
  const skillDir = getSkillDir()
  if (!fs.existsSync(skillDir)) {
    fs.mkdirSync(skillDir, { recursive: true })
    log.info(`已创建 SKILL 目录: ${skillDir}`)
  }
  // 同步内置技能（public/skills/* → SKILL/）
  syncBuiltinSkills()
}

/**
 * 递归复制目录
 * @param {string} src 源目录
 * @param {string} dest 目标目录
 */
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * 同步内置技能到用户的 SKILL 目录
 *
 * 将 public/skills/* 下的每个技能目录同步到 {SKILL}/ 下，
 * 作为默认内置技能供 Agent 使用。
 *
 * 同步策略：
 *   - 通过版本标记文件 .builtin-synced 避免重复同步（源未变更时跳过）
 *   - 源变更时覆盖更新内置技能（确保版本一致，作为"默认内置"语义）
 *   - 用户自建的技能（不在内置列表中）不受影响
 *   - 若内置技能源目录不存在（打包未包含），仅记录警告，不影响已有技能
 *
 * @returns {string[]} 已同步的内置技能名列表（未变更时返回空数组）
 */
export function syncBuiltinSkills() {
  const skillDir = getSkillDir()

  // 内置技能源目录不存在（打包未包含或开发环境异常），跳过同步
  if (!fs.existsSync(BUILTIN_SKILLS_SRC_DIR)) {
    log.warn(`内置技能源目录不存在，跳过同步: ${BUILTIN_SKILLS_SRC_DIR}`)
    return []
  }

  // 计算源目录签名（子目录名 + 各 SKILL.md 的 mtimeMs）作为版本标记
  const sourceSignature = computeBuiltinSignature()
  const markerPath = path.join(skillDir, '.builtin-synced')

  // 版本标记存在且与当前源签名一致 → 跳过同步（避免每次创建 Agent 都复制 200+ 文件）
  let existingMarker = ''
  try {
    if (fs.existsSync(markerPath)) {
      existingMarker = fs.readFileSync(markerPath, 'utf-8').trim()
    }
  } catch (_e) {
    /* 读取失败则强制同步 */
  }

  if (sourceSignature && existingMarker === sourceSignature) {
    log.info('内置技能已是最新，跳过同步')
    return []
  }

  const synced = []
  const entries = fs.readdirSync(BUILTIN_SKILLS_SRC_DIR, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillMdPath = path.join(BUILTIN_SKILLS_SRC_DIR, entry.name, 'SKILL.md')
    if (!fs.existsSync(skillMdPath)) continue

    const destSkillDir = path.join(skillDir, entry.name)
    try {
      copyDirRecursive(path.join(BUILTIN_SKILLS_SRC_DIR, entry.name), destSkillDir)
      synced.push(entry.name)
    } catch (e) {
      log.warn(`同步内置技能失败: ${entry.name}`, e.message)
    }
  }

  if (synced.length > 0) {
    log.info(`已同步内置技能: ${synced.length} 个 (${synced.join(', ')})`)
    // 写入版本标记，下次启动若源未变更则跳过同步
    try {
      fs.writeFileSync(markerPath, sourceSignature, 'utf-8')
    } catch (e) {
      log.warn(`写入内置技能版本标记失败: ${e.message}`)
    }
  }
  return synced
}

/**
 * 计算内置技能源目录的签名
 *
 * 签名 = 各技能子目录名 + 其 SKILL.md 的 mtimeMs，用 `|` 拼接。
 * 用于判断源目录是否发生变更，避免重复同步。
 *
 * @returns {string} 签名字符串；源目录不可用时返回空串
 */
function computeBuiltinSignature() {
  try {
    const entries = fs.readdirSync(BUILTIN_SKILLS_SRC_DIR, { withFileTypes: true })
    const parts = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillMdPath = path.join(BUILTIN_SKILLS_SRC_DIR, entry.name, 'SKILL.md')
      if (!fs.existsSync(skillMdPath)) continue
      const stat = fs.statSync(skillMdPath)
      parts.push(`${entry.name}:${stat.mtimeMs}`)
    }
    return parts.join('|')
  } catch (_e) {
    return ''
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
