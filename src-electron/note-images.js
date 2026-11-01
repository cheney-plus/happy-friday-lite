import { protocol } from 'electron'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// 笔记图片文件化存储：
// 正文只保存相对路径 note-images/<文件名>，图片本体落在数据目录的 note-images/ 下。
// 不使用 base64：粘贴图片直接以二进制写入文件，截图也直接写 PNG 缓冲。
// 编辑器内通过 friday-asset:// 协议把相对路径解析为可加载地址。

const SCHEME = 'friday-asset'
const HOST = 'note-image'
const RELATIVE_PREFIX = 'note-images/'
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
// 文件名只允许安全字符，防止通过 URL 穿越目录
const SAFE_FILE_NAME = /^[A-Za-z0-9._-]+$/

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif'
}

const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
  'image/avif': '.avif'
}

let imageDir = null

// 必须在 app ready 之前调用：注册特权协议
export function registerNoteImageScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: true,
        stream: true
      }
    }
  ])
}

// app ready 之后调用：建立图片目录并注册协议处理器
export function initNoteImages(dataDir) {
  imageDir = path.join(dataDir, 'note-images')
  try {
    fs.mkdirSync(imageDir, { recursive: true })
  } catch (e) {
    console.error('[NoteImages] 创建图片目录失败:', e)
  }

  protocol.handle(SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== HOST) {
        return new Response('Not Found', { status: 404 })
      }
      const fileName = decodeURIComponent(url.pathname.replace(/^\//, ''))
      if (!SAFE_FILE_NAME.test(fileName)) {
        return new Response('Forbidden', { status: 403 })
      }
      const filePath = path.join(imageDir, fileName)
      if (!fs.existsSync(filePath)) {
        return new Response('Not Found', { status: 404 })
      }
      const data = await fs.promises.readFile(filePath)
      return new Response(data, {
        headers: {
          'Content-Type': MIME_BY_EXT[path.extname(fileName).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-cache'
        }
      })
    } catch (e) {
      console.error('[NoteImages] 读取图片失败:', e)
      return new Response('Internal Server Error', { status: 500 })
    }
  })
}

// 返回图片文件绝对路径；文件名非法或目录未初始化时返回 null
export function getNoteImagePath(fileName) {
  if (!imageDir || !fileName || !SAFE_FILE_NAME.test(fileName)) return null
  return path.join(imageDir, fileName)
}

function toBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes
  if (ArrayBuffer.isView(bytes)) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes)
  return null
}

// 把二进制图片写入图片目录，返回正文使用的相对路径 note-images/<文件名>
export async function saveNoteImage(bytes, mimeType) {
  if (!imageDir) {
    throw new Error('图片目录未初始化')
  }

  const buffer = toBuffer(bytes)
  if (!buffer || buffer.length === 0) {
    throw new Error('图片内容为空')
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('图片体积超过上限')
  }

  const mime = String(mimeType || '').toLowerCase()
  if (!mime.startsWith('image/')) {
    throw new Error('不是有效的图片类型')
  }

  const ext = EXT_BY_MIME[mime] || '.png'
  const fileName = `${crypto.randomUUID()}${ext}`
  await fs.promises.writeFile(path.join(imageDir, fileName), buffer)
  return `${RELATIVE_PREFIX}${fileName}`
}

export { RELATIVE_PREFIX as IMAGE_RELATIVE_PREFIX }
