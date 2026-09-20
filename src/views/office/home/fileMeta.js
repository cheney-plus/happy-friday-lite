/**
 * Office 首页文件元数据与格式化工具（复刻上游 FileBadge / 列表列展示）。
 */

/** 编辑器类型 → 徽标配色与扩展名组（对齐上游 FileBadge 的类型色） */
export const TYPE_META = {
  docs: { color: '#2b6cd4', exts: ['docx'] },
  sheets: { color: '#217346', exts: ['xlsx', 'xlsm', 'csv'] },
  slides: { color: '#c43e1c', exts: ['pptx'] },
  pdf: { color: '#d93025', exts: ['pdf'] },
}

export function extOf(filePath) {
  const name = String(filePath || '').split('/').pop().split('\\').pop()
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function typeOf(filePath) {
  const ext = extOf(filePath)
  for (const [type, meta] of Object.entries(TYPE_META)) {
    if (meta.exts.includes(ext)) return type
  }
  return 'docs'
}

/** 主色 + 文件类型徽标（上游 quick-card / 行图标） */
export function badgeMeta(type) {
  return TYPE_META[type] || TYPE_META.docs
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 修改时间：当天显示时分，一年内显示月日，否则显示年月日 */
export function formatModified(mtimeMs) {
  if (typeof mtimeMs !== 'number') return '—'
  const d = new Date(mtimeMs)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const pad = (n) => String(n).padStart(2, '0')
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const sameYear = d.getFullYear() === now.getFullYear()
  if (sameYear && now.getTime() - mtimeMs < 2 * DAY_MS) {
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  if (sameYear) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 文件大小：B/KB/MB/GB */
export function formatSize(sizeBytes) {
  if (typeof sizeBytes !== 'number' || Number.isNaN(sizeBytes)) return '—'
  if (sizeBytes < 1024) return `${sizeBytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = sizeBytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}
