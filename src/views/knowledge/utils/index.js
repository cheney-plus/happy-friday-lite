/**
 * @file 知识库模块通用工具函数
 * 集中管理文件类型判断、图标/标签解析、日期与体积格式化等纯函数，
 * 避免在多个组件/composable 中重复实现。
 */
import { FILE_TYPE_MAP, FILE_TYPE_LABELS } from '../constants';
import { FILE_ICON_MAP, UnknownFileIcon } from '../components/icons';

/**
 * 根据文件名推断知识库内部使用的文件类型标识。
 * @param {string} fileName 文件名（含扩展名）
 * @returns {string} 类型标识，如 'markdown' / 'pdf' / 'folder'；未匹配返回 'unknown'
 */
export function getFileType(fileName) {
  if (!fileName) return 'unknown';
  const ext = fileName.split('.').pop().toLowerCase();
  for (const [type, exts] of Object.entries(FILE_TYPE_MAP)) {
    if (exts.includes(ext)) return type;
  }
  return 'unknown';
}

/**
 * 根据文件类型获取对应的图标组件。
 * @param {string} type getFileType 返回的类型标识
 * @returns {import('vue').Component} 图标组件，未匹配时返回 UnknownFileIcon
 */
export function getFileIconComponent(type) {
  return FILE_ICON_MAP[type] || UnknownFileIcon;
}

/**
 * 根据文件类型获取中文展示标签。
 * @param {string} type getFileType 返回的类型标识
 * @returns {string} 中文标签，如 'Markdown' / 'PDF'；未匹配返回 '文件'
 */
export function getTypeLabel(type) {
  return FILE_TYPE_LABELS[type] || '文件';
}

/**
 * 紧凑日期格式：今天显示 HH:MM，其他日期显示 M/D。
 * 用于文件卡片、列表等空间受限的场景。
 * @param {string} [isoString] ISO 时间字符串
 * @returns {string} 格式化后的日期字符串，无输入返回空串
 */
export function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }
  return (d.getMonth() + 1) + '/' + d.getDate();
}

/**
 * 相对时间格式：刚刚 / X分钟前 / X小时前 / X天前 / YYYY-MM-DD。
 * 用于笔记等需要明确时间跨度的场景。
 * @param {string} [isoString] ISO 时间字符串
 * @returns {string} 格式化后的相对时间字符串，无输入返回空串
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 7) return `${diffDay}天前`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 将字节数格式化为人类可读的体积字符串。
 * @param {number|string|null|undefined} size 字节数（数值或可转数值的字符串）
 * @returns {string} 形如 '12 B' / '3.2 KB' / '1.5 MB' / '2.00 GB'；无效输入返回空串
 */
export function formatFileSize(size) {
  if (size == null || size === '') return '';
  const bytes = Number(size);
  if (isNaN(bytes)) return '';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}
