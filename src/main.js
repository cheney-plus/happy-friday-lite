import { createApp } from 'vue'
import { pinia } from './store'
import { router } from './router'
import { i18n } from './i18n'
import './assets/styles/main.css'
import App from './App.vue'

const app = createApp(App)

app.use(pinia)
app.use(router)
app.use(i18n)

app.mount('#app')
