export const FILE_TYPE_MAP = {
  folder: [],
  markdown: ['md', 'markdown', 'mdx'],
  pdf: ['pdf'],
  txt: ['txt', 'text', 'log'],
  excel: ['xls', 'xlsx', 'csv'],
  word: ['doc', 'docx'],
  note: ['note'],
  ppt: ['ppt', 'pptx'],
  html: ['html', 'htm'],
  epub: ['epub'],
  json: ['json'],
  xml: ['xml']
};

// 知识库允许的文件扩展名白名单
export const ALLOWED_EXTENSIONS = [
  // PDF
  'pdf',
  // PowerPoint
  'ppt', 'pptx',
  // Word
  'doc', 'docx',
  // Excel
  'xls', 'xlsx',
  // HTML
  'html', 'htm',
  // Text-based
  'txt', 'text', 'log', 'csv', 'json', 'xml', 'md', 'markdown', 'mdx',
  // EPub
  'epub',
  // 笔记引用
  'note'
];

export function isAllowedFile(fileName) {
  if (!fileName || !fileName.includes('.')) return false;
  const ext = fileName.split('.').pop().toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

export const FILE_TYPE_LABELS = {
  folder: '文件夹',
  markdown: 'Markdown',
  pdf: 'PDF',
  txt: 'TXT',
  excel: 'Excel',
  word: 'Word',
  note: '笔记',
  ppt: 'PPT',
  epub: 'EPUB',
  html: 'HTML',
  xml: 'XML',
  json: 'JSON',
  unknown: '文件'
};

export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 280;

export const coverOptions = [
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#B8E6D5"/><rect x="20" y="18" width="40" height="44" rx="4" fill="#fff" opacity="0.8"/><line x1="28" y1="30" x2="52" y2="30" stroke="#7BC9A8" stroke-width="3" stroke-linecap="round"/><line x1="28" y1="40" x2="48" y2="40" stroke="#7BC9A8" stroke-width="3" stroke-linecap="round"/><line x1="28" y1="50" x2="44" y2="50" stroke="#7BC9A8" stroke-width="3" stroke-linecap="round"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#A8C8F8"/><rect x="14" y="12" width="52" height="56" rx="8" fill="#fff" opacity="0.85"/><path d="M24 48 L36 58 L60 30" stroke="#6B9FE8" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#C5E1A5"/><rect x="22" y="10" width="24" height="60" rx="4" fill="#fff" opacity="0.75"/><rect x="26" y="16" width="16" height="20" rx="2" fill="#9CCC65" opacity="0.6"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#E6D2B5"/><ellipse cx="40" cy="46" rx="22" ry="18" fill="#D4A574"/><path d="M25 38 Q32 34 40 38 Q48 42 55 38" stroke="#8B6914" stroke-width="2.5" fill="none" opacity="0.4"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#E8A598"/><circle cx="40" cy="40" r="24" fill="#333" opacity="0.85"/><circle cx="40" cy="40" r="8" fill="#E8A598"/></svg>'),
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#CE93D8"/><circle cx="32" cy="32" r="16" fill="#FFB74D" opacity="0.8"/><path d="M16 64 L40 40 L64 64 Z" fill="#F8BBD9" opacity="0.7"/></svg>')
];

export const DEFAULT_CATEGORIES = [
  {
    id: 'personal',
    name: '个人知识库',
    expanded: true,
    items: [
      { id: 'personal-notes', name: '我的笔记' }
    ]
  },
  {
    id: 'agent',
    name: 'Agent知识库',
    expanded: true,
    items: [
      { id: 'rag-thinking', name: 'SKILL' }
    ]
  },
  {
    id: 'local',
    name: '本地知识库',
    expanded: false,
    items: [
      { id: 'local-books', name: '我的书籍' }
    ]
  }
];
