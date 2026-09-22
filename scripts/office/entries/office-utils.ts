// Re-exports the upstream renderer custom-scheme helpers so the Happy Friday
// Lite main process can serve the built editor renderers (see office-host.js),
// plus the headless-export contract used by src-electron/office/office-headless.js
// (the CLI spawns the app binary with --headless-export for pdf/html rendering).
export {
  installRendererProtocol,
  registerRendererScheme,
  RENDERER_SCHEME,
  parseHeadlessExportArgv,
  setHeadlessMode,
  headlessModuleFor,
  HEADLESS_TARGETS,
  HEADLESS_EXIT,
  formatHeadlessEnvelope,
  headlessExitCode,
} from '../../../vendor/happyoffice/packages/electron-utils/src/index'
