<template>
  <section class="template-grid">
    <button v-for="item in templates" :key="item.key" class="template-card" type="button" @click="emit('select')">
      <span :class="['template-preview', `is-${item.variant}`]" aria-hidden="true"><span v-if="item.variant === 'window'" class="preview-dots"><i></i><i></i><i></i></span><span class="preview-lines"><i></i><i></i><i></i></span><component :is="item.icon" :size="20" :stroke-width="1.8" class="preview-icon" /></span>
      <span class="template-copy"><strong>{{ item.title }}</strong><span>{{ item.description }}</span></span>
    </button>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Bug, Crosshair, FilePlus2, Glasses, LineChart, ScanSearch, Sparkles, TestTubeDiagonal } from 'lucide-vue-next';

const emit = defineEmits(['select']);
const { t } = useI18n();
const templates = computed(() => [
  { key: 'aiNews', icon: Sparkles, variant: 'window', title: t('automation.templates.aiNews.title'), description: t('automation.templates.aiNews.description') },
  { key: 'brandSentiment', icon: Glasses, variant: 'window', title: t('automation.templates.brandSentiment.title'), description: t('automation.templates.brandSentiment.description') },
  { key: 'competitorTracking', icon: Crosshair, variant: 'window', title: t('automation.templates.competitorTracking.title'), description: t('automation.templates.competitorTracking.description') },
  { key: 'stockAlerts', icon: LineChart, variant: 'window', title: t('automation.templates.stockAlerts.title'), description: t('automation.templates.stockAlerts.description') },
  { key: 'securityScan', icon: ScanSearch, variant: 'code', title: t('automation.templates.securityScan.title'), description: t('automation.templates.securityScan.description') },
  { key: 'commitBugs', icon: Bug, variant: 'code', title: t('automation.templates.commitBugs.title'), description: t('automation.templates.commitBugs.description') },
  { key: 'testCoverage', icon: TestTubeDiagonal, variant: 'code', title: t('automation.templates.testCoverage.title'), description: t('automation.templates.testCoverage.description') },
  { key: 'dailyChanges', icon: FilePlus2, variant: 'code', title: t('automation.templates.dailyChanges.title'), description: t('automation.templates.dailyChanges.description') }
]);
</script>
