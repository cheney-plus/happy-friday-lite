export function resolveFridayKnowledgeScope(attachments = []) {
  const folderAttachment = attachments.find(item => item.type === 'kb-folder');
  if (folderAttachment) {
    return {
      useKnowledgeBase: true,
      kbName: folderAttachment.kbName || folderAttachment.name || '',
      kbCategoryId: folderAttachment.categoryId || '',
      folderPath: folderAttachment.folderPath || folderAttachment.path || ''
    };
  }

  const kbAttachment = attachments.find(item => item.type === 'kb');
  if (kbAttachment) {
    return {
      useKnowledgeBase: true,
      kbName: kbAttachment.categoryId ? (kbAttachment.name || '') : '',
      kbCategoryId: kbAttachment.categoryId || '',
      folderPath: ''
    };
  }

  return {
    useKnowledgeBase: false,
    kbName: '',
    kbCategoryId: '',
    folderPath: ''
  };
}

export function buildFridayAttachmentData(text, attachments = [], labels = {}) {
  const noteAttachments = attachments.filter(item => item.type === 'note');
  const kbFileAttachments = attachments.filter(item => item.type === 'kb-file');
  if (!noteAttachments.length && !kbFileAttachments.length) return null;

  const refNote = labels.refNote || '';
  const refDoc = labels.refDoc || '';
  const refLines = [
    ...noteAttachments.map(note => `${refNote}${note.name}`),
    ...kbFileAttachments.map(file => `${refDoc}${file.name}`)
  ];

  return {
    userMessage: `${text}\n\n---\n${refLines.join('\n')}`,
    attachments: [
      ...noteAttachments.map(note => ({ kind: 'note', name: note.name, noteId: note.noteId })),
      ...kbFileAttachments.map(file => ({ kind: 'file', name: file.name, path: file.path }))
    ]
  };
}
