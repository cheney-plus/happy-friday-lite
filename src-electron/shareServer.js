import http from 'http'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as db from './db.js'

// 内网分享服务：在主进程启动一个 HTTP 服务，局域网内可通过浏览器访问
// 复用前端构建产物（dist/），直接加载已有的对话界面（隐藏输入框）。
// 仅暴露 GET /api/share/:sessionId 数据接口 + 静态文件服务，无任何写操作

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// dist 目录位于项目根目录（src-electron 的上一级）
const DIST_DIR = path.join(__dirname, '..', 'dist')

let server = null
let serverPort = null
const PREFERRED_PORT = 17918

// 获取本机内网 IPv4 地址（非回环）
function getLocalIp() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '127.0.0.1'
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
}

function getMime(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

// 提供前端构建产物的静态文件服务（SPA：未命中的路径回退到 index.html）
function serveStatic(res, urlPath) {
  if (!fs.existsSync(DIST_DIR)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Share service unavailable: app not built yet.')
    return
  }

  // 规范化并防止路径穿越
  const resolved = path.normalize(path.join(DIST_DIR, urlPath))
  if (resolved !== DIST_DIR && !resolved.startsWith(DIST_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }

  let filePath = resolved
  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // SPA 回退：未命中的路径交给前端路由处理
      filePath = path.join(DIST_DIR, 'index.html')
    }
    const data = fs.readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': getMime(filePath) })
    res.end(data)
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not Found')
  }
}

// 分享数据接口：返回会话信息和消息列表
function serveShareApi(res, sessionId) {
  try {
    const session = db.getSession(sessionId)
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ success: false, error: 'Session not found' }))
      return
    }
    const messages = db.getMessages(sessionId)
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ success: true, session, messages }))
  } catch (e) {
    // 数据库未就绪或查询异常时返回 404，避免暴露内部错误
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ success: false, error: 'Session not found' }))
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getSharedMessageContent(message) {
  if (typeof message?.content === 'string' && message.content.trim()) return message.content
  const segments = message?.metadata?.segments
  if (!Array.isArray(segments)) return ''
  return segments
    .filter(segment => segment?.type === 'text' && segment.content)
    .map(segment => segment.content)
    .join('\n\n')
}

// A framework-free page keeps LAN conversation links readable in browsers that
// cannot load Vite's module-based application bundle.
function serveSharedConversationPage(res, sessionId) {
  try {
    const session = db.getSession(sessionId)
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<!doctype html><title>Not Found</title><p>Conversation not found.</p>')
      return
    }

    const title = session.title || 'Friday Conversation'
    const messages = db.getMessages(sessionId)
    const content = messages
      .map((message) => {
        const text = getSharedMessageContent(message)
        if (!text) return ''
        const role = message.role === 'user' ? 'You' : 'Friday'
        const roleClass = message.role === 'user' ? 'user' : 'assistant'
        return `<div class="message ${roleClass}"><div class="role">${role}</div><div class="content">${escapeHtml(text)}</div></div>`
      })
      .filter(Boolean)
      .join('') || '<p class="empty">This conversation has no messages.</p>'

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f5f5f5; color: #1c1917; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
    .page { max-width: 860px; margin: 0 auto; padding: 32px 20px 48px; }
    .header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e7e5e4; }
    h1 { margin: 0; font-size: 22px; line-height: 1.35; font-weight: 600; word-break: break-word; }
    .message { margin: 0 0 16px; padding: 16px; border: 1px solid #e7e5e4; border-radius: 8px; background: #fff; }
    .message.user { border-left: 3px solid #2563eb; }
    .role { margin-bottom: 8px; color: #78716c; font-size: 13px; font-weight: 600; }
    .content { white-space: pre-wrap; overflow-wrap: break-word; word-wrap: break-word; line-height: 1.65; font-size: 15px; }
    .empty { color: #78716c; text-align: center; }
    @media (max-width: 480px) { .page { padding: 20px 12px 32px; } .message { padding: 14px; } h1 { font-size: 20px; } }
  </style>
</head>
<body><div class="page"><div class="header"><h1>${escapeHtml(title)}</h1></div>${content}</div></body>
</html>`

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<!doctype html><title>Not Found</title><p>Conversation not found.</p>')
  }
}

// 笔记分享数据接口：返回笔记内容（只读查看）
function serveNoteShareApi(res, noteId) {
  try {
    const note = db.getNote(noteId)
    if (!note) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ success: false, error: 'Note not found' }))
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ success: true, note }))
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ success: false, error: 'Note not found' }))
  }
}

function handleRequest(req, res) {
  try {
    // 仅允许 GET 请求
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Method Not Allowed')
      return
    }

    const url = new URL(req.url, `http://${req.headers.host}`)

    // 健康检查
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    // 笔记分享数据接口 /api/share/note/:noteId（需在会话接口之前匹配）
    const noteApiMatch = url.pathname.match(/^\/api\/share\/note\/(.+)$/)
    if (noteApiMatch) {
      serveNoteShareApi(res, decodeURIComponent(noteApiMatch[1]))
      return
    }

    // 分享数据接口 /api/share/:sessionId
    const apiMatch = url.pathname.match(/^\/api\/share\/(.+)$/)
    if (apiMatch) {
      serveShareApi(res, decodeURIComponent(apiMatch[1]))
      return
    }

    // Serve shared conversations directly instead of relying on an ES module SPA.
    const sharePageMatch = url.pathname.match(/^\/share\/([^/]+)$/)
    if (sharePageMatch) {
      serveSharedConversationPage(res, decodeURIComponent(sharePageMatch[1]))
      return
    }

    // 其余请求交给静态文件服务（含 SPA 回退）
    serveStatic(res, url.pathname)
  } catch (e) {
    console.error('[ShareServer] request error:', e)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Internal Server Error')
    }
  }
}

// 启动分享服务：优先使用固定端口，被占用时回退到随机端口
export async function startShareServer() {
  if (server) return serverPort

  return new Promise((resolve) => {
    const tryListen = (port) => {
      const s = http.createServer(handleRequest)
      s.on('error', () => {
        if (port !== 0) {
          tryListen(0)
        } else {
          console.error('[ShareServer] Failed to start share server')
          resolve(null)
        }
      })
      s.listen(port, '0.0.0.0', () => {
        server = s
        serverPort = s.address().port
        console.log(`[ShareServer] ✅ Share server running on http://0.0.0.0:${serverPort}`)
        resolve(serverPort)
      })
    }
    tryListen(PREFERRED_PORT)
  })
}

export function stopShareServer() {
  if (server) {
    try { server.close() } catch (_e) {}
    server = null
    serverPort = null
  }
}

// Generate a framework-free page so recipients can use older browsers too.
export function getShareUrl(sessionId) {
  if (!serverPort) return null
  const ip = getLocalIp()
  return `http://${ip}:${serverPort}/share/${encodeURIComponent(sessionId)}`
}

// 生成笔记分享链接
export function getNoteShareUrl(noteId) {
  if (!serverPort) return null
  const ip = getLocalIp()
  return `http://${ip}:${serverPort}/#/share/note/${encodeURIComponent(noteId)}`
}
