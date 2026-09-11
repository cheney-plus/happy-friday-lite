const circle = {
  r: 4.5,
  magnet: true,
  stroke: '#2563eb',
  strokeWidth: 1.5,
  fill: '#ffffff'
}

export const SIDE_PORTS = {
  groups: {
    top: { position: 'top', attrs: { circle } },
    right: { position: 'right', attrs: { circle } },
    bottom: { position: 'bottom', attrs: { circle } },
    left: { position: 'left', attrs: { circle } }
  },
  items: [
    { id: 'port-top', group: 'top' },
    { id: 'port-right', group: 'right' },
    { id: 'port-bottom', group: 'bottom' },
    { id: 'port-left', group: 'left' }
  ]
}
