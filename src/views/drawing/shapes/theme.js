export function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark'
}

export function getCanvasTheme() {
  const dark = isDarkTheme()
  return {
    dark,
    fill: dark ? '#252528' : '#ffffff',
    fillMuted: dark ? '#2c2c32' : '#f8fafc',
    stroke: dark ? '#7a7a82' : '#94a3b8',
    text: dark ? '#ededed' : '#1c1917',
    accent: dark ? '#60a5fa' : '#2563eb',
    grid: dark ? '#3a3a40' : '#d6d3d1',
    canvas: dark ? '#1a1a1c' : '#f4f4f5'
  }
}

export const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
