/**
 * SKILL 技能加载模块
 *
 * 设计参考：src/views/knowledge/agent/Agent智能体设计.md §4.4
 *
 * 设计思路：
 *   由于项目未安装 deepagents SDK，无法使用其 SkillsMiddleware 自动加载 skill。
 *   本模块采用等价的"手动注入"策略：
 *     1. 扫描 {agentRootDir}/SKILL/ 目录，支持两种组织方式：
 *        a) 顶层 .md 文件：每个文件就是一个 skill
 *        b) 子目录：每个子目录下应有 SKILL.md（兼容 deep-agents 约定）
 *     2. 解析每个 skill 文件的元信息（标题、描述）与正文
 *     3. 将所有 skill 内容拼接为一段 Markdown，注入到 Agent 系统提示中
 *     4. LLM 在系统提示中看到 skill 列表，会按 skill 中的指引工作
 *
 * Skill 文件格式（兼容两种约定）：
 *
 *   约定 A（设计文档 §4.4，简单格式）：
 *   ```markdown
 *   # 研究助手
 *
 *   > 当用户要求调研某个主题时启用。
 *
 *   ## 工作流程
 *   1. 调用 retrieve_knowledge 工具检索知识库
 *   2. 综合输出研究报告
 *   ```
 *
 *   约定 B（deep-agents 风格，YAML front matter）：
 *   ```markdown
 *   ---
 *   name: deep-agents-core
 *   description: "INVOKE THIS SKILL when building ANY Deep Agents application..."
 *   ---
 *
 *   <overview>...</overview>
 *   <when-to-use>...</when-to-use>
 *   ```
 *
 * 与设计文档 §4.4 的差异：
 *   - 设计文档原本用 deepagents SkillsMiddleware，本模块改为手动注入 system prompt
 *   - 同时兼容子目录组织方式（每个子目录一个 SKILL.md）
 *   - 不再需要 _index.json（直接由 loadSkills 返回内存对象，前端通过 IPC 获取）
 */

import fs from 'fs'
import path from 'path'
import { logger } from './logger.js'

const log = logger.scope('Skill')

/**
 * 解析 YAML front matter（简单实现，不依赖 yaml 库）
 *
 * 仅解析顶层的 `name` 和 `description` 字段，足够 skill 元信息使用。
 *
 * @param {string} content - 文件完整内容
 * @returns {{name?: string, description?: string, body: string}|null}
 *   front matter 不存在时返回 null，body 为去掉 front matter 后的正文
 */
function parseFrontMatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return null
  const yamlBlock = match[1]
  const body = match[2]
  const meta = {}
  // 简单解析 `key: value` 行，value 可能被双引号包围
  for (const line of yamlBlock.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    let value = m[2].trim()
    // 去掉包围的双引号
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }
    meta[key] = value
  }
  return { name: meta.name, description: meta.description, body }
}

/**
 * 解析单个 skill 文件
 *
 * 元信息提取优先级：
 *   1. YAML front matter 的 name/description（deep-agents 风格）
 *   2. 第一个 `# xxx` 行作为 title，第一个 `> xxx` 行作为 desc（设计文档约定）
 *   3. 都没有时，用文件名作为 title
 *
 * @param {string} filePath - skill 文件绝对路径
 * @param {string} displayName - 展示用名称（如 "research.md" 或 "deep-agents-core/SKILL.md"）
 * @returns {{file, title, desc, content}|null}
 */
function parseSkillFile(filePath, displayName) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')

    let title = ''
    let desc = ''
    let bodyForLookup = content

    // 1. 尝试 YAML front matter
    const fm = parseFrontMatter(content)
    if (fm) {
      title = fm.name || ''
      desc = fm.description || ''
      bodyForLookup = fm.body
    }

    // 2. 兜底：从正文提取 # 标题 和 > 描述
    if (!title) {
      const titleMatch = bodyForLookup.match(/^#\s+(.+)$/m)
      title = titleMatch ? titleMatch[1].trim() : ''
    }
    if (!desc) {
      const descMatch = bodyForLookup.match(/^>\s*(.+)$/m)
      desc = descMatch ? descMatch[1].trim() : ''
    }

    // 3. 都没有时用文件名
    if (!title) {
      title = displayName.replace(/\.md$/i, '')
    }

    return { file: displayName, title, desc, content }
  } catch (e) {
    log.warn(`解析 skill 文件失败: ${displayName}, error=${e.message}`)
    return null
  }
}

/**
 * 扫描并加载所有 skill
 *
 * 扫描规则：
 *   - SKILL 目录下的 .md 文件 → 每个 file 是一个 skill
 *   - SKILL 目录下的子目录 → 进入子目录查找 SKILL.md（兼容 deep-agents 约定）
 *   - 跳过以 . 开头的隐藏文件/目录
 *
 * @param {string} agentRootDir - Agent 工作区根目录
 * @returns {Array<{file, title, desc, content}>} skill 列表
 */
export function loadSkills(agentRootDir) {
  const skillDir = path.join(agentRootDir, 'SKILL')
  if (!fs.existsSync(skillDir)) {
    log.info(`SKILL 目录不存在: ${skillDir}`)
    return []
  }

  let entries = []
  try {
    entries = fs.readdirSync(skillDir, { withFileTypes: true })
  } catch (e) {
    log.warn(`读取 SKILL 目录失败: ${e.message}`)
    return []
  }

  const skills = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      // 顶层 .md 文件
      const filePath = path.join(skillDir, entry.name)
      const skill = parseSkillFile(filePath, entry.name)
      if (skill) skills.push(skill)
    } else if (entry.isDirectory()) {
      // 子目录：查找其中的 SKILL.md（兼容 deep-agents 约定）
      const subSkillFile = path.join(skillDir, entry.name, 'SKILL.md')
      if (fs.existsSync(subSkillFile)) {
        const displayName = `${entry.name}/SKILL.md`
        const skill = parseSkillFile(subSkillFile, displayName)
        if (skill) skills.push(skill)
      } else {
        // 子目录下没有 SKILL.md，尝试加载该子目录下所有 .md
        try {
          const subEntries = fs.readdirSync(path.join(skillDir, entry.name))
            .filter((f) => f.toLowerCase().endsWith('.md'))
          for (const subFile of subEntries) {
            const filePath = path.join(skillDir, entry.name, subFile)
            const displayName = `${entry.name}/${subFile}`
            const skill = parseSkillFile(filePath, displayName)
            if (skill) skills.push(skill)
          }
        } catch (_e) {
          // 忽略子目录读取失败
        }
      }
    }
  }

  log.info(`加载 ${skills.length} 个 SKILL: ${skills.map((s) => s.file).join(', ') || '无'}`)
  return skills
}

/**
 * 将 skill 列表格式化为可注入 system prompt 的 Markdown 段落
 *
 * 格式：
 *   ## 可用技能（SKILL）
 *
 *   以下技能由用户配置，按需启用：
 *
 *   ### 技能：研究助手
 *   文件: research.md
 *
 *   <完整 skill 文件内容>
 *
 *   ---
 *
 *   ### 技能：xxx
 *   ...
 *
 * @param {Array} skills - loadSkills 返回的 skill 列表
 * @returns {string} 注入用 Markdown，无 skill 时返回空串
 */
export function formatSkillsForPrompt(skills) {
  if (!skills || skills.length === 0) return ''

  const blocks = skills.map((s) => {
    return [
      `### 技能：${s.title}`,
      `文件: ${s.file}`,
      '',
      s.content,
    ].join('\n')
  })

  return [
    '',
    '## 可用技能（SKILL）',
    '',
    '以下技能由用户在 SKILL 目录中配置，遇到匹配场景时按技能文档中的指引工作：',
    '',
    blocks.join('\n\n---\n\n'),
  ].join('\n')
}

/**
 * 确保 SKILL 目录存在
 * @param {string} agentRootDir - Agent 工作区根目录
 * @returns {string} SKILL 目录绝对路径
 */
export function ensureSkillDir(agentRootDir) {
  const skillDir = path.join(agentRootDir, 'SKILL')
  if (!fs.existsSync(skillDir)) {
    fs.mkdirSync(skillDir, { recursive: true })
    log.info(`创建 SKILL 目录: ${skillDir}`)
  }
  return skillDir
}

/**
 * 列出 skill 元信息（供前端展示，不包含完整正文）
 * @param {string} agentRootDir
 * @returns {Array<{file, title, desc}>}
 */
export function listSkillMetas(agentRootDir) {
  return loadSkills(agentRootDir).map((s) => ({
    file: s.file,
    title: s.title,
    desc: s.desc,
  }))
}
