import { getCanvasTheme } from './theme.js'

export const PALETTE_GROUPS = [
  {
    id: 'general',
    items: [
      { id: 'rect', kind: 'node', shape: 'draw-rect', preview: 'rect', width: 140, height: 56, defaultLabel: '矩形' },
      { id: 'rounded', kind: 'node', shape: 'draw-rounded', preview: 'rounded', width: 140, height: 56, defaultLabel: '圆角矩形' },
      { id: 'circle', kind: 'node', shape: 'draw-circle', preview: 'circle', width: 88, height: 88, defaultLabel: '圆形' },
      { id: 'ellipse', kind: 'node', shape: 'draw-ellipse', preview: 'ellipse', width: 120, height: 64, defaultLabel: '椭圆' },
      { id: 'diamond', kind: 'node', shape: 'draw-diamond', preview: 'diamond', width: 140, height: 88, defaultLabel: '菱形' },
      { id: 'triangle', kind: 'node', shape: 'draw-triangle', preview: 'triangle', width: 120, height: 88, defaultLabel: '三角形' },
      { id: 'parallelogram', kind: 'node', shape: 'draw-parallelogram', preview: 'parallelogram', width: 150, height: 64, defaultLabel: '平行四边形' },
      { id: 'hexagon', kind: 'node', shape: 'draw-hexagon', preview: 'hexagon', width: 140, height: 80, defaultLabel: '六边形' },
      { id: 'star', kind: 'node', shape: 'draw-star', preview: 'star', width: 96, height: 96, defaultLabel: '星形' },
      { id: 'cloud', kind: 'node', shape: 'draw-cloud', preview: 'cloud', width: 150, height: 90, defaultLabel: '云' },
      { id: 'cylinder', kind: 'node', shape: 'draw-cylinder', preview: 'cylinder', width: 110, height: 90, defaultLabel: '圆柱' },
      { id: 'document', kind: 'node', shape: 'draw-document', preview: 'document', width: 130, height: 86, defaultLabel: '文档' },
      { id: 'sticky', kind: 'node', shape: 'draw-sticky', preview: 'sticky', width: 140, height: 110, defaultLabel: '便签' },
      { id: 'note', kind: 'node', shape: 'draw-note', preview: 'note', width: 130, height: 90, defaultLabel: '注释' },
      { id: 'text', kind: 'node', shape: 'draw-text', preview: 'text', width: 140, height: 36, defaultLabel: '文本' },
      { id: 'image', kind: 'node', shape: 'draw-image', preview: 'image', width: 148, height: 108, defaultLabel: '图片' },
      { id: 'container', kind: 'node', shape: 'draw-container', preview: 'container', width: 280, height: 180, defaultLabel: '容器' }
    ]
  },
  {
    id: 'lines',
    items: [
      { id: 'straight', kind: 'edge', style: 'straight', preview: 'line-straight' },
      { id: 'arrow', kind: 'edge', style: 'arrow', preview: 'line-arrow' },
      { id: 'doubleArrow', kind: 'edge', style: 'doubleArrow', preview: 'line-double' },
      { id: 'dashed', kind: 'edge', style: 'dashed', preview: 'line-dashed' },
      { id: 'orthogonal', kind: 'edge', style: 'orthogonal', preview: 'line-orth' },
      { id: 'manhattan', kind: 'edge', style: 'manhattan', preview: 'line-manhattan' },
      { id: 'curve', kind: 'edge', style: 'curve', preview: 'line-curve' },
      { id: 'association', kind: 'edge', style: 'association', preview: 'line-assoc' }
    ]
  },
  {
    id: 'animation',
    items: [
      { id: 'pulse', kind: 'action', action: 'pulse', preview: 'anim-pulse' },
      { id: 'breathe', kind: 'action', action: 'breathe', preview: 'anim-breathe' },
      { id: 'bounce', kind: 'action', action: 'bounce', preview: 'anim-bounce' },
      { id: 'flow', kind: 'action', action: 'flow', preview: 'anim-flow' },
      { id: 'stopAnim', kind: 'action', action: 'none', preview: 'anim-stop' }
    ]
  },
  {
    id: 'mindmap',
    items: [
      { id: 'mindTemplate', kind: 'template', template: 'mindmap', preview: 'tpl-mind' },
      { id: 'mindRoot', kind: 'node', shape: 'draw-mind-root', preview: 'mind-root', width: 160, height: 52, defaultLabel: '中心主题' },
      { id: 'mindTopic', kind: 'node', shape: 'draw-mind-topic', preview: 'mind-topic', width: 132, height: 42, defaultLabel: '分支主题' },
      { id: 'mindSub', kind: 'node', shape: 'draw-mind-sub', preview: 'mind-sub', width: 116, height: 34, defaultLabel: '子主题' },
      { id: 'mindCallout', kind: 'node', shape: 'draw-mind-callout', preview: 'mind-callout', width: 120, height: 48, defaultLabel: '备注' }
    ]
  },
  {
    id: 'flowchart',
    items: [
      { id: 'flowTemplate', kind: 'template', template: 'flowchart', preview: 'tpl-flow' },
      { id: 'terminator', kind: 'node', shape: 'draw-terminator', preview: 'ellipse', width: 128, height: 52, defaultLabel: '开始' },
      { id: 'process', kind: 'node', shape: 'draw-process', preview: 'rect', width: 140, height: 56, defaultLabel: '处理' },
      { id: 'decision', kind: 'node', shape: 'draw-decision', preview: 'diamond', width: 148, height: 92, defaultLabel: '判断' },
      { id: 'data', kind: 'node', shape: 'draw-data', preview: 'parallelogram', width: 150, height: 60, defaultLabel: '数据' },
      { id: 'documentShape', kind: 'node', shape: 'draw-document', preview: 'document', width: 130, height: 86, defaultLabel: '文档' },
      { id: 'database', kind: 'node', shape: 'draw-cylinder', preview: 'cylinder', width: 110, height: 90, defaultLabel: '数据库' },
      { id: 'preparation', kind: 'node', shape: 'draw-preparation', preview: 'hexagon', width: 150, height: 70, defaultLabel: '准备' },
      { id: 'delay', kind: 'node', shape: 'draw-delay', preview: 'delay', width: 130, height: 64, defaultLabel: '延迟' },
      { id: 'display', kind: 'node', shape: 'draw-display', preview: 'display', width: 140, height: 70, defaultLabel: '显示' },
      { id: 'manual', kind: 'node', shape: 'draw-manual', preview: 'manual', width: 140, height: 70, defaultLabel: '手工操作' },
      { id: 'connector', kind: 'node', shape: 'draw-connector', preview: 'circle', width: 44, height: 44, defaultLabel: 'A' }
    ]
  },
  {
    id: 'er',
    items: [
      { id: 'erTemplate', kind: 'template', template: 'er', preview: 'tpl-er' },
      { id: 'erEntity', kind: 'node', shape: 'draw-er-entity', preview: 'er-entity', width: 160, height: 88, defaultLabel: '实体' },
      { id: 'erWeak', kind: 'node', shape: 'draw-er-weak', preview: 'er-weak', width: 168, height: 96, defaultLabel: '弱实体' },
      { id: 'erAttr', kind: 'node', shape: 'draw-er-attr', preview: 'ellipse', width: 120, height: 52, defaultLabel: '属性' },
      { id: 'erKey', kind: 'node', shape: 'draw-er-key', preview: 'er-key', width: 120, height: 52, defaultLabel: '主键' },
      { id: 'erRel', kind: 'node', shape: 'draw-er-rel', preview: 'diamond', width: 140, height: 88, defaultLabel: '关系' },
      { id: 'erIdent', kind: 'node', shape: 'draw-er-ident', preview: 'er-ident', width: 148, height: 92, defaultLabel: '标识关系' },
      { id: 'erLine', kind: 'edge', style: 'er', preview: 'line-assoc' }
    ]
  },
  {
    id: 'uml',
    items: [
      { id: 'umlClass', kind: 'node', shape: 'draw-uml-class', preview: 'uml-class', width: 200, height: 148, defaultLabel: 'Class', data: { className: 'Class', attributes: '+ id: string', methods: '+ save(): void' } },
      { id: 'umlInterface', kind: 'node', shape: 'draw-uml-interface', preview: 'rounded', width: 160, height: 56, defaultLabel: '«interface»' },
      { id: 'umlActor', kind: 'node', shape: 'draw-uml-actor', preview: 'actor', width: 64, height: 108, defaultLabel: 'Actor' },
      { id: 'umlUsecase', kind: 'node', shape: 'draw-uml-usecase', preview: 'ellipse', width: 150, height: 70, defaultLabel: '用例' },
      { id: 'umlPackage', kind: 'node', shape: 'draw-uml-package', preview: 'package', width: 180, height: 110, defaultLabel: 'Package' },
      { id: 'umlComponent', kind: 'node', shape: 'draw-uml-component', preview: 'component', width: 160, height: 72, defaultLabel: 'Component' },
      { id: 'umlNote', kind: 'node', shape: 'draw-note', preview: 'note', width: 130, height: 90, defaultLabel: '注释' }
    ]
  },
  {
    id: 'advanced',
    children: [
      {
        id: 'timeline',
        items: [
          { id: 'timelineTemplate', kind: 'template', template: 'timeline', preview: 'tpl-timeline' },
          { id: 'tlAxis', kind: 'node', shape: 'draw-tl-axis', preview: 'tl-axis', width: 520, height: 8, defaultLabel: '' },
          { id: 'tlEvent', kind: 'node', shape: 'draw-tl-event', preview: 'rounded', width: 150, height: 64, defaultLabel: '事件' },
          { id: 'tlMilestone', kind: 'node', shape: 'draw-tl-milestone', preview: 'circle', width: 28, height: 28, defaultLabel: '' }
        ]
      },
      {
        id: 'sequence',
        items: [
          { id: 'sequenceTemplate', kind: 'template', template: 'sequence', preview: 'tpl-seq' },
          { id: 'seqActor', kind: 'node', shape: 'draw-seq-actor', preview: 'seq-actor', width: 120, height: 280, defaultLabel: '对象' },
          { id: 'seqActivation', kind: 'node', shape: 'draw-seq-activation', preview: 'seq-act', width: 16, height: 80, defaultLabel: '' },
          { id: 'seqFragment', kind: 'node', shape: 'draw-seq-fragment', preview: 'container', width: 360, height: 160, defaultLabel: 'alt' },
          { id: 'seqMessage', kind: 'edge', style: 'message', preview: 'line-arrow' },
          { id: 'seqReturn', kind: 'edge', style: 'returnMessage', preview: 'line-dashed' }
        ]
      },
      {
        id: 'architecture',
        items: [
          { id: 'archTemplate', kind: 'template', template: 'architecture', preview: 'tpl-arch' },
          { id: 'archClient', kind: 'node', shape: 'draw-arch-client', preview: 'arch-client', width: 140, height: 64, defaultLabel: '客户端' },
          { id: 'archServer', kind: 'node', shape: 'draw-arch-server', preview: 'arch-server', width: 140, height: 64, defaultLabel: '服务' },
          { id: 'archDb', kind: 'node', shape: 'draw-arch-db', preview: 'cylinder', width: 140, height: 64, defaultLabel: '数据库' },
          { id: 'archCloud', kind: 'node', shape: 'draw-arch-cloud', preview: 'cloud', width: 140, height: 64, defaultLabel: '云服务' },
          { id: 'archQueue', kind: 'node', shape: 'draw-arch-queue', preview: 'arch-queue', width: 140, height: 64, defaultLabel: '消息队列' },
          { id: 'archCache', kind: 'node', shape: 'draw-arch-cache', preview: 'arch-cache', width: 140, height: 64, defaultLabel: '缓存' },
          { id: 'archGateway', kind: 'node', shape: 'draw-arch-gateway', preview: 'hexagon', width: 140, height: 64, defaultLabel: '网关' }
        ]
      },
      {
        id: 'dfd',
        items: [
          { id: 'dfdTemplate', kind: 'template', template: 'dfd', preview: 'tpl-dfd' },
          { id: 'dfdExternal', kind: 'node', shape: 'draw-dfd-external', preview: 'dfd-ext', width: 140, height: 64, defaultLabel: '外部实体' },
          { id: 'dfdProcess', kind: 'node', shape: 'draw-dfd-process', preview: 'circle', width: 92, height: 92, defaultLabel: '处理' },
          { id: 'dfdStore', kind: 'node', shape: 'draw-dfd-store', preview: 'dfd-store', width: 150, height: 48, defaultLabel: '数据存储' },
          { id: 'dfdFlow', kind: 'edge', style: 'dataflow', preview: 'line-arrow' }
        ]
      }
    ]
  }
]

export function findCatalogItem(id) {
  const visit = (groups) => {
    for (const group of groups) {
      if (group.items) {
        const found = group.items.find((item) => item.id === id)
        if (found) return found
      }
      if (group.children) {
        const found = visit(group.children)
        if (found) return found
      }
    }
    return null
  }
  return visit(PALETTE_GROUPS)
}

const PRESERVE_STYLE_PREFIXES = [
  'draw-mind-',
  'draw-arch-',
  'draw-er-',
  'draw-uml-',
  'draw-dfd-',
  'draw-sticky',
  'draw-note',
  'draw-image',
  'draw-seq-activation',
  'draw-tl-milestone'
]

function shouldPreserveStyle(shape) {
  return PRESERVE_STYLE_PREFIXES.some((prefix) => shape.startsWith(prefix) || shape === prefix)
}

export function createNodeMetadata(item, x, y, extra = {}) {
  const theme = getCanvasTheme()
  const label = extra.label ?? item.defaultLabel ?? ''
  const metadata = {
    shape: item.shape,
    x,
    y,
    width: item.width,
    height: item.height,
    label,
    data: { catalogId: item.id, ...(item.data || {}), ...(extra.data || {}) },
    zIndex: extra.zIndex ?? 1
  }
  if (!shouldPreserveStyle(item.shape)) {
    metadata.attrs = {
      body: {
        fill: theme.fill,
        stroke: theme.stroke
      },
      label: {
        fill: theme.text,
        text: label
      }
    }
  }
  return metadata
}
