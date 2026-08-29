import { createApp } from 'vue'
import { pinia } from './store'
import { router } from './router'
import { i18n } from './i18n'
import './assets/styles/main.css'
import App from './App.vue'

// The desktop app does not use Tab-based focus navigation.
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return
  // Note editor handles Tab for indentation and list nesting.
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('[contenteditable="true"]')) return
  event.preventDefault()
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}, true)

const app = createApp(App)

app.use(pinia)
app.use(router)
app.use(i18n)

app.mount('#app')
