/**
 * 构建前下载 Python 运行时
 * =========================
 * 根据当前平台和指定的架构（默认当前架构）下载对应的 Python 运行时。
 *
 * 用法：
 *   node scripts/prebuild-python.mjs           # 当前平台 + 当前架构
 *   node scripts/prebuild-python.mjs arm64     # 当前平台 + arm64
 *   node scripts/prebuild-python.mjs x64       # 当前平台 + x64
 */
import { execSync } from 'node:child_process'

const targetArch = process.argv[2] || process.arch
const platformKey = `${process.platform}-${targetArch}`

console.log(`[prebuild-python] 当前平台: ${process.platform}`)
console.log(`[prebuild-python] 目标架构: ${targetArch}`)
console.log(`[prebuild-python] 平台标识: ${platformKey}`)
console.log(`[prebuild-python] 开始下载 Python 运行时...`)

try {
  execSync(
    `node python/download-python.js --platform ${platformKey} --mirror`,
    { stdio: 'inherit' }
  )
  console.log(`[prebuild-python] ✓ Python 运行时下载完成`)
} catch (e) {
  console.error(`[prebuild-python] ✗ 下载失败: ${e.message}`)
  process.exit(1)
}
