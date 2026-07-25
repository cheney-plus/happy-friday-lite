import { ref, computed, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useTabStore } from '@/store';
import { isAllowedFile } from '../constants';
import { getFileType } from '../utils';

// 可在应用内查看的文件类型（拥有对应的查看器组件）
// 其余格式（图片、Word/Excel/PPT 等）均使用系统默认应用打开
const IN_APP_VIEWABLE_TYPES = ['pdf', 'epub', 'markdown', 'note', 'html', 'txt', 'json', 'xml'];

export function useFileSystem() {
  const api = window.electronAPI;
  const router = useRouter();
  const tabStore = useTabStore();

  const dataDir = ref('');
  const currentPath = ref('');
  const kbRootPath = ref('');
  const files = ref([]);
  const navigationHistory = ref([]);
  const historyIndex = ref(-1);

  const showNewFolderDialog = ref(false);
  const newFolderName = ref('');
  const newFolderInputRef = ref(null);

  // 重命名对话框状态
  const showRenameDialog = ref(false);
  const renameItem = ref(null);
  const renameName = ref('');
  const renameInputRef = ref(null);

  const canGoBack = computed(() => historyIndex.value > 0);
  const canGoForward = computed(() => historyIndex.value < navigationHistory.value.length - 1);

  const pathSegments = computed(() => {
    if (!currentPath.value || !kbRootPath.value) return [];
    const basePath = kbRootPath.value.substring(0, kbRootPath.value.lastIndexOf('/'));
    const relativePath = currentPath.value.slice(basePath.length).replace(/^\//, '');
    const segments = relativePath.split('/').filter(Boolean);
    let accumulated = basePath;
    return segments.map(name => {
      accumulated = accumulated + '/' + name;
      return { name, path: accumulated };
    });
  });

  async function loadDataDir() {
    if (!api) return;
    try {
      dataDir.value = await api.invoke('kb-get-data-dir');
    } catch (e) {
      console.error('Failed to get data dir:', e);
    }
  }

  async function readDirectory(dirPath) {
    if (!api) return;
    try {
      const entries = await api.invoke('kb-read-dir', { dirPath });
      // 工作区(agent)不限制文件格式，其他知识库仅显示允许的文件类型
      const isAgentDir = dirPath.includes('/knowledge/agent/');
      const isVisible = entry => entry.isDirectory || isAgentDir || isAllowedFile(entry.name);
      files.value = entries
        .filter(isVisible)
        .map(entry => ({
          ...entry,
          type: entry.isDirectory ? 'folder' : getFileType(entry.name)
        }));

      // 并发获取各子目录的项目数，避免串行 N+1 IPC 调用带来的延迟
      const folders = files.value.filter(f => f.isDirectory);
      if (folders.length > 0) {
        const counts = await Promise.all(
          folders.map(f =>
            api.invoke('kb-read-dir', { dirPath: f.path })
              .then(subEntries => subEntries.filter(isVisible).length + '项')
              .catch(() => '0项')
          )
        );
        folders.forEach((f, i) => { f.count = counts[i]; });
      }
    } catch (e) {
      console.error('Failed to read directory:', e);
      files.value = [];
    }
  }

  async function navigateTo(dirPath, addToHistory = true) {
    currentPath.value = dirPath;
    await readDirectory(dirPath);
    // 通知后端动态监听当前目录（Linux 不支持 recursive 监听，需切换监听目标）
    // macOS/Windows 已有 recursive watcher，此调用为空操作
    if (api) {
      api.invoke('kb-watch-current-dir', { dirPath }).catch(() => {});
    }
    if (addToHistory) {
      if (historyIndex.value < navigationHistory.value.length - 1) {
        navigationHistory.value = navigationHistory.value.slice(0, historyIndex.value + 1);
      }
      navigationHistory.value.push(dirPath);
      historyIndex.value = navigationHistory.value.length - 1;
    }
  }

  async function selectKnowledgeBaseDir(id, name, categoryId) {
    if (!api || !dataDir.value) return;
    const kbDir = dataDir.value + '/knowledge/' + categoryId + '/' + name;
    kbRootPath.value = kbDir;
    try {
      await api.invoke('kb-create-dir', { dirPath: kbDir });
    } catch (e) {
      console.error('Failed to create kb dir:', e);
    }
    await navigateTo(kbDir);
  }

  function goBack() {
    if (!canGoBack.value) return;
    historyIndex.value--;
    const targetPath = navigationHistory.value[historyIndex.value];
    currentPath.value = targetPath;
    readDirectory(targetPath);
  }

  function goForward() {
    if (!canGoForward.value) return;
    historyIndex.value++;
    const targetPath = navigationHistory.value[historyIndex.value];
    currentPath.value = targetPath;
    readDirectory(targetPath);
  }

  async function navigateToSegment(index) {
    const segment = pathSegments.value[index];
    if (segment && segment.path !== currentPath.value) {
      await navigateTo(segment.path);
    }
  }

  async function openFile(file) {
    if (file.isDirectory) {
      await navigateTo(file.path);
      return;
    }
    // 可在应用内查看的文件类型在新标签页中打开
    if (IN_APP_VIEWABLE_TYPES.includes(file.type)) {
      const tab = tabStore.addFileTab(file);
      router.push(tab.fullPath);
      return;
    }
    // 其他格式（图片、Word/Excel/PPT 等）使用系统默认应用打开
    if (api) {
      await api.invoke('kb-open-file-external', { filePath: file.path });
    }
  }

  // 搜索结果点击：文件夹则进入，文件则跳转到所在目录
  async function openSearchResult(file) {
    if (file.isDirectory) {
      await navigateTo(file.path);
    } else {
      const lastSep = Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\'));
      const parentPath = lastSep > 0 ? file.path.substring(0, lastSep) : currentPath.value;
      await navigateTo(parentPath);
    }
  }

  async function refreshCurrentDir() {
    if (currentPath.value) {
      await readDirectory(currentPath.value);
    }
  }

  function openNewFolderDialog() {
    newFolderName.value = '';
    showNewFolderDialog.value = true;
    nextTick(() => {
      newFolderInputRef.value?.focus();
    });
  }

  function closeNewFolderDialog() {
    showNewFolderDialog.value = false;
    newFolderName.value = '';
  }

  async function confirmNewFolder() {
    const folderName = newFolderName.value.trim();
    if (!folderName || !currentPath.value || !api) return;
    try {
      const result = await api.invoke('kb-mkdir', {
        parentPath: currentPath.value,
        dirName: folderName
      });
      if (result.success) {
        closeNewFolderDialog();
        await refreshCurrentDir();
      } else {
        console.error('Failed to create folder:', result.error);
      }
    } catch (e) {
      console.error('Failed to create folder:', e);
    }
  }

  // ===== 重命名功能 =====
  function openRenameDialog(file) {
    renameItem.value = file;
    renameName.value = file.name;
    showRenameDialog.value = true;
    nextTick(() => {
      renameInputRef.value?.focus();
      renameInputRef.value?.select();
    });
  }

  function closeRenameDialog() {
    showRenameDialog.value = false;
    renameItem.value = null;
    renameName.value = '';
  }

  // 获取不含扩展名的文件名和扩展名
  function splitNameAndExt(name) {
    const lastDot = name.lastIndexOf('.');
    // 隐藏文件(如 .gitignore)或无扩展名
    if (lastDot <= 0) return { base: name, ext: '' };
    return { base: name.substring(0, lastDot), ext: name.substring(lastDot) };
  }

  // 检查路径冲突并自动添加"副本"后缀
  async function resolveNameConflict(parentPath, newName, originalPath) {
    let candidateName = newName;
    let candidatePath = parentPath + '/' + candidateName;

    if (candidatePath === originalPath) {
      return { name: candidateName, path: candidatePath };
    }

    let exists = await api.invoke('kb-path-exists', { path: candidatePath });
    if (!exists) {
      return { name: candidateName, path: candidatePath };
    }

    const { base, ext } = splitNameAndExt(newName);
    let counter = 1;
    while (exists) {
      candidateName = base + ' 副本' + (counter > 1 ? ' ' + counter : '') + ext;
      candidatePath = parentPath + '/' + candidateName;
      exists = await api.invoke('kb-path-exists', { path: candidatePath });
      counter++;
    }
    return { name: candidateName, path: candidatePath };
  }

  async function confirmRename() {
    const newName = renameName.value.trim();
    if (!newName || !renameItem.value || !api) {
      closeRenameDialog();
      return;
    }

    const file = renameItem.value;
    if (newName === file.name) {
      closeRenameDialog();
      return;
    }

    try {
      const lastSep = Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\'));
      const parentPath = file.path.substring(0, lastSep);
      const { path: newPath } = await resolveNameConflict(parentPath, newName, file.path);

      const result = await api.invoke('kb-rename-dir', { oldPath: file.path, newPath });
      if (result.success) {
        closeRenameDialog();
        await refreshCurrentDir();
      } else {
        console.error('Failed to rename:', result.error);
      }
    } catch (e) {
      console.error('Failed to rename:', e);
    }
  }

  // ===== 删除文件/文件夹功能 =====
  async function deleteFileOrFolder(file) {
    if (!api || !file || !file.path) return false;
    try {
      const result = await api.invoke('kb-delete-dir', { dirPath: file.path });
      if (result.success) {
        await refreshCurrentDir();
        return true;
      }
      console.error('Failed to delete:', result.error);
      return false;
    } catch (e) {
      console.error('Failed to delete:', e);
      return false;
    }
  }

  function resetNavigation() {
    files.value = [];
    currentPath.value = '';
    kbRootPath.value = '';
    navigationHistory.value = [];
    historyIndex.value = -1;
  }

  return {
    dataDir,
    currentPath,
    kbRootPath,
    files,
    showNewFolderDialog,
    newFolderName,
    newFolderInputRef,
    showRenameDialog,
    renameItem,
    renameName,
    renameInputRef,
    canGoBack,
    canGoForward,
    pathSegments,
    loadDataDir,
    navigateTo,
    selectKnowledgeBaseDir,
    goBack,
    goForward,
    navigateToSegment,
    openFile,
    openSearchResult,
    refreshCurrentDir,
    openNewFolderDialog,
    closeNewFolderDialog,
    confirmNewFolder,
    openRenameDialog,
    closeRenameDialog,
    confirmRename,
    deleteFileOrFolder,
    resetNavigation
  };
}
