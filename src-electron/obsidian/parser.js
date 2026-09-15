import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
const WIKILINK_RE = /(!?)\[\[([^\]\n]+)\]\]/g
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)\n]+)\)/g
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif'])

export function parseObsidianMarkdown(markdown, options = {}) {
  const source = String(markdown || '')
  const { frontmatter, body } = parseFrontmatter(source)
  const searchableBody = maskCodeBlocks(body)
  const links = extractWikilinks(searchableBody)
  const tags = collectTags(frontmatter, searchableBody)
  const aliases = normalizeArray(frontmatter.aliases || frontmatter.alias)

  return {
    filePath: options.filePath || '',
    frontmatter,
    body,
    tags,
    aliases,
    wikilinks: links.filter(link => !link.embed),
    embeds: links.filter(link => link.embed)
  }
}

export async function transformObsidianMarkdown(markdown, options = {}) {
  const filePath = options.filePath || ''
  const rootDir = options.rootDir || findVaultRoot(filePath)
  const currentDir = filePath ? path.dirname(filePath) : rootDir
  const linkMap = {}
  let linkIndex = 0

  let output = String(markdown || '').replace(WIKILINK_RE, (raw, bang, value) => {
    const parsed = parseWikiTarget(value)
    if (bang) {
      const assetPath = resolveVaultAsset(parsed.target, { currentDir, rootDir, attachmentDirs: options.attachmentDirs, imageDirs: options.imageDirs })
      return `![${escapeMarkdownAlt(parsed.alias || parsed.target)}](${assetPath ? `obsidian-asset:${encodeURIComponent(assetPath)}` : ''})`
    }

    const href = `obsidian-link:${linkIndex++}`
    linkMap[href] = { ...parsed, resolvedPath: resolveWikiNotePath(parsed.target, { currentDir, rootDir }) }
    return `[${escapeMarkdownLabel(parsed.alias || parsed.heading || parsed.target)}](${href})`
  })

  output = await replaceAsync(output, MARKDOWN_IMAGE_RE, async (raw, alt, src) => {
    if (isRemoteUrl(src) || src.startsWith('data:') || src.startsWith('obsidian-asset:')) return raw
    const cleanSrc = src.replace(/^<|>$/g, '').split('#')[0]
    const assetPath = resolveVaultAsset(cleanSrc, { currentDir, rootDir, attachmentDirs: options.attachmentDirs, imageDirs: options.imageDirs })
    if (!assetPath) return raw
    const dataUrl = await loadAssetDataUrl(assetPath, options.resolveAsset)
    return dataUrl ? `![${alt}](${dataUrl})` : raw
  })

  output = await replaceAsync(output, /!\[([^\]]*)\]\(obsidian-asset:([^)]+)\)/g, async (raw, alt, encodedPath) => {
    const assetPath = decodeURIComponent(encodedPath)
    const dataUrl = await loadAssetDataUrl(assetPath, options.resolveAsset)
    return dataUrl ? `![${alt}](${dataUrl})` : raw
  })

  const parsed = parseObsidianMarkdown(markdown, options)
  return { markdown: output, linkMap, metadata: parsed }
}

export async function transformMarkdownFile(filePath, options = {}) {
  const content = fs.readFileSync(filePath, 'utf-8')
  return transformObsidianMarkdown(content, { ...options, filePath })
}

export function resolveVaultAsset(target, options = {}) {
  if (!target || isRemoteUrl(target) || target.startsWith('data:')) return ''
  const cleanTarget = decodeURIComponent(String(target).replace(/^<|>$/g, '').split('#')[0])
  if (!cleanTarget) return ''
  if (path.isAbsolute(cleanTarget)) {
    return fs.existsSync(cleanTarget) ? cleanTarget : ''
  }

  const candidates = []
  if (options.currentDir) candidates.push(path.resolve(options.currentDir, cleanTarget))
  if (options.rootDir) candidates.push(path.resolve(options.rootDir, cleanTarget))

  for (const dir of [...normalizeArray(options.attachmentDirs), ...normalizeArray(options.imageDirs)]) {
    if (options.rootDir && dir) candidates.push(path.resolve(options.rootDir, dir, cleanTarget))
  }

  return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0] || ''
}

export function findVaultRoot(filePath) {
  let current = filePath ? path.dirname(filePath) : process.cwd()
  while (current && current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.obsidian'))) return current
    current = path.dirname(current)
  }
  return filePath ? path.dirname(filePath) : process.cwd()
}

export function resolveWikiNotePath(target, options = {}) {
  if (!target) return ''
  const cleanTarget = String(target).split('#')[0].trim()
  if (!cleanTarget) return ''
  const currentDir = options.currentDir || ''
  const rootDir = options.rootDir || currentDir
  const withExt = path.extname(cleanTarget) ? cleanTarget : `${cleanTarget}.md`
  const candidates = [
    currentDir ? path.resolve(currentDir, withExt) : '',
    rootDir ? path.resolve(rootDir, withExt) : ''
  ].filter(Boolean)
  const exact = candidates.find(candidate => fs.existsSync(candidate))
  if (exact) return exact
  return findFileByBasename(rootDir, path.basename(withExt))
}

function parseFrontmatter(source) {
  const match = source.match(FRONTMATTER_RE)
  if (!match) return { frontmatter: {}, body: source }
  try {
    return { frontmatter: yaml.load(match[1]) || {}, body: source.slice(match[0].length) }
  } catch (e) {
    return { frontmatter: {}, body: source.slice(match[0].length), frontmatterError: e.message }
  }
}

function extractWikilinks(source) {
  const links = []
  source.replace(WIKILINK_RE, (raw, bang, value) => {
    links.push({ raw, ...parseWikiTarget(value), embed: Boolean(bang) })
    return raw
  })
  return links
}

function parseWikiTarget(value) {
  const [targetPart, aliasPart = ''] = String(value).split('|')
  const [target, heading = ''] = targetPart.split('#')
  return {
    target: target.trim(),
    heading: heading.trim(),
    alias: aliasPart.trim()
  }
}

function collectTags(frontmatter, source) {
  const set = new Set()
  for (const tag of normalizeArray(frontmatter.tags || frontmatter.tag)) {
    String(tag).split(/[,\s]+/).filter(Boolean).forEach(item => set.add(stripTagPrefix(item)))
  }
  source.replace(/(^|[\s([{])#([A-Za-z0-9_\-/\u4e00-\u9fff]+)(?=$|[\s.,;:!?)}\]])/g, (_raw, _prefix, tag) => {
    set.add(stripTagPrefix(tag))
    return _raw
  })
  return [...set].filter(Boolean)
}

function maskCodeBlocks(source) {
  return String(source || '').replace(/```[\s\S]*?```/g, match => ' '.repeat(match.length))
}

function normalizeArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.flatMap(normalizeArray)
  return [value].map(item => String(item).trim()).filter(Boolean)
}

function stripTagPrefix(value) {
  return String(value || '').replace(/^#/, '').trim()
}

function isRemoteUrl(value) {
  return /^(https?:|file:|mailto:)/i.test(String(value || ''))
}

function escapeMarkdownLabel(value) {
  return String(value || '').replace(/([\[\]])/g, '\\$1')
}

function escapeMarkdownAlt(value) {
  return String(value || '').replace(/[\[\]\n\r]/g, ' ')
}

async function loadAssetDataUrl(assetPath, resolver) {
  if (typeof resolver === 'function') return resolver(assetPath)
  if (!assetPath || !fs.existsSync(assetPath)) return ''
  const ext = path.extname(assetPath).toLowerCase()
  if (!IMAGE_EXTENSIONS.has(ext)) return ''
  const mime = mimeForExtension(ext)
  const data = fs.readFileSync(assetPath).toString('base64')
  return `data:${mime};base64,${data}`
}

function mimeForExtension(ext) {
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.bmp') return 'image/bmp'
  if (ext === '.avif') return 'image/avif'
  return 'image/png'
}

function findFileByBasename(rootDir, basename) {
  if (!rootDir || !fs.existsSync(rootDir)) return ''
  const stack = [rootDir]
  while (stack.length) {
    const dir = stack.pop()
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (e) {
      continue
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) stack.push(fullPath)
      } else if (entry.name.toLowerCase() === basename.toLowerCase()) {
        return fullPath
      }
    }
  }
  return ''
}

async function replaceAsync(source, regex, replacer) {
  const matches = []
  source.replace(regex, (...args) => {
    matches.push(args)
    return args[0]
  })
  const replacements = await Promise.all(matches.map(args => replacer(...args)))
  let index = 0
  return source.replace(regex, () => replacements[index++])
}
