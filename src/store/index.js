import { createPinia } from 'pinia'
export const pinia = createPinia()
export * from './modules/app'
export * from './modules/workspace'
export * from './modules/note'
export * from './modules/schedule'
export * from './modules/history'
export * from './modules/settings'
export * from './modules/tabs'
