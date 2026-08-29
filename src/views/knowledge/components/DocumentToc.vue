<template>
  <aside v-if="items.length" class="document-toc" aria-label="文档目录">
    <div class="toc-title">目录</div>
    <nav class="toc-nav">
      <button
        v-for="item in items"
        :key="item.id"
        class="toc-item"
        :class="{ active: activeId === item.id }"
        :style="{ paddingLeft: `${10 + (item.level - 1) * 14}px` }"
        :title="item.title"
        @click="$emit('select', item)"
      >{{ item.title }}</button>
    </nav>
  </aside>
</template>

<script setup>
defineProps({ items: { type: Array, default: () => [] }, activeId: { type: String, default: '' } });
defineEmits(['select']);
</script>

<style scoped lang="scss">
.document-toc { width: 220px; flex: 0 0 220px; border-right: 1px solid var(--border-color); background: var(--bg-primary); overflow-y: auto; padding: 18px 10px; scrollbar-width: thin; scrollbar-color: var(--border-color) transparent; }
.document-toc::-webkit-scrollbar { width: 4px; height: 4px; }
.document-toc::-webkit-scrollbar-track { background: transparent; }
.document-toc::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
.document-toc::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }
.toc-title { padding: 0 10px 12px; color: var(--text-primary); font-size: 13px; font-weight: 600; }
.toc-nav { display: flex; flex-direction: column; gap: 2px; }
.toc-item { width: 100%; min-height: 30px; border: 0; border-left: 2px solid transparent; background: transparent; color: var(--text-secondary); text-align: left; font-size: 12px; line-height: 1.4; cursor: pointer; padding-top: 6px; padding-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: all .15s; }
.toc-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.toc-item.active { border-left-color: var(--accent-color); color: var(--accent-color); background: var(--bg-secondary); font-weight: 600; }
@media (max-width: 700px) { .document-toc { width: 180px; flex-basis: 180px; } }
</style>
