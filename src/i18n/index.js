import { createI18n } from 'vue-i18n'

const modules = import.meta.glob('./locales/*/*.json', { eager: true })

const messages = {
  'zh-CN': {},
  'en-US': {}
}

for (const path in modules) {
  const match = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/)
  if (match) {
    const lang = match[1]
    const moduleName = match[2]
    messages[lang][moduleName] = modules[path].default || modules[path]
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages
})

export function setI18nLanguage(lang) {
  i18n.global.locale.value = lang
  document.documentElement.setAttribute('lang', lang)
}
