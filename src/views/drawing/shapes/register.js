import { Graph, Shape } from '@antv/x6'
import { FONT_FAMILY } from './theme.js'
import { SIDE_PORTS } from './ports.js'

let registered = false

function bodyAttrs(extra = {}) {
  return {
    fill: '#ffffff',
    stroke: '#94a3b8',
    strokeWidth: 1.5,
    ...extra
  }
}

function labelAttrs(extra = {}) {
  return {
    fill: '#1c1917',
    fontSize: 13,
    fontFamily: FONT_FAMILY,
    textWrap: { width: -16, height: -10, ellipsis: true },
    ...extra
  }
}

function registerRect(name, options = {}) {
  Graph.registerNode(
    name,
    {
      inherit: 'rect',
      width: options.width || 140,
      height: options.height || 56,
      attrs: {
        body: bodyAttrs({ rx: options.rx ?? 8, ry: options.ry ?? 8, ...(options.body || {}) }),
        label: labelAttrs(options.label)
      },
      ports: options.ports === false ? undefined : SIDE_PORTS
    },
    true
  )
}

function registerPolygon(name, refPoints, options = {}) {
  Graph.registerNode(
    name,
    {
      inherit: 'polygon',
      width: options.width || 120,
      height: options.height || 72,
      attrs: {
        body: { ...bodyAttrs(options.body), refPoints },
        label: labelAttrs(options.label)
      },
      ports: SIDE_PORTS
    },
    true
  )
}

function registerPath(name, refD, options = {}) {
  Graph.registerNode(
    name,
    {
      inherit: 'path',
      width: options.width || 120,
      height: options.height || 80,
      attrs: {
        body: { ...bodyAttrs(options.body), refD },
        label: labelAttrs(options.label)
      },
      ports: SIDE_PORTS
    },
    true
  )
}

function registerEllipse(name, options = {}) {
  Graph.registerNode(
    name,
    {
      inherit: options.inherit || 'ellipse',
      width: options.width || 120,
      height: options.height || 64,
      attrs: {
        body: bodyAttrs(options.body),
        label: labelAttrs(options.label)
      },
      ports: SIDE_PORTS
    },
    true
  )
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function registerDrawingShapes() {
  if (registered) return
  registered = true

  registerRect('draw-rect')
  registerRect('draw-rounded', { rx: 18, ry: 18 })
  registerRect('draw-process', { rx: 6, ry: 6 })
  registerRect('draw-container', {
    width: 280,
    height: 180,
    rx: 14,
    ry: 14,
    body: { fill: 'rgba(148,163,184,0.08)', strokeDasharray: '6 4' },
    label: { textVerticalAnchor: 'top', refY: 12, fontSize: 12, fill: '#78716c' }
  })
  registerRect('draw-sticky', {
    width: 140,
    height: 110,
    rx: 4,
    ry: 4,
    body: { fill: '#fef3c7', stroke: '#f59e0b' }
  })
  registerRect('draw-text', {
    width: 140,
    height: 36,
    rx: 4,
    ry: 4,
    body: { fill: 'transparent', stroke: 'transparent' },
    label: { fontSize: 16, fontWeight: 600 }
  })

  registerEllipse('draw-circle', { inherit: 'circle', width: 88, height: 88 })
  registerEllipse('draw-ellipse')
  registerEllipse('draw-terminator', { width: 128, height: 52 })
  registerEllipse('draw-connector', { inherit: 'circle', width: 44, height: 44 })

  registerPolygon('draw-diamond', '0,10 10,0 20,10 10,20', { width: 140, height: 88 })
  registerPolygon('draw-triangle', '10,0 20,20 0,20', { width: 120, height: 88 })
  registerPolygon('draw-parallelogram', '4,0 20,0 16,20 0,20', { width: 150, height: 64 })
  registerPolygon('draw-hexagon', '5,0 15,0 20,10 15,20 5,20 0,10', { width: 140, height: 80 })
  registerPolygon('draw-star', '10,0 12.4,7 20,7.2 14,11.8 16.2,19 10,15 3.8,19 6,11.8 0,7.2 7.6,7', {
    width: 96,
    height: 96
  })
  registerPolygon('draw-decision', '0,10 10,0 20,10 10,20', { width: 148, height: 92 })
  registerPolygon('draw-data', '4,0 20,0 16,20 0,20', { width: 150, height: 60 })
  registerPolygon('draw-preparation', '5,0 15,0 20,10 15,20 5,20 0,10', { width: 150, height: 70 })
  registerPolygon('draw-er-rel', '0,10 10,0 20,10 10,20', {
    width: 140,
    height: 88,
    body: { fill: '#eff6ff', stroke: '#2563eb' }
  })
  registerPolygon('draw-er-ident', '0,10 10,0 20,10 10,20', {
    width: 148,
    height: 92,
    body: { fill: '#eff6ff', stroke: '#1d4ed8', strokeWidth: 2.4 }
  })

  registerPath(
    'draw-cloud',
    'M 25 60 C 8 60 5 38 22 34 C 22 14 48 10 58 24 C 78 16 96 28 90 46 C 108 48 108 68 86 70 C 80 82 52 86 38 74 C 28 80 18 74 25 60 Z',
    { width: 150, height: 90 }
  )
  registerPath(
    'draw-cylinder',
    'M 0 12 C 0 4 40 4 40 12 L 40 52 C 40 60 0 60 0 52 Z M 0 12 C 0 20 40 20 40 12',
    { width: 110, height: 90 }
  )
  registerPath(
    'draw-document',
    'M 0 0 L 40 0 L 40 48 Q 30 42 20 48 T 0 48 Z',
    { width: 130, height: 86 }
  )
  registerPath(
    'draw-note',
    'M 0 0 L 30 0 L 40 10 L 40 56 L 0 56 Z M 30 0 L 30 10 L 40 10',
    { width: 130, height: 90, body: { fill: '#fffbeb', stroke: '#d97706' } }
  )
  registerPath(
    'draw-delay',
    'M 0 0 L 28 0 C 40 0 40 40 28 40 L 0 40 Z',
    { width: 130, height: 64 }
  )
  registerPath(
    'draw-display',
    'M 6 0 L 34 0 C 40 10 40 30 34 40 L 6 40 L 0 20 Z',
    { width: 140, height: 70 }
  )
  registerPath(
    'draw-manual',
    'M 0 8 L 40 0 L 40 40 L 0 40 Z',
    { width: 140, height: 70 }
  )

  Graph.registerNode(
    'draw-image',
    {
      inherit: 'image',
      width: 148,
      height: 108,
      attrs: {
        image: {
          xlinkHref:
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="148" height="108"><rect width="148" height="108" rx="10" fill="%23f1f5f9"/><rect x="18" y="22" width="112" height="64" rx="8" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-dasharray="6 4"/><circle cx="52" cy="48" r="8" fill="%23cbd5e1"/><path d="M36 78 L68 54 L92 70 L112 58 L112 78 Z" fill="%23cbd5e1"/></svg>'
        },
        label: labelAttrs({ refY: '100%', refY2: 14, textVerticalAnchor: 'top', fontSize: 12 })
      },
      ports: SIDE_PORTS
    },
    true
  )

  registerRect('draw-mind-root', {
    width: 160,
    height: 52,
    rx: 26,
    ry: 26,
    body: { fill: '#2563eb', stroke: '#1d4ed8' },
    label: { fill: '#ffffff', fontWeight: 600 }
  })
  registerRect('draw-mind-topic', {
    width: 132,
    height: 42,
    rx: 12,
    ry: 12,
    body: { fill: '#eff6ff', stroke: '#3b82f6' }
  })
  registerRect('draw-mind-sub', {
    width: 116,
    height: 34,
    rx: 8,
    ry: 8,
    body: { fill: '#ffffff', stroke: '#93c5fd' },
    label: { fontSize: 12 }
  })
  registerRect('draw-mind-callout', {
    width: 120,
    height: 48,
    rx: 18,
    ry: 18,
    body: { fill: '#fef3c7', stroke: '#f59e0b' }
  })

  registerRect('draw-er-entity', {
    width: 160,
    height: 88,
    rx: 8,
    ry: 8,
    body: { fill: '#ecfeff', stroke: '#0f766e' }
  })
  registerRect('draw-er-weak', {
    width: 168,
    height: 96,
    rx: 8,
    ry: 8,
    body: { fill: '#ecfeff', stroke: '#0f766e', strokeWidth: 2.4 }
  })
  registerEllipse('draw-er-attr', { width: 120, height: 52, body: { fill: '#f0fdf4', stroke: '#16a34a' } })
  registerEllipse('draw-er-key', {
    width: 120,
    height: 52,
    body: { fill: '#f0fdf4', stroke: '#16a34a' },
    label: { textDecoration: 'underline', fontWeight: 600 }
  })

  registerEllipse('draw-uml-usecase', { width: 150, height: 70, body: { fill: '#f5f3ff', stroke: '#7c3aed' } })
  registerRect('draw-uml-package', {
    width: 180,
    height: 110,
    rx: 4,
    ry: 4,
    body: { fill: '#f8fafc', stroke: '#64748b' },
    label: { textVerticalAnchor: 'top', refY: 14 }
  })
  registerRect('draw-uml-component', {
    width: 160,
    height: 72,
    rx: 6,
    ry: 6,
    body: { fill: '#eef2ff', stroke: '#4f46e5' }
  })
  registerRect('draw-uml-interface', {
    width: 160,
    height: 56,
    rx: 10,
    ry: 10,
    body: { fill: '#f5f3ff', stroke: '#7c3aed' }
  })

  Graph.registerNode(
    'draw-uml-actor',
    {
      width: 64,
      height: 108,
      markup: [
        { tagName: 'circle', selector: 'head' },
        { tagName: 'path', selector: 'body' },
        { tagName: 'text', selector: 'label' }
      ],
      attrs: {
        head: {
          cx: 32,
          cy: 16,
          r: 12,
          fill: '#ffffff',
          stroke: '#64748b',
          strokeWidth: 1.5
        },
        body: {
          d: 'M 32 28 L 32 58 M 16 40 L 48 40 M 32 58 L 16 90 M 32 58 L 48 90',
          stroke: '#64748b',
          strokeWidth: 1.5,
          fill: 'none'
        },
        label: {
          ...labelAttrs({ fontSize: 12 }),
          refX: 32,
          y: 104,
          textAnchor: 'middle',
          textVerticalAnchor: 'top'
        }
      },
      ports: SIDE_PORTS
    },
    true
  )

  Shape.HTML.register({
    shape: 'draw-uml-class',
    width: 200,
    height: 148,
    effect: ['data'],
    ports: SIDE_PORTS,
    html(cell) {
      const data = cell.getData() || {}
      const name = escapeHtml(data.className || cell.attr('label/text') || 'Class')
      const attrs = escapeHtml(data.attributes || '+ id: string\n+ name: string')
      const methods = escapeHtml(data.methods || '+ save(): void')
      return `<div class="draw-uml-class">
        <div class="draw-uml-class__head">${name}</div>
        <div class="draw-uml-class__section">${attrs}</div>
        <div class="draw-uml-class__section">${methods}</div>
      </div>`
    }
  })

  registerRect('draw-tl-event', {
    width: 150,
    height: 64,
    rx: 10,
    ry: 10,
    body: { fill: '#eff6ff', stroke: '#2563eb' }
  })
  registerEllipse('draw-tl-milestone', {
    inherit: 'circle',
    width: 28,
    height: 28,
    body: { fill: '#2563eb', stroke: '#1d4ed8' },
    label: { fill: '#ffffff', fontSize: 11 }
  })
  registerRect('draw-tl-axis', {
    width: 520,
    height: 8,
    rx: 4,
    ry: 4,
    body: { fill: '#cbd5e1', stroke: 'transparent' },
    label: { text: '' }
  })

  Graph.registerNode(
    'draw-seq-actor',
    {
      inherit: 'rect',
      width: 120,
      height: 280,
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'rect', selector: 'header' },
        { tagName: 'path', selector: 'life' },
        { tagName: 'text', selector: 'label' }
      ],
      attrs: {
        body: { fill: 'transparent', stroke: 'none', refWidth: '100%', refHeight: '100%' },
        header: {
          refWidth: '100%',
          height: 40,
          rx: 8,
          ry: 8,
          fill: '#ffffff',
          stroke: '#64748b',
          strokeWidth: 1.5
        },
        life: {
          d: 'M 60 40 L 60 280',
          stroke: '#94a3b8',
          strokeWidth: 1.4,
          strokeDasharray: '6 5'
        },
        label: labelAttrs({ refY: 20 })
      },
      ports: SIDE_PORTS
    },
    true
  )

  registerRect('draw-seq-activation', {
    width: 16,
    height: 80,
    rx: 2,
    ry: 2,
    body: { fill: '#dbeafe', stroke: '#2563eb' },
    label: { text: '' }
  })
  registerRect('draw-seq-fragment', {
    width: 360,
    height: 160,
    rx: 6,
    ry: 6,
    body: { fill: 'rgba(148,163,184,0.06)', stroke: '#64748b', strokeDasharray: '5 4' },
    label: { textVerticalAnchor: 'top', refY: 12, refX: 12, textAnchor: 'start', fontSize: 12 }
  })

  const arch = (name, fill, stroke) =>
    registerRect(name, {
      width: 140,
      height: 64,
      rx: 12,
      ry: 12,
      body: { fill, stroke }
    })

  arch('draw-arch-client', '#eff6ff', '#2563eb')
  arch('draw-arch-server', '#ecfdf5', '#059669')
  arch('draw-arch-db', '#fef3c7', '#d97706')
  arch('draw-arch-cloud', '#e0f2fe', '#0284c7')
  arch('draw-arch-queue', '#f5f3ff', '#7c3aed')
  arch('draw-arch-cache', '#ffe4e6', '#e11d48')
  arch('draw-arch-gateway', '#f1f5f9', '#475569')

  registerRect('draw-dfd-external', {
    width: 140,
    height: 64,
    rx: 2,
    ry: 2,
    body: { fill: '#fff7ed', stroke: '#ea580c', strokeWidth: 2 }
  })
  registerEllipse('draw-dfd-process', {
    inherit: 'circle',
    width: 92,
    height: 92,
    body: { fill: '#ecfeff', stroke: '#0f766e', strokeWidth: 2 }
  })
  registerRect('draw-dfd-store', {
    width: 150,
    height: 48,
    rx: 0,
    ry: 0,
    body: { fill: '#f8fafc', stroke: '#334155' }
  })
}
