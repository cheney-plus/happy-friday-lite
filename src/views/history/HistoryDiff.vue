<template>
  <div class="history-diff">
    <h1>{{ t('history.title') }}</h1>
    <p>{{ t('history.placeholder') }}</p>
    <p v-if="$route.params.id">ID: {{ $route.params.id }}</p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<style scoped>
.history-diff {
  padding: 24px;
}
</style>
