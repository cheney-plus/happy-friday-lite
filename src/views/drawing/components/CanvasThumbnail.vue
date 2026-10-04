<template>
  <svg v-if="nodes.length || edges.length" class="canvas-thumbnail" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <marker :id="arrowMarkerId" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#9ca3af" />
      </marker>
      <marker :id="openMarkerId" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="none" stroke="#9ca3af" stroke-width="1" />
      </marker>
    </defs>
    <g v-for="edge in edges" :key="edge.id">
      <path
        v-if="edge.mindPath"
        :d="edge.mindPath"
        fill="none"
        :stroke="edge.stroke"
        :stroke-width="edge.strokeWidth"
        stroke-linecap="round"
      />
      <polyline
        v-else
        :points="edgePoints(edge)"
        fill="none"
        :stroke="edge.stroke"
        :stroke-width="edge.strokeWidth"
        :stroke-dasharray="edge.dash"
        :marker-end="edge.hasArrow ? `url(#${edge.openArrow ? openMarkerId : arrowMarkerId})` : undefined"
        :marker-start="edge.hasStartArrow ? `url(#${arrowMarkerId})` : undefined"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <text
        v-if="edge.label"
        :x="edgeLabelPosition(edge).x"
        :y="edgeLabelPosition(edge).y"
        class="thumbnail-label"
        :fill="edge.labelFill"
        :font-size="edge.labelSize"
        :font-weight="edge.labelWeight"
        text-anchor="middle"
      >{{ edge.label }}</text>
    </g>
    <g v-for="node in nodes" :key="node.id">
      <template v-if="node.kind === 'actor'">
        <circle :cx="node.headCx" :cy="node.headCy" :r="node.headR" :fill="node.fill" :stroke="node.stroke" :stroke-width="node.strokeWidth" />
        <path :d="node.bodyD" :transform="node.transform" fill="none" :stroke="node.stroke" :stroke-width="node.strokeWidth" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      </template>
      <template v-else-if="node.kind === 'umlclass'">
        <rect :x="node.x" :y="node.y" :width="node.width" :height="node.height" rx="8" :fill="node.fill" :stroke="node.stroke" :stroke-width="node.strokeWidth" />
        <line :x1="node.x" :y1="node.y + node.height / 3" :x2="node.x + node.width" :y2="node.y + node.height / 3" :stroke="node.stroke" :stroke-width="node.strokeWidth * 0.7" opacity="0.5" />
        <line :x1="node.x" :y1="node.y + (node.height * 2) / 3" :x2="node.x + node.width" :y2="node.y + (node.height * 2) / 3" :stroke="node.stroke" :stroke-width="node.strokeWidth * 0.7" opacity="0.5" />
      </template>
      <template v-else-if="node.kind === 'seqactor'">
        <rect :x="node.x" :y="node.y" :width="node.width" :height="node.headerH" rx="8" :fill="node.fill" :stroke="node.stroke" :stroke-width="node.strokeWidth" />
        <line :x1="node.cx" :y1="node.y + node.headerH" :x2="node.cx" :y2="node.y + node.height" :stroke="node.lifeline" :stroke-width="1.2" stroke-dasharray="6 5" />
      </template>
      <template v-else-if="node.kind === 'image'">
        <rect :x="node.x" :y="node.y" :width="node.width" :height="node.height" rx="10" :fill="node.fill" :stroke="node.stroke" :stroke-width="node.strokeWidth" stroke-dasharray="6 4" />
      </template>
      <template v-else-if="node.kind === 'text'">
        <text
          v-if="node.label"
          :x="node.cx"
          :y="node.cy"
          class="thumbnail-label"
          :fill="node.labelFill"
          :font-size="node.labelSize"
          :font-weight="600"
          text-anchor="middle"
          dominant-baseline="middle"
        >{{ node.label }}</text>
      </template>
      <rect
        v-else-if="node.kind === 'rect' || node.kind === 'stadium'"
        :x="node.x"
        :y="node.y"
        :width="node.width"
        :height="node.height"
        :rx="node.rx"
        :ry="node.rx"
        :fill="node.fill"
        :stroke="node.stroke"
        :stroke-width="node.strokeWidth"
        :stroke-dasharray="node.dash"
      />
      <circle
        v-else-if="node.kind === 'circle'"
        :cx="node.cx"
        :cy="node.cy"
        :r="node.r"
        :fill="node.fill"
        :stroke="node.stroke"
        :stroke-width="node.strokeWidth"
      />
      <ellipse
        v-else-if="node.kind === 'ellipse'"
        :cx="node.cx"
        :cy="node.cy"
        :rx="node.width / 2"
        :ry="node.height / 2"
        :fill="node.fill"
        :stroke="node.stroke"
        :stroke-width="node.strokeWidth"
      />
      <polygon
        v-else-if="node.kind === 'polygon'"
        :points="node.points"
        :fill="node.fill"
        :stroke="node.stroke"
        :stroke-width="node.strokeWidth"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
      <path
        v-else-if="node.kind === 'path'"
        :d="node.d"
        :transform="node.transform"
        :fill="node.fill"
        :stroke="node.stroke"
        :stroke-width="node.strokeWidth"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
      <text
        v-if="node.showLabel"
        :x="node.labelX"
        :y="node.labelY"
        class="thumbnail-label"
        :fill="node.labelFill"
        :font-size="node.labelSize"
        :font-weight="node.labelWeight"
        :text-decoration="node.underline ? 'underline' : undefined"
        :text-anchor="node.labelAnchor"
        dominant-baseline="middle"
      >{{ node.label }}</text>
    </g>
  </svg>
  <span v-else class="thumbnail-empty"><PencilLine :size="26" :stroke-width="1.5" /></span>
</template>

<script setup>
import { computed } from 'vue'
import { PencilLine } from 'lucide-vue-next'

let markerSeq = 0

const props = defineProps({
  // Must be graphJson (not graphJSON): :graph-json camelizes to graphJson.
  graphJson: { type: Object, default: () => ({ cells: [] }) }
})

const arrowMarkerId = `thumbnail-arrow-${++markerSeq}`
const openMarkerId = `thumbnail-arrow-open-${markerSeq}`

// Shape descriptors mirroring shapes/register.js so thumbnails match the real canvas styles.
const POLYGON_POINTS = {
  diamond: '0,10 10,0 20,10 10,20',
  triangle: '10,0 20,20 0,20',
  parallelogram: '4,0 20,0 16,20 0,20',
  hexagon: '5,0 15,0 20,10 15,20 5,20 0,10',
  star: '10,0 12.4,7 20,7.2 14,11.8 16.2,19 10,15 3.8,19 6,11.8 0,7.2 7.6,7'
}

const PATH_SHAPES = {
  'draw-cloud': {
    d: 'M 25 60 C 8 60 5 38 22 34 C 22 14 48 10 58 24 C 78 16 96 28 90 46 C 108 48 108 68 86 70 C 80 82 52 86 38 74 C 28 80 18 74 25 60 Z',
    refW: 108,
    refH: 86
  },
  'draw-cylinder': {
    d: 'M 0 12 C 0 4 40 4 40 12 L 40 52 C 40 60 0 60 0 52 Z M 0 12 C 0 20 40 20 40 12',
    refW: 40,
    refH: 60
  },
  'draw-document': {
    d: 'M 0 0 L 40 0 L 40 48 Q 30 42 20 48 T 0 48 Z',
    refW: 40,
    refH: 48
  },
  'draw-note': {
    d: 'M 0 0 L 30 0 L 40 10 L 40 56 L 0 56 Z M 30 0 L 30 10 L 40 10',
    refW: 40,
    refH: 56,
    fill: '#fffbeb',
    stroke: '#d97706'
  },
  'draw-delay': {
    d: 'M 0 0 L 28 0 C 40 0 40 40 28 40 L 0 40 Z',
    refW: 40,
    refH: 40
  },
  'draw-display': {
    d: 'M 6 0 L 34 0 C 40 10 40 30 34 40 L 6 40 L 0 20 Z',
    refW: 40,
    refH: 40
  },
  'draw-manual': {
    d: 'M 0 8 L 40 0 L 40 40 L 0 40 Z',
    refW: 40,
    refH: 40
  }
}

const SHAPE_TABLE = {
  'draw-rect': { kind: 'rect', rx: 8 },
  'draw-process': { kind: 'rect', rx: 6 },
  'draw-rounded': { kind: 'rect', rx: 18 },
  'draw-terminator': { kind: 'stadium' },
  'draw-sticky': { kind: 'rect', rx: 4, fill: '#fef3c7', stroke: '#f59e0b' },
  'draw-container': { kind: 'rect', rx: 14, fill: 'rgba(148,163,184,0.08)', dash: '6 4', labelPos: 'top-left' },
  'draw-text': { kind: 'text' },
  'draw-image': { kind: 'image', fill: '#f1f5f9', stroke: '#94a3b8', labelPos: 'bottom' },
  'draw-tl-event': { kind: 'rect', rx: 10, fill: '#eff6ff', stroke: '#2563eb' },
  'draw-tl-axis': { kind: 'rect', rx: 4, fill: '#cbd5e1', stroke: 'transparent', noLabel: true },
  'draw-tl-milestone': { kind: 'circle', fill: '#2563eb', stroke: '#1d4ed8', labelFill: '#ffffff' },
  'draw-uml-package': { kind: 'rect', rx: 4, fill: '#f8fafc', stroke: '#64748b', labelPos: 'top-left' },
  'draw-uml-component': { kind: 'rect', rx: 6, fill: '#eef2ff', stroke: '#4f46e5' },
  'draw-uml-interface': { kind: 'rect', rx: 10, fill: '#f5f3ff', stroke: '#7c3aed' },
  'draw-uml-usecase': { kind: 'ellipse', fill: '#f5f3ff', stroke: '#7c3aed' },
  'draw-uml-actor': { kind: 'actor' },
  'draw-uml-class': { kind: 'umlclass', fill: '#f5f3ff', stroke: '#7c3aed' },
  'draw-seq-actor': { kind: 'seqactor', fill: '#ffffff', stroke: '#64748b' },
  'draw-seq-activation': { kind: 'rect', rx: 2, fill: '#dbeafe', stroke: '#2563eb', noLabel: true },
  'draw-seq-fragment': { kind: 'rect', rx: 6, fill: 'rgba(148,163,184,0.06)', stroke: '#64748b', dash: '5 4', labelPos: 'top-left' },
  'draw-dfd-external': { kind: 'rect', rx: 2, fill: '#fff7ed', stroke: '#ea580c', strokeWidth: 2 },
  'draw-dfd-process': { kind: 'circle', fill: '#ecfeff', stroke: '#0f766e', strokeWidth: 2 },
  'draw-dfd-store': { kind: 'rect', rx: 0, fill: '#f8fafc', stroke: '#334155' },
  'draw-er-entity': { kind: 'rect', rx: 8, fill: '#ecfeff', stroke: '#0f766e' },
  'draw-er-weak': { kind: 'rect', rx: 8, fill: '#ecfeff', stroke: '#0f766e', strokeWidth: 2.4 },
  'draw-er-attr': { kind: 'ellipse', fill: '#f0fdf4', stroke: '#16a34a' },
  'draw-er-key': { kind: 'ellipse', fill: '#f0fdf4', stroke: '#16a34a', underline: true },
  'draw-er-rel': { kind: 'polygon', points: POLYGON_POINTS.diamond, fill: '#eff6ff', stroke: '#2563eb' },
  'draw-er-ident': { kind: 'polygon', points: POLYGON_POINTS.diamond, fill: '#eff6ff', stroke: '#1d4ed8', strokeWidth: 2.4 },
  'draw-diamond': { kind: 'polygon', points: POLYGON_POINTS.diamond },
  'draw-decision': { kind: 'polygon', points: POLYGON_POINTS.diamond },
  'draw-triangle': { kind: 'polygon', points: POLYGON_POINTS.triangle },
  'draw-parallelogram': { kind: 'polygon', points: POLYGON_POINTS.parallelogram },
  'draw-data': { kind: 'polygon', points: POLYGON_POINTS.parallelogram },
  'draw-hexagon': { kind: 'polygon', points: POLYGON_POINTS.hexagon },
  'draw-preparation': { kind: 'polygon', points: POLYGON_POINTS.hexagon },
  'draw-star': { kind: 'polygon', points: POLYGON_POINTS.star },
  'draw-circle': { kind: 'circle' },
  'draw-connector': { kind: 'circle', noLabel: true },
  'draw-ellipse': { kind: 'ellipse' },
  'draw-note': PATH_SHAPES['draw-note'],
  'draw-arch-client': { kind: 'rect', rx: 12, fill: '#eff6ff', stroke: '#2563eb' },
  'draw-arch-server': { kind: 'rect', rx: 12, fill: '#ecfdf5', stroke: '#059669' },
  'draw-arch-db': { kind: 'rect', rx: 12, fill: '#fef3c7', stroke: '#d97706' },
  'draw-arch-cloud': { kind: 'rect', rx: 12, fill: '#e0f2fe', stroke: '#0284c7' },
  'draw-arch-queue': { kind: 'rect', rx: 12, fill: '#f5f3ff', stroke: '#7c3aed' },
  'draw-arch-cache': { kind: 'rect', rx: 12, fill: '#ffe4e6', stroke: '#e11d48' },
  'draw-arch-gateway': { kind: 'rect', rx: 12, fill: '#f1f5f9', stroke: '#475569' },
  topic: { kind: 'rect', rx: 6, fill: '#EFF4FF', stroke: '#5F95FF', labelFill: '#262626' },
  'topic-child': { kind: 'rect', rx: 6, fill: '#EFF4FF', stroke: '#5F95FF', labelFill: '#262626' }
}

const rawCells = computed(() => {
  const data = props.graphJson
  if (!data) return []
  if (Array.isArray(data.cells)) return data.cells
  if (Array.isArray(data.nodes) || Array.isArray(data.edges)) {
    return [...(data.nodes || []), ...(data.edges || [])]
  }
  return []
})

const isEdgeCell = (cell) => Boolean(cell?.source || cell?.target)

const readNumber = (...values) => {
  for (const value of values) {
    const num = Number(value)
    if (Number.isFinite(num)) return num
  }
  return 0
}

const clampLabelSize = (fontSize) => Math.max(Math.min(Number(fontSize) || 12, 18), 7)

const pickPolygon = (shape) => {
  if (/star/.test(shape)) return POLYGON_POINTS.star
  if (/hexagon|preparation/.test(shape)) return POLYGON_POINTS.hexagon
  if (/parallelogram|data/.test(shape)) return POLYGON_POINTS.parallelogram
  if (/triangle/.test(shape)) return POLYGON_POINTS.triangle
  return POLYGON_POINTS.diamond
}

const resolveShape = (shape) => {
  if (SHAPE_TABLE[shape]) return SHAPE_TABLE[shape]
  // Fallback for unknown/custom shapes, similar to the registry naming.
  if (/actor/.test(shape)) return { kind: 'actor' }
  if (/uml-class/.test(shape)) return { kind: 'umlclass', fill: '#f5f3ff', stroke: '#7c3aed' }
  if (/circle/.test(shape)) return { kind: 'circle' }
  if (/terminator/.test(shape)) return { kind: 'stadium' }
  if (/ellipse|usecase/.test(shape)) return { kind: 'ellipse' }
  if (/diamond|decision|rel/.test(shape)) return { kind: 'polygon', points: pickPolygon(shape) }
  if (PATH_SHAPES[shape]) return { kind: 'path', ...PATH_SHAPES[shape] }
  if (/text/.test(shape)) return { kind: 'text' }
  if (/container|fragment/.test(shape)) return { kind: 'rect', rx: 10, fill: 'rgba(148,163,184,0.08)', dash: '6 4', labelPos: 'top-left' }
  if (/image/.test(shape)) return { kind: 'image', fill: '#f1f5f9', stroke: '#94a3b8', labelPos: 'bottom' }
  return { kind: 'rect', rx: /rounded|process|topic|interface/.test(shape) ? 10 : 2 }
}

const scalePolygon = (proportional, x, y, width, height) => proportional
  .split(' ')
  .map((pair) => {
    const [px, py] = pair.split(',').map(Number)
    return `${x + (px / 20) * width},${y + (py / 20) * height}`
  })
  .join(' ')

const normalizeNode = (cell, index) => {
  const shape = cell.shape || ''
  const desc = resolveShape(shape)
  const x = readNumber(cell.position?.x, cell.x)
  const y = readNumber(cell.position?.y, cell.y)
  const width = Math.max(readNumber(cell.size?.width, cell.width) || 80, 10)
  const height = Math.max(readNumber(cell.size?.height, cell.height) || 40, 10)
  const body = cell.attrs?.body || {}
  const labelAttrs = cell.attrs?.label || cell.attrs?.text || {}
  const data = cell.data || {}
  const label = labelAttrs.text || cell.label || ''
  const fill = body.fill || desc.fill || 'rgba(255,255,255,.72)'
  const stroke = body.stroke || desc.stroke || '#9ca3af'
  const strokeWidth = Number(body.strokeWidth) || desc.strokeWidth || 1.5
  const cx = x + width / 2
  const cy = y + height / 2

  const node = {
    id: cell.id || `node-${index}`,
    shape,
    kind: desc.kind,
    x,
    y,
    width,
    height,
    cx,
    cy,
    r: Math.min(width, height) / 2,
    fill,
    stroke,
    strokeWidth,
    dash: body.strokeDasharray || desc.dash,
    label: desc.kind === 'umlclass' ? (data.className || label) : label,
    labelFill: labelAttrs.fill || desc.labelFill || '#374151',
    labelSize: clampLabelSize(labelAttrs.fontSize),
    labelWeight: labelAttrs.fontWeight || 400,
    underline: Boolean(desc.underline),
    showLabel: false,
    labelX: cx,
    labelY: cy,
    labelAnchor: 'middle'
  }

  if (desc.kind === 'rect') {
    node.rx = Math.min(desc.rx ?? 2, height / 2, width / 2)
  } else if (desc.kind === 'stadium') {
    node.kind = 'rect'
    node.rx = Math.min(height / 2, width / 2)
  } else if (desc.kind === 'polygon') {
    node.points = scalePolygon(desc.points, x, y, width, height)
  } else if (desc.kind === 'path') {
    node.d = desc.d
    node.transform = `translate(${x},${y}) scale(${width / desc.refW},${height / desc.refH})`
  } else if (desc.kind === 'actor') {
    node.headCx = cx
    node.headCy = y + (height * 16) / 108
    node.headR = (width * 12) / 64
    node.bodyD = 'M 32 28 L 32 58 M 16 40 L 48 40 M 32 58 L 16 90 M 32 58 L 48 90'
    node.transform = `translate(${x},${y}) scale(${width / 64},${height / 108})`
    node.fill = '#ffffff'
    node.stroke = stroke === '#9ca3af' ? '#64748b' : stroke
  } else if (desc.kind === 'umlclass') {
    node.strokeWidth = 1.5
  } else if (desc.kind === 'seqactor') {
    node.headerH = Math.min(40, height / 2)
    node.lifeline = '#94a3b8'
  }

  // Label placement mirrors the registered shapes.
  const labelPos = desc.labelPos
  if (desc.noLabel || desc.kind === 'text') {
    // 'text' nodes render their own label element in the template branch.
    node.showLabel = false
  } else if (labelPos === 'top-left') {
    node.showLabel = Boolean(label)
    node.labelX = x + 8
    node.labelY = y + 10
    node.labelAnchor = 'start'
  } else if (labelPos === 'bottom') {
    node.showLabel = Boolean(label)
    node.labelX = cx
    node.labelY = y + height + 12
    node.labelAnchor = 'middle'
  } else if (desc.kind === 'seqactor') {
    node.showLabel = Boolean(label)
    node.labelX = cx
    node.labelY = y + node.headerH / 2
    node.labelAnchor = 'middle'
  } else {
    node.showLabel = Boolean(label)
    node.labelX = cx
    node.labelY = cy
    node.labelAnchor = 'middle'
  }
  return node
}

const normalizeEdge = (cell, index, nodeMap) => {
  const line = cell.attrs?.line || {}
  const labelAttrs = cell.labels?.[0]?.attrs?.label || {}
  const source = nodeMap.get(cell.source?.cell || cell.source)
  const target = nodeMap.get(cell.target?.cell || cell.target)
  const targetMarker = line.targetMarker
  const hasArrow = Boolean(
    targetMarker
    || cell.data?.style === 'arrow'
    || cell.data?.style === 'manhattan'
    || cell.data?.style === 'orthogonal'
  )
  const isMind = cell.shape === 'mindmap-edge'

  let mindPath = ''
  if (isMind && source && target) {
    const goingRight = target.cx >= source.cx
    const sx = goingRight ? source.x + source.width : source.x
    const tx = goingRight ? target.x : target.x + target.width
    const midX = sx + (goingRight ? 12 : -12)
    const ctrX = (tx - midX) / 5 + midX
    mindPath = `M ${sx} ${source.cy} L ${midX} ${source.cy} Q ${ctrX} ${target.cy} ${tx} ${target.cy}`
  }

  return {
    id: cell.id || `edge-${index}`,
    source,
    target,
    vertices: Array.isArray(cell.vertices) ? cell.vertices : [],
    stroke: line.stroke || (isMind ? '#A2B1C3' : '#9ca3af'),
    strokeWidth: Number(line.strokeWidth) || (isMind ? 2 : 1.2),
    dash: line.strokeDasharray || undefined,
    hasArrow,
    openArrow: Boolean(targetMarker?.open || targetMarker?.fill === 'transparent'),
    hasStartArrow: Boolean(line.sourceMarker) && !isMind,
    mindPath,
    label: labelAttrs.text || '',
    labelFill: labelAttrs.fill || '#374151',
    labelSize: clampLabelSize(labelAttrs.fontSize),
    labelWeight: labelAttrs.fontWeight || 400
  }
}

const nodes = computed(() => rawCells.value
  .filter((cell) => !isEdgeCell(cell))
  .map((cell, index) => normalizeNode(cell, index)))

const nodeMap = computed(() => new Map(nodes.value.map((node) => [node.id, node])))

const edges = computed(() => rawCells.value
  .filter((cell) => isEdgeCell(cell))
  .map((cell, index) => normalizeEdge(cell, index, nodeMap.value)))

const bounds = computed(() => {
  if (!nodes.value.length) return { minX: 0, minY: 0, maxX: 100, maxY: 70 }
  return {
    minX: Math.min(...nodes.value.map((node) => node.x)),
    minY: Math.min(...nodes.value.map((node) => node.y)),
    maxX: Math.max(...nodes.value.map((node) => node.x + node.width)),
    maxY: Math.max(...nodes.value.map((node) => node.y + node.height))
  }
})

const viewBox = computed(() => {
  const margin = 24
  const width = Math.max(bounds.value.maxX - bounds.value.minX + margin * 2, 100)
  const height = Math.max(bounds.value.maxY - bounds.value.minY + margin * 2, 70)
  return `${bounds.value.minX - margin} ${bounds.value.minY - margin} ${width} ${height}`
})

const edgePoints = (edge) => {
  if (!edge.source || !edge.target) return ''
  const points = [
    { x: edge.source.cx, y: edge.source.cy },
    ...edge.vertices,
    { x: edge.target.cx, y: edge.target.cy }
  ]
  return points.map((point) => `${readNumber(point.x)},${readNumber(point.y)}`).join(' ')
}

const edgeLabelPosition = (edge) => {
  const points = edgePoints(edge)
    .split(' ')
    .map((point) => point.split(',').map(Number))
    .filter((point) => point.length === 2 && point.every(Number.isFinite))
  const point = points[Math.floor(points.length / 2)] || [0, 0]
  return { x: point[0], y: point[1] - 5 }
}
</script>

<style scoped>
.canvas-thumbnail { display: block; width: 100%; height: 100%; overflow: visible; }
.thumbnail-label { font-family: inherit; pointer-events: none; }
.thumbnail-empty { display: inline-flex; align-items: center; justify-content: center; height: 100%; color: var(--text-tertiary); }
</style>
