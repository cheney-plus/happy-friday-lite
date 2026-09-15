import { request as httpRequest } from 'http'
import { request as httpsRequest } from 'https'
import { load } from 'cheerio'

export function normalizeDavPath(input = '/', options = {}) {
  let value = String(input || '/').replace(/\\/g, '/')
  if (!value.startsWith('/')) value = '/' + value
  value = value.replace(/\/+/g, '/')
  if (options.directory !== false && !value.endsWith('/')) value += '/'
  if (options.directory === false && value.length > 1) value = value.replace(/\/$/, '')
  return value
}

export function parsePropfindXml(xml, basePath = '/') {
  const $ = load(xml, { xmlMode: true })
  const normalizedBase = normalizeDavPath(basePath)
  const entries = []

  elementsByLocalName($, 'response').each((_i, el) => {
    const response = $(el)
    const href = safeDecodeURIComponent((firstText($, response, 'href') || '').trim())
    if (!href) return
    const isDirectory = findByLocalName($, response, 'collection').length > 0 || href.endsWith('/')
    const relativePath = stripBasePath(href, normalizedBase)
    const sizeText = firstText($, response, 'getcontentlength')
    entries.push({
      href,
      relativePath,
      isDirectory,
      etag: firstText($, response, 'getetag') || '',
      lastModified: firstText($, response, 'getlastmodified') || '',
      size: sizeText ? Number(sizeText) || 0 : 0
    })
  })

  return entries
}

export class WebDavClient {
  constructor(config = {}) {
    this.baseUrl = String(config.url || '').replace(/\/+$/, '')
    this.username = config.username || ''
    this.password = config.password || ''
  }

  async propfind(remotePath = '/', depth = 'infinity') {
    const davPath = normalizeDavPath(remotePath)
    const body = `<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><allprop/></propfind>`
    const response = await this.request('PROPFIND', davPath, {
      headers: { Depth: String(depth), 'Content-Type': 'application/xml' },
      body
    })
    const text = response.body.toString('utf-8')
    return parsePropfindXml(text, this.responseBasePath(davPath))
  }

  async get(remotePath) {
    const response = await this.request('GET', normalizeDavPath(remotePath, { directory: false }))
    return response.body
  }

  async request(method, remotePath, options = {}) {
    if (!this.baseUrl) throw new Error('Missing WebDAV url')
    const url = new URL(this.baseUrl + normalizeDavPath(remotePath, { directory: method === 'PROPFIND' }))
    const transport = url.protocol === 'https:' ? httpsRequest : httpRequest
    const headers = { ...(options.headers || {}) }
    if (this.username || this.password) {
      headers.Authorization = 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64')
    }
    const body = options.body ? Buffer.from(options.body) : null
    if (body) headers['Content-Length'] = body.length

    return new Promise((resolve, reject) => {
      const req = transport(url, { method, headers }, (res) => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => {
          const response = { statusCode: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) }
          if (response.statusCode >= 200 && response.statusCode < 300) resolve(response)
          else reject(new Error(`WebDAV ${method} failed with ${response.statusCode}`))
        })
      })
      req.on('error', reject)
      if (body) req.write(body)
      req.end()
    })
  }

  responseBasePath(remotePath) {
    const basePath = new URL(this.baseUrl).pathname || '/'
    return normalizeDavPath(pathJoinUrl(basePath, remotePath))
  }
}

function stripBasePath(href, basePath) {
  const pathOnly = safeDecodeURIComponent(new URL(href, 'http://localhost').pathname)
  const normalizedHref = normalizeDavPath(pathOnly, { directory: href.endsWith('/') })
  if (normalizedHref === basePath) return ''
  return normalizedHref.startsWith(basePath)
    ? normalizedHref.slice(basePath.length).replace(/\/$/, '')
    : normalizedHref.replace(/^\//, '').replace(/\/$/, '')
}

function safeDecodeURIComponent(value) {
  const input = String(value || '')
  try {
    return decodeURIComponent(input)
  } catch (e) {
    return decodeURIComponent(input.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'))
  }
}

function elementsByLocalName($, localName) {
  return $('*').filter((_i, el) => tagLocalName(el) === localName)
}

function findByLocalName($, scope, localName) {
  return scope.find('*').filter((_i, el) => tagLocalName(el) === localName)
}

function firstText($, scope, localName) {
  return findByLocalName($, scope, localName).first().text()
}

function tagLocalName(el) {
  const name = String(el?.tagName || el?.name || '').toLowerCase()
  return name.includes(':') ? name.split(':').pop() : name
}

function pathJoinUrl(basePath, remotePath) {
  const left = String(basePath || '/').replace(/\/+$/, '')
  const right = String(remotePath || '/').replace(/^\/+/, '')
  return `${left}/${right}` || '/'
}
