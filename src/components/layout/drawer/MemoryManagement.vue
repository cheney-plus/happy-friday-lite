<template>
  <div class="placeholder-panel">
    <!-- Header (fixed, no scroll) -->
    <div class="panel-header">
      <h2 class="section-title">{{ t('drawer.nav.memory') }}</h2>
      <button class="close-btn" @click="emit('close')">
        <X :size="16" :stroke-width="2" />
      </button>
    </div>

    <!-- Body -->
    <div class="panel-body">
      <div class="placeholder-content">
        <div class="placeholder-icon">
          <Brain :size="44" :stroke-width="1.2" />
        </div>
        <h3 class="placeholder-title">{{ t('drawer.comingSoon') }}</h3>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { Brain, X } from 'lucide-vue-next';

const { t } = useI18n();

const emit = defineEmits(['close']);
</script>

<style scoped>
.placeholder-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 10px 7px;
  flex-shrink: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 5px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  flex-shrink: 0;
}

.close-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.panel-body::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-tertiary);
  padding: 20px;
}

.placeholder-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: 16px;
  color: var(--text-tertiary);
}

.placeholder-title {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
}
</style>
