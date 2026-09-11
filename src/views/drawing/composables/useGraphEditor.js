import {
  Clipboard,
  Dnd,
  Export,
  Graph,
  History,
  Keyboard,
  MiniMap,
  Selection,
  Snapline,
  Transform
} from '@antv/x6'
import { applyCellAnimation, restoreGraphAnimations } from '../shapes/animation.js'
import { createNodeMetadata } from '../shapes/catalog.js'
import { applyEdgeStyle, createEdgeMetadata, DEFAULT_EDGE_STYLE } from '../shapes/edgeStyles.js'
import { registerDrawingShapes } from '../shapes/register.js'
import { cloneTemplateAt, TEMPLATE_BUILDERS } from '../shapes/templates.js'
import { getCanvasTheme } from '../shapes/theme.js'

export function createDrawingGraph(container, minimapContainer, state) {
  registerDrawingShapes()
  const theme = getCanvasTheme()

  const graph = new Graph({
    container,
    autoResize: true,
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
      validateConnection({ targetMagnet, targetCell, sourceCell }) {
        if (sourceCell && targetCell && sourceCell.id === targetCell.id) return false
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
      edgeMovable: () => state.mode !== 'pan',
      magnetConnectable: () => state.mode !== 'pan'
    }
  })

  graph
    .use(
      new Selection({
        enabled: true,
        multiple: true,
        rubberband: true,
        movable: true,
        showNodeSelectionBox: true,
        showEdgeSelectionBox: true,
        pointerEvents: 'none'
      })
    )
    .use(new Snapline({ enabled: true }))
    .use(new Keyboard({ enabled: true, global: false }))
    .use(new Clipboard({ enabled: true }))
    .use(new History({ enabled: true }))
    .use(
      new Transform({
        resizing: { enabled: true, minWidth: 20, minHeight: 20, orthogonal: false },
        rotating: { enabled: true }
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
    const cells = graph.getSelectedCells()
    if (cells.length) graph.copy(cells)
    return false
  })
  graph.bindKey(['meta+x', 'ctrl+x'], () => {
    const cells = graph.getSelectedCells()
    if (cells.length) graph.cut(cells)
    return false
  })
  graph.bindKey(['meta+v', 'ctrl+v'], () => {
    if (!graph.isClipboardEmpty()) graph.paste({ offset: 24 })
    return false
  })
  graph.bindKey(['meta+d', 'ctrl+d'], () => {
    const cells = graph.getSelectedCells()
    if (!cells.length) return false
    graph.copy(cells)
    graph.paste({ offset: 28 })
    return false
  })
  graph.bindKey(['backspace', 'delete'], () => {
    const cells = graph.getSelectedCells()
    if (cells.length) graph.removeCells(cells)
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

function bindTools(graph) {
  graph.on('edge:selected', ({ edge }) => {
    edge.addTools([
      { name: 'vertices', args: { stopPropagation: false } },
      { name: 'segments', args: { stopPropagation: false } },
      'source-arrowhead',
      'target-arrowhead'
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

export function insertTemplate(graph, name) {
  const builder = TEMPLATE_BUILDERS[name]
  if (!builder) return
  const bbox = graph.getCells().length ? graph.getContentBBox() : null
  const dx = bbox ? Math.round(bbox.x + bbox.width + 80) : 0
  const dy = bbox ? Math.round(bbox.y) : 0
  const data = cloneTemplateAt(builder(), dx, dy)
  const nodes = data.cells.filter((cell) => !cell.source && !cell.target)
  const edges = data.cells.filter((cell) => cell.source || cell.target)
  if (nodes.length) graph.addNodes(nodes)
  if (edges.length) graph.addEdges(edges)
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

export { applyEdgeStyle }
