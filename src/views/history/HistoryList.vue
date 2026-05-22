<template>
  <div class="history-list">
    <h1>{{ t('history.title') }}</h1>
    <p>{{ t('history.placeholder') }}</p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<style scoped>
.history-list {
  padding: 24px;
}
</style>
