/**
 * 内置工具：网页正文抓取（fetch_webpage_text）
 * =================================================
 * 设计参考：Agent智能体设计.md 2.9 内置工具清单
 *          commands.js#L702-775（kb-fetch-webpage 的实现参考）
 *
 * 抓取网页 HTML 并清洗为纯文本：
 *   1. 使用 fetch 获取原始 HTML（在主进程执行以规避渲染进程跨域限制）
 *   2. 优先使用 @mozilla/readability 提取正文（需 jsdom 支持）
 *   3. 兜底使用 cheerio 清洗 + html-to-text 转纯文本
 *   4. 返回包含标题、URL、正文的纯文本结果
 *
 * 仅抓取，只读操作，无需审批。
 */

import { z } from 'zod'
import { registerTool } from '../registry.js'

// 默认 UA：与 commands.js kb-fetch-webpage 保持一致
const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const DEFAULT_TIMEOUT_MS = 30000
// 正文最大长度：32KB
const MAX_TEXT_LENGTH = 32 * 1024

/**
 * 使用 @mozilla/readability 提取正文
 * 依赖 jsdom（项目已通过 @langchain/community 间接安装）
 * @param {string} html 原始 HTML
 * @param {string} finalUrl 最终 URL（用于解析相对链接）
 * @returns {Promise<{ title: string, content: string, textContent: string, byline: string } | null>}
 */
async function extractWithReadability(html, finalUrl) {
  try {
    const [{ Readability }, { JSDOM }] = await Promise.all([
      import('@mozilla/readability'),
      import('jsdom')
    ])
    const dom = new JSDOM(html, {
      url: finalUrl,
      // 关闭外部资源加载，避免请求脚本/样式
      resources: undefined,
      runScripts: 'outside-only'
    })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    if (!article || !article.textContent || article.textContent.trim().length < 50) {
      return null
    }
    return {
      title: article.title || '',
      content: article.content || '',
      textContent: article.textContent || '',
      byline: article.byline || ''
    }
  } catch (_e) {
    // jsdom 或 readability 不可用，返回 null 让调用方走兜底逻辑
    return null
  }
}

/**
 * 兜底：cheerio 清洗 + html-to-text 转纯文本
 * @param {string} html 原始 HTML
 * @returns {Promise<{ title: string, text: string }>}
 */
async function extractWithCheerio(html) {
  const cheerio = await import('cheerio')
  const { convert } = await import('html-to-text')

  const $ = cheerio.load(html)

  // 提取标题
  const title =
    $('title').first().text().trim() ||
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    ''

  // 移除明显的非正文元素
  $(
    'script, style, noscript, iframe, svg, canvas, nav, aside, header, footer, form, button, ' +
      '[role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"], ' +
      '.nav, .navbar, .menu, .sidebar, .footer, .header, .advertisement, .ad, .comment, ' +
      '.related, .recommend, .breadcrumb, .pagination, .social, .share, .cookie'
  ).remove()

  // 优先取 article 或 main 标签，其次取 body
  const root = $('article').first().length
    ? $('article').first()
    : $('main').first().length
      ? $('main').first()
      : $('body')

  // html-to-text 转换为纯文本
  const text = convert(root.html() || root.text() || '', {
    wordwrap: false,
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' },
      { selector: 'table', options: { uppercaseHeaderCells: false } }
    ],
    // 限制空白处理
    preserveNewlines: true
  })
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()

  return { title: title.trim(), text }
}

const schema = z.object({
  url: z.string().describe('要抓取的网页 URL（http/https，可省略协议前缀）'),
  timeoutMs: z.number().optional().describe('请求超时（毫秒），默认 30000'),
  rawHtml: z
    .boolean()
    .optional()
    .describe('是否返回原始 HTML 而非清洗后的纯文本（默认 false，返回纯文本）')
})

async function handler(args, ctx) {
  const { url, timeoutMs = DEFAULT_TIMEOUT_MS, rawHtml = false } = args

  // 1. 规范化 URL
  let fetchUrl = (url || '').trim()
  if (!fetchUrl) {
    return '错误：URL 不能为空'
  }
  if (!/^https?:\/\//i.test(fetchUrl)) {
    fetchUrl = 'https://' + fetchUrl
  }

  ctx.logger.info(`[fetch_webpage_text] url=${fetchUrl}, rawHtml=${rawHtml}`)

  // 2. 发起 fetch 请求（带超时）
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      },
      redirect: 'follow',
      signal: controller.signal
    })
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') {
      return `抓取超时（${timeoutMs}ms）：${fetchUrl}`
    }
    ctx.logger.error(`[fetch_webpage_text] 请求失败: ${e.message}`)
    return `抓取失败: ${e.message}`
  }
  clearTimeout(timer)

  if (!response.ok) {
    ctx.logger.warn(`[fetch_webpage_text] HTTP ${response.status}`)
    return `抓取失败：HTTP ${response.status} ${response.statusText || ''}`
  }

  const html = await response.text()
  const finalUrl = response.url || fetchUrl

  ctx.logger.info(`[fetch_webpage_text] htmlLen=${html.length}, finalUrl=${finalUrl}`)

  // 3. 如果调用方要求原始 HTML，直接返回（截断）
  if (rawHtml) {
    const truncated = html.length > MAX_TEXT_LENGTH
    const out = truncated ? html.slice(0, MAX_TEXT_LENGTH) + `\n... (已截断，共 ${html.length} 字符)` : html
    return `URL：${finalUrl}\nHTTP ${response.status}\n\n原始 HTML：\n${out}`
  }

  // 4. 优先使用 Readability 提取正文
  let title = ''
  let text = ''

  const article = await extractWithReadability(html, finalUrl)
  if (article && article.textContent) {
    title = article.title
    text = article.textContent
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim()
    ctx.logger.info(`[fetch_webpage_text] readability 提取成功, textLen=${text.length}`)
  } else {
    // 5. 兜底：cheerio + html-to-text
    const fallback = await extractWithCheerio(html)
    title = fallback.title
    text = fallback.text
    ctx.logger.info(`[fetch_webpage_text] 使用 cheerio 兜底, textLen=${text.length}`)
  }

  // 6. 截断输出
  if (text.length > MAX_TEXT_LENGTH) {
    text = text.slice(0, MAX_TEXT_LENGTH) + `\n... (正文已截断，共 ${text.length} 字符)`
  }

  // 7. 组装最终输出
  const header = [
    `标题：${title || '(无标题)'}`,
    `URL：${finalUrl}`,
    `原始 HTML 大小：${html.length} 字符`,
    '',
    '正文：'
  ].join('\n')

  return header + '\n' + (text || '(未能提取正文)')
}

registerTool({
  name: 'fetch_webpage_text',
  description:
    '抓取网页并提取正文纯文本内容。' +
    '优先使用 @mozilla/readability 智能提取正文，自动去除导航、广告、脚本等非正文内容；' +
    '提取失败时回退到 cheerio + html-to-text 清洗。' +
    '适用于获取文章、博客、文档等网页的文本内容供后续分析。' +
    '可选参数 rawHtml=true 时返回原始 HTML。',
  schema,
  handler,
  meta: { requireApproval: false } // 抓取是只读操作
})
