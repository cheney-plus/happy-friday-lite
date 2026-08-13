<template>
  <section class="template-grid">
    <button v-for="item in templates" :key="item.key" class="template-card" type="button" @click="emit('select', item)">
      <span :class="['template-preview', `is-${item.variant}`]" aria-hidden="true"><span v-if="item.variant === 'window'" class="preview-dots"><i></i><i></i><i></i></span><span class="preview-lines"><i></i><i></i><i></i></span><component :is="item.icon" :size="20" :stroke-width="1.8" class="preview-icon" /></span>
      <span class="template-copy"><strong>{{ item.title }}</strong><span>{{ item.description }}</span></span>
    </button>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Bug, Crosshair, FilePlus2, Glasses, LineChart, ScanSearch, Sparkles, TestTubeDiagonal } from 'lucide-vue-next';
import automationTemplates from './automationTemplates.json';

const emit = defineEmits(['select']);
const { t } = useI18n();
const templateIcons = { aiNews: Sparkles, brandSentiment: Glasses, competitorTracking: Crosshair, stockAlerts: LineChart, securityScan: ScanSearch, commitBugs: Bug, testCoverage: TestTubeDiagonal, dailyChanges: FilePlus2 };
const templates = computed(() => automationTemplates.map(template => ({
  ...template,
  icon: templateIcons[template.key],
  title: t(`automation.templates.${template.key}.title`),
  description: t(`automation.templates.${template.key}.description`)
})));
</script>
