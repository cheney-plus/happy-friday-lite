<template>
  <svg v-if="cells.length" class="canvas-thumbnail" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <marker id="thumbnail-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#9ca3af" />
      </marker>
    </defs>
    <g v-for="edge in edges" :key="edge.id">
      <polyline
        :points="edgePoints(edge)"
        fill="none"
        :stroke="edgeStroke(edge)"
        :stroke-width="edgeWidth(edge)"
        :stroke-dasharray="edgeDash(edge)"
        :marker-end="hasArrow(edge) ? 'url(#thumbnail-arrow)' : undefined"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <text
        v-if="edgeLabel(edge)"
        :x="edgeLabelPosition(edge).x"
        :y="edgeLabelPosition(edge).y"
        class="thumbnail-label"
        :fill="edgeLabelAttrs(edge).fill || '#374151'"
        :font-size="labelSize(edgeLabelAttrs(edge))"
        :font-weight="edgeLabelAttrs(edge).fontWeight || 400"
        text-anchor="middle"
      >{{ edgeLabel(edge) }}</text>
    </g>
    <g v-for="node in nodes" :key="node.id">
      <rect
        v-if="!isText(node) && (isContainer(node) || isRectangular(node))"
        :x="node.position.x"
        :y="node.position.y"
        :width="node.size.width"
        :height="node.size.height"
        :rx="isRounded(node) ? 8 : 2"
        :fill="nodeFill(node)"
        :stroke="nodeStroke(node)"
        :stroke-width="nodeStrokeWidth(node)"
        :stroke-dasharray="isContainer(node) ? '5 3' : undefined"
      />
      <circle
        v-else-if="!isText(node) && isCircle(node)"
        :cx="node.position.x + node.size.width / 2"
        :cy="node.position.y + node.size.height / 2"
        :r="Math.min(node.size.width, node.size.height) / 2"
        :fill="nodeFill(node)"
        :stroke="nodeStroke(node)"
        :stroke-width="nodeStrokeWidth(node)"
      />
      <polygon
        v-else-if="!isText(node) && isDiamond(node)"
        :points="diamondPoints(node)"
        :fill="nodeFill(node)"
        :stroke="nodeStroke(node)"
        :stroke-width="nodeStrokeWidth(node)"
      />
      <ellipse
        v-else-if="!isText(node)"
        :cx="node.position.x + node.size.width / 2"
        :cy="node.position.y + node.size.height / 2"
        :rx="node.size.width / 2"
        :ry="node.size.height / 2"
        :fill="nodeFill(node)"
        :stroke="nodeStroke(node)"
        :stroke-width="nodeStrokeWidth(node)"
      />
      <text
        v-if="nodeLabel(node)"
        :x="node.position.x + node.size.width / 2"
        :y="node.position.y + node.size.height / 2"
        class="thumbnail-label"
        :fill="nodeLabelAttrs(node).fill || '#374151'"
        :font-size="labelSize(nodeLabelAttrs(node))"
        :font-weight="nodeLabelAttrs(node).fontWeight || 400"
        text-anchor="middle"
        dominant-baseline="middle"
      >{{ nodeLabel(node) }}</text>
    </g>
  </svg>
  <span v-else class="thumbnail-empty"><PencilLine :size="26" :stroke-width="1.5" /></span>
</template>

<script setup>
import { computed } from 'vue'
import { PencilLine } from 'lucide-vue-next'

const props = defineProps({ graphJSON: { type: Object, default: () => ({ cells: [] }) } })
const cells = computed(() => Array.isArray(props.graphJSON?.cells) ? props.graphJSON.cells : [])
const nodes = computed(() => cells.value.filter((cell) => cell.position && !cell.source && !cell.target))
const edges = computed(() => cells.value.filter((cell) => cell.source || cell.target))
const nodeMap = computed(() => new Map(nodes.value.map((node) => [node.id, node])))

const normalizePosition = (node) => ({ x: Number(node.position?.x) || 0, y: Number(node.position?.y) || 0 })
const normalizeSize = (node) => ({ width: Math.max(Number(node.size?.width) || 80, 10), height: Math.max(Number(node.size?.height) || 40, 10) })
const bounds = computed(() => {
  const items = nodes.value.map((node) => ({ position: normalizePosition(node), size: normalizeSize(node) }))
  if (!items.length) return { minX: 0, minY: 0, maxX: 100, maxY: 70 }
  return {
    minX: Math.min(...items.map((item) => item.position.x)),
    minY: Math.min(...items.map((item) => item.position.y)),
    maxX: Math.max(...items.map((item) => item.position.x + item.size.width)),
    maxY: Math.max(...items.map((item) => item.position.y + item.size.height))
  }
})
const viewBox = computed(() => {
  const margin = 24
  return `${bounds.value.minX - margin} ${bounds.value.minY - margin} ${Math.max(bounds.value.maxX - bounds.value.minX + margin * 2, 100)} ${Math.max(bounds.value.maxY - bounds.value.minY + margin * 2, 70)}`
})
const nodeAttrs = (node, key) => node.attrs?.[key] || {}
const nodeLabelAttrs = (node) => nodeAttrs(node, 'label')
const nodeLabel = (node) => nodeLabelAttrs(node).text || nodeAttrs(node, 'text').text || ''
const nodeFill = (node) => nodeAttrs(node, 'body').fill || 'rgba(255,255,255,.72)'
const nodeStroke = (node) => nodeAttrs(node, 'body').stroke || '#9ca3af'
const nodeStrokeWidth = (node) => Number(nodeAttrs(node, 'body').strokeWidth) || 1
const isContainer = (node) => node.shape?.includes('container')
const isCircle = (node) => /circle|ellipse|terminator|usecase|actor/.test(node.shape || '')
const isDiamond = (node) => /diamond|decision|rel/.test(node.shape || '')
const isRounded = (node) => /rounded|process|topic|interface/.test(node.shape || '')
const isText = (node) => node.shape?.includes('text')
const isRectangular = (node) => !isCircle(node) && !isDiamond(node) && !node.shape?.includes('text')
const labelSize = (label) => Math.max(Math.min(Number(label.fontSize) || 12, 18), 7)
const diamondPoints = (node) => {
  const { x, y } = node.position
  const { width, height } = node.size
  return `${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`
}
const center = (node) => node ? { x: node.position.x + node.size.width / 2, y: node.position.y + node.size.height / 2 } : null
const edgePoints = (edge) => {
  const source = center(nodeMap.value.get(edge.source?.cell))
  const target = center(nodeMap.value.get(edge.target?.cell))
  if (!source || !target) return ''
  return [source, ...(edge.vertices || []), target].map((point) => `${Number(point.x) || 0},${Number(point.y) || 0}`).join(' ')
}
const edgeStroke = (edge) => edge.attrs?.line?.stroke || '#9ca3af'
const edgeWidth = (edge) => Number(edge.attrs?.line?.strokeWidth) || 1.2
const edgeDash = (edge) => edge.attrs?.line?.strokeDasharray || undefined
const hasArrow = (edge) => Boolean(edge.attrs?.line?.targetMarker || edge.data?.style === 'arrow' || edge.data?.style === 'manhattan' || edge.data?.style === 'orthogonal')
const edgeLabelAttrs = (edge) => edge.labels?.[0]?.attrs?.label || {}
const edgeLabel = (edge) => edgeLabelAttrs(edge).text || ''
const edgeLabelPosition = (edge) => {
  const points = edgePoints(edge).split(' ').map((point) => point.split(',').map(Number)).filter((point) => point.length === 2)
  const point = points[Math.floor(points.length / 2)] || [0, 0]
  return { x: point[0], y: point[1] - 5 }
}
</script>

<style scoped>
.canvas-thumbnail { display: block; width: 100%; height: 100%; overflow: visible; }
.thumbnail-label { font-family: inherit; pointer-events: none; }
.thumbnail-empty { display: inline-flex; align-items: center; justify-content: center; height: 100%; color: var(--text-tertiary); }
</style>
