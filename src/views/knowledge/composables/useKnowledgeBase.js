import { ref, reactive, computed, nextTick } from 'vue';
import { coverOptions, DEFAULT_CATEGORIES } from '../constants';

export function useKnowledgeBase(fileSystem, sidebar) {
  const api = window.electronAPI;
  const selectedKB = ref('');
  const currentTitle = ref('知识库');
  const categories = reactive(JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)));

  const showCreateDialog = ref(false);
  const currentCategoryId = ref('');
  const currentCategoryName = ref('');
  const kbNameInputRef = ref(null);
  const editingKBId = ref(null);

  const newKB = reactive({
    name: '',
    description: '',
    coverIndex: 0
  });

  // 从磁盘目录扫描知识库列表
  async function loadCategoriesFromDisk() {
    if (!api || !fileSystem.dataDir.value) return;
    const baseDir = fileSystem.dataDir.value + '/knowledge';
    for (const category of categories) {
      const catDir = baseDir + '/' + category.id;
      try {
        await api.invoke('kb-create-dir', { dirPath: catDir });
        const entries = await api.invoke('kb-read-dir', { dirPath: catDir });
        // 只添加磁盘上存在但列表中没有的文件夹
        for (const entry of entries) {
          if (entry.isDirectory && !category.items.some(i => i.name === entry.name)) {
            category.items.push({
              id: `kb-${category.id}-${entry.name}`,
              name: entry.name,
              coverIndex: null
            });
          }
        }
      } catch (e) {
        console.error(`Failed to load category ${category.id}:`, e);
      }
    }

    // 默认选中个人知识库中的第一个知识库
    const personalCategory = categories.find(c => c.id === 'personal');
    if (personalCategory && personalCategory.items.length > 0 && !selectedKB.value) {
      const firstItem = personalCategory.items[0];
      await selectKnowledgeBase(firstItem.id, firstItem.name, personalCategory.id);
    }
  }

  const filteredCategories = computed(() => {
    if (!sidebar.searchQuery.value) return categories;
    const q = sidebar.searchQuery.value.toLowerCase();
    return categories.map(cat => ({
      ...cat,
      _matched: cat.items.some(item => item.name.toLowerCase().includes(q)) || cat.name.toLowerCase().includes(q),
      items: cat.items.filter(item => item.name.toLowerCase().includes(q)),
      expanded: true
    }));
  });

  function toggleCategory(id) {
    const category = categories.find(c => c.id === id);
    if (category) {
      category.expanded = !category.expanded;
    }
  }

  async function selectKnowledgeBase(id, name, categoryId) {
    selectedKB.value = id;
    currentTitle.value = name;
    await fileSystem.selectKnowledgeBaseDir(id, name, categoryId);
  }

  function addKnowledgeBase(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      currentCategoryId.value = categoryId;
      currentCategoryName.value = category.name;
      newKB.name = '';
      newKB.description = '';
      newKB.coverIndex = 0;
      showCreateDialog.value = true;
      nextTick(() => {
        kbNameInputRef.value?.focus();
      });
    }
  }

  function selectCover(index) {
    newKB.coverIndex = index;
  }

  function closeCreateDialog() {
    showCreateDialog.value = false;
    editingKBId.value = null;
  }

  async function confirmCreateKB() {
    if (!newKB.name.trim()) return;

    const category = categories.find(c => c.id === currentCategoryId.value);
    if (!category) return;

    if (editingKBId.value) {
      const item = category.items.find(i => i.id === editingKBId.value);
      if (item) {
        const oldName = item.name;
        const newName = newKB.name.trim();

        // 重命名本地文件夹
        if (oldName !== newName && api && fileSystem.dataDir.value) {
          const oldPath = fileSystem.dataDir.value + '/knowledge/' + currentCategoryId.value + '/' + oldName;
          const newPath = fileSystem.dataDir.value + '/knowledge/' + currentCategoryId.value + '/' + newName;
          try {
            await api.invoke('kb-rename-dir', { oldPath, newPath });
            // 如果当前正在浏览该知识库，更新路径
            if (selectedKB.value === item.id) {
              const newKbDir = newPath;
              fileSystem.kbRootPath.value = newKbDir;
              if (fileSystem.currentPath.value.startsWith(oldPath)) {
                fileSystem.currentPath.value = fileSystem.currentPath.value.replace(oldPath, newPath);
              }
            }
          } catch (e) {
            console.error('Failed to rename kb dir:', e);
          }
        }

        item.name = newName;
        item.description = newKB.description.trim();
        item.coverIndex = newKB.coverIndex;
        if (selectedKB.value === item.id) {
          currentTitle.value = item.name;
        }
      }
    } else {
      const newId = `kb-${Date.now()}`;
      const newItem = {
        id: newId,
        name: newKB.name.trim(),
        description: newKB.description.trim(),
        coverIndex: newKB.coverIndex
      };
      category.items.push(newItem);
      selectedKB.value = newId;
      currentTitle.value = newKB.name.trim();

      if (window.electronAPI && fileSystem.dataDir.value) {
        const kbDir = fileSystem.dataDir.value + '/knowledge/' + currentCategoryId.value + '/' + newItem.name;
        fileSystem.kbRootPath.value = kbDir;
        try {
          await window.electronAPI.invoke('kb-create-dir', { dirPath: kbDir });
        } catch (e) {
          console.error('Failed to create kb dir:', e);
        }
        await fileSystem.navigateTo(kbDir);
      }
    }
    closeCreateDialog();
  }

  function editKnowledgeBase(contextMenu) {
    if (!contextMenu.item) return;
    const itemId = contextMenu.item.id;
    const categoryId = contextMenu.categoryId;
    const itemName = contextMenu.item.name || '';
    const itemDesc = contextMenu.item.description || '';
    const itemCoverIndex = contextMenu.item.coverIndex ?? 0;

    editingKBId.value = itemId;
    currentCategoryId.value = categoryId;
    const cat = categories.find(c => c.id === categoryId);
    currentCategoryName.value = cat ? cat.name : '';

    newKB.name = itemName;
    newKB.description = itemDesc;
    newKB.coverIndex = itemCoverIndex;

    showCreateDialog.value = true;
    nextTick(() => {
      kbNameInputRef.value?.focus();
    });
  }

  async function deleteKnowledgeBase(contextMenu) {
    if (!contextMenu.item) return;
    const categoryId = contextMenu.categoryId;
    const itemId = contextMenu.item.id;

    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    const index = category.items.findIndex(i => i.id === itemId);
    if (index !== -1) {
      // 删除本地文件夹
      if (api && fileSystem.dataDir.value) {
        const kbDir = fileSystem.dataDir.value + '/knowledge/' + categoryId + '/' + contextMenu.item.name;
        try {
          await api.invoke('kb-delete-dir', { dirPath: kbDir });
        } catch (e) {
          console.error('Failed to delete kb dir:', e);
        }
      }

      category.items.splice(index, 1);
      if (selectedKB.value === itemId) {
        selectedKB.value = '';
        currentTitle.value = '知识库';
        fileSystem.resetNavigation();
      }
    }
  }

  return {
    selectedKB,
    currentTitle,
    categories,
    filteredCategories,
    showCreateDialog,
    currentCategoryId,
    currentCategoryName,
    kbNameInputRef,
    editingKBId,
    newKB,
    coverOptions,
    loadCategoriesFromDisk,
    toggleCategory,
    selectKnowledgeBase,
    addKnowledgeBase,
    selectCover,
    closeCreateDialog,
    confirmCreateKB,
    editKnowledgeBase,
    deleteKnowledgeBase
  };
}
