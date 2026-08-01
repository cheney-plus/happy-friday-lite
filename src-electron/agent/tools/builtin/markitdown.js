/**
 * 内置工具：文件转 Markdown（markitdown_convert）
 * ================================================
 * 参考：https://github.com/microsoft/markitdown
 *
 * 使用 Microsoft MarkItDown 库将多种文件格式转换为 Markdown：
 *   - PDF（支持 OCR 回退识别扫描版 PDF）
 *   - PowerPoint (.pptx/.ppt)
 *   - Word (.docx/.doc)
 *   - Excel (.xlsx/.xls)
 *   - HTML (.html/.htm)
 *   - 文本格式 (CSV/JSON/XML)
 *   - EPub (.epub)
 *   - 纯文本 (.txt/.md)
 *
 * 转换结果保存到 SANDBOX/markitdown/ 目录下。
 * 需用户审批后执行（依赖 Python 环境和 markitdown 库）。
 *
 * 依赖：
 *   - markitdown[all]（通过 pip_install 安装，已在 requirements.txt 中声明）
 *   - PDF OCR 回退（可选）：pytesseract + PyMuPDF + 系统安装的 tesseract
 *
 * 工作流程：
 *   1. 使用 markitdown 库转换源文件为 Markdown
 *   2. 若为 PDF 且文本内容极少（疑似扫描版），自动尝试 OCR 回退
 *   3. 将 Markdown 结果保存到 SANDBOX/markitdown/{outputFileName}.md
 *   4. 返回输出路径与内容预览
 */

import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { registerTool } from '../registry.js'
import { getPythonPath } from '../../../python-env.js'

// 支持的文件扩展名（用于校验提示）
const SUPPORTED_EXTENSIONS = new Set([
  '.pdf',                    // PDF
  '.pptx', '.ppt',           // PowerPoint
  '.docx', '.doc',           // Word
  '.xlsx', '.xls',           // Excel
  '.html', '.htm',           // HTML
  '.csv', '.json', '.xml',   // 文本格式
  '.epub',                   // EPub
  '.txt', '.md'              // 纯文本
])

// 默认超时：2 分钟（markitdown 转换 + OCR 可能较慢）
const DEFAULT_TIMEOUT_MS = 120000

// 输出预览最大长度
const MAX_PREVIEW_LENGTH = 2000

// stdout/stderr 截断阈值
const MAX_OUTPUT = 20 * 1024

/**
 * Python 辅助脚本：调用 markitdown 转换文件，支持 PDF OCR 回退
 *
 * 用法：python markitdown_helper.py <source> <output> <ocr:0|1>
 *
 * 输出协议（stdout）：
 *   RESULT_PATH=<输出文件绝对路径>
 *   RESULT_LENGTH=<Markdown 内容字符数>
 *   RESULT_OCR=<0|1>
 *   RESULT_OCR_PAGES=<页数>（仅 OCR 时输出）
 *   RESULT_TITLE=<标题>（仅当 markitdown 返回标题时输出）
 *
 * 退出码：
 *   0 = 成功
 *   1 = 转换失败（文件不存在、markitdown 异常等）
 *   2 = markitdown 未安装
 */
const HELPER_SCRIPT = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MarkItDown helper - converts files to Markdown."""
import sys
import os


def main():
    if len(sys.argv) < 3:
        print('ERROR: Usage: markitdown_helper.py <source> <output> [ocr]', file=sys.stderr)
        sys.exit(1)

    source_path = sys.argv[1]
    output_path = sys.argv[2]
    ocr_enabled = len(sys.argv) > 3 and sys.argv[3] == '1'

    if not os.path.exists(source_path):
        print(f'ERROR: Source file not found: {source_path}', file=sys.stderr)
        sys.exit(1)

    # Step 1: Convert with markitdown
    content = ''
    title = ''
    try:
        from markitdown import MarkItDown
        md = MarkItDown(enable_plugins=False)
        result = md.convert(source_path)
        content = getattr(result, 'text_content', None) or getattr(result, 'markdown', '') or ''
        title = getattr(result, 'title', '') or ''
    except ImportError:
        print('ERROR: markitdown not installed. Please install: pip install "markitdown[all]"', file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        print(f'ERROR: markitdown conversion failed: {e}', file=sys.stderr)
        sys.exit(1)

    # Step 2: OCR fallback for scanned PDFs
    # 当 PDF 提取的文本极少（< 100 字符）时，判定为扫描版 PDF，尝试 OCR
    is_pdf = source_path.lower().endswith('.pdf')
    ocr_used = False
    ocr_pages = 0
    if is_pdf and ocr_enabled and len(content.strip()) < 100:
        print('[INFO] PDF text content is very short, attempting OCR...', file=sys.stderr)
        try:
            import fitz  # PyMuPDF
            import pytesseract
            from PIL import Image
            import io

            ocr_parts = []
            doc = fitz.open(source_path)
            for page_num, page in enumerate(doc):
                pix = page.get_pixmap(dpi=200)
                img_data = pix.tobytes('png')
                img = Image.open(io.BytesIO(img_data))
                # 优先使用中文+英文识别，失败时回退到仅英文
                try:
                    text = pytesseract.image_to_string(img, lang='chi_sim+eng')
                except Exception:
                    text = pytesseract.image_to_string(img, lang='eng')
                ocr_parts.append(f'<!-- Page {page_num + 1} -->\\n' + text)
            doc.close()

            if ocr_parts:
                content = '\\n\\n'.join(ocr_parts)
                ocr_used = True
                ocr_pages = len(ocr_parts)
                print(f'[INFO] OCR completed for {ocr_pages} pages', file=sys.stderr)
        except ImportError:
            print('[WARN] OCR libraries not available (need pytesseract + PyMuPDF), skipping OCR', file=sys.stderr)
        except Exception as e:
            print(f'[WARN] OCR failed, using original result: {e}', file=sys.stderr)

    # Step 3: Write output
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)

    # Step 4: Print structured result for Node.js handler to parse
    print(f'RESULT_PATH={output_path}')
    print(f'RESULT_LENGTH={len(content)}')
    print(f'RESULT_OCR={1 if ocr_used else 0}')
    if ocr_used:
        print(f'RESULT_OCR_PAGES={ocr_pages}')
    if title:
        print(f'RESULT_TITLE={title}')


if __name__ == '__main__':
    main()
`

/**
 * 解析源文件路径
 * - 绝对路径：直接使用（允许转换用户系统中的任意文件）
 * - 相对路径：相对于 SANDBOX 解析，禁止 .. 穿越
 *
 * @param {string} sandboxDir SANDBOX 绝对路径
 * @param {string} sourcePath 用户提供的源文件路径
 * @returns {string} 源文件绝对路径
 */
function resolveSourcePath(sandboxDir, sourcePath) {
  const trimmed = (sourcePath || '').trim()
  if (!trimmed) throw new Error('源文件路径不能为空')

  // 绝对路径直接使用（允许转换 SANDBOX 之外的文件，因为本工具需审批）
  if (path.isAbsolute(trimmed)) {
    return trimmed
  }

  // 相对路径：相对于 SANDBOX 解析
  const cleaned = trimmed.replace(/\\/g, '/').replace(/^\/+/, '')
  if (cleaned === '..' || cleaned.startsWith('../') || cleaned.includes('/../') || cleaned.endsWith('/..')) {
    throw new Error('源文件路径不允许包含 .. 路径穿越')
  }
  return path.resolve(sandboxDir, cleaned)
}

/**
 * 解析输出文件路径（固定存放在 SANDBOX/markitdown/，重名追加 -1/-2 后缀，永不覆盖）
 *
 * @param {string} outputDir SANDBOX/markitdown/ 绝对路径
 * @param {string} sourceFileName 源文件名（含扩展名）
 * @param {string} [outputFileName] 用户指定的输出文件名（不含 .md）
 * @returns {string} 输出文件绝对路径
 */
function resolveOutputPath(outputDir, sourceFileName, outputFileName) {
  const ext = path.extname(sourceFileName)
  let base =
    outputFileName && outputFileName.trim()
      ? outputFileName.trim().replace(/\.md$/i, '')
      : path.basename(sourceFileName, ext)

  // 安全化文件名：仅移除文件系统不安全字符，保留中文等 Unicode 字符
  base = base.replace(/[\/\\:*?"<>|]/g, '_').trim()
  if (!base) base = 'converted'

  const first = path.join(outputDir, `${base}.md`)
  if (!fs.existsSync(first)) return first

  for (let i = 1; i < 10000; i++) {
    const candidate = path.join(outputDir, `${base}-${i}.md`)
    if (!fs.existsSync(candidate)) return candidate
  }
  return path.join(outputDir, `${base}-${Date.now()}.md`)
}

/**
 * 解析脚本文件路径（固定存放在 SANDBOX/tmpscript/，辅助脚本可覆盖）
 *
 * @param {string} scriptDir SANDBOX/tmpscript/ 绝对路径
 * @returns {string} 脚本文件绝对路径
 */
function resolveScriptPath(scriptDir) {
  return path.join(scriptDir, '_markitdown_helper.py')
}

const schema = z.object({
  sourcePath: z
    .string()
    .describe(
      '要转换的源文件路径。支持绝对路径（如 /home/user/report.pdf）或相对于 SANDBOX 的相对路径。' +
      '支持格式：PDF、PowerPoint(.pptx/.ppt)、Word(.docx/.doc)、Excel(.xlsx/.xls)、' +
      'HTML(.html/.htm)、CSV、JSON、XML、EPub(.epub)、纯文本(.txt/.md)。'
    ),
  outputFileName: z
    .string()
    .optional()
    .describe(
      '输出 Markdown 文件名（不含 .md 扩展名）。不传则使用源文件名。' +
      '同名文件自动追加 -1/-2 后缀，不会覆盖已有文件。'
    ),
  ocr: z
    .boolean()
    .optional()
    .describe(
      '是否对扫描版 PDF 启用 OCR 识别。默认 true。' +
      '当 PDF 提取的文本极少（疑似扫描版）时，自动使用 Tesseract OCR 识别。' +
      'OCR 需要 pytesseract + PyMuPDF 库及系统安装的 tesseract。'
    ),
  timeoutMs: z
    .number()
    .optional()
    .describe('超时时间（毫秒），默认 120000（2 分钟）。大文件或 OCR 可能需要更长时间。')
})

async function handler(args, ctx) {
  const { sourcePath, outputFileName, ocr = true, timeoutMs = DEFAULT_TIMEOUT_MS } = args

  ctx.logger.info(
    `[markitdown_convert] sourcePath=${sourcePath}, outputFileName=${outputFileName || '(自动)'}, ` +
      `ocr=${ocr}, timeout=${timeoutMs}ms`
  )

  // 1. 获取 Python 路径
  const pythonPath = await getPythonPath()
  if (!pythonPath) {
    ctx.logger.warn('[markitdown_convert] Python 环境未配置')
    return (
      '⚠️ 未配置 Python 环境，无法执行文件转换。\n\n' +
      '请在「设置 → 通用 → Python 环境」中配置 Python 可执行文件路径。\n\n' +
      '配置后如缺少 markitdown 库，可使用 pip_install 工具安装：\n' +
      'pip_install({ packages: ["markitdown[all]"] })'
    )
  }

  // 2. 准备目录
  const sandboxDir = path.join(ctx.agentRootDir, 'SANDBOX')
  if (!fs.existsSync(sandboxDir)) {
    fs.mkdirSync(sandboxDir, { recursive: true })
  }

  const scriptDir = path.join(sandboxDir, 'tmpscript')
  if (!fs.existsSync(scriptDir)) {
    fs.mkdirSync(scriptDir, { recursive: true })
  }

  const outputDir = path.join(sandboxDir, 'markitdown')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // 3. 解析源文件路径
  let absSourcePath
  try {
    absSourcePath = resolveSourcePath(sandboxDir, sourcePath)
  } catch (e) {
    ctx.logger.warn(`[markitdown_convert] 源文件路径解析失败: ${e.message}`)
    return `源文件路径解析失败: ${e.message}`
  }

  if (!fs.existsSync(absSourcePath)) {
    ctx.logger.warn(`[markitdown_convert] 源文件不存在: ${absSourcePath}`)
    return `源文件不存在: ${absSourcePath}`
  }

  const stat = fs.statSync(absSourcePath)
  if (stat.isDirectory()) {
    return `源路径是目录，不是文件: ${absSourcePath}`
  }

  // 4. 扩展名校验（仅警告，不阻止）
  const ext = path.extname(absSourcePath).toLowerCase()
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    ctx.logger.warn(`[markitdown_convert] 文件扩展名 ${ext} 不在推荐列表中，仍尝试转换`)
  }

  // 5. 解析输出文件路径
  const sourceFileName = path.basename(absSourcePath)
  const outputPath = resolveOutputPath(outputDir, sourceFileName, outputFileName)
  ctx.logger.info(
    `[markitdown_convert] sandboxDir=${sandboxDir}, source=${absSourcePath}, output=${outputPath}`
  )

  // 6. 写入辅助脚本（固定路径，可覆盖）
  const scriptPath = resolveScriptPath(scriptDir)
  fs.writeFileSync(scriptPath, HELPER_SCRIPT, 'utf-8')
  ctx.logger.info(`[markitdown_convert] 辅助脚本: ${scriptPath}`)

  // 7. 执行 Python 脚本
  return new Promise(resolve => {
    const child = spawn(
      pythonPath,
      ['-u', scriptPath, absSourcePath, outputPath, ocr ? '1' : '0'],
      {
        cwd: outputDir,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      }
    )

    let stdout = ''
    let stderr = ''
    const MAX_BUF = MAX_OUTPUT * 2

    child.stdout.on('data', chunk => {
      stdout += chunk.toString('utf-8')
      if (stdout.length > MAX_BUF) stdout = stdout.slice(0, MAX_BUF)
    })

    child.stderr.on('data', chunk => {
      stderr += chunk.toString('utf-8')
      if (stderr.length > MAX_BUF) stderr = stderr.slice(0, MAX_BUF)
    })

    const timer = setTimeout(() => {
      ctx.logger.warn('[markitdown_convert] 执行超时，终止进程')
      try {
        child.kill('SIGKILL')
      } catch (_e) {
        /* 忽略 */
      }
    }, timeoutMs)

    child.on('error', err => {
      clearTimeout(timer)
      ctx.logger.error(`[markitdown_convert] 进程错误: ${err.message}`)
      resolve(`Python 启动失败: ${err.message}\n（请确认 Python 环境配置正确）`)
    })

    child.on('close', exitCode => {
      clearTimeout(timer)
      ctx.logger.info(`[markitdown_convert] 进程退出, exitCode=${exitCode}`)

      // markitdown 未安装
      if (exitCode === 2 || /markitdown not installed/i.test(stderr)) {
        resolve(
          '⚠️ markitdown 库未安装，无法执行转换。\n\n' +
          '请使用 pip_install 工具安装：\n' +
          'pip_install({ packages: ["markitdown[all]"] })\n\n' +
          '或安装完整依赖：pip_install({ requirements: true })'
        )
        return
      }

      // 转换失败
      if (exitCode !== 0) {
        let errMsg = '转换失败'
        const errorMatch = stderr.match(/ERROR:\s*(.+)/i)
        if (errorMatch) errMsg = errorMatch[1].trim()
        let output = `❌ ${errMsg}`
        if (stderr) output += `\n\nstderr:\n${stderr.slice(0, MAX_OUTPUT)}`
        resolve(output)
        return
      }

      // 8. 解析结构化输出
      const lines = stdout.split('\n')
      const result = {}
      for (const line of lines) {
        const m = line.match(/^(RESULT_\w+)=(.*)$/)
        if (m) result[m[1]] = m[2]
      }

      const resultPath = result.RESULT_PATH || outputPath
      const contentLength = parseInt(result.RESULT_LENGTH || '0', 10)
      const ocrUsed = result.RESULT_OCR === '1'
      const ocrPages = parseInt(result.RESULT_OCR_PAGES || '0', 10)
      const title = result.RESULT_TITLE || ''

      // 9. 读取预览
      let preview = ''
      try {
        const content = fs.readFileSync(resultPath, 'utf-8')
        preview = content.slice(0, MAX_PREVIEW_LENGTH)
        if (content.length > MAX_PREVIEW_LENGTH) {
          preview += `\n... (预览已截断，共 ${content.length} 字符)`
        }
      } catch (_e) {
        preview = '(无法读取预览)'
      }

      // 10. 组装最终输出
      let output =
        `✅ 转换完成\n\n` +
        `源文件：${absSourcePath}\n` +
        `输出文件：${resultPath}\n` +
        `文件大小：${contentLength} 字符\n`

      if (title) {
        output += `文档标题：${title}\n`
      }

      if (ext === '.pdf') {
        if (ocrUsed) {
          output += `OCR 识别：是（Tesseract OCR，共 ${ocrPages} 页）\n`
        } else if (ocr) {
          output += `OCR 识别：未触发（PDF 文本内容充足）\n`
        } else {
          output += `OCR 识别：已禁用\n`
        }
      }

      // 附加 OCR 相关的 stderr 信息（如果有）
      if (stderr && /\[WARN\]|\[INFO\]/.test(stderr)) {
        const warnLines = stderr
          .split('\n')
          .filter(l => /\[WARN\]|\[INFO\]/.test(l))
          .map(l => l.trim())
        if (warnLines.length > 0) {
          output += `\n${warnLines.join('\n')}\n`
        }
      }

      output += `\n--- 内容预览 ---\n${preview}`

      ctx.logger.info(
        `[markitdown_convert] 成功, length=${contentLength}, ocr=${ocrUsed}`
      )
      resolve(output)
    })
  })
}

registerTool({
  name: 'markitdown_convert',
  description:
    '将文件转换为 Markdown 格式（基于 Microsoft MarkItDown 库）。需用户审批后执行。\n\n' +
    '【支持的文件格式】\n' +
    '- PDF（.pdf）—— 支持扫描版 PDF 的 OCR 回退识别\n' +
    '- PowerPoint（.pptx/.ppt）\n' +
    '- Word（.docx/.doc）\n' +
    '- Excel（.xlsx/.xls）\n' +
    '- HTML（.html/.htm）\n' +
    '- 文本格式（CSV/JSON/XML）\n' +
    '- EPub（.epub）\n' +
    '- 纯文本（.txt/.md）\n\n' +
    '【OCR 说明】\n' +
    '- 默认对 PDF 启用 OCR 回退（ocr=true）：当 markitdown 提取的文本极少（< 100 字符，疑似扫描版）时，' +
    '自动使用 Tesseract OCR 识别页面文字。\n' +
    '- OCR 依赖：pytesseract + PyMuPDF 库（通过 pip_install 安装）+ 系统安装的 tesseract 可执行文件。\n' +
    '- 若 OCR 依赖缺失，将跳过 OCR 并使用 markitdown 的原始结果。\n\n' +
    '【输出位置】\n' +
    '- 转换结果保存到 SANDBOX/markitdown/{outputFileName}.md\n' +
    '- 不传 outputFileName 时使用源文件名；同名文件自动追加 -1/-2 后缀。\n\n' +
    '【依赖要求】\n' +
    '- 需已配置 Python 环境（设置 → 通用 → Python 环境）\n' +
    '- 需已安装 markitdown 库（pip_install({ packages: ["markitdown[all]"] })）\n' +
    '- OCR 需要 pytesseract + PyMuPDF（pip_install({ packages: ["pytesseract", "PyMuPDF"] })）\n\n' +
    '【返回内容】\n' +
    '返回转换状态、输出文件路径、文件大小、OCR 信息及内容预览（前 2000 字符）。',
  schema,
  handler,
  meta: { requireApproval: true } // 文件转换需审批
})
