export const extractPlainText = (text) => {
  return text
    .replace(/<\/?(p|div|h[1-6]|li|blockquote|br)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[# \t\-+>]+/gm, '')
    .replace(/[*_~`]/g, '')
    .trim()
}
