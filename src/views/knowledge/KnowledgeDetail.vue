<template>
  <div class="knowledge-detail">
    <h1>{{ t('knowledge.title') }}</h1>
    <p>{{ t('knowledge.placeholder') }}</p>
    <p v-if="$route.params.id">ID: {{ $route.params.id }}</p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<style scoped>
.knowledge-detail {
  padding: 24px;
}
</style>
