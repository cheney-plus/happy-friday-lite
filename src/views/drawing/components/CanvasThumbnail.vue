<template>
  <svg v-if="nodes.length || edges.length" class="canvas-thumbnail" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <marker :id="arrowMarkerId" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#9ca3af" />
      </marker>
    </defs>
    <g v-for="edge in edges" :key="edge.id">
      <polyline
        :points="edgePoints(edge)"
        fill="none"
        :stroke="edge.stroke"
        :stroke-width="edge.strokeWidth"
        :stroke-dasharray="edge.dash"
        :marker-end="edge.hasArrow ? `url(#${arrowMarkerId})` : undefined"
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
      <rect
        v-if="!node.isText && (node.isContainer || node.isRectangular)"
        :x="node.x"
        :y="node.y"
        :width="node.width"
        :height="node.height"
        :rx="node.isRounded ? 8 : 2"
        :fill="node.fill"
        :stroke="node.stroke"
        :stroke-width="node.strokeWidth"
        :stroke-dasharray="node.isContainer ? '5 3' : undefined"
      />
      <circle
        v-else-if="!node.isText && node.isCircle"
        :cx="node.cx"
        :cy="node.cy"
        :r="node.r"
        :fill="node.fill"
        :stroke="node.stroke"
        :stroke-width="node.strokeWidth"
      />
      <polygon
        v-else-if="!node.isText && node.isDiamond"
        :points="node.diamondPoints"
        :fill="node.fill"
        :stroke="node.stroke"
        :stroke-width="node.strokeWidth"
      />
      <ellipse
        v-else-if="!node.isText"
        :cx="node.cx"
        :cy="node.cy"
        :rx="node.width / 2"
        :ry="node.height / 2"
        :fill="node.fill"
        :stroke="node.stroke"
        :stroke-width="node.strokeWidth"
      />
      <text
        v-if="node.label"
        :x="node.cx"
        :y="node.cy"
        class="thumbnail-label"
        :fill="node.labelFill"
        :font-size="node.labelSize"
        :font-weight="node.labelWeight"
        text-anchor="middle"
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

const normalizeNode = (cell, index) => {
  const shape = cell.shape || ''
  const x = readNumber(cell.position?.x, cell.x)
  const y = readNumber(cell.position?.y, cell.y)
  const width = Math.max(readNumber(cell.size?.width, cell.width) || 80, 10)
  const height = Math.max(readNumber(cell.size?.height, cell.height) || 40, 10)
  const body = cell.attrs?.body || {}
  const labelAttrs = cell.attrs?.label || cell.attrs?.text || {}
  const label = labelAttrs.text || cell.label || ''
  const isText = shape.includes('text')
  const isCircle = /circle|ellipse|terminator|usecase|actor/.test(shape)
  const isDiamond = /diamond|decision|rel/.test(shape)
  const isRounded = /rounded|process|topic|interface/.test(shape)
  const isContainer = shape.includes('container')
  const isRectangular = !isCircle && !isDiamond && !isText

  return {
    id: cell.id || `node-${index}`,
    shape,
    x,
    y,
    width,
    height,
    cx: x + width / 2,
    cy: y + height / 2,
    r: Math.min(width, height) / 2,
    diamondPoints: `${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`,
    fill: body.fill || 'rgba(255,255,255,.72)',
    stroke: body.stroke || '#9ca3af',
    strokeWidth: Number(body.strokeWidth) || 1,
    label,
    labelFill: labelAttrs.fill || '#374151',
    labelSize: clampLabelSize(labelAttrs.fontSize),
    labelWeight: labelAttrs.fontWeight || 400,
    isText,
    isCircle,
    isDiamond,
    isRounded,
    isContainer,
    isRectangular
  }
}

const normalizeEdge = (cell, index, nodeMap) => {
  const line = cell.attrs?.line || {}
  const labelAttrs = cell.labels?.[0]?.attrs?.label || {}
  const source = nodeMap.get(cell.source?.cell || cell.source)
  const target = nodeMap.get(cell.target?.cell || cell.target)
  const hasArrow = Boolean(
    line.targetMarker
    || cell.data?.style === 'arrow'
    || cell.data?.style === 'manhattan'
    || cell.data?.style === 'orthogonal'
  )

  return {
    id: cell.id || `edge-${index}`,
    source,
    target,
    vertices: Array.isArray(cell.vertices) ? cell.vertices : [],
    stroke: line.stroke || '#9ca3af',
    strokeWidth: Number(line.strokeWidth) || 1.2,
    dash: line.strokeDasharray || undefined,
    hasArrow,
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
