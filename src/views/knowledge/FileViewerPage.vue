<template>
  <FileViewer :file="file" />
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import FileViewer from './components/FileViewer.vue';

const route = useRoute();

const file = computed(() => {
  const params = route.query;
  return {
    path: params.path || '',
    name: params.name || '文件',
    type: params.type || 'unknown'
  };
});
</script>
