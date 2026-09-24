import fs from 'node:fs'

/**
 * Remove DSH's credentials writer lock before launching a new sidecar.
 * This is called directly before spawn, while this application's DSH sidecar
 * is stopped, so the app-private lock cannot belong to the child being launched.
 */
export function clearHarnessCredentialLock(filename) {
  const lockPath = `${filename}.lock`
  try {
    fs.unlinkSync(lockPath)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}
