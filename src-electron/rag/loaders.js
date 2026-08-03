import fs from 'fs'
import path from 'path'
import { Document } from '@langchain/core/documents'

/**
 * 文档加载器：将不同格式的文件加载为统一的 Document 对象数组
 * 支持: TXT, MD, PDF, HTML, JSON, EPUB, DOCX, XLSX, PPTX, .note(笔记引用)
 * 暂不支持 OCR PDF（复杂扫描版 PDF）
 */

// 根据文件扩展名获取文件类型
export function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase().slice(1)
  return ext
}

// 加载纯文本文件 (txt, md, markdown, log, text, csv, xml)
async function loadTextFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const stat = fs.statSync(filePath)
  return [new Document({
    pageContent: content,
    metadata: {
      source: filePath,
      fileType: path.extname(filePath).slice(1),
      fileSize: stat.size,
      fileCreatedAt: stat.birthtime.toISOString(),
      fileModifiedAt: stat.mtime.toISOString()
    }
  })]
}

// 加载 PDF 文件
// 依赖 pdf-parse（@langchain/community 的可选 peer 依赖）。
// 同 EPUB：pdf-parse 必须显式声明在 dependencies 中，否则打包时被裁剪，
// 运行时 import("pdf-parse") 抛错，PDF 索引构建失败。
async function loadPdfFile(filePath) {
  try {
    const { PDFLoader } = await import('@langchain/community/document_loaders/fs/pdf')
    const loader = new PDFLoader(filePath)
    const docs = await loader.load()
    const stat = fs.statSync(filePath)
    // 补充元数据
    return docs.map(doc => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        source: filePath,
        fileType: 'pdf',
        fileSize: stat.size,
        fileCreatedAt: stat.birthtime.toISOString(),
        fileModifiedAt: stat.mtime.toISOString()
      }
    }))
  } catch (e) {
    if (/pdf-parse/i.test(e.message)) {
      throw new Error(`PDF 解析依赖 pdf-parse 缺失（打包未包含）：${e.message}。请确认 pdf-parse 已在 dependencies 中声明并重新构建。`)
    }
    throw e
  }
}

// 加载 HTML 文件（本地文件直接用 cheerio 解析，不使用 CheerioWebBaseLoader）
async function loadHtmlFile(filePath) {
  const cheerio = await import('cheerio')
  const content = fs.readFileSync(filePath, 'utf-8')
  const $ = cheerio.load(content)
  // 移除 script 和 style 标签
  $('script, style').remove()
  const text = $('body').text().replace(/\s+/g, ' ').trim()
  const stat = fs.statSync(filePath)
  return [new Document({
    pageContent: text,
    metadata: {
      source: filePath,
      fileType: 'html',
      fileSize: stat.size,
      fileCreatedAt: stat.birthtime.toISOString(),
      fileModifiedAt: stat.mtime.toISOString()
    }
  })]
}

// 加载 JSON 文件（直接作为文本读取，@langchain/community 未导出 JSONLoader）
async function loadJsonFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const stat = fs.statSync(filePath)
  return [new Document({
    pageContent: content,
    metadata: {
      source: filePath,
      fileType: 'json',
      fileSize: stat.size,
      fileCreatedAt: stat.birthtime.toISOString(),
      fileModifiedAt: stat.mtime.toISOString()
    }
  })]
}

// 加载 EPUB 文件
// 依赖 epub2（@langchain/community 的可选 peer 依赖）。
// 注意：epub2 必须在 package.json 的 dependencies 中显式声明，否则
// electron-builder 打包时会将其作为 peer 依赖裁剪掉，导致打包后运行时
// import("epub2") 抛出 "Failed to load epub2"，EPUB 索引构建失败。
async function loadEpubFile(filePath) {
  try {
    const { EPubLoader } = await import('@langchain/community/document_loaders/fs/epub')
    const loader = new EPubLoader(filePath)
    const docs = await loader.load()
    const stat = fs.statSync(filePath)
    return docs.map(doc => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        source: filePath,
        fileType: 'epub',
        fileSize: stat.size,
        fileCreatedAt: stat.birthtime.toISOString(),
        fileModifiedAt: stat.mtime.toISOString()
      }
    }))
  } catch (e) {
    if (/epub2/i.test(e.message)) {
      throw new Error(`EPUB 解析依赖 epub2 缺失（打包未包含）：${e.message}。请确认 epub2 已在 dependencies 中声明并重新构建。`)
    }
    throw e
  }
}

// 加载 DOCX 文件（使用 mammoth 提取纯文本）
async function loadDocxFile(filePath) {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ path: filePath })
  const stat = fs.statSync(filePath)
  return [new Document({
    pageContent: result.value,
    metadata: {
      source: filePath,
      fileType: 'docx',
      fileSize: stat.size,
      fileCreatedAt: stat.birthtime.toISOString(),
      fileModifiedAt: stat.mtime.toISOString()
    }
  })]
}

// 加载 XLS/XLSX 文件（使用 xlsx 库提取文本）
async function loadExcelFile(filePath) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.readFile(filePath)
  const stat = fs.statSync(filePath)
  const docs = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    if (csv.trim()) {
      docs.push(new Document({
        pageContent: csv,
        metadata: {
          source: filePath,
          fileType: path.extname(filePath).slice(1),
          fileSize: stat.size,
          fileCreatedAt: stat.birthtime.toISOString(),
          fileModifiedAt: stat.mtime.toISOString(),
          sheetName
        }
      }))
    }
  }
  return docs
}

// 加载 PPTX 文件（使用 officeparser 提取文本）
async function loadPptxFile(filePath) {
  const officeparser = await import('officeparser')
  const text = await officeparser.parseOfficeAsync(filePath)
  const stat = fs.statSync(filePath)
  return [new Document({
    pageContent: text,
    metadata: {
      source: filePath,
      fileType: path.extname(filePath).slice(1),
      fileSize: stat.size,
      fileCreatedAt: stat.birthtime.toISOString(),
      fileModifiedAt: stat.mtime.toISOString()
    }
  })]
}

// 加载 .note 笔记引用文件
// .note 文件是 JSON 元数据，包含 noteId，需要从数据库获取笔记内容
async function loadNoteFile(filePath, db) {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const meta = JSON.parse(raw)
  const stat = fs.statSync(filePath)

  if (!meta.noteId) {
    throw new Error(`Invalid .note file: missing noteId in ${filePath}`)
  }

  // 从数据库获取笔记内容
  const note = db.getNote(meta.noteId)
  if (!note) {
    throw new Error(`Note not found in DB: ${meta.noteId}`)
  }

  // 笔记内容是 HTML 格式，需要转为纯文本/markdown
  // contentText 字段已经是纯文本
  const content = note.contentText || note.content || ''
  const title = note.title || meta.title || '未命名笔记'

  return [new Document({
    pageContent: `# ${title}\n\n${content}`,
    metadata: {
      source: filePath,
      fileType: 'note',
      fileSize: stat.size,
      fileCreatedAt: note.createdAt || stat.birthtime.toISOString(),
      fileModifiedAt: note.updatedAt || stat.mtime.toISOString(),
      noteId: meta.noteId,
      title: title
    }
  })]
}

// 主加载入口：根据文件类型选择加载器
export async function loadDocument(filePath, db = null) {
  const ext = path.extname(filePath).toLowerCase().slice(1)

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  switch (ext) {
    case 'txt':
    case 'text':
    case 'log':
    case 'md':
    case 'markdown':
    case 'mdx':
    case 'csv':
    case 'xml':
      return loadTextFile(filePath)

    case 'pdf':
      return loadPdfFile(filePath)

    case 'html':
    case 'htm':
      return loadHtmlFile(filePath)

    case 'json':
      return loadJsonFile(filePath)

    case 'epub':
      return loadEpubFile(filePath)

    case 'doc':
    case 'docx':
      return loadDocxFile(filePath)

    case 'xls':
    case 'xlsx':
      return loadExcelFile(filePath)

    case 'ppt':
    case 'pptx':
      return loadPptxFile(filePath)

    case 'note':
      if (!db) {
        throw new Error('Loading .note files requires db module')
      }
      return loadNoteFile(filePath, db)

    default:
      // 未知类型尝试作为文本加载
      console.warn(`[RAG] Unknown file type: ${ext}, trying as text`)
      return loadTextFile(filePath)
  }
}
