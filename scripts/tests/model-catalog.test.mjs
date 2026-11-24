import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { listProviderModels } from '../../src-electron/modelCatalog.js'

test('自定义模型列表接受基础地址和完整对话地址', async t => {
  const requests = []
  const server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, token: req.headers.authorization })
    if (req.url === '/unsupported/models') {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ data: [{ id: 'test-chat' }, { id: 'test-chat' }, { id: 12 }] }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`

  for (const address of [
    `${base}/proxy/v1/`,
    `${base}/proxy/v1/chat/completions?api-version=demo#fragment`,
    `${base}/proxy/v1/embeddings`
  ]) {
    assert.deepEqual(await listProviderModels('other', ' test-key ', address), { chat: ['test-chat'], embedding: [] })
  }
  assert.deepEqual(requests, [
    { method: 'GET', url: '/proxy/v1/models', token: 'Bearer test-key' },
    { method: 'GET', url: '/proxy/v1/models?api-version=demo', token: 'Bearer test-key' },
    { method: 'GET', url: '/proxy/v1/models', token: 'Bearer test-key' }
  ])
  await assert.rejects(listProviderModels('other', 'test-key', `${base}/unsupported`), /404/)
  await assert.rejects(listProviderModels('other', 'test-key', 'file:///tmp/model'), /HTTP/)
})

test('预设厂商继续使用固定的模型列表地址', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.href, 'https://api.deepseek.com/models')
    assert.equal(options.headers.Authorization, 'Bearer test-key')
    return Response.json({ data: [{ id: 'deepseek-chat' }] })
  })
  assert.deepEqual(await listProviderModels('deepseek', 'test-key', 'https://example.com/v1'), { chat: ['deepseek-chat'], embedding: [] })
  assert.equal(fetchMock.mock.callCount(), 1)
})

test('按能力区分对话、向量和多模态模型', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: [
    'plain-chat',
    'text-embedding-small',
    'qwen-vl-instruct',
    { id: 'generic-vector-service', type: 'embedding' },
    { id: 'image-encoder', type: 'embedding', architecture: { input_modalities: ['text', 'image'] } },
    { id: 'mixed-input', architecture: { input_modalities: ['text', 'image'] } },
    { id: 'both-endpoints', supported_endpoints: ['/v1/chat/completions', '/v1/embeddings'] }
  ] }))
  assert.deepEqual(await listProviderModels('other', 'test-key', 'https://example.com/v1'), {
    chat: ['both-endpoints', 'mixed-input', 'plain-chat', 'qwen-vl-instruct'],
    embedding: ['both-endpoints', 'generic-vector-service', 'image-encoder', 'mixed-input', 'qwen-vl-instruct', 'text-embedding-small']
  })
})
