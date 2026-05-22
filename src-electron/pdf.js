import fs from 'fs'
import path from 'path'
import os from 'os'
import { BrowserWindow } from 'electron'
import { AppError } from './error.js'

function wrapHtmlWithStyles(content) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: #333;
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 60px;
  }
  h1 { font-size: 28px; font-weight: 600; margin: 0.8em 0 0.4em; line-height: 1.3; }
  h2 { font-size: 22px; font-weight: 600; margin: 0.8em 0 0.4em; line-height: 1.3; }
  h3 { font-size: 18px; font-weight: 600; margin: 0.8em 0 0.4em; line-height: 1.3; }
  p { margin: 0.5em 0; }
  ul, ol { padding-left: 2em; }
  li { margin: 0.2em 0; }
  blockquote {
    border-left: 4px solid #ddd;
    margin: 0.5em 0;
    padding: 0.5em 1em;
    color: #666;
  }
  pre {
    background: #f5f5f5;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 13px;
  }
  code {
    font-family: "SF Mono", "Fira Code", monospace;
    background: #f5f5f5;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 13px;
  }
  pre code {
    background: none;
    padding: 0;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.5em 0;
  }
  th, td {
    border: 1px solid #ddd;
    padding: 8px 12px;
    text-align: left;
  }
  th {
    background: #f5f5f5;
    font-weight: 600;
  }
  img {
    max-width: 100%;
    height: auto;
  }
  a {
    color: #2563eb;
    text-decoration: none;
  }
  hr {
    border: none;
    border-top: 1px solid #ddd;
    margin: 1em 0;
  }
  mark {
    background: #fef08a;
    padding: 1px 3px;
    border-radius: 2px;
  }
  strike, s {
    text-decoration: line-through;
  }
  ul[data-type="taskList"] {
    list-style: none;
    padding-left: 0;
  }
  ul[data-type="taskList"] li {
    display: flex;
    align-items: flex-start;
    gap: 0.5em;
  }
  ul[data-type="taskList"] li input {
    margin-top: 0.35em;
  }
</style>
</head>
<body>
${content}
</body>
</html>`
}

export async function exportHtmlToPdf(html, savePath) {
  const styledHtml = wrapHtmlWithStyles(html)

  const tempDir = os.tmpdir()
  const tempPath = path.join(tempDir, 'happy-friday-export.html')

  try {
    fs.writeFileSync(tempPath, styledHtml, 'utf-8')
  } catch (e) {
    throw AppError.pdf(`无法写入临时文件: ${e.message}`)
  }

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      offscreen: true
    }
  })

  try {
    await win.loadFile(tempPath)

    await new Promise(resolve => setTimeout(resolve, 1500))

    const pdfBytes = await win.webContents.printToPDF({
      printBackground: true
    })

    fs.writeFileSync(savePath, pdfBytes)
  } catch (e) {
    throw AppError.pdf(`PDF 生成失败: ${e.message}`)
  } finally {
    win.close()
    try {
      fs.unlinkSync(tempPath)
    } catch (_e) {
      // ignore temp file cleanup errors
    }
  }
}

export async function exportMarkdown(markdown, savePath) {
  try {
    fs.writeFileSync(savePath, markdown, 'utf-8')
  } catch (e) {
    throw AppError.pdf(`无法保存 Markdown 文件: ${e.message}`)
  }
}
