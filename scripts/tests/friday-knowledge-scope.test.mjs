import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFridayAttachmentData,
  resolveFridayKnowledgeScope
} from '../../src/views/friday/utils/knowledgeScope.js'

const labels = {
  refNote: 'User referenced [Note]: ',
  refDoc: 'User referenced [Doc]: '
}

test('resolves folder selection as the RAG knowledge scope', () => {
  const scope = resolveFridayKnowledgeScope([
    { type: 'kb', name: 'Project Vault', categoryId: 'local' },
    { type: 'kb-folder', name: 'Project Vault / Notes', kbName: 'Project Vault', categoryId: 'local', folderPath: 'Notes' }
  ])

  assert.deepEqual(scope, {
    useKnowledgeBase: true,
    kbName: 'Project Vault',
    kbCategoryId: 'local',
    folderPath: 'Notes'
  })
})

test('resolves all-knowledge selection as an unrestricted RAG scope', () => {
  const scope = resolveFridayKnowledgeScope([
    { type: 'kb', name: '全部知识库', categoryId: null }
  ])

  assert.deepEqual(scope, {
    useKnowledgeBase: true,
    kbName: '',
    kbCategoryId: '',
    folderPath: ''
  })
})

test('keeps referenced files in attachment context only', () => {
  const data = buildFridayAttachmentData('summarize this', [
    { type: 'kb-file', name: 'plan.md', path: 'D:/kb/local/Project Vault/Notes/plan.md' }
  ], labels)

  assert.deepEqual(data.attachments, [
    { kind: 'file', name: 'plan.md', path: 'D:/kb/local/Project Vault/Notes/plan.md' }
  ])
  assert.match(data.userMessage, /User referenced \[Doc\]: plan\.md/)
})
