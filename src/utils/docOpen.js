/**
 * 文档默认打开方式工具
 * 根据用户在"设置 → 通用 → 文档默认打开方式"中的配置，
 * 决定 Markdown / Word / Excel / PPT 文档由内置编辑器还是系统默认应用打开。
 */
import { useAppStore } from '@/store';

export const DOC_OPEN_INTERNAL = 'internal';
export const DOC_OPEN_SYSTEM = 'system';

// 文档类型分组与扩展名映射（分组与知识库 FILE_TYPE_MAP 保持一致）
const DOC_GROUP_EXTS = {
  markdown: ['md', 'markdown', 'mdx'],
  word: ['doc', 'docx'],
  excel: ['xls', 'xlsx', 'csv'],
  ppt: ['ppt', 'pptx']
};

const EXT_TO_GROUP = Object.entries(DOC_GROUP_EXTS).reduce((map, [group, exts]) => {
  exts.forEach(ext => map.set(ext, group));
  return map;
}, new Map());

/**
 * 根据文件名推断文档类型分组。
 * @param {string} fileName 文件名（含扩展名）
 * @returns {string|null} 'markdown' | 'word' | 'excel' | 'ppt'，非文档类型返回 null
 */
export function getDocGroup(fileName) {
  if (!fileName) return null;
  const ext = String(fileName).split('.').pop().toLowerCase();
  return EXT_TO_GROUP.get(ext) || null;
}

/**
 * 读取指定文件的默认打开方式。
 * @param {string} fileName 文件名（含扩展名）
 * @returns {string|null} 'internal' | 'system'，非文档类型返回 null
 */
export function getDocOpenMode(fileName) {
  const group = getDocGroup(fileName);
  if (!group) return null;
  const modes = useAppStore().docOpenModes || {};
  return modes[group] === DOC_OPEN_SYSTEM ? DOC_OPEN_SYSTEM : DOC_OPEN_INTERNAL;
}
