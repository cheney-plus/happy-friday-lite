import { defineComponent, h } from 'vue';

const IconWrapper = (pathData, defaultSize = 18) => defineComponent({
  props: { size: { type: Number, default: defaultSize } },
  render() {
    return h('svg', {
      width: this.size, height: this.size,
      viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', 'stroke-width': 2,
      innerHTML: pathData
    });
  }
});

export const SidebarIcon = IconWrapper('<rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1.8"/><line x1="9" y1="3" x2="9" y2="21" stroke-width="1.8"/>');
export const SearchIcon = IconWrapper('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>');
export const ChevronIcon = IconWrapper('<polyline points="9 18 15 12 9 6"/>', 12);
export const PlusIcon = IconWrapper('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', 14);
export const BookIcon = IconWrapper('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', 16);
export const FolderIcon = defineComponent({
  props: { size: { type: Number, default: 36 } },
  render() {
    return h('svg', {
      width: this.size, height: this.size,
      viewBox: '0 0 24 24', fill: 'none'
    }, [
      h('path', {
        d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
        fill: '#5B9BF5',
        stroke: '#1560F7',
        'stroke-width': '1.2',
        'stroke-linejoin': 'round'
      })
    ]);
  }
});

export const MarkdownIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#E8F5E9', stroke: '#4CAF50', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#388E3C', 'font-size': '7', 'font-weight': 'bold', 'font-family': 'monospace' }, 'MD')
    ]);
  }
});

export const PdfIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#FFEBEE', stroke: '#F44336', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#D32F2F', 'font-size': '7', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'PDF')
    ]);
  }
});

export const TxtIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#F5F5F5', stroke: '#9E9E9E', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#616161', 'font-size': '7', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'TXT')
    ]);
  }
});

export const ExcelIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#E8F5E9', stroke: '#4CAF50', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#2E7D32', 'font-size': '6', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'XLS')
    ]);
  }
});

export const WordIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#E3F2FD', stroke: '#2196F3', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#1565C0', 'font-size': '6', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'DOC')
    ]);
  }
});

export const NoteIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#FFF8E1', stroke: '#FFC107', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#F57F17', 'font-size': '6', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'NOTE')
    ]);
  }
});

export const PptIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#FFF3E0', stroke: '#FF9800', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#E65100', 'font-size': '6', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'PPT')
    ]);
  }
});

export const EpubIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#F3E5F5', stroke: '#9C27B0', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#7B1FA2', 'font-size': '6', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'EPUB')
    ]);
  }
});

export const HtmlIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#E0F7FA', stroke: '#00BCD4', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#00838F', 'font-size': '6', 'font-weight': 'bold', 'font-family': 'monospace' }, 'HTML')
    ]);
  }
});

export const XmlIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#ECEFF1', stroke: '#607D8B', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#37474F', 'font-size': '6', 'font-weight': 'bold', 'font-family': 'monospace' }, 'XML')
    ]);
  }
});

export const JsonIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#FFF3E0', stroke: '#FF9800', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#E65100', 'font-size': '6', 'font-weight': 'bold', 'font-family': 'monospace' }, 'JSON')
    ]);
  }
});

export const UnknownFileIcon = defineComponent({
  render() {
    return h('svg', { width: 36, height: 36, viewBox: '0 0 24 24', fill: 'none' }, [
      h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '3', fill: '#ECEFF1', stroke: '#90A4AE', 'stroke-width': '1.2' }),
      h('text', { x: '12', y: '16', 'text-anchor': 'middle', fill: '#546E7A', 'font-size': '6', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'FILE')
    ]);
  }
});

export const FILE_ICON_MAP = {
  folder: FolderIcon,
  markdown: MarkdownIcon,
  pdf: PdfIcon,
  txt: TxtIcon,
  excel: ExcelIcon,
  word: WordIcon,
  note: NoteIcon,
  ppt: PptIcon,
  epub: EpubIcon,
  html: HtmlIcon,
  xml: XmlIcon,
  json: JsonIcon,
  unknown: UnknownFileIcon
};
