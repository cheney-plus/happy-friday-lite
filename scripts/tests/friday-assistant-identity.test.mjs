import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getDefaultAssistantName,
  normalizeAssistantName,
  resolveAssistantName
} from '../../src/views/friday/utils/assistantIdentity.js'

test('uses localized default assistant names', () => {
  assert.equal(getDefaultAssistantName('zh-CN'), '周五')
  assert.equal(getDefaultAssistantName('en-US'), 'Friday')
})

test('prefers a normalized custom assistant name', () => {
  assert.equal(resolveAssistantName('  小七  ', 'zh-CN'), '小七')
  assert.equal(resolveAssistantName('', 'zh-CN'), '周五')
})

test('limits assistant names to a compact display length', () => {
  assert.equal(normalizeAssistantName('abcdefghijklmnopq'), 'abcdefghijklmnop')
})
