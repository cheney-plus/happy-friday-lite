<template>
  <main class="login-page">
    <div class="login-content">
      <div class="login-brand">
        <div class="login-logo-row">
          <img :src="logoImage" alt="" class="login-logo" draggable="false" />
          <img :src="wordmark" alt="Happy Friday" class="login-wordmark" draggable="false" />
        </div>
        <p class="login-kicker">{{ t('auth.kicker') }}</p>
      </div>

      <form class="login-card" @submit.prevent="submit">
        <div class="login-heading">
          <h1>{{ t('auth.title') }}</h1>
          <p>{{ t('auth.description') }}</p>
        </div>

        <label class="login-field">
          <span>{{ t('auth.serverURL') }}</span>
          <input
            v-model.trim="serverURL"
            type="url"
            :placeholder="t('auth.serverPlaceholder')"
            required
          >
        </label>
        <label class="login-field">
          <span>{{ t('auth.email') }}</span>
          <input
            v-model.trim="email"
            type="email"
            autocomplete="email"
            required
          >
        </label>
        <label class="login-field">
          <span>{{ t('auth.password') }}</span>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
          >
        </label>

        <p v-if="error" class="login-error">{{ error }}</p>

        <button class="login-submit" type="submit" :disabled="loading">
          {{ loading ? t('auth.submitting') : t('auth.submit') }}
        </button>
      </form>
    </div>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/store'
import { getServerURL } from '@/services/enterprise'
import { useTheme } from '@/utils/theme'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const { appliedTheme } = useTheme()

const serverURL = ref(getServerURL())
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const isDark = computed(() => appliedTheme.value === 'dark')
const logoImage = new URL('@/assets/images/friday-w.png', import.meta.url).href
const wordmark = computed(() => (
  isDark.value
    ? new URL('@/assets/images/HPTEXT-w.png', import.meta.url).href
    : new URL('@/assets/images/HPTEXT-b.png', import.meta.url).href
))

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.signIn({
      serverURL: serverURL.value,
      email: email.value,
      password: password.value
    })
    router.replace('/friday')
  } catch (e) {
    error.value = e?.message || t('auth.failed')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 0;
  width: 100%;
  padding: 40px 24px;
  background-color: var(--bg-primary);
  overflow: auto;
}

.login-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 36px;
  width: min(460px, 100%);
}

.login-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.login-logo-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.login-logo {
  height: 60px;
  width: auto;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

.login-wordmark {
  height: 46px;
  width: auto;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

.login-kicker {
  margin: 0;
  font-size: 14px;
  letter-spacing: 2px;
  color: var(--text-tertiary);
}

.login-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 28px 28px 24px;
  background-color: var(--bg-secondary);
  border-radius: 10px;
}

.login-heading h1 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.login-heading p {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  font-weight: 400;
}

.login-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.login-field input {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
  font-weight: 400;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.login-field input::placeholder {
  color: var(--text-tertiary);
}

.login-field input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.login-submit {
  margin-top: 4px;
  height: 42px;
  border: none;
  border-radius: 8px;
  background-color: var(--text-primary);
  color: var(--bg-primary);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.login-submit:hover:not(:disabled) {
  opacity: 0.85;
}

.login-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-error {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: #dc2626;
}
</style>
