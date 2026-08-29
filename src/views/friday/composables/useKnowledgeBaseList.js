import { computed, ref } from 'vue';
import { DEFAULT_CATEGORIES } from '@/views/knowledge/constants';

export function useKnowledgeBaseList() {
  const kbList = ref(JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)));
  const selectableKbList = computed(() => kbList.value.filter(category => category.id !== 'agent'));

  async function loadKbListFromDisk() {
    const api = window.electronAPI;
    if (!api) return;
    let dataDir = '';
    try {
      dataDir = await api.invoke('kb-get-data-dir');
    } catch (error) {
      console.error('Failed to get data dir:', error);
      return;
    }
    if (!dataDir) return;
    const baseDir = `${dataDir}/knowledge`;
    for (const category of kbList.value) {
      const catDir = `${baseDir}/${category.id}`;
      try {
        await api.invoke('kb-create-dir', { dirPath: catDir });
        const entries = await api.invoke('kb-read-dir', { dirPath: catDir });
        for (const entry of entries) {
          if (entry.isDirectory && !category.items.some(item => item.name === entry.name)) {
            category.items.push({
              id: `kb-${category.id}-${entry.name}`,
              name: entry.name,
              coverIndex: null
            });
          }
        }
      } catch (error) {
        console.error(`Failed to load category ${category.id}:`, error);
      }
    }
  }

  return {
    kbList,
    selectableKbList,
    loadKbListFromDisk
  };
}
