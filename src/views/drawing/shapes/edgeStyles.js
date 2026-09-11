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
  association: {
    router: { name: 'normal' },
    connector: { name: 'normal' },
    attrs: {
      line: {
        stroke: '#64748b',
        strokeWidth: 1.4,
        strokeDasharray: 0,
        targetMarker: { name: 'classic', width: 12, height: 8 },
        sourceMarker: null
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
