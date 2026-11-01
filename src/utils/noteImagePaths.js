// 笔记图片路径转换：
// 正文中保存相对路径 note-images/<文件名>，编辑器内解析为 friday-asset:// 才能加载，
// 保存回库时再还原为相对路径，保证数据库里不出现 base64 或绝对地址。
const RELATIVE_PREFIX = 'note-images/'
const ASSET_PREFIX = 'friday-asset://note-image/'

// 只匹配 img 的 src 属性，避免正文中其他同名文本被误改
const STORED_SRC_PATTERN = /src=(["'])note-images\/([^"']+)\1/g
const ASSET_SRC_PATTERN = /src=(["'])friday-asset:\/\/note-image\/([^"']+)\1/g

export function toDisplayImageSrc(src) {
  if (typeof src !== 'string' || !src.startsWith(RELATIVE_PREFIX)) return src
  return `${ASSET_PREFIX}${src.slice(RELATIVE_PREFIX.length)}`
}

export function toDisplayContent(html) {
  if (!html) return html
  return html.replace(
    STORED_SRC_PATTERN,
    (_, quote, fileName) => `src=${quote}${ASSET_PREFIX}${fileName}${quote}`
  )
}

export function toStoredContent(html) {
  if (!html) return html
  return html.replace(
    ASSET_SRC_PATTERN,
    (_, quote, fileName) => `src=${quote}${RELATIVE_PREFIX}${fileName}${quote}`
  )
}
