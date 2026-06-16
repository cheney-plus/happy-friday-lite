import fs from 'fs'
import path from 'path'
import { defaultConfig } from './types.js'
import { AppError } from './error.js'

let dataDir = null

export function setDataDir(dir) {
  dataDir = dir
}

export function getDataDir() {
  return dataDir
}

function getConfigPath() {
  if (!dataDir) {
    throw AppError.config('Data directory not initialized')
  }
  return path.join(dataDir, 'config.json')
}

export function loadConfig() {
  const configPath = getConfigPath()

  if (!fs.existsSync(configPath)) {
    const config = defaultConfig()
    saveConfig(config)
    return config
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(content)
    return { ...defaultConfig(), ...parsed }
  } catch (e) {
    throw AppError.config(`Failed to load config: ${e.message}`)
  }
}

export function saveConfig(config) {
  const configPath = getConfigPath()
  try {
    const dir = path.dirname(configPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  } catch (e) {
    throw AppError.config(`Failed to save config: ${e.message}`)
  }
}
