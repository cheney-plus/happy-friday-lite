import { Point } from '@antv/x6'

export const EDGE_STYLES = {
  straight: {
    router: { name: 'normal' },
    connector: { name: 'normal' },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.6,
        strokeDasharray: 0,
        targetMarker: null,
        sourceMarker: null
      }
    }
  },
  arrow: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.6,
        strokeDasharray: 0,
        targetMarker: { name: 'block', width: 10, height: 8 },
        sourceMarker: null
      }
    }
  },
  doubleArrow: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.6,
        strokeDasharray: 0,
        targetMarker: { name: 'block', width: 10, height: 8 },
        sourceMarker: { name: 'block', width: 10, height: 8 }
      }
    }
  },
  dashed: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.6,
        strokeDasharray: '8 5',
        targetMarker: { name: 'block', width: 10, height: 8 },
        sourceMarker: null
      }
    }
  },
  dashedStraight: {
    router: { name: 'normal' },
    connector: { name: 'normal' },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.6,
        strokeDasharray: '8 5',
        targetMarker: null,
        sourceMarker: null
      }
    }
  },
  orthogonal: {
    router: { name: 'orth' },
    connector: { name: 'rounded', args: { radius: 8 } },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.6,
        strokeDasharray: 0,
        targetMarker: { name: 'block', width: 10, height: 8 },
        sourceMarker: null
      }
    }
  },
  manhattan: {
    router: { name: 'manhattan' },
    connector: { name: 'rounded', args: { radius: 8 } },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.6,
        strokeDasharray: 0,
        targetMarker: { name: 'block', width: 10, height: 8 },
        sourceMarker: null
      }
    }
  },
  curve: {
    router: { name: 'normal' },
    connector: { name: 'smooth' },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.6,
        strokeDasharray: 0,
        targetMarker: { name: 'classic', width: 10, height: 8 },
        sourceMarker: null
      }
    }
  },
  // UML 类图标准关系线（按 UML 规范：空心三角/菱形端点）
  inheritance: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.6,
        strokeDasharray: 0,
        targetMarker: { name: 'block', width: 14, height: 12, fill: 'transparent' },
        sourceMarker: null
      }
    }
  },
  realization: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.5,
        strokeDasharray: '8 5',
        targetMarker: { name: 'block', width: 14, height: 12, fill: 'transparent' },
        sourceMarker: null
      }
    }
  },
  dependency: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.5,
        strokeDasharray: '6 4',
        targetMarker: { name: 'block', width: 11, height: 9, open: true },
        sourceMarker: null
      }
    }
  },
  composition: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.6,
        strokeDasharray: 0,
        targetMarker: null,
        sourceMarker: { name: 'diamond', width: 14, height: 9 }
      }
    }
  },
  aggregation: {
    router: { name: 'normal' },
    connector: { name: 'rounded', args: { radius: 8 } },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.6,
        strokeDasharray: 0,
        targetMarker: null,
        sourceMarker: { name: 'diamond', width: 14, height: 9, fill: 'transparent' }
      }
    }
  },
  er: {
    router: { name: 'er' },
    connector: { name: 'rounded', args: { radius: 6 } },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.5,
        strokeDasharray: 0,
        targetMarker: { name: 'classic', width: 10, height: 8 },
        sourceMarker: null
      }
    }
  },
  message: {
    router: { name: 'normal' },
    connector: { name: 'normal' },
    attrs: {
      line: {
        stroke: '#2563eb',
        strokeWidth: 1.4,
        strokeDasharray: 0,
        targetMarker: { name: 'block', width: 10, height: 7 },
        sourceMarker: null
      }
    }
  },
  returnMessage: {
    router: { name: 'normal' },
    connector: { name: 'normal' },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.3,
        strokeDasharray: '7 4',
        targetMarker: { name: 'classic', width: 10, height: 7 },
        sourceMarker: null
      }
    }
  },
  dataflow: {
    router: { name: 'orth' },
    connector: { name: 'rounded', args: { radius: 8 } },
    attrs: {
      line: {
        stroke: '#0f766e',
        strokeWidth: 1.6,
        strokeDasharray: 0,
        targetMarker: { name: 'block', width: 10, height: 8 },
        sourceMarker: null
      }
    }
  }
}

export const DEFAULT_EDGE_STYLE = 'manhattan'

// manhattan 路由在源/目标周围没有可行路径点时（如拖拽节点与连通节点重叠、
// 距离过近）会 console.warn "Unable to execute manhattan algorithm, use orth
// instead" 并退化。提供 fallbackRoute 后 findRoute 不再返回 null，改为走这条
// 简单的 Z 形直角兜底路径，避免拖拽时控制台刷警告。
export function manhattanFallbackRoute(from, to) {
  if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
    const midX = Math.round((from.x + to.x) / 2)
    return [new Point(midX, from.y), new Point(midX, to.y)]
  }
  const midY = Math.round((from.y + to.y) / 2)
  return [new Point(from.x, midY), new Point(to.x, midY)]
}

export function applyEdgeStyle(edge, styleId) {
  const style = EDGE_STYLES[styleId] || EDGE_STYLES[DEFAULT_EDGE_STYLE]
  edge.setRouter(style.router)
  edge.setConnector(style.connector)
  edge.attr('line', { ...style.attrs.line })
  edge.setData({ ...(edge.getData() || {}), edgeStyle: styleId })
}

export function createEdgeMetadata(styleId = DEFAULT_EDGE_STYLE, extra = {}) {
  const style = EDGE_STYLES[styleId] || EDGE_STYLES[DEFAULT_EDGE_STYLE]
  return {
    shape: 'edge',
    router: style.router,
    connector: style.connector,
    attrs: { line: { ...style.attrs.line } },
    data: { edgeStyle: styleId },
    zIndex: 0,
    ...extra
  }
}
