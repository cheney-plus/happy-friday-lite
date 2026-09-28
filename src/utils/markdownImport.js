/**
 * Markdown 导入为笔记工具
 * 将 markdown 文件内容转换为笔记（HTML 存储），实现"以笔记方式打开"：
 * 同名笔记已存在时复用并同步内容，避免重复导入产生大量同名笔记。
 */
import { marked } from 'marked';
import { stripMarkdown } from '@/utils/markdown';
import { electronService } from '@/services/electron';
import { useNoteStore } from '@/store';

/** 取文件名并去掉 markdown 扩展名，作为笔记标题 */
export function markdownNoteTitle(filePath) {
  const name = String(filePath).split('/').pop().split('\\').pop();
  return name.replace(/\.(md|markdown|mdx)$/i, '') || '新建笔记';
}

/**
 * 将 markdown 文件导入为可编辑笔记。
 * 同名笔记存在时更新其内容后复用；失败返回 null（由调用方回退只读查看器）。
 * @param {string} filePath markdown 文件绝对路径
 * @returns {Promise<{id: string, title: string}|null>}
 */
export async function importMarkdownAsNote(filePath) {
  try {
    const res = await electronService.invoke('kb-read-file', { filePath });
    if (!res?.success) throw new Error(res?.error || 'read failed');
    const md = res.content || '';
    const title = markdownNoteTitle(filePath);
    const html = marked.parse(md);
    const text = stripMarkdown(md);
    const notes = (await electronService.invoke('get_notes', {})) || [];
    const existing = notes.find(n => n && !n.isDeleted && n.title === title);
    const note = existing
      ? await electronService.invoke('update_note', { noteId: existing.id, title, content: html, contentText: text })
      : await electronService.invoke('import_note', { title, content: html, contentText: text });
    return note?.id ? note : null;
  } catch (_e) {
    return null;
  }
}

/**
 * 导入 markdown 文件并在笔记模块界面（NoteList 内嵌编辑器）中打开编辑。
 * 完全复用笔记模块的编辑框：fetchNote 注入列表 + selectNote 选中 + 跳转 /note。
 * @returns {Promise<boolean>} 是否成功打开
 */
export async function openMarkdownAsNotePage(filePath, router) {
  const note = await importMarkdownAsNote(filePath);
  if (!note?.id) {
    return false;
  }
  const noteStore = useNoteStore();
  await noteStore.fetchNote(note.id);
  noteStore.selectNote(note.id);
  await router.push({ name: 'note' });
  return true;
}
