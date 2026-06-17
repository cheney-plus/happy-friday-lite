import { ref, computed, nextTick } from 'vue';
import { FILE_TYPE_MAP, FILE_TYPE_LABELS, isAllowedFile } from '../constants';
import { FILE_ICON_MAP, UnknownFileIcon } from '../components/icons';

export function useFileSystem() {
  const api = window.electronAPI;

  const dataDir = ref('');
  const currentPath = ref('');
  const kbRootPath = ref('');
  const files = ref([]);
  const navigationHistory = ref([]);
  const historyIndex = ref(-1);

  const showNewFolderDialog = ref(false);
  const newFolderName = ref('');
  const newFolderInputRef = ref(null);

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

  function getFileType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    for (const [type, exts] of Object.entries(FILE_TYPE_MAP)) {
      if (exts.includes(ext)) return type;
    }
    return 'unknown';
  }

  function getFileIconComponent(type) {
    return FILE_ICON_MAP[type] || UnknownFileIcon;
  }

  function getTypeLabel(type) {
    return FILE_TYPE_LABELS[type] || '文件';
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    }
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

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
      files.value = entries
        .filter(entry => entry.isDirectory || isAllowedFile(entry.name))
        .map(entry => ({
          ...entry,
          type: entry.isDirectory ? 'folder' : getFileType(entry.name)
        }));
      for (const file of files.value) {
        if (file.isDirectory) {
          try {
            const subEntries = await api.invoke('kb-read-dir', { dirPath: file.path });
            file.count = subEntries.filter(e => e.isDirectory || isAllowedFile(e.name)).length + '项';
          } catch {
            file.count = '0项';
          }
        }
      }
    } catch (e) {
      console.error('Failed to read directory:', e);
      files.value = [];
    }
  }

  async function navigateTo(dirPath, addToHistory = true) {
    currentPath.value = dirPath;
    await readDirectory(dirPath);
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
    navigationHistory,
    historyIndex,
    showNewFolderDialog,
    newFolderName,
    newFolderInputRef,
    canGoBack,
    canGoForward,
    pathSegments,
    getFileType,
    getFileIconComponent,
    getTypeLabel,
    formatDate,
    loadDataDir,
    readDirectory,
    navigateTo,
    selectKnowledgeBaseDir,
    goBack,
    goForward,
    navigateToSegment,
    openFile,
    refreshCurrentDir,
    openNewFolderDialog,
    closeNewFolderDialog,
    confirmNewFolder,
    resetNavigation
  };
}
