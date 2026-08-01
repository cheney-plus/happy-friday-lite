// 备份压缩 worker：在独立线程中执行文件收集与 zip 压缩，
// 避免在 Electron 主进程中同步阻塞 UI。
//
// workerData: { dataDir, zipPath }
// 消息流：
//   { type: 'progress', current, total, name }  打包文件进度
//   { type: 'compressing' }                     进入最终压缩阶段
//   { type: 'done', success, path?, error? }    完成
import { parentPort, workerData } from 'worker_threads'
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'

// 递归收集目录下所有文件（仅文件，跳过目录条目）
function collectFiles(dir, baseDir) {
  const results = []
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (e) {
    return results
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relPath = path.relative(baseDir, fullPath)
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, baseDir))
    } else {
      results.push({ path: fullPath, relPath })
    }
  }
  return results
}

function post(msg) {
  parentPort?.postMessage(msg)
}

const { dataDir, zipPath } = workerData || {}

if (!dataDir || !zipPath) {
  post({ type: 'done', success: false, error: '缺少 dataDir 或 zipPath' })
} else {
  try {
    const zip = new AdmZip()
    // 排除临时/锁文件，避免打包运行时的 WAL/SHM
    const files = collectFiles(dataDir, dataDir).filter(
      f => !f.relPath.endsWith('.lock') &&
           !f.relPath.endsWith('-wal') &&
           !f.relPath.endsWith('-shm')
    )

    const total = files.length
    for (let i = 0; i < total; i++) {
      const file = files[i]
      const dirName = path.dirname(file.relPath)
      zip.addLocalFile(file.path, dirName === '.' ? '' : dirName)
      // 每若干个文件或最后一个时上报进度，避免消息洪泛
      if (i % 5 === 0 || i === total - 1) {
        post({ type: 'progress', current: i + 1, total, name: file.relPath })
      }
    }

    post({ type: 'compressing' })
    zip.writeZip(zipPath)

    post({ type: 'done', success: true, path: zipPath })
  } catch (e) {
    post({ type: 'done', success: false, error: e?.message || String(e) })
  }
}
