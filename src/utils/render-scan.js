const FLASH_MS = 650
const TOGGLE_KEY = 'r'
const STORAGE_KEY = 'render-scan:enabled'

let enabled = false
try {
  enabled = localStorage.getItem(STORAGE_KEY) === '1'
} catch {
  enabled = false
}

let styleInjected = false
const flashCounts = new WeakMap()

function injectStyle() {
  if (styleInjected) return
  styleInjected = true
  const style = document.createElement('style')
  style.id = 'render-scan-style'
  style.textContent = `
.render-scan-flash {
  position: fixed;
  pointer-events: none;
  z-index: 2147483646;
  border: 1.5px solid rgba(255, 106, 0, 0.9);
  background: rgba(255, 106, 0, 0.08);
  border-radius: 3px;
  animation: render-scan-fade ${FLASH_MS}ms ease-out forwards;
}
.render-scan-label {
  position: fixed;
  pointer-events: none;
  z-index: 2147483647;
  transform: translateY(-100%);
  padding: 1px 5px;
  border-radius: 3px 3px 3px 0;
  background: rgba(255, 106, 0, 0.95);
  color: #fff;
  font: 600 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: nowrap;
  animation: render-scan-fade ${FLASH_MS}ms ease-out forwards;
}
@keyframes render-scan-fade {
  0% { opacity: 1; }
  70% { opacity: 0.9; }
  100% { opacity: 0; }
}
`
  document.head.appendChild(style)
}

function flash(el, name) {
  const now = performance.now()
  const record = flashCounts.get(el)
  const count = record && now - record.at < 1000 ? record.count + 1 : 1
  flashCounts.set(el, { count, at: now })
  console.log(
    `%c⟳ ${name} ×${count}`,
    'color:#ff6a00;font-weight:bold;font-family:monospace'
  )

  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return

  for (const cls of ['render-scan-flash', 'render-scan-label']) {
    const node = document.createElement('div')
    node.className = cls
    if (cls === 'render-scan-flash') {
      Object.assign(node.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      })
    } else {
      node.textContent = `${name} ×${count}`
      Object.assign(node.style, {
        left: `${Math.max(rect.left, 0)}px`,
        top: `${Math.max(rect.top, 12)}px`
      })
    }
    document.body.appendChild(node)
    setTimeout(() => node.remove(), FLASH_MS)
  }
}

function isEditableTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  )
}

function onKeydown(event) {
  if (!event.altKey || event.code !== 'KeyR') return
  if (isEditableTarget(event.target)) return
  event.preventDefault()
  enabled = !enabled
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* storage unavailable */
  }
  console.log(
    `%c[render-scan] ${enabled ? 'ON' : 'OFF'} (Alt+R 切换)`,
    `color:${enabled ? '#ff6a00' : '#888'};font-weight:bold`
  )
}

export function renderScan(app) {
  injectStyle()
  window.addEventListener('keydown', onKeydown, true)
  app.mixin({
    updated() {
      if (!enabled) return
      const el = this.$el
      if (!el || el.nodeType !== 1) return
      const name = this.$options.name || this.$options.__name || 'Anonymous'
      flash(el, name)
    }
  })
  console.log(`[render-scan] ready, ${enabled ? 'ON' : 'OFF'} (Alt+R 切换)`)
}
