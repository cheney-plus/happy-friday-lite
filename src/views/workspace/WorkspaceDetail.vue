<template>
  <div class="workspace-detail">
    <h1>{{ t('workspace.title') }}</h1>
    <p>{{ t('workspace.placeholder') }}</p>
    <p v-if="$route.params.id">ID: {{ $route.params.id }}</p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<style scoped>
.workspace-detail {
  padding: 24px;
}
</style>
