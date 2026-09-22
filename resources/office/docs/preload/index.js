"use strict";
const electron = require("electron");
const AI_PROVIDERS = [
  {
    id: "genspark",
    label: "Genspark",
    // must stay within the proxy's served set (GET /api/llm_proxy/v1/models);
    // bare gpt-5.6 and the gemini family dropped off it (verified 2026-08-31).
    // DeepSeek goes by the proxy's hyphenated pool id; V4.1 Flash takes images
    // (live-verified 2026-09-15). gpt-6-astra: chat, tool call and image
    // input all live-verified through the proxy 2026-09-17
    models: [
      "claude-opus-4-7",
      "claude-opus-4-8",
      "claude-sonnet-4-6",
      "gpt-6-astra",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "deep-seek-v4.1-flash"
    ],
    defaultModel: "claude-opus-4-7",
    keyPlaceholder: "Not required - sign in to Genspark"
  },
  {
    id: "codex",
    label: "Codex CLI",
    // Populated at runtime from codex app-server model/list. Empty also lets
    // the CLI select the account's current default without a stale hardcode.
    models: [],
    defaultModel: "",
    keyPlaceholder: "",
    needsCliPath: true
  },
  {
    id: "anthropic",
    label: "Claude",
    // current-generation ids per platform.claude.com models overview (2026-08)
    models: [
      "claude-opus-5",
      "claude-sonnet-5",
      "claude-fable-5",
      "claude-opus-4-8",
      "claude-opus-4-7",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001"
    ],
    defaultModel: "claude-sonnet-5",
    keyPlaceholder: "sk-ant-api03-..."
  },
  {
    id: "gemini",
    label: "Gemini",
    // 3.x lineup per ai.google.dev/gemini-api/docs/models (2026-08). 3.7 Flash is
    // the current stable Flash; 3.1 Pro is still preview-only.
    models: [
      "gemini-3.7-flash",
      "gemini-3.1-pro-preview",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite"
    ],
    defaultModel: "gemini-3.7-flash",
    keyPlaceholder: "AIza..."
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    // exactly what GET api.deepseek.com/v1/models serves (2026-09-16):
    // `deepseek-flash` is V4.1 Flash with native vision. The legacy
    // `deepseek-v4-flash` still answers but the model behind it is retired;
    // indirect-route aliases such as `-openrouter` do not belong here either.
    models: ["deepseek-v4-pro", "deepseek-flash"],
    defaultModel: "deepseek-v4-pro",
    keyPlaceholder: "sk-..."
  },
  {
    id: "openai",
    label: "OpenAI",
    // GPT-5.6 naming: sol is the flagship (the bare `gpt-5.6` alias resolves to
    // it, but spell it out so the picker says which tier it is), terra balances
    // cost/intelligence, luna is the high-volume tier (2026-08). gpt-6-astra
    // is deliberately absent: OpenAI serves its tool calls only through the
    // Responses API, which has no protocol here (2026-09-17)
    models: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.5", "gpt-5.4", "gpt-5.4-mini"],
    defaultModel: "gpt-5.6-terra",
    keyPlaceholder: "sk-..."
  },
  {
    id: "kimi",
    label: "Kimi",
    models: ["kimi-k3"],
    defaultModel: "kimi-k3",
    keyPlaceholder: "sk-..."
  },
  {
    id: "glm",
    label: "GLM",
    // bigmodel.cn text-model lineup (2026-08); 5.3 and 5.2 share a base model,
    // 5-Turbo is the cheap tier
    models: ["glm-5.3", "glm-5.2", "glm-5-turbo"],
    defaultModel: "glm-5.3",
    keyPlaceholder: "xxxxxxxx.xxxxxxxx"
  },
  {
    id: "qwen",
    label: "Qwen",
    // Versioned DashScope ids: the bare qwen-max alias still points at a
    // Qwen2.5-era snapshot, so name the 3.x tiers explicitly (2026-08)
    models: ["qwen3.8-max", "qwen3.7-plus", "qwen3.7-flash"],
    defaultModel: "qwen3.8-max",
    keyPlaceholder: "sk-..."
  },
  {
    id: "doubao",
    label: "Doubao",
    // Ark ids are dashed and date-pinned; it also accepts ep-... inference
    // endpoint ids in the model field
    models: ["doubao-seed-2-1-pro-260628", "doubao-seed-2-1-turbo-260628"],
    defaultModel: "doubao-seed-2-1-pro-260628",
    keyPlaceholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  },
  {
    id: "minimax",
    label: "MiniMax",
    // M3 is the current agentic/tool-use model; M2.5 moved to the legacy tier
    models: ["MiniMax-M3", "MiniMax-M2.7"],
    defaultModel: "MiniMax-M3",
    keyPlaceholder: "eyJ..."
  },
  {
    id: "xai",
    label: "Grok",
    models: ["grok-4.6", "grok-4.5"],
    defaultModel: "grok-4.6",
    keyPlaceholder: "xai-..."
  },
  {
    id: "mistral",
    label: "Mistral",
    // `-latest` aliases track the newest GA snapshot. Medium 3.5 is Mistral's
    // agentic tier; codestral is a code-completion/FIM model, not an agent driver.
    models: ["mistral-medium-latest", "mistral-large-latest", "mistral-small-latest"],
    defaultModel: "mistral-medium-latest",
    keyPlaceholder: "API Key"
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    // vendor-prefixed slugs exactly as openrouter.ai/api/v1/models lists them —
    // there is no `openai/gpt-5.6` alias there, only the per-tier ids
    models: [
      "openrouter/auto",
      "anthropic/claude-sonnet-5",
      "openai/gpt-6-astra",
      "openai/gpt-5.6-sol",
      "moonshotai/kimi-k3"
    ],
    defaultModel: "openrouter/auto",
    keyPlaceholder: "sk-or-..."
  },
  {
    id: "requesty",
    label: "Requesty",
    // Managed policy ids exactly as GET router.requesty.ai/v1/models/managed
    // lists them (2026-09-11): short stable names Requesty routes across
    // providers, used as-is in the model field. The full vendor-prefixed
    // catalog (GET /v1/models, e.g. openai/gpt-4o-mini) works too when typed
    // in. Ids ending "@eu" route through EU providers only.
    models: [
      "claude-sonnet-5",
      "claude-opus-4-8",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gemini-3.7-flash",
      "deepseek-v4-pro",
      "kimi-k3"
    ],
    defaultModel: "claude-sonnet-5",
    keyPlaceholder: "sk-..."
  },
  {
    id: "opper",
    label: "Opper",
    // Pool ids exactly as GET api.opper.ai/v3/models lists them (2026-09-14):
    // a bare name is an Opper pool, and Opper picks the serving provider and
    // region per request. The vendor-prefixed catalog (anthropic/claude-sonnet-4-6,
    // azure/gpt-5, …) pins one provider and works as-is when typed in.
    // Full list at opper.ai/models.
    models: [
      "claude-sonnet-4-6",
      "claude-opus-5",
      "gpt-5.5",
      "gpt-5.4-mini",
      "gemini-3.8-flash",
      "deepseek-v4-pro",
      "kimi-k3",
      "mistral-large-2512"
    ],
    defaultModel: "claude-sonnet-4-6",
    keyPlaceholder: "API Key"
  },
  {
    id: "opencode-zen",
    label: "OpenCode Zen",
    // Pay-as-you-go gateway (opencode.ai/docs/zen); ids exactly as GET
    // /zen/v1/models lists them (2026-09-03). GPT-5.x, Grok and Muse Spark
    // are served only through the Responses API, which has no protocol here,
    // so they stay out until one exists.
    models: [
      "claude-sonnet-5",
      "claude-opus-5",
      "claude-fable-5-1",
      "claude-haiku-4-5",
      "gemini-3.7-flash",
      "gemini-3.1-pro",
      "kimi-k3",
      "kimi-k2.7-code",
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "glm-5.2",
      "minimax-m3",
      "qwen3.6-plus"
    ],
    defaultModel: "claude-sonnet-5",
    keyPlaceholder: "API Key"
  },
  {
    id: "opencode-go",
    label: "OpenCode Go",
    // $10/month subscription to open-weight coding models (opencode.ai/docs/go),
    // same key as Zen; ids exactly as GET /zen/go/v1/models lists them
    // (2026-09-03). GPT-5.6 Luna, Grok and Muse Spark are Responses-only and
    // left out for the same reason as above.
    models: [
      "kimi-k2.7-code",
      "kimi-k3",
      "glm-5.3",
      "glm-5.3-flash",
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "qwen3.8-max",
      "qwen3.8-flash",
      "minimax-m3",
      "mimo-v2.5-pro",
      "longcat-2.0"
    ],
    defaultModel: "kimi-k2.7-code",
    keyPlaceholder: "API Key"
  },
  {
    id: "custom",
    label: "Custom",
    models: [],
    defaultModel: "",
    keyPlaceholder: "API Key",
    needsBaseUrl: true
  }
];
function metaOf(id) {
  return AI_PROVIDERS.find((m) => m.id === id);
}
({
  genspark: {
    meta: metaOf("genspark")
  },
  codex: {
    meta: metaOf("codex")
  },
  anthropic: {
    meta: metaOf("anthropic")
  },
  gemini: {
    meta: metaOf("gemini")
  },
  deepseek: {
    meta: metaOf("deepseek")
  },
  openai: {
    meta: metaOf("openai")
  },
  kimi: {
    meta: metaOf("kimi")
  },
  glm: {
    meta: metaOf("glm")
  },
  qwen: {
    meta: metaOf("qwen")
  },
  doubao: {
    meta: metaOf("doubao")
  },
  minimax: {
    meta: metaOf("minimax")
  },
  xai: {
    meta: metaOf("xai")
  },
  mistral: {
    meta: metaOf("mistral")
  },
  openrouter: {
    meta: metaOf("openrouter")
  },
  requesty: {
    meta: metaOf("requesty")
  },
  opper: {
    meta: metaOf("opper")
  },
  "opencode-zen": {
    meta: metaOf("opencode-zen")
  },
  "opencode-go": {
    meta: metaOf("opencode-go")
  },
  custom: {
    meta: metaOf("custom")
  }
});
const VIEW_IMAGE_CHANNEL = "genoffice:view-image";
const DROP_OPEN_CHANNEL = "app:open-dropped-files";
const OPENABLE_DOC_RE = /\.(docx|xlsx|xlsm|xls|csv|pptx|pdf|md|markdown|html|htm)$/i;
const KNOWN_UNSUPPORTED_DOC_RE = /\.(doc|rtf|odt|ppt|pps|odp|ods|xlsb|pages|key|numbers)$/i;
const MAX_DROPPED_FILES = 20;
function tryResolvePath(file, getPathForFile) {
  try {
    return getPathForFile(file).trim();
  } catch {
    return "";
  }
}
function droppableFilePaths(ev, getPathForFile) {
  const transfer = ev.dataTransfer;
  if (!transfer || !transfer.types.includes("Files")) return null;
  const paths = [];
  for (const file of Array.from(transfer.files)) {
    const path = tryResolvePath(file, getPathForFile);
    if (path) paths.push(path);
  }
  return paths;
}
const INSTALLED = /* @__PURE__ */ Symbol.for("genoffice.drop-open-installed");
function installDropOpenBridge() {
  const holder = globalThis;
  if (typeof window === "undefined" || holder[INSTALLED]) return;
  holder[INSTALLED] = true;
  window.addEventListener("dragover", (ev) => {
    if (ev.defaultPrevented) return;
    if (!ev.dataTransfer?.types.includes("Files")) return;
    ev.preventDefault();
  });
  window.addEventListener("drop", (ev) => {
    if (ev.defaultPrevented) return;
    const paths = droppableFilePaths(ev, (file) => electron.webUtils.getPathForFile(file));
    if (!paths) return;
    const payload = paths.filter((p) => OPENABLE_DOC_RE.test(p) || KNOWN_UNSUPPORTED_DOC_RE.test(p));
    ev.preventDefault();
    if (payload.length === 0) return;
    electron.ipcRenderer.send(DROP_OPEN_CHANNEL, payload.slice(0, MAX_DROPPED_FILES));
  });
}
const api = {
  getLanguage: () => electron.ipcRenderer.invoke("app:get-language"),
  onLanguageChanged: (handler) => {
    const listener = (_event, lang) => handler(lang);
    electron.ipcRenderer.on("app:language-changed", listener);
    return () => electron.ipcRenderer.removeListener("app:language-changed", listener);
  },
  getTheme: () => electron.ipcRenderer.invoke("app:get-theme"),
  onThemeChanged: (handler) => {
    const listener = (_event, theme) => handler(theme);
    electron.ipcRenderer.on("app:theme-changed", listener);
    return () => electron.ipcRenderer.removeListener("app:theme-changed", listener);
  },
  getAutoSaveDefault: () => electron.ipcRenderer.invoke("app:get-auto-save-default"),
  onAutoSaveDefaultChanged: (handler) => {
    const listener = (_event, value) => handler(value);
    electron.ipcRenderer.on("app:auto-save-default-changed", listener);
    return () => electron.ipcRenderer.removeListener("app:auto-save-default-changed", listener);
  },
  getAiPanelPrefs: () => electron.ipcRenderer.invoke("app:get-ai-panel-prefs"),
  setAiPanelPrefs: (patch) => electron.ipcRenderer.invoke("app:set-ai-panel-prefs", patch),
  onAiPanelPrefsChanged: (handler) => {
    const listener = (_event, prefs) => handler(prefs);
    electron.ipcRenderer.on("app:ai-panel-prefs-changed", listener);
    return () => electron.ipcRenderer.removeListener("app:ai-panel-prefs-changed", listener);
  },
  onChromePressed: (handler) => {
    const listener = () => handler();
    electron.ipcRenderer.on("app:chrome-pressed", listener);
    return () => electron.ipcRenderer.removeListener("app:chrome-pressed", listener);
  },
  zoteroCommand: (command) => electron.ipcRenderer.invoke("zotero:command", command),
  onZoteroRequest: (handler) => {
    const listener = (_event, request) => handler(request);
    electron.ipcRenderer.on("zotero:request", listener);
    return () => electron.ipcRenderer.removeListener("zotero:request", listener);
  },
  respondToZotero: (response) => electron.ipcRenderer.send("zotero:response", response),
  openDocx: () => electron.ipcRenderer.invoke("docs:open"),
  openDocxPath: (path) => electron.ipcRenderer.invoke("docs:open-path", path),
  convertAltChunkHtml: (html) => electron.ipcRenderer.invoke("docs:altchunk-html-to-docx", html),
  openDocxDecrypt: (path, password) => electron.ipcRenderer.invoke("docs:open-decrypt", path, password),
  setDocPassword: (filePath, password) => electron.ipcRenderer.invoke("docs:set-password", filePath, password),
  docPasswordIntentRevision: async () => {
    const revision = await electron.ipcRenderer.invoke("docs:password-intent-revision");
    return typeof revision === "number" && Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
  },
  discardDocPasswordIntents: (throughRevision) => electron.ipcRenderer.invoke("docs:discard-password-intents", throughRevision),
  consumePendingOpenDocx: () => electron.ipcRenderer.invoke("docs:consume-pending-open"),
  consumeNewBlankDoc: () => electron.ipcRenderer.invoke("docs:consume-new-blank"),
  consumeAiDocContent: () => electron.ipcRenderer.invoke("docs:consume-ai-doc-content"),
  consumeHeadlessExport: () => electron.ipcRenderer.invoke("docs:consume-headless-export"),
  headlessExportDone: (result) => electron.ipcRenderer.send("docs:headless-export-done", result),
  createDocument: (request) => electron.ipcRenderer.invoke("docs:create-document", request),
  onOpenDocx: (handler) => {
    const listener = (_event, result) => handler(result);
    electron.ipcRenderer.on("docs:opened", listener);
    return () => electron.ipcRenderer.removeListener("docs:opened", listener);
  },
  onRenamedDocx: (handler) => {
    const listener = (_event, paths) => handler(paths);
    electron.ipcRenderer.on("docs:renamed", listener);
    return () => electron.ipcRenderer.removeListener("docs:renamed", listener);
  },
  saveDocx: (path, data, auto) => electron.ipcRenderer.invoke("docs:save", path, data, auto === true),
  writeRecoveryCopy: (path, data) => electron.ipcRenderer.invoke("docs:write-recovery", path, data),
  onTeardown: (handler) => {
    const listener = () => handler();
    electron.ipcRenderer.on("docs:teardown", listener);
    return () => electron.ipcRenderer.removeListener("docs:teardown", listener);
  },
  respellKick: () => electron.ipcRenderer.invoke("docs:respell-kick"),
  spellDiag: (line) => electron.ipcRenderer.send("docs:spell-diag", line),
  saveDocxAs: (defaultName, data, sourcePath) => electron.ipcRenderer.invoke("docs:save-as", defaultName, data, sourcePath ?? null),
  saveDocxNew: (defaultName, data) => electron.ipcRenderer.invoke("docs:save-new", defaultName, data),
  saveDocxTo: (path, data, overwrite) => electron.ipcRenderer.invoke("docs:save-to", path, data, overwrite === true),
  onMcpCommand: (handler) => {
    const listener = (_event, message) => handler(message);
    electron.ipcRenderer.on("docs:mcp-command", listener);
    return () => electron.ipcRenderer.removeListener("docs:mcp-command", listener);
  },
  reportMcpResult: (result) => electron.ipcRenderer.send("docs:mcp-result", result),
  signalMcpReady: () => electron.ipcRenderer.send("docs:mcp-ready"),
  getRecentFiles: () => electron.ipcRenderer.invoke("docs:recent"),
  pickImage: () => electron.ipcRenderer.invoke("docs:pick-image"),
  fontMetrics: (family) => electron.ipcRenderer.invoke("docs:font-metrics", family),
  print: (scale) => electron.ipcRenderer.invoke("docs:print", scale),
  exportPdf: (defaultName, pageWidthTwips, pageHeightTwips, outPath, scale) => electron.ipcRenderer.invoke(
    "docs:export-pdf",
    defaultName,
    pageWidthTwips,
    pageHeightTwips,
    outPath,
    scale
  ),
  exportHtml: (defaultName, html, outPath) => electron.ipcRenderer.invoke("docs:export-html", defaultName, html, outPath),
  printPdfBuffer: (pageWidthTwips, pageHeightTwips, scale) => electron.ipcRenderer.invoke("docs:print-pdf-buffer", pageWidthTwips, pageHeightTwips, scale),
  saveMergedPdf: (defaultName, base64Parts, outPath) => electron.ipcRenderer.invoke("docs:save-merged-pdf", defaultName, base64Parts, outPath),
  pickExportImagesTarget: () => electron.ipcRenderer.invoke("docs:pick-export-images-target"),
  takeExportPdf: (pdfPath) => electron.ipcRenderer.invoke("docs:take-export-pdf", pdfPath),
  writeExportImage: (dir, fileName, pngBase64) => electron.ipcRenderer.invoke("docs:write-export-image", dir, fileName, pngBase64),
  saveImageAs: (src) => electron.ipcRenderer.invoke("docs:save-image-as", src),
  onViewImage: (handler) => {
    const listener = (_event, src) => handler(src);
    electron.ipcRenderer.on(VIEW_IMAGE_CHANNEL, listener);
    return () => electron.ipcRenderer.removeListener(VIEW_IMAGE_CHANNEL, listener);
  },
  getAiSettings: () => electron.ipcRenderer.invoke("ai:get-settings"),
  setAiSettings: (settings) => electron.ipcRenderer.invoke("ai:set-settings", settings),
  aiChat: (request) => electron.ipcRenderer.invoke("ai:chat", request),
  aiStream: (request) => electron.ipcRenderer.invoke("ai:stream", request),
  aiStreamCancel: (requestId) => electron.ipcRenderer.invoke("ai:stream-cancel", requestId),
  aiGskStatus: (withEmail) => electron.ipcRenderer.invoke("ai:gsk-status", withEmail),
  aiGskLogin: () => electron.ipcRenderer.invoke("ai:gsk-login"),
  webSearch: (query, maxResults) => electron.ipcRenderer.invoke("ai:web-search", query, maxResults),
  imageSearch: (query, maxResults) => electron.ipcRenderer.invoke("ai:image-search", query, maxResults),
  fetchImage: (url) => electron.ipcRenderer.invoke("ai:fetch-image", url),
  aiGenerateImage: (op) => electron.ipcRenderer.invoke("docs:ai-generate-image", op),
  pickAttachments: () => electron.ipcRenderer.invoke("files:pick"),
  addAttachmentPaths: (paths) => electron.ipcRenderer.invoke("files:add", paths),
  addPastedImage: (data, ext) => electron.ipcRenderer.invoke("files:add-pasted-image", data, ext),
  copyImageToClipboard: (dataUrl, metaJson) => electron.ipcRenderer.invoke("docs:copy-image-to-clipboard", dataUrl, metaJson),
  readAttachment: (path, offset, maxChars) => electron.ipcRenderer.invoke("files:read", path, offset, maxChars),
  readAttachmentImage: (path) => electron.ipcRenderer.invoke("files:read-image", path),
  getPathForFile: (file) => electron.webUtils.getPathForFile(file),
  openNewTab: (openPath) => electron.ipcRenderer.invoke("win:new", openPath ?? null),
  listDocsTabs: () => electron.ipcRenderer.invoke("win:list"),
  focusDocsTab: (id) => electron.ipcRenderer.invoke("win:focus", id),
  onAiStream: (handler) => {
    const listener = (_event, chunk) => handler(chunk);
    electron.ipcRenderer.on("ai:stream-chunk", listener);
    return () => electron.ipcRenderer.removeListener("ai:stream-chunk", listener);
  },
  onMenuCommand: (handler) => {
    const listener = (_event, command, payload) => handler(command, payload);
    electron.ipcRenderer.on("menu:command", listener);
    return () => electron.ipcRenderer.removeListener("menu:command", listener);
  },
  onCloseCheck: (handler) => {
    const listener = () => handler();
    electron.ipcRenderer.on("docs:close-check", listener);
    return () => electron.ipcRenderer.removeListener("docs:close-check", listener);
  },
  reportViewMenuState: (state) => electron.ipcRenderer.send("docs:view-menu-state", {
    aiSidebar: state?.aiSidebar === true,
    darkCanvas: state?.darkCanvas === true
  }),
  reportCloseCheck: (state) => electron.ipcRenderer.send("docs:close-check-result", {
    dirty: state?.dirty === true,
    autoSave: state?.autoSave === true,
    filePath: typeof state?.filePath === "string" ? state.filePath : null
  }),
  onCloseSaveRequest: (handler) => {
    const listener = () => handler();
    electron.ipcRenderer.on("docs:close-save-request", listener);
    return () => electron.ipcRenderer.removeListener("docs:close-save-request", listener);
  },
  reportCloseSaveResult: (ok) => electron.ipcRenderer.send("docs:close-save-result", ok === true)
};
const projectApi = {
  resolveChat: (args) => electron.ipcRenderer.invoke("project:resolveChat", args),
  appendChat: (args) => electron.ipcRenderer.invoke("project:appendChat", args),
  loadChat: (args) => electron.ipcRenderer.invoke("project:loadChat", args),
  rebindChat: (args) => electron.ipcRenderer.invoke("project:rebindChat", args)
};
electron.contextBridge.exposeInMainWorld("desktop", api);
electron.contextBridge.exposeInMainWorld("projectApi", projectApi);
installDropOpenBridge();
