<template>
  <section class="quick-start">
    <div class="home-hero">
      <h1 class="hero-title">
        {{ greeting }}
        <span class="hero-ask">{{ ask }}</span>
      </h1>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();

// 上游同款时段问候：hour<6 算晚间
const hour = new Date().getHours();
const greetKey = hour < 6 ? 'greetEvening' : hour < 12 ? 'greetMorning' : hour < 18 ? 'greetAfternoon' : 'greetEvening';
const isCjk = computed(() => /^zh|ja/.test(locale.value));

const greeting = computed(() => {
  const base = t(`office.${greetKey}`);
  return isCjk.value ? `${base}。` : `${base}. `;
});

const asks = ['greetAsk1', 'greetAsk2', 'greetAsk3', 'greetAsk4', 'greetAsk5', 'greetAsk6'];
const ask = ref(t(`office.${asks[Math.floor(Math.random() * asks.length)]}`));
</script>

<style scoped lang="scss">
.home-hero {
  margin: 28px 0 20px;
}

.hero-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
  color: var(--of-text-primary);
}

.hero-ask {
  display: block;
  color: var(--of-text-primary);
  font-weight: 500;
}
</style>
