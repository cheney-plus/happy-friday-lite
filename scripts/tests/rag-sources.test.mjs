import assert from 'node:assert/strict';
import { formatRagSources } from '../../src-electron/rag/sources.js';

const content = `
  # Project Plan

  This note describes the WebDAV import design, sync cadence, and preview
  rules for Obsidian image attachments.
`;

const sources = formatRagSources([
  {
    content,
    source: 'D:/kb/local/Vault/Inbox/project-plan.md',
    confidence: 0.876,
    kbType: 'obsidian-webdav',
    metadata: {
      title: 'Project Plan',
      fileType: 'md',
      noteId: 'note-1'
    },
    parentInfo: {
      sourcePath: 'D:/kb/local/Vault/Inbox/project-plan.md'
    }
  },
  {
    content: 'Duplicate chunk should be ignored',
    source: 'D:/kb/local/Vault/Inbox/project-plan.md',
    confidence: 0.7,
    kbType: 'obsidian-webdav',
    metadata: {
      title: 'Project Plan',
      fileType: 'md',
      noteId: 'note-1'
    }
  },
  {
    content: 'A second note with no title metadata.',
    source: 'D:/kb/local/Vault/Notes/untitled.md',
    confidence: 0.55,
    kbType: 'local',
    metadata: {}
  }
], { maxSnippetLength: 72 });

assert.equal(sources.length, 2);
assert.deepEqual(sources[0], {
  title: 'Project Plan',
  source: 'D:/kb/local/Vault/Inbox/project-plan.md',
  filePath: 'D:/kb/local/Vault/Inbox/project-plan.md',
  kbType: 'obsidian-webdav',
  confidence: 0.876,
  snippet: '# Project Plan This note describes the WebDAV import design, sync cad...',
  metadata: {
    title: 'Project Plan',
    fileType: 'md',
    noteId: 'note-1'
  }
});
assert.equal(sources[1].title, 'untitled.md');
assert.equal(sources[1].filePath, 'D:/kb/local/Vault/Notes/untitled.md');
assert.equal(sources[1].snippet, 'A second note with no title metadata.');

console.log('rag-sources ok');
