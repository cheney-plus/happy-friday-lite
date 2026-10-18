import { useTabStore, useKnowledgeStore } from '@/store';
import { electronService } from '@/services/electron';

// 标签页会话持久化：退出时保存、启动时恢复
// 存储于主进程 session.json，通过 session-get / session-save IPC 读写

const OFFICE_TAB_RE = /^office-(docs|sheets|slides|pdf)-(\d+)$/;
const FRIDAY_TAB_RE = /^friday-(\d+)$/;
const NOTE_PATH_RE = /^\/note\/(.+)$/;

/** 采集当前会话状态（纯 JSON 结构，可直接过 IPC） */
export function captureSessionState() {
  const tabStore = useTabStore();
  const knowledgeStore = useKnowledgeStore();
  return {
    tabs: tabStore.openedTabs.map(t => {
      const out = { id: t.id, path: t.path, fullPath: t.fullPath };
      if (t.title) out.title = t.title;
      if (t.i18nKey) out.i18nKey = t.i18nKey;
      if (t.icon) out.icon = t.icon;
      if (t.officeFilePath) out.officeFilePath = t.officeFilePath;
      return out;
    }),
    activeTabId: tabStore.activeTabId,
    fridayCounter: tabStore.fridayCounter,
    knowledge: knowledgeStore.sessionState ? { ...knowledgeStore.sessionState } : null
  };
}

let saveTimer = null;

/** 防抖保存会话（标签页/激活项/知识库目录变化时调用） */
export function scheduleSessionSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    electronService.invoke('session-save', captureSessionState());
  }, 500);
}

/** 窗口关闭前的兜底同步保存（fire-and-forget） */
export function flushSessionSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  electronService.send('session-save-sync', captureSessionState());
}

async function pathExists(p) {
  if (!p) return false;
  try {
    return await electronService.invoke('kb-path-exists', { path: p });
  } catch {
    return false;
  }
}

// 重新打开 Office 编辑器文件，返回更新补丁（新 id/path/fullPath）；失败返回 null
// 启动恢复时主进程 Office 会话可能尚未初始化完成，失败后延迟重试一次
async function reopenOfficeTab(tab) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await electronService.invoke('office-open-file', { filePath: tab.officeFilePath });
      if (res?.success && res.viewId) {
        return {
          id: `office-${res.viewId}`,
          path: `/office/${res.viewId.replace('-', '/')}`,
          fullPath: `/office/${res.viewId.replace('-', '/')}`
        };
      }
      if (res && res.success === false) break; // 编辑器明确拒绝（格式不支持等）：不再重试
    } catch { /* IPC 未就绪或文件丢失 */ }
    if (attempt === 0) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  return null;
}

/**
 * 启动时恢复会话。
 * 返回 true 表示已恢复标签并完成导航；false 表示无会话或全部标签失效（保持默认首页）。
 * 引用的文件/目录已被移动或删除时跳过对应标签，不报错。
 */
export async function restoreSession(router) {
  const tabStore = useTabStore();
  const knowledgeStore = useKnowledgeStore();
  const session = await electronService.invoke('session-get');
  if (!session || !Array.isArray(session.tabs) || session.tabs.length === 0) {
    return false;
  }

  // 知识库目录恢复状态交给知识库模块消费
  if (session.knowledge) {
    knowledgeStore.sessionState = session.knowledge;
  }

  const restored = [];

  for (const saved of session.tabs) {
    if (!saved || typeof saved.id !== 'string') continue;
    const tab = { ...saved };

    // Friday 对话标签：直接恢复
    if (FRIDAY_TAB_RE.test(tab.id)) {
      restored.push(tab);
    }
    // 文件查看器标签：校验文件仍存在
    else if (tab.id.startsWith('file-')) {
      const params = new URLSearchParams(tab.fullPath.split('?')[1] || '');
      if (await pathExists(params.get('path'))) {
        restored.push(tab);
      }
    }
    // Office 编辑器标签：校验源文件存在，稍后重开编辑器视图
    else if (OFFICE_TAB_RE.test(tab.id)) {
      if (await pathExists(tab.officeFilePath)) {
        restored.push(tab);
      }
    }
    // 笔记编辑标签：校验笔记仍存在
    else if (NOTE_PATH_RE.test(tab.path || '')) {
      const noteId = decodeURIComponent(tab.path.match(NOTE_PATH_RE)[1]);
      const note = await electronService.invoke('get_note', { noteId });
      if (note) {
        restored.push(tab);
      }
    }
    // 普通模块标签（/knowledge、/settings 等）：直接恢复
    else {
      restored.push(tab);
    }
  }

  if (restored.length === 0) {
    return false;
  }

  // 重新打开 Office 编辑器视图（激活标签阻塞导航，其余后台重开）
  const officeTabs = restored.filter(t => OFFICE_TAB_RE.test(t.id));
  const savedActive = restored.find(t => t.id === session.activeTabId) || restored[restored.length - 1];
  const savedActiveIsOffice = OFFICE_TAB_RE.test(savedActive.id);
  const activeOfficeTab = savedActiveIsOffice ? savedActive : null;

  for (const tab of officeTabs) {
    if (tab === activeOfficeTab) continue;
    // 后台重开：成功则对齐新视图 id，失败则移除该标签
    reopenOfficeTab(tab).then(patch => {
      if (patch) {
        tabStore.updateTab(tab.id, patch);
      } else {
        tabStore.openedTabs = tabStore.openedTabs.filter(t => t.id !== tab.id);
      }
    });
  }
  if (activeOfficeTab) {
    const patch = await reopenOfficeTab(activeOfficeTab);
    if (patch) {
      Object.assign(activeOfficeTab, patch);
    } else {
      restored.splice(restored.indexOf(activeOfficeTab), 1);
    }
  }

  if (restored.length === 0) {
    return false;
  }

  // Friday 标签计数器对齐，避免新开 Friday 标签 id 冲突
  let fridayCounter = 0;
  for (const t of restored) {
    const m = t.id.match(FRIDAY_TAB_RE);
    if (m) fridayCounter = Math.max(fridayCounter, parseInt(m[1], 10));
  }

  const finalActive = restored.find(t => t === savedActive) || restored[restored.length - 1];
  tabStore.restoreTabs(restored, finalActive.id, fridayCounter);

  try {
    await router.isReady();
    await router.replace(finalActive.fullPath);
  } catch { /* 路由非法时保持当前页面 */ }
  return true;
}
