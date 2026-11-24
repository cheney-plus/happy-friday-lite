import assert from 'node:assert/strict'
import test from 'node:test'
import { testEmbeddingModel } from '../../src-electron/modelTest.js'

test('向量测试从共用地址推导端点，并保留独立地址与密钥', async t => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, { headers }) => {
    requests.push([url, headers.Authorization])
    return Response.json({ data: [{ embedding: [0, 1] }] })
  })
  const config = { provider: 'other', apiKey: 'shared', embeddingModelName: 'text-embedding-v4' }
  for (const baseUrl of ['https://example.com/v1', 'https://example.com/v1/chat/completions']) {
    assert.equal((await testEmbeddingModel({ ...config, baseUrl })).dimension, 2)
  }
  await testEmbeddingModel({
    ...config,
    useSeparateEmbeddingConfig: true,
    embeddingApiKey: 'separate',
    embeddingBaseUrl: 'https://example.com/custom/vector'
  })
  assert.deepEqual(requests, [
    ['https://example.com/v1/embeddings', 'Bearer shared'],
    ['https://example.com/v1/embeddings', 'Bearer shared'],
    ['https://example.com/custom/vector', 'Bearer separate']
  ])
})
