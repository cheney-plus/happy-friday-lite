import { ipcMain } from 'electron'
import { spawn } from 'child_process'
import { createRequire } from 'module'
import fs from 'fs'
import http from 'http'
import net from 'net'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import yaml from 'js-yaml'
import { getDataDir, loadConfig } from '../config.js'
import {
  acquireLocalMcpServer,
  getLocalMcpStatus,
  releaseLocalMcpServer
} from '../agent/mcp.js'
import { listRegisteredTools } from '../agent/tools/registry.js'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HARNESS_CONSUMER = 'deepseek-harness'
const HARNESS_PROVIDER = 'happy-friday'
const HARNESS_CREDENTIAL = 'HAPPY_FRIDAY_HARNESS_API_KEY'
const MCP_SERVER_NAME = 'happy-friday'
const START_TIMEOUT_MS = 45_000

let mainWindow = null
let sidecar = null
let startPromise = null
let generation = 0
let activeModelSignature = null
let recentOutput = []
let startupDiagnostic = null
let state = {
  status: 'idle',
  url: null,
  port: null,
  model: null,
  toolCount: 0,
  error: null
}

function publicStatus() {
  return { ...state }
}

function updateState(patch) {
  state = { ...state, ...patch }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('harness-status-changed', publicStatus())
  }
  return publicStatus()
}

function harnessPaths() {
  const root = path.join(getDataDir(), 'deepseek-harness')
  return {
    root,
    home: path.join(root, 'home'),
    workspace: path.join(root, 'workspace'),
    settings: path.join(root, 'home', 'settings.yaml'),
    credentials: path.join(root, 'home', '.credentials.yaml'),
    patch: path.join(root, 'home', 'happy-friday.patch.yml'),
    policy: path.join(root, 'home', 'happy-friday-tool-policy.mjs')
  }
}

function ensureHarnessDirectories(paths) {
  fs.mkdirSync(paths.root, { recursive: true, mode: 0o700 })
  fs.mkdirSync(paths.home, { recursive: true, mode: 0o700 })
  fs.mkdirSync(paths.workspace, { recursive: true, mode: 0o700 })
  if (process.platform !== 'win32') {
    fs.chmodSync(paths.root, 0o700)
    fs.chmodSync(paths.home, 0o700)
    fs.chmodSync(paths.workspace, 0o700)
  }
}

function clearStaleAppImageModuleLinks(paths) {
  const modulesRoot = path.join(paths.home, 'profiles', 'node_modules')
  if (!fs.existsSync(modulesRoot)) return

  const entries = [modulesRoot]
  while (entries.length > 0) {
    const directory = entries.pop()
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        entries.push(filename)
        continue
      }
      if (!entry.isSymbolicLink()) continue

      const target = fs.readlinkSync(filename)
      if (target.includes('/tmp/.mount_') && !fs.existsSync(filename)) {
        fs.unlinkSync(filename)
      }
    }
  }
}

function writeAtomic(filename, content, mode = 0o600) {
  const temporary = path.join(
    path.dirname(filename),
    `.${path.basename(filename)}.${process.pid}.${Date.now()}.tmp`
  )
  fs.writeFileSync(temporary, content, { encoding: 'utf-8', mode })
  if (process.platform !== 'win32') fs.chmodSync(temporary, mode)
  fs.renameSync(temporary, filename)
  if (process.platform !== 'win32') fs.chmodSync(filename, mode)
}

function readYamlMapping(filename) {
  if (!fs.existsSync(filename)) return {}
  const parsed = yaml.load(fs.readFileSync(filename, 'utf-8'))
  if (parsed === null || parsed === undefined) return {}
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${path.basename(filename)} must contain a mapping`)
  }
  return parsed
}

function selectedModel() {
  const config = loadConfig()
  const models = Array.isArray(config.customModels) ? config.customModels : []
  const model = models.find(item => item.id === config.selectedModelId)
  if (!model || !model.apiKey || !model.modelName || !model.baseUrl) {
    const error = new Error('请先在设置中配置并选择一个可用模型')
    error.code = 'HARNESS_MODEL_REQUIRED'
    throw error
  }
  let baseUrl = String(model.baseUrl).replace(/\/+$/, '')
  if (model.provider === 'other') {
    baseUrl = baseUrl.replace(/\/chat\/completions\/?$/i, '')
  }
  return {
    provider: String(model.provider || 'other'),
    providerLabel: model.providerLabel || model.provider || 'Custom',
    apiKey: String(model.apiKey),
    modelName: String(model.modelName),
    baseUrl
  }
}

function modelSignature(model) {
  return JSON.stringify([model.provider, model.providerLabel, model.apiKey, model.modelName, model.baseUrl])
}

function mcpToolConfiguration() {
  const definitions = listRegisteredTools().filter(def => def.meta?.exposedViaMcp === true)
  return {
    toolCount: definitions.length,
    approvalTools: definitions
      .filter(def => def.meta?.requireApproval === true)
      .map(def => `mcp__${MCP_SERVER_NAME}__${def.name}`)
  }
}

function syncConfiguration(model, mcpUrl) {
  const paths = harnessPaths()
  ensureHarnessDirectories(paths)

  const settings = readYamlMapping(paths.settings)
  settings['agent-default-model'] = {
    provider: HARNESS_PROVIDER,
    model: model.modelName
  }
  settings['llm-pi-ai'] = {
    providers: {
      [HARNESS_PROVIDER]: {
        displayName: model.providerLabel,
        apiKeyEnv: HARNESS_CREDENTIAL,
        api: 'openai-completions',
        baseURL: model.baseUrl,
        models: [{ id: model.modelName, name: model.modelName }]
      }
    }
  }
  writeAtomic(paths.settings, yaml.dump(settings, { noRefs: true, lineWidth: 120 }))

  const credentials = readYamlMapping(paths.credentials)
  credentials[HARNESS_CREDENTIAL] = model.apiKey
  writeAtomic(paths.credentials, yaml.dump(credentials, { noRefs: true, lineWidth: -1 }))

  fs.copyFileSync(path.join(__dirname, 'toolApprovalPolicy.mjs'), paths.policy)
  if (process.platform !== 'win32') fs.chmodSync(paths.policy, 0o600)

  const { toolCount, approvalTools } = mcpToolConfiguration()
  const patch = [
    { id: 'llm-deepseek', disabled: true },
    { id: 'ui-settings-models', disabled: true },
    {
      insert: [
        {
          id: 'mcp-happy-friday',
          name: '@deepseek-ai/dsh-mcp-client',
          config: {
            serverName: MCP_SERVER_NAME,
            transport: 'streamable-http',
            url: mcpUrl,
            toolCallTimeoutMs: 300000,
            failOnStartupError: true
          }
        },
        {
          id: 'happy-friday-tool-approval',
          name: pathToFileURL(paths.policy).href,
          inject: ['tools'],
          config: { approvalTools }
        }
      ]
    }
  ]
  writeAtomic(paths.patch, yaml.dump(patch, { noRefs: true, lineWidth: 120 }))

  return { paths, toolCount }
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : null
      server.close(error => error ? reject(error) : resolve(port))
    })
  })
}

function resolveHarnessCli() {
  const manifest = require.resolve('@deepseek-ai/dsh/package.json')
  const cli = path.join(path.dirname(manifest), 'lib', 'bin.js')
  const unpacked = cli.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`)
  return fs.existsSync(unpacked) ? unpacked : cli
}

function probe(url) {
  return new Promise(resolve => {
    const request = http.get(url, response => {
      response.resume()
      resolve(response.statusCode >= 200 && response.statusCode < 500)
    })
    request.setTimeout(1000, () => request.destroy())
    request.on('error', () => resolve(false))
  })
}

function failureDetail(fallback) {
  return startupDiagnostic
    || recentOutput.find(line => line.includes('Error: dsh:'))
    || recentOutput.find(line => /^error(?:\s+\[[^\]]+\])?:/i.test(line))
    || recentOutput.find(line => /cannot find package/i.test(line))
    // Node appends this footer after an unhandled exception. It contains no
    // diagnostic information and used to hide the real startup failure.
    || [...recentOutput].reverse().find(line => !/^Node\.js v\d+(?:\.\d+){1,2}$/i.test(line))
    || fallback
}

async function waitUntilReady(url, child, expectedGeneration) {
  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (expectedGeneration !== generation) {
      throw new Error('Harness startup was superseded')
    }
    if (child.exitCode !== null) {
      // `exit` can be emitted before stderr has flushed. Give its diagnostic
      // output a brief chance to reach `captureOutput` before selecting it.
      await new Promise(resolve => setTimeout(resolve, 50))
      throw new Error(failureDetail(`Harness exited with code ${child.exitCode}`))
    }
    if (child.harnessSpawnError) throw child.harnessSpawnError
    if (child !== sidecar) throw new Error(failureDetail('Harness stopped before becoming ready'))
    if (await probe(url)) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Harness startup timed out')
}

function captureOutput(stream) {
  stream.setEncoding('utf-8')
  stream.on('data', chunk => {
    for (const line of chunk.split(/\r?\n/)) {
      const value = line.trim()
      if (!value) continue
      if (!startupDiagnostic && (
        value.includes('Error: dsh:')
        || /^error(?:\s+\[[^\]]+\])?:/i.test(value)
        || /cannot find package/i.test(value)
      )) {
        startupDiagnostic = value
      }
      recentOutput.push(value)
      if (recentOutput.length > 30) recentOutput.shift()
    }
  })
}

async function bootHarness() {
  const expectedGeneration = ++generation
  updateState({ status: 'starting', error: null, url: null, port: null, model: null, toolCount: 0 })

  let model
  try {
    model = selectedModel()
  } catch (error) {
    updateState({ status: 'config-required', model: null, error: error.message })
    return publicStatus()
  }

  let acquiredMcp = false
  let launchedChild = null
  try {
    const mcp = await acquireLocalMcpServer(HARNESS_CONSUMER)
    acquiredMcp = true
    const mcpStatus = getLocalMcpStatus()
    if (!mcp.success || !mcpStatus.url) throw new Error('Happy Friday MCP server failed to start')
    if (expectedGeneration !== generation) throw new Error('Harness startup was superseded')

    const { paths, toolCount } = syncConfiguration(model, mcpStatus.url)
    clearStaleAppImageModuleLinks(paths)
    const port = await findOpenPort()
    if (expectedGeneration !== generation) throw new Error('Harness startup was superseded')
    const url = `http://127.0.0.1:${port}`
    const cli = resolveHarnessCli()
    recentOutput = []
    startupDiagnostic = null

    const child = spawn(
      process.execPath,
      ['--expose-internals', cli, 'web', '--patch', paths.patch, '--host', '127.0.0.1', '--port', String(port)],
      {
        cwd: paths.workspace,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          DSH_HOME: paths.home,
          DSH_CWD: paths.workspace,
          DSH_PERMISSION_MODE: 'workspace-write',
          DSH_TELEMETRY_DISABLED: '1',
          DSH_TOOLS_MODE: 'native'
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      }
    )
    launchedChild = child
    sidecar = child
    captureOutput(child.stdout)
    captureOutput(child.stderr)
    child.once('error', error => {
      child.harnessSpawnError = error
      recentOutput.push(error.message)
    })

    child.once('exit', (code, signal) => {
      if (child !== sidecar || expectedGeneration !== generation) return
      sidecar = null
      activeModelSignature = null
      releaseLocalMcpServer(HARNESS_CONSUMER).catch(() => {})
      const intentional = state.status === 'stopping' || state.status === 'idle'
      updateState(intentional
        ? { status: 'idle', url: null, port: null, model: null, toolCount: 0, error: null }
        : {
            status: 'error',
            url: null,
            port: null,
            model: null,
            toolCount: 0,
            error: failureDetail(`Harness exited (${signal || code || 'unknown'})`)
          })
    })

    await waitUntilReady(url, child, expectedGeneration)
    activeModelSignature = modelSignature(model)
    return updateState({
      status: 'ready',
      url,
      port,
      model: { providerLabel: model.providerLabel, modelName: model.modelName },
      toolCount,
      error: null
    })
  } catch (error) {
    if (launchedChild && launchedChild.exitCode === null) launchedChild.kill('SIGTERM')
    if (acquiredMcp) await releaseLocalMcpServer(HARNESS_CONSUMER).catch(() => {})
    if (expectedGeneration === generation) {
      activeModelSignature = null
      if (sidecar === launchedChild) sidecar = null
      updateState({
        status: error.code === 'HARNESS_MODEL_REQUIRED' ? 'config-required' : 'error',
        url: null,
        port: null,
        model: null,
        toolCount: 0,
        error: error.message || String(error)
      })
      console.error(`[Harness] Startup failed: ${error.message || String(error)}`)
    }
    return publicStatus()
  }
}

export function startHarnessSidecar() {
  if (sidecar && state.status === 'ready') return Promise.resolve(publicStatus())
  if (startPromise) return startPromise
  startPromise = bootHarness().finally(() => {
    startPromise = null
  })
  return startPromise
}

export async function stopHarnessSidecar() {
  generation += 1
  const child = sidecar
  sidecar = null
  startPromise = null
  activeModelSignature = null
  updateState({
    status: child ? 'stopping' : 'idle',
    url: null,
    port: null,
    model: null,
    toolCount: 0,
    error: null
  })
  if (child && child.exitCode === null) {
    child.kill('SIGTERM')
    await new Promise(resolve => {
      const timer = setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL')
        resolve()
      }, 3000)
      child.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }
  await releaseLocalMcpServer(HARNESS_CONSUMER)
  return updateState({ status: 'idle', url: null, port: null, model: null, toolCount: 0, error: null })
}

export async function restartHarnessSidecar() {
  await stopHarnessSidecar()
  return startHarnessSidecar()
}

export async function syncHarnessConfigurationIfRunning() {
  if (!sidecar || state.status !== 'ready') return publicStatus()
  try {
    const model = selectedModel()
    if (modelSignature(model) === activeModelSignature) return publicStatus()
    return restartHarnessSidecar()
  } catch (error) {
    await stopHarnessSidecar()
    return updateState({
      status: error.code === 'HARNESS_MODEL_REQUIRED' ? 'config-required' : 'error',
      error: error.message,
      model: null,
      toolCount: 0
    })
  }
}

export function registerHarnessCommands(window) {
  mainWindow = window
  ipcMain.handle('harness-start', () => startHarnessSidecar())
  ipcMain.handle('harness-status', () => publicStatus())
  ipcMain.handle('harness-restart', () => restartHarnessSidecar())
  ipcMain.handle('harness-sync-config', () => syncHarnessConfigurationIfRunning())
}
