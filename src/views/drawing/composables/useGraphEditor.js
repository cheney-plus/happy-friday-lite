import {
  Dnd,
  Export,
  Graph,
  History,
  Keyboard,
  Model,
  MiniMap,
  Selection,
  Snapline,
  Transform
} from '@antv/x6'
import { applyCellAnimation, restoreGraphAnimations } from '../shapes/animation.js'
import { createNodeMetadata } from '../shapes/catalog.js'
import { applyEdgeStyle, createEdgeMetadata, DEFAULT_EDGE_STYLE } from '../shapes/edgeStyles.js'
import {
  bindMindmapBehavior,
  collectMindRemoval,
  isMindNode,
  layoutAllMindTrees,
  layoutMindTree,
  prepareMindClipboard,
  remapPastedMindCells,
  restoreMindClipboardSource
} from '../shapes/mindmap.js'
import { registerDrawingShapes } from '../shapes/register.js'
import { cloneTemplateAt, TEMPLATE_BUILDERS } from '../shapes/templates.js'
import { getCanvasTheme } from '../shapes/theme.js'

// Graph instances are recreated whenever the active canvas changes. Keep the
// serialized cells at module scope so copy/paste works between canvases.
const drawingClipboard = { cells: [] }

export function createDrawingGraph(container, minimapContainer, state) {
  registerDrawingShapes()
  const theme = getCanvasTheme()
  const bounds = container?.getBoundingClientRect()
  // MiniMap uses the source graph's configured dimensions to calculate its
  // scale. A cached or just-mounted view can briefly measure as 0 x 0;
  // passing that through produces NaN and makes SVGMatrix reject the scale.
  const width = Number.isFinite(bounds?.width) && bounds.width > 0 ? bounds.width : 1
  const height = Number.isFinite(bounds?.height) && bounds.height > 0 ? bounds.height : 1

  const graph = new Graph({
    container,
    width,
    height,
    // DrawingEditor owns resize handling so a cached, hidden route cannot pass
    // a zero or non-finite size from X6's internal ResizeObserver to MiniMap.
    autoResize: false,
    preventDefaultContextMenu: true,
    background: { color: 'transparent' },
    grid: {
      visible: true,
      type: 'dot',
      size: 16,
      args: { color: theme.grid }
    },
    panning: {
      enabled: true,
      modifiers: ['space'],
      eventTypes: ['leftMouseDown', 'mouseWheel']
    },
    mousewheel: {
      enabled: true,
      zoomAtMousePosition: true,
      modifiers: ['ctrl', 'meta'],
      minScale: 0.2,
      maxScale: 3
    },
    connecting: {
      snap: { radius: 24 },
      allowBlank: false,
      allowLoop: false,
      allowNode: true,
      allowEdge: false,
      allowPort: true,
      highlight: true,
      router: 'manhattan',
      connector: { name: 'rounded', args: { radius: 8 } },
      anchor: 'center',
      connectionPoint: 'anchor',
      createEdge() {
        return this.createEdge(createEdgeMetadata(state.edgeStyleId || DEFAULT_EDGE_STYLE))
      },
      validateConnection({ targetCell, sourceCell }) {
        if (sourceCell && targetCell && sourceCell.id === targetCell.id) return false
        if (Boolean(isMindNode(sourceCell)) !== Boolean(isMindNode(targetCell))) return false
        return true
      }
    },
    highlighting: {
      magnetAdsorbed: {
        name: 'stroke',
        args: { attrs: { fill: '#2563eb', stroke: '#2563eb' } }
      }
    },
    embedding: {
      enabled: true,
      findParent({ node }) {
        if (isMindNode(node)) return []
        const bbox = node.getBBox()
        return this.getNodes().filter((parent) => {
          if (parent.id === node.id) return false
          if (parent.shape !== 'draw-container' && parent.shape !== 'draw-seq-fragment') return false
          return parent.getBBox().containsRect(bbox)
        })
      }
    },
    interacting: {
      nodeMovable: () => state.mode !== 'pan',
      edgeMovable: () => false,
      magnetConnectable: () => state.mode !== 'pan'
    }
  })

  graph
    .use(
      new Selection({
        enabled: true,
        multiple: true,
        rubberband: true,
        movable: false,
        showNodeSelectionBox: true,
        // Edge editing uses the vertices/endpoint tools. The bounding box is
        // redundant for edges and obscures the actual path while selected.
        showEdgeSelectionBox: false,
        pointerEvents: 'none'
      })
    )
    .use(new Snapline({ enabled: true }))
    .use(new Keyboard({ enabled: true, global: false }))
    .use(new History({ enabled: true }))
    .use(
      new Transform({
        resizing: { enabled: true, minWidth: 20, minHeight: 20, orthogonal: false },
        rotating: { enabled: (node) => !isMindNode(node) }
      })
    )
    .use(new Export())

  if (minimapContainer) {
    graph.use(
      new MiniMap({
        container: minimapContainer,
        width: 168,
        height: 114,
        padding: 8
      })
    )
  }

  const dnd = new Dnd({ target: graph, scaled: false })
  bindKeys(graph)
  bindTools(graph)
  bindMindmapBehavior(graph)
  return { graph, dnd }
}

function bindKeys(graph) {
  graph.bindKey(['meta+z', 'ctrl+z'], () => {
    graph.undo()
    return false
  })
  graph.bindKey(['meta+shift+z', 'ctrl+shift+z', 'ctrl+y', 'meta+y'], () => {
    graph.redo()
    return false
  })
  graph.bindKey(['meta+c', 'ctrl+c'], () => {
    copyDrawingCells(graph, graph.getSelectedCells())
    return false
  })
  graph.bindKey(['meta+x', 'ctrl+x'], () => {
    cutDrawingCells(graph, graph.getSelectedCells())
    return false
  })
  graph.bindKey(['meta+v', 'ctrl+v'], () => {
    pasteDrawingCells(graph, 24)
    return false
  })
  graph.bindKey(['meta+d', 'ctrl+d'], () => {
    duplicateDrawingCells(graph)
    return false
  })
  graph.bindKey(['backspace', 'delete'], () => {
    const cells = graph.getSelectedCells()
    if (cells.length) removeDrawingCells(graph, cells)
    return false
  })
  graph.bindKey(['meta+a', 'ctrl+a'], () => {
    graph.select(graph.getCells())
    return false
  })
  graph.bindKey('esc', () => {
    graph.cleanSelection()
    return false
  })
}

export function removeDrawingCells(graph, cells) {
  if (!cells?.length) return
  const trees = new Set()
  cells.forEach((cell) => {
    const treeId = cell.getData?.()?.mind?.treeId
    if (treeId) trees.add(treeId)
  })
  graph.removeCells(collectMindRemoval(graph, cells))
  trees.forEach((treeId) => layoutMindTree(graph, treeId))
}

export function copyDrawingCells(graph, cells) {
  if (!graph || !cells?.length) return
  const bundle = prepareMindClipboard(graph, cells)
  const cloned = Object.values(graph.cloneSubGraph(bundle))
  drawingClipboard.cells = cloned.map((cell) => cell.toJSON())
  restoreMindClipboardSource(bundle)
}

export function cutDrawingCells(graph, cells) {
  if (!graph || !cells?.length) return
  copyDrawingCells(graph, cells)
  removeDrawingCells(graph, cells)
}

export function pasteDrawingCells(graph, offset = 24) {
  if (!graph || !drawingClipboard.cells.length) return []
  const cells = Model.fromJSON({ cells: drawingClipboard.cells })
  const pasted = Object.values(graph.cloneCells(cells))
  pasted.forEach((cell) => cell.translate(offset, offset))
  const nodes = pasted.filter((cell) => cell.isNode())
  const edges = pasted.filter((cell) => cell.isEdge())
  graph.model.batchUpdate('paste', () => {
    graph.addNodes(nodes)
    graph.addEdges(edges)
  })
  remapPastedMindCells(graph, pasted)
  const alive = (pasted || []).filter((cell) => graph.getCellById(cell.id))
  if (alive.length) copyDrawingCells(graph, alive)
  return pasted
}

export function duplicateDrawingCells(graph) {
  const cells = graph?.getSelectedCells() || []
  if (!cells.length) return
  copyDrawingCells(graph, cells)
  pasteDrawingCells(graph, 28)
}

function bindTools(graph) {
  graph.on('edge:selected', ({ edge }) => {
    if (edge.shape === 'mindmap-edge') return
    // `vertices` makes the edge path itself editable: click the path to add a
    // waypoint, drag a waypoint to change the route, and double-click it to
    // remove it. Arrowhead handles let users reconnect either endpoint.
    // `segments` is intentionally avoided because it is unstable with routed
    // edges (X6 issues #2385/#3660).
    edge.addTools([
      {
        name: 'vertices',
        args: {
          addable: true,
          removable: true,
          removeRedundancies: true,
          stopPropagation: true,
          attrs: {
            r: 6,
            fill: '#2563eb',
            stroke: '#ffffff',
            'stroke-width': 2,
            cursor: 'move'
          }
        }
      },
      {
        name: 'source-arrowhead',
        args: { attrs: { fill: '#2563eb', stroke: '#ffffff', 'stroke-width': 2, cursor: 'move' } }
      },
      {
        name: 'target-arrowhead',
        args: { attrs: { fill: '#2563eb', stroke: '#ffffff', 'stroke-width': 2, cursor: 'move' } }
      }
    ])
  })
  graph.on('edge:unselected', ({ edge }) => {
    edge.removeTools()
  })
  graph.on('node:dblclick', ({ node }) => {
    node.removeTools()
    node.addTools({
      name: 'node-editor',
      args: {
        attrs: {
          backgroundColor: 'transparent',
          fontSize: 13
        }
      }
    })
  })
  graph.on('edge:dblclick', ({ edge }) => {
    edge.addTools({ name: 'edge-editor' })
  })
}

export function setInteractionMode(graph, mode) {
  if (mode === 'pan') {
    graph.options.panning.modifiers = null
    graph.enablePanning()
    graph.disableRubberband()
    graph.disableSelection()
    return
  }
  graph.options.panning.modifiers = ['space']
  graph.enablePanning()
  graph.enableSelection()
  graph.enableRubberband()
}

export function normalizeGraphJSON(data) {
  if (!data) return { cells: [] }
  if (Array.isArray(data.cells)) return { cells: data.cells }
  if (Array.isArray(data.nodes) || Array.isArray(data.edges)) {
    return { cells: [...(data.nodes || []), ...(data.edges || [])] }
  }
  return { cells: [] }
}

export function loadGraphData(graph, data) {
  graph.fromJSON(normalizeGraphJSON(data))
  layoutAllMindTrees(graph)
  graph.cleanHistory()
  if (graph.getCells().length) {
    graph.zoomToFit({ padding: 56, maxScale: 1 })
    graph.centerContent()
  } else {
    graph.zoomTo(1)
    graph.translate(0, 0)
  }
  restoreGraphAnimations(graph)
}

export function applyGraphTheme(graph) {
  if (!graph) return
  const theme = getCanvasTheme()
  graph.drawGrid({
    type: 'dot',
    args: { color: theme.grid }
  })
}

export function addCatalogNode(graph, item, x, y, extra = {}) {
  const node = graph.addNode(createNodeMetadata(item, x, y, extra))
  graph.cleanSelection()
  graph.select(node)
  return node
}

export function startCatalogDrag(graph, dnd, item, event, extra = {}) {
  const node = graph.createNode(createNodeMetadata(item, 0, 0, extra))
  dnd.start(node, event)
}

export function insertTemplate(graph, name, source = null) {
  const builder = TEMPLATE_BUILDERS[name]
  if (!builder && !source) return
  const bbox = graph.getCells().length ? graph.getContentBBox() : null
  const dx = bbox ? Math.round(bbox.x + bbox.width + 80) : 0
  const dy = bbox ? Math.round(bbox.y) : 0
  const template = source ? normalizeTemplateSource(source) : builder()
  const data = cloneTemplateAt(template, dx, dy)
  const nodes = data.cells.filter((cell) => !cell.source && !cell.target)
  const edges = data.cells.filter((cell) => cell.source || cell.target)
  if (nodes.length) graph.addNodes(nodes)
  if (edges.length) graph.addEdges(edges)
}

function normalizeTemplateSource(source) {
  const cells = Array.isArray(source?.cells)
    ? source.cells
    : [...(source?.nodes || []), ...(source?.edges || [])]
  return {
    cells: cells.map((cell) => {
      if (cell.source || cell.target || cell.x != null || !cell.position) return cell
      return {
        ...cell,
        x: cell.position.x,
        y: cell.position.y
      }
    })
  }
}

export function applyAnimationToSelection(graph, type) {
  const cells = graph.getSelectedCells()
  cells.forEach((cell) => applyCellAnimation(cell, type))
}

export function connectSelected(graph, styleId) {
  const nodes = graph.getSelectedCells().filter((cell) => cell.isNode())
  if (nodes.length !== 2) return
  graph.addEdge(
    createEdgeMetadata(styleId, {
      source: { cell: nodes[0].id },
      target: { cell: nodes[1].id }
    })
  )
}

export function setPendingEdgeStyle(graph, styleId, state) {
  state.edgeStyleId = styleId
  const meta = createEdgeMetadata(styleId)
  graph.options.connecting.router = meta.router
  graph.options.connecting.connector = meta.connector
}

export function getViewportCenter(graph, container) {
  const rect = container.getBoundingClientRect()
  return graph.clientToLocal(rect.left + rect.width / 2, rect.top + rect.height / 2)
}

export function downloadFile(content, filename, type = 'application/json') {
  const blob = typeof content === 'string' && content.startsWith('data:')
    ? null
    : new Blob([content], { type })
  const link = document.createElement('a')
  link.href = blob ? URL.createObjectURL(blob) : content
  link.download = filename
  link.click()
  if (blob) URL.revokeObjectURL(link.href)
}

function unionRect(a, b) {
  if (!a || !Number.isFinite(a.width) || !Number.isFinite(a.height)) return b
  if (!b || !Number.isFinite(b.width) || !Number.isFinite(b.height)) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y
  }
}

function clearExportedTransform(el) {
  if (!el) return
  el.removeAttribute('transform')
  el.removeAttribute('clip-path')
  el.removeAttribute('clip')
  if (!el.style) return
  el.style.removeProperty('transform')
  el.style.removeProperty('transform-origin')
  el.style.removeProperty('overflow')
  el.style.removeProperty('clip-path')
  el.style.removeProperty('clip')
  el.style.removeProperty('width')
  el.style.removeProperty('height')
  el.style.removeProperty('background')
  el.style.removeProperty('background-color')
}

function paintExportedSvgBackground(svg, color = '#ffffff') {
  svg.style.backgroundColor = color
  const parts = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  const [x, y, width, height] = parts
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return
  const ns = 'http://www.w3.org/2000/svg'
  svg.querySelectorAll('[data-export-bg]').forEach((node) => node.remove())
  const rect = svg.ownerDocument.createElementNS(ns, 'rect')
  rect.setAttribute('data-export-bg', 'true')
  rect.setAttribute('x', String(x))
  rect.setAttribute('y', String(y))
  rect.setAttribute('width', String(width))
  rect.setAttribute('height', String(height))
  rect.setAttribute('fill', color)
  const defs = svg.querySelector('defs')
  const anchor = defs?.nextSibling || svg.firstChild
  if (anchor) svg.insertBefore(rect, anchor)
  else svg.appendChild(rect)
}

export function getDrawingExportViewBox(graph, padding = 24) {
  const geometry = graph.getContentArea()
  let visual = null
  try {
    visual = graph.getContentArea({ useCellGeometry: false })
  } catch {
    visual = null
  }
  const bbox = unionRect(geometry, visual) || { x: 0, y: 0, width: 1, height: 1 }
  return {
    x: bbox.x - padding,
    y: bbox.y - padding,
    width: Math.max(bbox.width, 1) + padding * 2,
    height: Math.max(bbox.height, 1) + padding * 2
  }
}

export function sanitizeExportedDrawingSvg(svg) {
  svg.removeAttribute('style')
  svg.style.overflow = 'visible'
  // Pan/zoom lives on the viewport group. X6 toSVG only drops the stage transform,
  // then copyStyles inlines the leftover matrix and clips the bottom-right.
  clearExportedTransform(svg.querySelector('.x6-graph-svg-viewport'))
  clearExportedTransform(svg.querySelector('.x6-graph-svg-stage'))
  paintExportedSvgBackground(svg, '#ffffff')
  svg.querySelectorAll(
    '.x6-widget-selection, .x6-widget-selection-box, .x6-widget-selection-inner, .x6-graph-svg-overlay'
  ).forEach((node) => node.remove())
  return svg
}

export function exportDrawingSVG(graph, filename) {
  graph.exportSVG(filename, {
    viewBox: getDrawingExportViewBox(graph),
    preserveDimensions: true,
    copyStyles: true,
    beforeSerialize: sanitizeExportedDrawingSvg
  })
}

export { applyEdgeStyle }
