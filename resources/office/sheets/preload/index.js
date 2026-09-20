"use strict";
const electron = require("electron");
const MAX_SAVE_EDITS = 1e6;
const MAX_SAVE_EDITS_TOTAL = 1e7;
const SAVE_EDITS_CHUNK_JSON_MAX = 256e6;
const MAX_CSV_EXPORT_CHARS = 64e6;
const MAX_CREATE_DOCUMENT_TITLE_CHARS = 200;
const MAX_CREATE_DOCUMENT_CONTENT_CHARS = 2e6;
const MAX_PDF_TEMPLATE_CHARS = 12e6;
const HEADER_FOOTER_PICTURE_POSITION = /^[LCR][HF](EVEN|FIRST)?$/;
const IPC_CHANNELS = {
  selectWorkbook: "workbook:select",
  /** Multi-file picker + sidecar sessions for merging into the current workbook */
  selectWorkbooksForMerge: "workbook:select-for-merge",
  /** Open explicit paths (chat attachments) as merge-source sessions — no dialog */
  openWorkbooksForMerge: "workbook:open-for-merge",
  readWorkbookRange: "workbook:read-range",
  readWorkbookFormulas: "workbook:read-formulas",
  recalcWorkbook: "workbook:recalc",
  readWorkbookMedia: "workbook:read-media",
  readPivotDefinition: "workbook:read-pivot-definition",
  readLocalImage: "shell:read-local-image",
  closeWorkbook: "workbook:close",
  saveWorkbook: "workbook:save",
  /** Chunked upload of a large save's cell edits, consumed by the next save */
  saveEditsBegin: "workbook:save-edits-begin",
  saveEditsChunk: "workbook:save-edits-chunk",
  saveEditsAbort: "workbook:save-edits-abort",
  /** Crash-recovery copy of a dirty workbook, written under userData */
  writeWorkbookRecovery: "workbook:write-recovery",
  /** Main found a newer recovery copy while opening; renderer shows the styled prompt */
  recoveryPrompt: "workbook:recovery-prompt",
  recoveryPromptReply: "workbook:recovery-prompt-reply",
  autoRenameWorkbook: "workbook:auto-rename",
  workbookRenamed: "workbook:renamed",
  pendingEditsChanged: "workbook:pending-edits",
  closeSaveRequest: "workbook:close-save-request",
  closeSaveResult: "workbook:close-save-result",
  exportPdf: "workbook:export-pdf",
  printWorkbook: "workbook:print",
  exportCsv: "workbook:export-csv",
  csvSaveConfirm: "workbook:csv-save-confirm",
  /** AI create_document: new standalone file in the default folder (no dialog) */
  createDocument: "workbook:create-document",
  openExternal: "shell:open-external",
  menuAction: "menu:action",
  aiGetSettings: "ai:get-settings",
  aiSetSettings: "ai:set-settings",
  aiChat: "ai:chat",
  aiStream: "ai:stream",
  aiStreamCancel: "ai:stream-cancel",
  aiStreamChunk: "ai:stream-chunk",
  aiGskStatus: "ai:gsk-status",
  aiGskLogin: "ai:gsk-login",
  aiImageSearch: "ai:image-search",
  aiFetchImage: "ai:fetch-image",
  // sheets: prefix — slides' ai:generate-image only registers once a slides view exists
  aiGenerateImage: "sheets:ai-generate-image",
  // MCP visible-grid bridge: shell pushes one command, the renderer that owns
  // the Univer workbook executes it with the built-in AI's executors
  mcpCommand: "sheets:mcp-command",
  mcpResult: "sheets:mcp-result",
  mcpReady: "sheets:mcp-ready",
  // Chat attachments (sheets: prefix — docs already registers global files:* in
  // the shell; avoids collisions)
  captureScreenSources: "sheets:capture-screen-sources",
  captureScreenSource: "sheets:capture-screen-source",
  filesPick: "sheets:files-pick",
  filesAdd: "sheets:files-add",
  filesAddPastedImage: "sheets:files-add-pasted-image",
  filesRead: "sheets:files-read",
  filesReadImage: "sheets:files-read-image"
};
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
const desktopApi = {
  getLanguage: () => electron.ipcRenderer.invoke("app:get-language"),
  onLanguageChanged(handler) {
    const listener = (_event, lang) => handler(lang);
    electron.ipcRenderer.on("app:language-changed", listener);
    return () => electron.ipcRenderer.removeListener("app:language-changed", listener);
  },
  getTheme: () => electron.ipcRenderer.invoke("app:get-theme"),
  onThemeChanged(handler) {
    const listener = (_event, theme) => handler(theme);
    electron.ipcRenderer.on("app:theme-changed", listener);
    return () => electron.ipcRenderer.removeListener("app:theme-changed", listener);
  },
  getAutoSaveDefault: () => electron.ipcRenderer.invoke("app:get-auto-save-default"),
  onAutoSaveDefaultChanged(handler) {
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
  onChromePressed(handler) {
    const listener = () => handler();
    electron.ipcRenderer.on("app:chrome-pressed", listener);
    return () => electron.ipcRenderer.removeListener("app:chrome-pressed", listener);
  },
  async selectWorkbook() {
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.selectWorkbook);
    return result === null ? null : parseWorkbookFile(result);
  },
  async selectWorkbooksForMerge() {
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.selectWorkbooksForMerge);
    if (result === null) return null;
    if (!Array.isArray(result)) throw new Error("Invalid merge selection result.");
    return result.map((file) => parseWorkbookFile(file));
  },
  async openWorkbooksForMerge(paths) {
    if (!Array.isArray(paths) || paths.some((p) => typeof p !== "string")) {
      throw new Error("Invalid merge paths.");
    }
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.openWorkbooksForMerge, paths);
    if (result === null) return null;
    if (!Array.isArray(result)) throw new Error("Invalid merge open result.");
    return result.map((file) => parseWorkbookFile(file));
  },
  async readWorkbookRange(request) {
    const validatedRequest = parseRangeRequest(request);
    const result = await electron.ipcRenderer.invoke(
      IPC_CHANNELS.readWorkbookRange,
      validatedRequest
    );
    return parseRangeResult(result);
  },
  async readWorkbookFormulas(request) {
    const validatedRequest = parseFormulaCellsRequest(request);
    const result = await electron.ipcRenderer.invoke(
      IPC_CHANNELS.readWorkbookFormulas,
      validatedRequest
    );
    return parseFormulaCellsResult(result);
  },
  async recalcWorkbook(request) {
    const validatedRequest = parseRecalcRequest(request);
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.recalcWorkbook, validatedRequest);
    return parseRecalcResult(result);
  },
  async readWorkbookMedia(request) {
    const validatedRequest = parseMediaRequest(request);
    const result = await electron.ipcRenderer.invoke(
      IPC_CHANNELS.readWorkbookMedia,
      validatedRequest
    );
    return parseMediaResult(result);
  },
  async readLocalImage(request) {
    if (!isRecord(request) || typeof request.path !== "string" || request.path.length === 0 || request.path.length > 1024) {
      throw new Error("Invalid local image request.");
    }
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.readLocalImage, request);
    if (!isRecord(result) || typeof result.mediaType !== "string" || !["image/png", "image/jpeg", "image/gif"].includes(result.mediaType) || typeof result.base64 !== "string" || result.base64.length === 0) {
      throw new Error("Invalid local image response.");
    }
    return result;
  },
  async captureScreenSources() {
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.captureScreenSources);
    if (!isRecord(result) || result.status !== "ok" && result.status !== "denied" || !Array.isArray(result.sources)) {
      throw new Error("Invalid screen sources response.");
    }
    return result;
  },
  async captureScreenSource(request) {
    if (!isRecord(request) || typeof request.id !== "string" || request.id.length === 0) {
      throw new Error("Invalid screen capture request.");
    }
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.captureScreenSource, {
      id: request.id
    });
    if (result === null) return null;
    if (!isRecord(result) || result.mediaType !== "image/png" || typeof result.base64 !== "string" || result.base64.length === 0 || typeof result.width !== "number" || typeof result.height !== "number") {
      throw new Error("Invalid screen capture response.");
    }
    return result;
  },
  async readPivotDefinition(request) {
    const validatedRequest = parsePivotRequest(request);
    const result = await electron.ipcRenderer.invoke(
      IPC_CHANNELS.readPivotDefinition,
      validatedRequest
    );
    return parsePivotDefinitionResult(result);
  },
  async saveWorkbookEdits(request) {
    const validatedRequest = parseSaveRequest(request);
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.saveWorkbook, validatedRequest);
    return parseSaveResult(result);
  },
  async beginSaveEditsTransfer(request) {
    if (!isRecord(request)) throw new Error("Invalid save transfer request.");
    if (!isUuid(request.sessionId)) throw new Error("Invalid save transfer session.");
    if (!isUuid(request.transferId)) throw new Error("Invalid save transfer id.");
    if (typeof request.total !== "number" || !Number.isInteger(request.total) || request.total <= 0 || request.total > MAX_SAVE_EDITS_TOTAL) {
      throw new Error(
        `Invalid save transfer size. (${String(request.total)} exceeds the ${MAX_SAVE_EDITS_TOTAL} limit)`
      );
    }
    await electron.ipcRenderer.invoke(IPC_CHANNELS.saveEditsBegin, {
      sessionId: request.sessionId,
      transferId: request.transferId,
      total: request.total
    });
  },
  async sendSaveEditsChunk(request) {
    if (!isRecord(request)) throw new Error("Invalid save transfer chunk.");
    if (!isUuid(request.sessionId)) throw new Error("Invalid save transfer session.");
    if (!isUuid(request.transferId)) throw new Error("Invalid save transfer id.");
    if (typeof request.seq !== "number" || !Number.isInteger(request.seq) || request.seq < 0)
      throw new Error("Invalid save transfer chunk index.");
    if (typeof request.editsJson !== "string" || request.editsJson.length < 2 || request.editsJson.length > SAVE_EDITS_CHUNK_JSON_MAX) {
      throw new Error("Invalid save transfer chunk edits.");
    }
    await electron.ipcRenderer.invoke(IPC_CHANNELS.saveEditsChunk, {
      sessionId: request.sessionId,
      transferId: request.transferId,
      seq: request.seq,
      editsJson: request.editsJson
    });
  },
  async abortSaveEditsTransfer(request) {
    if (!isRecord(request)) throw new Error("Invalid save transfer request.");
    if (!isUuid(request.sessionId)) throw new Error("Invalid save transfer session.");
    if (!isUuid(request.transferId)) throw new Error("Invalid save transfer id.");
    await electron.ipcRenderer.invoke(IPC_CHANNELS.saveEditsAbort, {
      sessionId: request.sessionId,
      transferId: request.transferId
    });
  },
  async writeWorkbookRecovery(request) {
    const validatedRequest = parseSaveRequest(request);
    const result = await electron.ipcRenderer.invoke(
      IPC_CHANNELS.writeWorkbookRecovery,
      validatedRequest
    );
    return { ok: result?.ok === true };
  },
  async autoRenameWorkbook(sessionId, baseName) {
    if (!isUuid(sessionId)) throw new Error("Invalid workbook session.");
    if (typeof baseName !== "string" || baseName.length === 0 || baseName.length > 100) {
      throw new Error("Invalid workbook name.");
    }
    const result = await electron.ipcRenderer.invoke(
      IPC_CHANNELS.autoRenameWorkbook,
      sessionId,
      baseName
    );
    if (!isRecord(result) || typeof result.renamed !== "boolean") {
      throw new Error("Invalid auto-rename response.");
    }
    return result;
  },
  async exportPdf(request) {
    if (!isPdfExportRequest(request)) throw new Error("Invalid PDF export request.");
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.exportPdf, request);
    if (!isRecord(result) || typeof result.canceled !== "boolean" || result.canceled === false && typeof result.path !== "string") {
      throw new Error("Invalid PDF export response.");
    }
    return result;
  },
  async printWorkbook(request) {
    if (!isPdfExportRequest(request)) throw new Error("Invalid print request.");
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.printWorkbook, request);
    if (!isRecord(result) || typeof result.ok !== "boolean" || result.error !== void 0 && typeof result.error !== "string") {
      throw new Error("Invalid print response.");
    }
    return result;
  },
  async exportCsv(request) {
    if (!isRecord(request) || typeof request.fileName !== "string" || request.fileName.length === 0 || request.fileName.length > 255 || typeof request.content !== "string" || request.content.length > MAX_CSV_EXPORT_CHARS || typeof request.hasFormulas !== "boolean" || request.activeSheetName !== void 0 && (typeof request.activeSheetName !== "string" || request.activeSheetName.length > 255) || request.targetPath !== void 0 && (typeof request.targetPath !== "string" || request.targetPath.length === 0)) {
      throw new Error("Invalid CSV export request.");
    }
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.exportCsv, request);
    if (!isRecord(result) || typeof result.canceled !== "boolean" || result.canceled === false && typeof result.path !== "string" || result.canceled === true && result.saveAsXlsxInstead !== void 0 && typeof result.saveAsXlsxInstead !== "boolean") {
      throw new Error("Invalid CSV export response.");
    }
    return result;
  },
  async confirmCsvSave() {
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.csvSaveConfirm);
    if (result !== "csv" && result !== "xlsx" && result !== "cancel") {
      throw new Error("Invalid CSV save confirmation response.");
    }
    return result;
  },
  async createDocument(request) {
    if (!isRecord(request) || request.type !== "xlsx" && request.type !== "csv" && request.type !== "docx" && request.type !== "pdf" && request.type !== "md" || typeof request.title !== "string" || request.title.length === 0 || request.title.length > MAX_CREATE_DOCUMENT_TITLE_CHARS || typeof request.content !== "string" || request.content.length === 0 || request.content.length > (request.type === "xlsx" || request.type === "csv" ? MAX_CSV_EXPORT_CHARS : MAX_CREATE_DOCUMENT_CONTENT_CHARS) || request.sheetName !== void 0 && (typeof request.sheetName !== "string" || request.sheetName.length === 0 || request.sheetName.length > 31)) {
      throw new Error("Invalid create-document request.");
    }
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.createDocument, request);
    if (!isRecord(result) || typeof result.ok !== "boolean" || result.path !== void 0 && typeof result.path !== "string" || result.error !== void 0 && typeof result.error !== "string") {
      throw new Error("Invalid create-document response.");
    }
    return result;
  },
  async closeWorkbook(sessionId) {
    if (!isUuid(sessionId)) throw new Error("Invalid workbook session.");
    await electron.ipcRenderer.invoke(IPC_CHANNELS.closeWorkbook, sessionId);
  },
  async openExternal(url) {
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
      throw new Error("Only http(s) links can be opened.");
    }
    await electron.ipcRenderer.invoke(IPC_CHANNELS.openExternal, url);
  },
  onMenuAction(callback) {
    const listener = (_event, action) => {
      if (action === "open" || action === "save" || action === "save-as" || action === "print" || action === "export-pdf" || action === "export-csv" || action === "undo" || action === "redo")
        callback(action);
    };
    electron.ipcRenderer.on(IPC_CHANNELS.menuAction, listener);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.menuAction, listener);
  },
  onWorkbookRenamed(callback) {
    const listener = (_event, newName) => {
      if (typeof newName === "string" && newName) callback(newName);
    };
    electron.ipcRenderer.on(IPC_CHANNELS.workbookRenamed, listener);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.workbookRenamed, listener);
  },
  notifyPendingEdits(count) {
    if (typeof count !== "number" || !Number.isFinite(count) || count < 0) return;
    electron.ipcRenderer.send(IPC_CHANNELS.pendingEditsChanged, Math.floor(count));
  },
  onCloseSaveRequest(callback) {
    const listener = () => callback();
    electron.ipcRenderer.on(IPC_CHANNELS.closeSaveRequest, listener);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.closeSaveRequest, listener);
  },
  reportCloseSaveResult(ok) {
    electron.ipcRenderer.send(IPC_CHANNELS.closeSaveResult, ok === true);
  },
  onRecoveryPrompt(callback) {
    const listener = (_event, payload) => {
      if (isRecord(payload) && typeof payload.title === "string" && typeof payload.body === "string" && typeof payload.restoreLabel === "string" && typeof payload.discardLabel === "string" && typeof payload.fileName === "string" && typeof payload.savedAtMs === "number" && Number.isFinite(payload.savedAtMs)) {
        callback(payload);
      }
    };
    electron.ipcRenderer.on(IPC_CHANNELS.recoveryPrompt, listener);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.recoveryPrompt, listener);
  },
  replyRecoveryPrompt(restore) {
    electron.ipcRenderer.send(IPC_CHANNELS.recoveryPromptReply, restore === true);
  },
  async getAiSettings() {
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.aiGetSettings);
    if (!isRecord(result)) throw new Error("Invalid AI settings response.");
    return result;
  },
  async setAiSettings(settings) {
    await electron.ipcRenderer.invoke(IPC_CHANNELS.aiSetSettings, settings);
  },
  async aiChat(request) {
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.aiChat, request);
    if (!isRecord(result) || typeof result.ok !== "boolean") {
      throw new Error("Invalid AI chat response.");
    }
    return result;
  },
  async aiStream(request) {
    await electron.ipcRenderer.invoke(IPC_CHANNELS.aiStream, request);
  },
  async aiStreamCancel(requestId) {
    if (!requestId) throw new Error("Invalid AI stream request id.");
    await electron.ipcRenderer.invoke(IPC_CHANNELS.aiStreamCancel, requestId);
  },
  async aiGskStatus(withEmail) {
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.aiGskStatus, withEmail);
    if (!isRecord(result) || typeof result.loggedIn !== "boolean") {
      throw new Error("Invalid Genspark account status response.");
    }
    return result;
  },
  async aiGskLogin() {
    await electron.ipcRenderer.invoke(IPC_CHANNELS.aiGskLogin);
  },
  async webSearch(query, maxResults) {
    if (typeof query !== "string" || !query.trim() || query.length > 512) {
      throw new Error("Invalid search query.");
    }
    const result = await electron.ipcRenderer.invoke("ai:web-search", query, maxResults);
    if (!isRecord(result) || !Array.isArray(result.results) || typeof result.method !== "string") {
      throw new Error("Invalid web search response.");
    }
    return result;
  },
  async imageSearch(query, maxResults) {
    if (typeof query !== "string" || !query.trim() || query.length > 512) {
      throw new Error("Invalid search query.");
    }
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.aiImageSearch, query, maxResults);
    if (!isRecord(result) || !Array.isArray(result.images) || typeof result.method !== "string") {
      throw new Error("Invalid image search response.");
    }
    return result;
  },
  async generateImage(op) {
    if (!isRecord(op) || typeof op.prompt !== "string" || !op.prompt.trim()) {
      throw new Error("Invalid image generation request.");
    }
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.aiGenerateImage, op);
    if (!isRecord(result)) throw new Error("Invalid image generation response.");
    return result;
  },
  async fetchImage(url) {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url) || url.length > 2048) {
      throw new Error("Invalid image URL.");
    }
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.aiFetchImage, url);
    if (result === null) return null;
    if (!isRecord(result) || typeof result.base64 !== "string" || typeof result.mime !== "string") {
      throw new Error("Invalid image download response.");
    }
    return result;
  },
  onAiStream(callback) {
    const listener = (_event, chunk) => {
      if (isRecord(chunk) && typeof chunk.requestId === "string" && typeof chunk.type === "string") {
        callback(chunk);
      }
    };
    electron.ipcRenderer.on(IPC_CHANNELS.aiStreamChunk, listener);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.aiStreamChunk, listener);
  },
  async consumeNewBlankWorkbook() {
    const result = await electron.ipcRenderer.invoke("sheets:consume-new-blank");
    return result === true;
  },
  onMcpCommand(callback) {
    const listener = (_event, message) => {
      if (isRecord(message) && typeof message.requestId === "string" && typeof message.command === "string") {
        callback(message);
      }
    };
    electron.ipcRenderer.on(IPC_CHANNELS.mcpCommand, listener);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.mcpCommand, listener);
  },
  reportMcpResult(result) {
    if (!isRecord(result) || typeof result.requestId !== "string") return;
    electron.ipcRenderer.send(IPC_CHANNELS.mcpResult, result);
  },
  signalMcpReady() {
    electron.ipcRenderer.send(IPC_CHANNELS.mcpReady);
  },
  async hasQueuedWorkbook() {
    const result = await electron.ipcRenderer.invoke("sheets:has-queued-workbook");
    return result === true;
  },
  async consumeHeadlessExport() {
    const result = await electron.ipcRenderer.invoke("sheets:consume-headless-export");
    return typeof result === "string" ? result : null;
  },
  headlessExportDone(result) {
    electron.ipcRenderer.send("sheets:headless-export-done", {
      ok: result.ok === true,
      ...typeof result.error === "string" ? { error: result.error } : {}
    });
  },
  async pickAttachments() {
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.filesPick);
    return result === null ? null : parseAttachmentAddResult(result);
  },
  async addAttachmentPaths(paths) {
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > 50 || paths.some((p) => typeof p !== "string" || p.length === 0 || p.length > 1024)) {
      throw new Error("Invalid attachment paths.");
    }
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.filesAdd, paths);
    return parseAttachmentAddResult(result);
  },
  async addPastedImage(data, ext) {
    if (!(data instanceof ArrayBuffer) || data.byteLength === 0 || data.byteLength > 64 * 1024 * 1024) {
      throw new Error("Invalid pasted image data.");
    }
    if (typeof ext !== "string" || ext.length === 0 || ext.length > 8) {
      throw new Error("Invalid pasted image extension.");
    }
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.filesAddPastedImage, data, ext);
    return parseAttachmentAddResult(result);
  },
  async readAttachment(path, offset, maxChars) {
    if (typeof path !== "string" || path.length === 0 || path.length > 1024) {
      throw new Error("Invalid attachment path.");
    }
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.filesRead, path, offset, maxChars);
    if (!isRecord(result) || typeof result.ok !== "boolean" || !isOptionalString(result.error) || !isOptionalString(result.name) || !isOptionalString(result.text) || result.totalChars !== void 0 && !isNonnegativeInteger(result.totalChars) || result.offset !== void 0 && !isNonnegativeInteger(result.offset)) {
      throw new Error("Invalid attachment read response.");
    }
    const read = { ok: result.ok };
    if (result.error !== void 0) read.error = result.error;
    if (result.name !== void 0) read.name = result.name;
    if (result.text !== void 0) read.text = result.text;
    if (result.totalChars !== void 0) read.totalChars = result.totalChars;
    if (result.offset !== void 0) read.offset = result.offset;
    return read;
  },
  async readAttachmentImage(path) {
    if (typeof path !== "string" || path.length === 0 || path.length > 1024) {
      throw new Error("Invalid attachment path.");
    }
    const result = await electron.ipcRenderer.invoke(IPC_CHANNELS.filesReadImage, path);
    if (!isRecord(result) || typeof result.ok !== "boolean" || !isOptionalString(result.base64) || !isOptionalString(result.mime) || !isOptionalString(result.error)) {
      throw new Error("Invalid attachment image response.");
    }
    const image = { ok: result.ok };
    if (result.base64 !== void 0) image.base64 = result.base64;
    if (result.mime !== void 0) image.mime = result.mime;
    if (result.error !== void 0) image.error = result.error;
    return image;
  },
  getPathForFile(file) {
    return electron.webUtils.getPathForFile(file);
  }
};
function parseAttachmentAddResult(input) {
  if (!isRecord(input) || !Array.isArray(input.accepted) || input.accepted.length > 50 || !Array.isArray(input.rejected) || input.rejected.length > 50 || input.rejected.some((reason) => typeof reason !== "string")) {
    throw new Error("Invalid attachment response.");
  }
  const accepted = input.accepted.map((meta) => {
    if (!isRecord(meta) || typeof meta.path !== "string" || meta.path.length === 0 || typeof meta.name !== "string" || meta.name.length === 0 || typeof meta.ext !== "string" || !isNonnegativeInteger(meta.sizeBytes)) {
      throw new Error("Invalid attachment metadata.");
    }
    return { path: meta.path, name: meta.name, ext: meta.ext, sizeBytes: meta.sizeBytes };
  });
  return { accepted, rejected: input.rejected };
}
electron.contextBridge.exposeInMainWorld("desktopApi", desktopApi);
const projectApi = {
  resolveChat: (args) => electron.ipcRenderer.invoke("project:resolveChat", args),
  appendChat: (args) => electron.ipcRenderer.invoke("project:appendChat", args),
  loadChat: (args) => electron.ipcRenderer.invoke("project:loadChat", args),
  rebindChat: (args) => electron.ipcRenderer.invoke("project:rebindChat", args)
};
electron.contextBridge.exposeInMainWorld("projectApi", projectApi);
if (process.env.GENOFFICE_DEBUG_HOOKS === "1") {
  electron.contextBridge.exposeInMainWorld("__genofficeDebugHooks", true);
}
installDropOpenBridge();
function parseWorkbookFile(input) {
  if (!isRecord(input)) throw new Error("Invalid workbook response.");
  const {
    sessionId,
    name,
    path,
    sha256,
    fileBytes,
    entryCount,
    sheets,
    styles,
    dxfStyles,
    visuals,
    definedNames,
    readOnly,
    needsSaveAs,
    csvPath,
    restoredFromRecovery
  } = input;
  if (!isUuid(sessionId) || typeof name !== "string" || path !== void 0 && (typeof path !== "string" || path.length === 0) || typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256) || fileBytes !== void 0 && !isNonnegativeInteger(fileBytes) || !isNonnegativeInteger(entryCount) || !Array.isArray(sheets) || !Array.isArray(styles) || !Array.isArray(dxfStyles) || !Array.isArray(visuals) || !Array.isArray(definedNames) || typeof readOnly !== "boolean" || needsSaveAs !== void 0 && typeof needsSaveAs !== "boolean" || csvPath !== void 0 && (typeof csvPath !== "string" || csvPath.length === 0) || restoredFromRecovery !== void 0 && typeof restoredFromRecovery !== "boolean") {
    throw new Error("Invalid workbook response.");
  }
  const parsedDefinedNames = definedNames.map((entry) => {
    if (!isRecord(entry) || typeof entry.name !== "string" || entry.name.length === 0 || typeof entry.formula !== "string" || entry.formula.length === 0 || entry.sheetIndex !== void 0 && !isNonnegativeInteger(entry.sheetIndex)) {
      throw new Error("Invalid workbook defined name.");
    }
    return {
      name: entry.name,
      formula: entry.formula,
      ...entry.sheetIndex === void 0 ? {} : { sheetIndex: entry.sheetIndex }
    };
  });
  const parsedSheets = sheets.map((sheet) => {
    if (!isRecord(sheet) || typeof sheet.id !== "string" || typeof sheet.name !== "string" || !isPositiveInteger(sheet.rowCount) || !isPositiveInteger(sheet.columnCount) || !Array.isArray(sheet.columnWidths) || typeof sheet.hidden !== "boolean" || sheet.tabColor !== null && typeof sheet.tabColor !== "string" || typeof sheet.showGridLines !== "boolean" || !Array.isArray(sheet.tables) || !Array.isArray(sheet.comments) || !Array.isArray(sheet.pivotRanges) || sheet.pivotRanges.length > 1e3) {
      throw new Error("Invalid worksheet metadata.");
    }
    const tables = sheet.tables.map((table) => {
      if (!isRecord(table) || !isNonnegativeInteger(table.headerRowCount) || typeof table.showRowStripes !== "boolean" || typeof table.showColumnStripes !== "boolean" || table.filterActive !== void 0 && typeof table.filterActive !== "boolean" || !isOptionalString(table.styleName) || !isOptionalString(table.name) || table.columns !== void 0 && (!Array.isArray(table.columns) || table.columns.some((column) => typeof column !== "string")) || !isOptionalString(table.headerFill) || !isOptionalString(table.headerFontColor) || !isOptionalString(table.stripeFill) || !isOptionalString(table.secondRowStripeFill) || !isOptionalString(table.columnStripeFill) || !isOptionalString(table.secondColumnStripeFill) || !isOptionalString(table.wholeTableFill) || !isOptionalString(table.firstColumnFill) || !isOptionalString(table.lastColumnFill) || !isOptionalString(table.totalRowFill) || !isOptionalString(table.totalRowFontColor) || !isOptionalString(table.totalRowBorderColor) || !isOptionalString(table.totalRowBorderStyle) || !isOptionalString(table.bodyFontColor) || !isOptionalString(table.firstHeaderCellFontColor) || !isOptionalString(table.borderColor) || !isOptionalString(table.wholeTableBorderColor) || !isOptionalString(table.wholeTableBorderStyle) || !isOptionalString(table.innerHorizontalBorderColor) || !isOptionalString(table.innerHorizontalBorderStyle) || !isOptionalString(table.innerVerticalBorderColor) || !isOptionalString(table.innerVerticalBorderStyle) || !isOptionalString(table.headerBottomBorderColor) || !isOptionalString(table.headerBottomBorderStyle) || table.totalsRowCount !== void 0 && !isNonnegativeInteger(table.totalsRowCount)) {
        throw new Error("Invalid worksheet table.");
      }
      return {
        range: parseCellArea(table.range),
        headerRowCount: table.headerRowCount,
        showRowStripes: table.showRowStripes,
        showColumnStripes: table.showColumnStripes,
        ...table.filterActive === void 0 ? {} : { filterActive: table.filterActive },
        ...table.name === void 0 ? {} : { name: table.name },
        ...table.columns === void 0 ? {} : { columns: table.columns },
        ...table.styleName === void 0 ? {} : { styleName: table.styleName },
        ...table.headerFill === void 0 ? {} : { headerFill: table.headerFill },
        ...table.headerFontColor === void 0 ? {} : { headerFontColor: table.headerFontColor },
        ...table.stripeFill === void 0 ? {} : { stripeFill: table.stripeFill },
        ...table.secondRowStripeFill === void 0 ? {} : { secondRowStripeFill: table.secondRowStripeFill },
        ...table.columnStripeFill === void 0 ? {} : { columnStripeFill: table.columnStripeFill },
        ...table.secondColumnStripeFill === void 0 ? {} : { secondColumnStripeFill: table.secondColumnStripeFill },
        ...table.wholeTableFill === void 0 ? {} : { wholeTableFill: table.wholeTableFill },
        ...table.firstColumnFill === void 0 ? {} : { firstColumnFill: table.firstColumnFill },
        ...table.lastColumnFill === void 0 ? {} : { lastColumnFill: table.lastColumnFill },
        ...table.totalRowFill === void 0 ? {} : { totalRowFill: table.totalRowFill },
        ...table.totalRowFontColor === void 0 ? {} : { totalRowFontColor: table.totalRowFontColor },
        ...table.totalRowBorderColor === void 0 ? {} : { totalRowBorderColor: table.totalRowBorderColor },
        ...table.totalRowBorderStyle === void 0 ? {} : { totalRowBorderStyle: table.totalRowBorderStyle },
        ...table.bodyFontColor === void 0 ? {} : { bodyFontColor: table.bodyFontColor },
        ...table.firstHeaderCellFontColor === void 0 ? {} : { firstHeaderCellFontColor: table.firstHeaderCellFontColor },
        ...table.totalsRowCount === void 0 ? {} : { totalsRowCount: table.totalsRowCount },
        ...table.borderColor === void 0 ? {} : { borderColor: table.borderColor },
        ...table.wholeTableBorderColor === void 0 ? {} : { wholeTableBorderColor: table.wholeTableBorderColor },
        ...table.wholeTableBorderStyle === void 0 ? {} : { wholeTableBorderStyle: table.wholeTableBorderStyle },
        ...table.innerHorizontalBorderColor === void 0 ? {} : { innerHorizontalBorderColor: table.innerHorizontalBorderColor },
        ...table.innerHorizontalBorderStyle === void 0 ? {} : { innerHorizontalBorderStyle: table.innerHorizontalBorderStyle },
        ...table.innerVerticalBorderColor === void 0 ? {} : { innerVerticalBorderColor: table.innerVerticalBorderColor },
        ...table.innerVerticalBorderStyle === void 0 ? {} : { innerVerticalBorderStyle: table.innerVerticalBorderStyle },
        ...table.headerBottomBorderColor === void 0 ? {} : { headerBottomBorderColor: table.headerBottomBorderColor },
        ...table.headerBottomBorderStyle === void 0 ? {} : { headerBottomBorderStyle: table.headerBottomBorderStyle }
      };
    });
    const comments = sheet.comments.map((comment) => {
      if (!isRecord(comment) || !isNonnegativeInteger(comment.row) || !isNonnegativeInteger(comment.column) || typeof comment.author !== "string" || typeof comment.text !== "string") {
        throw new Error("Invalid worksheet comment.");
      }
      return {
        row: comment.row,
        column: comment.column,
        author: comment.author,
        text: comment.text
      };
    });
    const columnWidths = sheet.columnWidths.map((columnWidth) => {
      if (!isRecord(columnWidth) || !isNonnegativeInteger(columnWidth.startColumn) || !isNonnegativeInteger(columnWidth.endColumn) || columnWidth.startColumn > columnWidth.endColumn || columnWidth.width !== void 0 && (typeof columnWidth.width !== "number" || !Number.isFinite(columnWidth.width) || columnWidth.width < 0) || typeof columnWidth.hidden !== "boolean" || columnWidth.outlineLevel !== void 0 && (!isNonnegativeInteger(columnWidth.outlineLevel) || columnWidth.outlineLevel > 7) || columnWidth.collapsed !== void 0 && typeof columnWidth.collapsed !== "boolean" || columnWidth.styleIndex !== void 0 && (!isNonnegativeInteger(columnWidth.styleIndex) || columnWidth.styleIndex === 0)) {
        throw new Error("Invalid worksheet column width.");
      }
      return {
        startColumn: columnWidth.startColumn,
        endColumn: columnWidth.endColumn,
        hidden: columnWidth.hidden,
        ...columnWidth.width === void 0 ? {} : { width: columnWidth.width },
        ...columnWidth.outlineLevel === void 0 ? {} : { outlineLevel: columnWidth.outlineLevel },
        ...columnWidth.collapsed === void 0 ? {} : { collapsed: columnWidth.collapsed },
        ...columnWidth.styleIndex === void 0 ? {} : { styleIndex: columnWidth.styleIndex }
      };
    });
    return {
      id: sheet.id,
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      // The renderer's oversized-sheet write gate needs this; omitting it
      // silently disables the gate (older sidecars don't report it).
      ...isPositiveInteger(sheet.sourceXmlBytes) ? { sourceXmlBytes: sheet.sourceXmlBytes } : {},
      columnWidths,
      // Degrade instead of rejecting the workbook: 0 / malformed defaults
      // mean "use the built-in size".
      defaultRowHeight: normalizedDefaultSize(sheet.defaultRowHeight),
      ...sheet.defaultRowHeightFixed === true ? { defaultRowHeightFixed: true } : {},
      defaultColumnWidth: normalizedDefaultSize(sheet.defaultColumnWidth),
      baseColumnWidth: normalizedDefaultSize(sheet.baseColumnWidth),
      freeze: parseFreeze(sheet.freeze),
      hidden: sheet.hidden,
      tabColor: sheet.tabColor,
      showGridLines: sheet.showGridLines,
      showFormulas: sheet.showFormulas === true,
      showRowColHeaders: sheet.showRowColHeaders !== false,
      rightToLeft: sheet.rightToLeft === true,
      ...typeof sheet.zoomScale === "number" && Number.isInteger(sheet.zoomScale) && sheet.zoomScale >= 10 && sheet.zoomScale <= 400 ? { zoomScale: sheet.zoomScale } : {},
      tables,
      comments,
      pivotRanges: sheet.pivotRanges.map(parseCellArea),
      pivotTables: parsePivotTableInfos(sheet.pivotTables ?? []),
      sparklines: parseSparklineGroups(sheet.sparklines ?? []),
      cellImages: parseCellImages(sheet.cellImages ?? []),
      ...isBoundedString(sheet.printArea, 2e3) ? { printArea: sheet.printArea } : {},
      ...isBoundedString(sheet.printTitles, 2e3) ? { printTitles: sheet.printTitles } : {},
      ...sheet.hasScopedDefinedNames === true ? { hasScopedDefinedNames: true } : {}
    };
  });
  if (parsedSheets.length === 0) throw new Error("Workbook contains no worksheets.");
  const { themeColors, themeFonts, workbookProtection } = input;
  if (themeColors !== void 0 && (!Array.isArray(themeColors) || themeColors.length !== 12 || themeColors.some((color) => typeof color !== "string"))) {
    throw new Error("Invalid workbook theme palette response.");
  }
  let parsedThemeFonts;
  if (themeFonts !== void 0) {
    if (!isRecord(themeFonts) || typeof themeFonts.major !== "string" || typeof themeFonts.minor !== "string") {
      throw new Error("Invalid workbook theme fonts response.");
    }
    parsedThemeFonts = {
      major: themeFonts.major,
      minor: themeFonts.minor,
      ...typeof themeFonts.minorEa === "string" ? { minorEa: themeFonts.minorEa } : {}
    };
  }
  let parsedWorkbookProtection;
  if (workbookProtection !== void 0) {
    if (!isRecord(workbookProtection) || typeof workbookProtection.lockStructure !== "boolean" || typeof workbookProtection.hasPassword !== "boolean") {
      throw new Error("Invalid workbook protection response.");
    }
    parsedWorkbookProtection = {
      lockStructure: workbookProtection.lockStructure,
      hasPassword: workbookProtection.hasPassword
    };
  }
  const activeTab = isNonnegativeInteger(input.activeTab) ? input.activeTab : 0;
  const date1904 = input.date1904 === true;
  const shortDateFormat = typeof input.shortDateFormat === "string" ? input.shortDateFormat : void 0;
  return {
    sessionId,
    name,
    ...path === void 0 ? {} : { path },
    sha256,
    ...fileBytes === void 0 ? {} : { fileBytes },
    entryCount,
    sheets: parsedSheets,
    activeTab,
    styles: styles.map(parseCellStyle),
    dxfStyles: dxfStyles.map(parseCellStyle),
    visuals: visuals.map(parseVisualObject),
    definedNames: parsedDefinedNames,
    readOnly,
    ...needsSaveAs === void 0 ? {} : { needsSaveAs },
    ...csvPath === void 0 ? {} : { csvPath },
    ...restoredFromRecovery === void 0 ? {} : { restoredFromRecovery },
    ...themeColors === void 0 ? {} : { themeColors },
    ...parsedThemeFonts === void 0 ? {} : { themeFonts: parsedThemeFonts },
    ...typeof input.normalFontName === "string" && input.normalFontName !== "" ? { normalFontName: input.normalFontName } : {},
    ...parsedWorkbookProtection === void 0 ? {} : { workbookProtection: parsedWorkbookProtection },
    ...date1904 ? { date1904 } : {},
    ...shortDateFormat === void 0 ? {} : { shortDateFormat }
  };
}
function parseRangeRequest(input) {
  if (!isRecord(input) || !isUuid(input.sessionId) || typeof input.sheetId !== "string" || !isRecord(input.range)) {
    throw new Error("Invalid workbook range request.");
  }
  const { startRow, endRow, startColumn, endColumn } = input.range;
  if (!isNonnegativeInteger(startRow) || !isNonnegativeInteger(endRow) || !isNonnegativeInteger(startColumn) || !isNonnegativeInteger(endColumn) || startRow > endRow || startColumn > endColumn || (endRow - startRow + 1) * (endColumn - startColumn + 1) > 1e5) {
    throw new Error("Invalid workbook range request.");
  }
  return input;
}
function parseCellRecord(cell) {
  if (!isRecord(cell) || !isNonnegativeInteger(cell.row) || !isNonnegativeInteger(cell.column) || !isCellScalar(cell.value) || cell.formula !== void 0 && typeof cell.formula !== "string" || cell.arrayRef !== void 0 && (typeof cell.arrayRef !== "string" || cell.arrayRef.length > 64) || cell.styleIndex !== void 0 && !isNonnegativeInteger(cell.styleIndex)) {
    throw new Error("Invalid workbook cell response.");
  }
  const rich = cell.rich === void 0 ? void 0 : parseRichRuns(cell.rich);
  return {
    row: cell.row,
    column: cell.column,
    value: cell.value,
    ...cell.formula === void 0 ? {} : { formula: cell.formula },
    ...cell.arrayRef === void 0 ? {} : { arrayRef: cell.arrayRef },
    ...cell.styleIndex === void 0 ? {} : { styleIndex: cell.styleIndex },
    ...rich === void 0 ? {} : { rich }
  };
}
function parseFormulaCellsRequest(input) {
  if (!isRecord(input) || !isUuid(input.sessionId) || typeof input.sheetId !== "string" || input.sheetId.length === 0) {
    throw new Error("Invalid formula-cells request.");
  }
  return { sessionId: input.sessionId, sheetId: input.sheetId };
}
function parseFormulaCellsResult(input) {
  if (!isRecord(input) || !Array.isArray(input.cells) || input.cells.length > 1e5 || typeof input.indexingComplete !== "boolean" || typeof input.truncated !== "boolean") {
    throw new Error("Invalid formula-cells response.");
  }
  return {
    cells: input.cells.map(parseCellRecord),
    indexingComplete: input.indexingComplete,
    truncated: input.truncated
  };
}
function parseRecalcRequest(input) {
  if (!isRecord(input) || !isUuid(input.sessionId) || !Array.isArray(input.edits) || input.edits.length > 1e4 || !Array.isArray(input.reads) || input.reads.length > 200) {
    throw new Error("Invalid workbook recalc request.");
  }
  let readCells = 0;
  const reads = input.reads.map((read) => {
    if (!isRecord(read) || typeof read.sheetId !== "string" || read.sheetId.length === 0) {
      throw new Error("Invalid workbook recalc request.");
    }
    const range = read.range;
    if (!isRecord(range) || !isNonnegativeInteger(range.startRow) || !isNonnegativeInteger(range.endRow) || !isNonnegativeInteger(range.startColumn) || !isNonnegativeInteger(range.endColumn) || range.startRow > range.endRow || range.startColumn > range.endColumn) {
      throw new Error("Invalid workbook recalc request.");
    }
    readCells += (range.endRow - range.startRow + 1) * (range.endColumn - range.startColumn + 1);
    return {
      sheetId: read.sheetId,
      range: {
        startRow: range.startRow,
        endRow: range.endRow,
        startColumn: range.startColumn,
        endColumn: range.endColumn
      }
    };
  });
  if (readCells > 2e4) throw new Error("Invalid workbook recalc request.");
  const edits = input.edits.map((edit) => {
    if (!isRecord(edit) || typeof edit.sheetId !== "string" || edit.sheetId.length === 0 || !isNonnegativeInteger(edit.row) || edit.row > 1048575 || !isNonnegativeInteger(edit.column) || edit.column > 16383 || typeof edit.input !== "string" || edit.input.length > 32767) {
      throw new Error("Invalid workbook recalc request.");
    }
    return { sheetId: edit.sheetId, row: edit.row, column: edit.column, input: edit.input };
  });
  return { sessionId: input.sessionId, edits, reads };
}
function parseRecalcResult(input) {
  if (!isRecord(input) || !Array.isArray(input.cells) || input.cells.length > 2e4) {
    throw new Error("Invalid workbook recalc response.");
  }
  const cells = input.cells.map((cell) => {
    if (!isRecord(cell) || typeof cell.sheetId !== "string" || cell.sheetId.length === 0 || !isNonnegativeInteger(cell.row) || !isNonnegativeInteger(cell.column) || typeof cell.formatted !== "string" || cell.number !== void 0 && (typeof cell.number !== "number" || !Number.isFinite(cell.number)) || cell.isError !== void 0 && typeof cell.isError !== "boolean" || typeof cell.isFormula !== "boolean") {
      throw new Error("Invalid workbook recalc response.");
    }
    return {
      sheetId: cell.sheetId,
      row: cell.row,
      column: cell.column,
      formatted: cell.formatted,
      ...cell.number === void 0 ? {} : { number: cell.number },
      ...cell.isError ? { isError: true } : {},
      isFormula: cell.isFormula
    };
  });
  return { cells };
}
function parseRangeResult(input) {
  if (!isRecord(input) || !Array.isArray(input.cells) || input.cells.length > 1e5 || !Array.isArray(input.rows) || input.rows.length > 1e5 || !Array.isArray(input.merges) || input.merges.length > 1e5 || !Array.isArray(input.hyperlinks) || input.hyperlinks.length > 1e5 || !Array.isArray(input.conditionalRules) || input.conditionalRules.length > 1e5 || input.indexedThroughRow !== null && !isNonnegativeInteger(input.indexedThroughRow) || typeof input.indexingComplete !== "boolean") {
    throw new Error("Invalid workbook range response.");
  }
  const cells = input.cells.map(parseCellRecord);
  const rows = input.rows.map((row) => {
    if (!isRecord(row) || !isNonnegativeInteger(row.row) || row.height !== void 0 && (typeof row.height !== "number" || !Number.isFinite(row.height) || row.height < 0) || typeof row.hidden !== "boolean" || row.outlineLevel !== void 0 && (!isNonnegativeInteger(row.outlineLevel) || row.outlineLevel > 7) || row.collapsed !== void 0 && typeof row.collapsed !== "boolean" || row.customHeight !== void 0 && typeof row.customHeight !== "boolean" || row.styleIndex !== void 0 && (!isNonnegativeInteger(row.styleIndex) || row.styleIndex === 0)) {
      throw new Error("Invalid workbook row response.");
    }
    return {
      row: row.row,
      hidden: row.hidden,
      ...row.height === void 0 ? {} : { height: row.height },
      ...row.customHeight === void 0 ? {} : { customHeight: row.customHeight },
      ...row.outlineLevel === void 0 ? {} : { outlineLevel: row.outlineLevel },
      ...row.collapsed === void 0 ? {} : { collapsed: row.collapsed },
      ...row.styleIndex === void 0 ? {} : { styleIndex: row.styleIndex }
    };
  });
  const merges = input.merges.map((merge) => {
    if (!isRecord(merge) || !isNonnegativeInteger(merge.startRow) || !isNonnegativeInteger(merge.startColumn) || !isNonnegativeInteger(merge.endRow) || !isNonnegativeInteger(merge.endColumn) || merge.startRow > merge.endRow || merge.startColumn > merge.endColumn) {
      throw new Error("Invalid workbook merge response.");
    }
    return {
      startRow: merge.startRow,
      startColumn: merge.startColumn,
      endRow: merge.endRow,
      endColumn: merge.endColumn
    };
  });
  const hyperlinks = input.hyperlinks.map((link) => {
    if (!isRecord(link) || !isNonnegativeInteger(link.row) || !isNonnegativeInteger(link.column) || typeof link.target !== "string") {
      throw new Error("Invalid workbook hyperlink response.");
    }
    return { row: link.row, column: link.column, target: link.target };
  });
  const conditionalRules = input.conditionalRules.map(parseConditionalRule);
  if (!Array.isArray(input.dataValidations) || input.dataValidations.length > 2e4 || input.autoFilter !== null && !isRecord(input.autoFilter) || !Array.isArray(input.autoFilterColumns) || input.autoFilterColumns.length > 1e3) {
    throw new Error("Invalid workbook range response.");
  }
  const autoFilterColumns = input.autoFilterColumns.map(parseAutoFilterColumn);
  const dataValidations = input.dataValidations.map((rule) => {
    if (!isRecord(rule) || !Array.isArray(rule.ranges) || typeof rule.ruleType !== "string" || !isOptionalString(rule.operator) || !Array.isArray(rule.formulas) || rule.formulas.some((formula) => typeof formula !== "string") || typeof rule.allowBlank !== "boolean" || typeof rule.suppressDropdown !== "boolean" || typeof rule.showInputMessage !== "boolean" || typeof rule.showErrorMessage !== "boolean" || !isOptionalString(rule.errorStyle) || !isOptionalString(rule.errorTitle) || !isOptionalString(rule.error) || !isOptionalString(rule.promptTitle) || !isOptionalString(rule.prompt)) {
      throw new Error("Invalid workbook data validation.");
    }
    return {
      ranges: rule.ranges.map(parseCellArea),
      ruleType: rule.ruleType,
      formulas: rule.formulas,
      allowBlank: rule.allowBlank,
      suppressDropdown: rule.suppressDropdown,
      showInputMessage: rule.showInputMessage,
      showErrorMessage: rule.showErrorMessage,
      ...rule.operator === void 0 ? {} : { operator: rule.operator },
      ...rule.errorStyle === void 0 ? {} : { errorStyle: rule.errorStyle },
      ...rule.errorTitle === void 0 ? {} : { errorTitle: rule.errorTitle },
      ...rule.error === void 0 ? {} : { error: rule.error },
      ...rule.promptTitle === void 0 ? {} : { promptTitle: rule.promptTitle },
      ...rule.prompt === void 0 ? {} : { prompt: rule.prompt }
    };
  });
  let sheetProtection = null;
  if (input.sheetProtection !== null && input.sheetProtection !== void 0) {
    const protection = input.sheetProtection;
    if (!isRecord(protection) || typeof protection.protected !== "boolean" || typeof protection.hasPassword !== "boolean") {
      throw new Error("Invalid workbook sheet protection.");
    }
    sheetProtection = { protected: protection.protected, hasPassword: protection.hasPassword };
  }
  const parseBreaks = (value, label) => {
    if (!Array.isArray(value) || value.length > 1024 || !value.every(isNonnegativeInteger)) {
      throw new Error(`Invalid workbook ${label} response.`);
    }
    return value;
  };
  if (!Array.isArray(input.protectedRanges) || input.protectedRanges.length > 1024) {
    throw new Error("Invalid workbook protected ranges response.");
  }
  const protectedRanges = input.protectedRanges.map((range) => {
    if (!isRecord(range) || typeof range.name !== "string" || range.name === "" || typeof range.sqref !== "string" || range.sqref === "" || typeof range.hasPassword !== "boolean") {
      throw new Error("Invalid workbook protected range response.");
    }
    return { name: range.name, sqref: range.sqref, hasPassword: range.hasPassword };
  });
  return {
    cells,
    rows,
    merges,
    hyperlinks,
    conditionalRules,
    autoFilter: input.autoFilter === null ? null : parseCellArea(input.autoFilter),
    autoFilterColumns,
    dataValidations,
    sheetProtection,
    rowBreaks: parseBreaks(input.rowBreaks, "row breaks"),
    colBreaks: parseBreaks(input.colBreaks, "column breaks"),
    protectedRanges,
    pageSetup: parsePagePrintSettings(input.pageSetup),
    indexedThroughRow: input.indexedThroughRow,
    indexingComplete: input.indexingComplete
  };
}
function parsePagePrintSettings(input) {
  if (input === null || input === void 0) return null;
  const boundedInt = (value, min, max) => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
  if (!isRecord(input) || input.orientation !== void 0 && input.orientation !== "portrait" && input.orientation !== "landscape" || input.paperSize !== void 0 && !boundedInt(input.paperSize, 1, 256) || input.scale !== void 0 && !boundedInt(input.scale, 10, 400) || input.fitToWidth !== void 0 && !boundedInt(input.fitToWidth, 0, 32767) || input.fitToHeight !== void 0 && !boundedInt(input.fitToHeight, 0, 32767) || input.fitToPage !== void 0 && typeof input.fitToPage !== "boolean" || input.printGridlines !== void 0 && typeof input.printGridlines !== "boolean" || input.printHeadings !== void 0 && typeof input.printHeadings !== "boolean" || input.oddHeader !== void 0 && !isBoundedString(input.oddHeader, 500) || input.oddFooter !== void 0 && !isBoundedString(input.oddFooter, 500) || input.differentOddEven !== void 0 && typeof input.differentOddEven !== "boolean" || input.differentFirst !== void 0 && typeof input.differentFirst !== "boolean" || input.headerFooterFixedSize !== void 0 && typeof input.headerFooterFixedSize !== "boolean" || input.evenHeader !== void 0 && !isBoundedString(input.evenHeader, 500) || input.evenFooter !== void 0 && !isBoundedString(input.evenFooter, 500) || input.firstHeader !== void 0 && !isBoundedString(input.firstHeader, 500) || input.firstFooter !== void 0 && !isBoundedString(input.firstFooter, 500) || input.headerFooterPictures !== void 0 && !isHeaderFooterPictureList(input.headerFooterPictures)) {
    throw new Error("Invalid workbook page setup response.");
  }
  let margins;
  if (input.margins !== void 0) {
    const record = input.margins;
    if (!isRecord(record) || !["left", "right", "top", "bottom", "header", "footer"].every((edge) => {
      const value = record[edge];
      return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10;
    })) {
      throw new Error("Invalid workbook page margins response.");
    }
    margins = {
      left: record.left,
      right: record.right,
      top: record.top,
      bottom: record.bottom,
      header: record.header,
      footer: record.footer
    };
  }
  const validated = input;
  return {
    ...validated.orientation === void 0 ? {} : { orientation: validated.orientation },
    ...validated.paperSize === void 0 ? {} : { paperSize: validated.paperSize },
    ...validated.scale === void 0 ? {} : { scale: validated.scale },
    ...validated.fitToWidth === void 0 ? {} : { fitToWidth: validated.fitToWidth },
    ...validated.fitToHeight === void 0 ? {} : { fitToHeight: validated.fitToHeight },
    ...validated.fitToPage === void 0 ? {} : { fitToPage: validated.fitToPage },
    ...margins === void 0 ? {} : { margins },
    ...validated.printGridlines === void 0 ? {} : { printGridlines: validated.printGridlines },
    ...validated.printHeadings === void 0 ? {} : { printHeadings: validated.printHeadings },
    ...validated.oddHeader === void 0 ? {} : { oddHeader: validated.oddHeader },
    ...validated.oddFooter === void 0 ? {} : { oddFooter: validated.oddFooter },
    ...validated.differentOddEven === void 0 ? {} : { differentOddEven: validated.differentOddEven },
    ...validated.differentFirst === void 0 ? {} : { differentFirst: validated.differentFirst },
    ...validated.headerFooterFixedSize === void 0 ? {} : { headerFooterFixedSize: validated.headerFooterFixedSize },
    ...validated.evenHeader === void 0 ? {} : { evenHeader: validated.evenHeader },
    ...validated.evenFooter === void 0 ? {} : { evenFooter: validated.evenFooter },
    ...validated.firstHeader === void 0 ? {} : { firstHeader: validated.firstHeader },
    ...validated.firstFooter === void 0 ? {} : { firstFooter: validated.firstFooter },
    ...validated.headerFooterPictures === void 0 ? {} : {
      headerFooterPictures: validated.headerFooterPictures.map((picture) => ({
        id: picture.id,
        position: picture.position,
        widthPt: picture.widthPt,
        heightPt: picture.heightPt,
        mediaType: picture.mediaType
      }))
    }
  };
}
function isHeaderFooterPictureList(input) {
  return Array.isArray(input) && input.length <= 18 && input.every(
    (picture) => isRecord(picture) && isBoundedString(picture.id, 64) && typeof picture.position === "string" && HEADER_FOOTER_PICTURE_POSITION.test(picture.position) && typeof picture.widthPt === "number" && picture.widthPt > 0 && picture.widthPt <= 2e3 && typeof picture.heightPt === "number" && picture.heightPt > 0 && picture.heightPt <= 2e3 && typeof picture.mediaType === "string" && /^image\//.test(picture.mediaType)
  );
}
function parseRichRuns(input) {
  if (!Array.isArray(input)) throw new Error("Invalid workbook rich text response.");
  return input.map((run) => {
    if (!isRecord(run) || typeof run.text !== "string" || typeof run.bold !== "boolean" || typeof run.italic !== "boolean" || typeof run.underline !== "boolean" || typeof run.strikethrough !== "boolean" || !isOptionalString(run.color) || run.size !== void 0 && (typeof run.size !== "number" || !Number.isFinite(run.size) || run.size <= 0) || !isOptionalString(run.family) || run.vertAlign !== void 0 && run.vertAlign !== "subscript" && run.vertAlign !== "superscript") {
      throw new Error("Invalid workbook rich text response.");
    }
    return {
      text: run.text,
      bold: run.bold,
      italic: run.italic,
      underline: run.underline,
      strikethrough: run.strikethrough,
      ...run.color === void 0 ? {} : { color: run.color },
      ...run.size === void 0 ? {} : { size: run.size },
      ...run.family === void 0 ? {} : { family: run.family },
      ...run.vertAlign === void 0 ? {} : { vertAlign: run.vertAlign }
    };
  });
}
function parseCellArea(input) {
  if (!isRecord(input) || !isNonnegativeInteger(input.startRow) || !isNonnegativeInteger(input.startColumn) || !isNonnegativeInteger(input.endRow) || !isNonnegativeInteger(input.endColumn) || input.startRow > input.endRow || input.startColumn > input.endColumn) {
    throw new Error("Invalid workbook cell area.");
  }
  return {
    startRow: input.startRow,
    startColumn: input.startColumn,
    endRow: input.endRow,
    endColumn: input.endColumn
  };
}
const CUSTOM_FILTER_OPERATORS = /* @__PURE__ */ new Set([
  "equal",
  "notEqual",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual"
]);
function parseAutoFilterColumn(input) {
  if (!isRecord(input) || !isNonnegativeInteger(input.colId) || input.colId > 16383 || input.values !== void 0 && (!Array.isArray(input.values) || input.values.length > 1e4 || input.values.some((value) => typeof value !== "string" || value.length > 32767)) || input.blank !== void 0 && typeof input.blank !== "boolean") {
    throw new Error("Invalid workbook filter column.");
  }
  let customs;
  if (input.customs !== void 0) {
    const raw = input.customs;
    if (!isRecord(raw) || raw.and !== void 0 && typeof raw.and !== "boolean" || !Array.isArray(raw.filters) || raw.filters.length < 1 || raw.filters.length > 2) {
      throw new Error("Invalid workbook filter column.");
    }
    const filters = [];
    for (const custom of raw.filters) {
      if (!isRecord(custom) || typeof custom.val !== "string" || custom.val.length > 32767) {
        throw new Error("Invalid workbook filter column.");
      }
      if (custom.operator !== void 0 && typeof custom.operator !== "string") {
        throw new Error("Invalid workbook filter column.");
      }
      if (custom.operator !== void 0 && !CUSTOM_FILTER_OPERATORS.has(custom.operator)) {
        filters.length = 0;
        break;
      }
      filters.push({
        val: custom.val,
        ...custom.operator === void 0 ? {} : { operator: custom.operator }
      });
    }
    if (filters.length > 0) {
      customs = { ...raw.and === true ? { and: true } : {}, filters };
    }
  }
  return {
    colId: input.colId,
    ...input.values === void 0 ? {} : { values: input.values },
    ...input.blank === true ? { blank: true } : {},
    ...customs === void 0 ? {} : { customs }
  };
}
function parseConditionalRule(input) {
  if (!isRecord(input) || !Array.isArray(input.ranges) || typeof input.ruleType !== "string" || !isOptionalString(input.operator) || !Array.isArray(input.formulas) || input.formulas.some((formula) => typeof formula !== "string") || !isOptionalString(input.text) || input.dxfIndex !== void 0 && !isNonnegativeInteger(input.dxfIndex) || typeof input.priority !== "number" || !Number.isInteger(input.priority) || input.stopIfTrue !== void 0 && typeof input.stopIfTrue !== "boolean" || input.rank !== void 0 && !isNonnegativeInteger(input.rank) || typeof input.percent !== "boolean" || typeof input.bottom !== "boolean" || !Array.isArray(input.cfvos) || !Array.isArray(input.colors) || input.colors.some((color) => typeof color !== "string")) {
    throw new Error("Invalid workbook conditional rule.");
  }
  const cfvos = input.cfvos.map((cfvo) => {
    if (!isRecord(cfvo) || typeof cfvo.kind !== "string" || !isOptionalString(cfvo.value) || cfvo.gte !== void 0 && typeof cfvo.gte !== "boolean") {
      throw new Error("Invalid workbook conditional rule value.");
    }
    return {
      kind: cfvo.kind,
      ...cfvo.value === void 0 ? {} : { value: cfvo.value },
      ...cfvo.gte === void 0 ? {} : { gte: cfvo.gte }
    };
  });
  if (!isOptionalString(input.iconSetName) || typeof input.iconReverse !== "boolean" || typeof input.showValue !== "boolean" || !isOptionalString(input.negativeColor) || input.negativeSameAsPositive !== void 0 && typeof input.negativeSameAsPositive !== "boolean" || input.gradient !== void 0 && typeof input.gradient !== "boolean" || input.axisPosition !== void 0 && input.axisPosition !== "automatic" && input.axisPosition !== "middle" && input.axisPosition !== "none" || !isOptionalString(input.axisColor) || !isOptionalBarLength(input.minLength) || !isOptionalBarLength(input.maxLength)) {
    throw new Error("Invalid workbook conditional rule.");
  }
  return {
    ranges: input.ranges.map(parseCellArea),
    ruleType: input.ruleType,
    formulas: input.formulas,
    priority: input.priority,
    percent: input.percent,
    bottom: input.bottom,
    cfvos,
    colors: input.colors,
    iconReverse: input.iconReverse,
    showValue: input.showValue,
    ...input.iconSetName === void 0 ? {} : { iconSetName: input.iconSetName },
    ...input.operator === void 0 ? {} : { operator: input.operator },
    ...input.text === void 0 ? {} : { text: input.text },
    ...input.dxfIndex === void 0 ? {} : { dxfIndex: input.dxfIndex },
    ...input.stopIfTrue === void 0 ? {} : { stopIfTrue: input.stopIfTrue },
    ...input.rank === void 0 ? {} : { rank: input.rank },
    ...input.negativeColor === void 0 ? {} : { negativeColor: input.negativeColor },
    ...input.negativeSameAsPositive === void 0 ? {} : { negativeSameAsPositive: input.negativeSameAsPositive },
    ...input.gradient === void 0 ? {} : { gradient: input.gradient },
    ...input.axisPosition === void 0 ? {} : { axisPosition: input.axisPosition },
    ...input.axisColor === void 0 ? {} : { axisColor: input.axisColor },
    ...input.minLength === void 0 ? {} : { minLength: input.minLength },
    ...input.maxLength === void 0 ? {} : { maxLength: input.maxLength }
  };
}
function isOptionalBarLength(value) {
  return value === void 0 || isNonnegativeInteger(value) && value <= 100;
}
function parseSaveRequest(input) {
  const invalid = (detail) => {
    throw new Error(`Invalid workbook save request. (${detail})`);
  };
  const cappedArray = (name, value, cap) => {
    if (!Array.isArray(value)) invalid(`${name}: not a list`);
    if (value.length > cap)
      invalid(`${name}: ${value.length} entries exceeds the ${cap} limit`);
  };
  if (!isRecord(input)) invalid("malformed request");
  if (!isUuid(input.sessionId)) invalid("session id");
  if (input.mode !== "save" && input.mode !== "save-as") invalid("mode");
  if (input.restoreWriteBack !== void 0 && typeof input.restoreWriteBack !== "boolean")
    invalid("restore flag");
  if (input.targetPath !== void 0 && (typeof input.targetPath !== "string" || input.targetPath.length === 0 || input.targetPath.length > 1024))
    invalid("target path");
  if (input.overwrite !== void 0 && typeof input.overwrite !== "boolean")
    invalid("overwrite flag");
  if (input.csvContent !== void 0 && (typeof input.csvContent !== "string" || input.csvContent.length > MAX_CSV_EXPORT_CHARS))
    invalid("csv content");
  if (input.editsTransferId !== void 0 && !isUuid(input.editsTransferId))
    invalid("edits transfer id");
  cappedArray("cell edits", input.edits, MAX_SAVE_EDITS);
  if (input.editsTransferId !== void 0 && input.edits.length > 0)
    invalid("cell edits: inline edits mixed with a transfer");
  cappedArray("bulk constant fills", input.bulkConstantFills ?? [], 1e3);
  cappedArray("structural operations", input.structuralOps, 1e3);
  cappedArray("chart edits", input.chartEdits, 100);
  cappedArray("visual edits", input.visualEdits, 100);
  cappedArray("visual additions", input.visualAdditions, 100);
  cappedArray("table additions", input.tableAdditions, 50);
  cappedArray("pivot additions", input.pivotAdditions, 20);
  cappedArray("sheet operations", input.sheetOps, 100);
  cappedArray("sheet order", input.sheetOrder, 1e3);
  if (input.sheetOrder.some((sheetId) => typeof sheetId !== "string" || sheetId.length === 0))
    invalid("sheet order: empty sheet id");
  cappedArray("filter states", input.filterStates, 1e3);
  cappedArray("hyperlink edits", input.hyperlinkEdits, 1e3);
  cappedArray("conditional-formatting states", input.cfStates, 1e3);
  cappedArray("data-validation states", input.dvStates, 1e3);
  cappedArray("page-setup states", input.pageSetupStates, 1e3);
  cappedArray("note states", input.noteStates, 1e3);
  cappedArray("pivot cache refreshes", input.pivotCacheRefreshPaths, 100);
  if (input.pivotCacheRefreshPaths.some((path) => typeof path !== "string"))
    invalid("pivot cache refreshes: non-string path");
  cappedArray("pivot refresh updates", input.pivotRefreshUpdates, 100);
  if (input.pivotRefreshUpdates.some(
    (update) => !isRecord(update) || typeof update.cachePath !== "string" || typeof update.sheetId !== "string" || update.sheetId.length === 0 || typeof update.newOutputRef !== "string" || update.newOutputRef.length > 64 || // relayout's full shape is authoritatively validated by main's zod schema.
    update.relayout !== void 0 && !isRecord(update.relayout)
  ))
    invalid("pivot refresh updates: malformed entry");
  cappedArray("sheet protections", input.sheetProtections, 1e3);
  if (input.sheetProtections.some(
    (state) => !isRecord(state) || typeof state.sheetId !== "string" || state.sheetId.length === 0 || typeof state.protected !== "boolean"
  ))
    invalid("sheet protections: malformed entry");
  if (!isDefinedNamesState(input.definedNamesState)) invalid("defined names");
  if (!isThemeState(input.themeState)) invalid("theme");
  if (input.workbookProtectionState !== null && (!isRecord(input.workbookProtectionState) || typeof input.workbookProtectionState.lockStructure !== "boolean"))
    invalid("workbook protection");
  cappedArray("protected-range states", input.protectedRangeStates, 1e3);
  if (input.protectedRangeStates.some(
    (state) => !isRecord(state) || typeof state.sheetId !== "string" || state.sheetId.length === 0 || !Array.isArray(state.ranges) || state.ranges.length > 1e3 || state.ranges.some(
      (range) => !isRecord(range) || typeof range.name !== "string" || range.name.length === 0 || range.name.length > 255 || typeof range.sqref !== "string" || range.sqref.length === 0 || range.sqref.length > 1024
    )
  ))
    invalid("protected-range states: malformed entry");
  if (input.mode !== "save-as" && input.restoreWriteBack !== true && input.editsTransferId === void 0 && input.edits.length === 0 && (input.bulkConstantFills?.length ?? 0) === 0 && input.structuralOps.length === 0 && input.chartEdits.length === 0 && input.visualEdits.length === 0 && input.visualAdditions.length === 0 && input.tableAdditions.length === 0 && input.pivotAdditions.length === 0 && (input.sparklineAdditions?.length ?? 0) === 0 && input.sheetOps.length === 0 && input.filterStates.length === 0 && input.hyperlinkEdits.length === 0 && input.cfStates.length === 0 && input.dvStates.length === 0 && input.pageSetupStates.length === 0 && input.noteStates.length === 0 && input.pivotCacheRefreshPaths.length === 0 && input.pivotRefreshUpdates.length === 0 && input.sheetProtections.length === 0 && input.definedNamesState === null && input.themeState === null && input.workbookProtectionState === null && input.protectedRangeStates.length === 0)
    invalid("no changes to save");
  if (input.sheetOps.length > 0 && input.sheetOrder.length === 0)
    invalid("sheet order missing for sheet operations");
  for (const state of input.dvStates) {
    if (!isRecord(state) || typeof state.sheetId !== "string" || state.sheetId.length === 0 || !Array.isArray(state.rules) || state.rules.length > 500) {
      throw new Error("Invalid workbook data-validation state.");
    }
    for (const rule of state.rules) {
      if (!isRecord(rule) || !isRecord(rule.rule) || !Array.isArray(rule.ranges) || rule.ranges.length === 0 || rule.ranges.length > 100) {
        throw new Error("Invalid workbook data-validation rule.");
      }
      for (const range of rule.ranges) parseCellArea(range);
    }
  }
  for (const state of input.pageSetupStates) {
    if (!isPageSetupState(state)) throw new Error("Invalid workbook page-setup state.");
  }
  for (const table of input.tableAdditions) {
    if (!isRecord(table) || typeof table.sheetId !== "string" || table.sheetId.length === 0 || typeof table.name !== "string" || table.name.length === 0 || table.name.length > 255 || !Array.isArray(table.columnNames) || table.columnNames.length === 0 || table.columnNames.length > 1e3 || table.columnNames.some((name) => typeof name !== "string" || name.length > 255) || table.style !== void 0 && (typeof table.style !== "string" || !/^TableStyle(?:Light|Medium|Dark)[1-9][0-9]?$/.test(table.style)) || typeof table.bandedRows !== "boolean") {
      throw new Error("Invalid workbook table addition.");
    }
    parseCellArea(table.area);
  }
  for (const pivot of input.pivotAdditions) {
    if (!isRecord(pivot) || typeof pivot.sheetId !== "string" || pivot.sheetId.length === 0 || typeof pivot.sourceSheetId !== "string" || pivot.sourceSheetId.length === 0 || typeof pivot.name !== "string" || pivot.name.length === 0 || pivot.name.length > 255 || !Array.isArray(pivot.fieldNames) || pivot.fieldNames.length === 0 || pivot.fieldNames.length > 200 || pivot.fieldNames.some(
      (name) => typeof name !== "string" || name.length === 0 || name.length > 255
    ) || !Array.isArray(pivot.rowFieldIndices) || pivot.rowFieldIndices.length === 0 || pivot.rowFieldIndices.length > 8 || pivot.rowFieldIndices.some((i) => !isNonnegativeInteger(i)) || pivot.rowLevelItems !== void 0 && (!Array.isArray(pivot.rowLevelItems) || pivot.rowLevelItems.length > 8 || pivot.rowLevelItems.some(
      (level) => !Array.isArray(level) || level.length > 1e4 || level.some((item) => typeof item !== "string" || item.length > 255)
    )) || pivot.rowLines !== void 0 && (!Array.isArray(pivot.rowLines) || pivot.rowLines.length > 2e4 || pivot.rowLines.some(
      (line) => !isRecord(line) || !["data", "default"].includes(String(line.t)) || !Array.isArray(line.members) || line.members.length === 0 || line.members.length > 8 || line.members.some((member) => !isNonnegativeInteger(member))
    )) || pivot.columnFieldIndex !== void 0 && !isNonnegativeInteger(pivot.columnFieldIndex) || pivot.pageFieldIndices !== void 0 && (!Array.isArray(pivot.pageFieldIndices) || pivot.pageFieldIndices.length > 4 || pivot.pageFieldIndices.some((i) => !isNonnegativeInteger(i))) || !Array.isArray(pivot.rowItems) || pivot.rowItems.length === 0 || pivot.rowItems.length > 1e4 || pivot.rowItems.some((item) => typeof item !== "string" || item.length > 255) || pivot.columnItems !== void 0 && (!Array.isArray(pivot.columnItems) || pivot.columnItems.length > 1e3 || pivot.columnItems.some((item) => typeof item !== "string" || item.length > 255)) || !Array.isArray(pivot.values) || pivot.values.length === 0 || pivot.values.length > 8 || pivot.values.some(
      (value) => !isRecord(value) || !isNonnegativeInteger(value.fieldIndex) || !["sum", "count", "average", "max", "min"].includes(String(value.agg)) || value.showDataAs !== void 0 && !["percentOfTotal", "percentOfRow", "percentOfCol"].includes(String(value.showDataAs))
    )) {
      throw new Error("Invalid workbook pivot addition.");
    }
    parseCellArea(pivot.sourceArea);
    parseCellArea(pivot.location);
  }
  for (const state of input.cfStates) {
    if (!isRecord(state) || typeof state.sheetId !== "string" || state.sheetId.length === 0 || !Array.isArray(state.rules) || state.rules.length > 500) {
      throw new Error("Invalid workbook conditional-formatting state.");
    }
    for (const rule of state.rules) {
      if (!isRecord(rule) || typeof rule.stopIfTrue !== "boolean" || !isRecord(rule.rule) || !Array.isArray(rule.ranges) || rule.ranges.length === 0 || rule.ranges.length > 100) {
        throw new Error("Invalid workbook conditional-formatting rule.");
      }
      for (const range of rule.ranges) parseCellArea(range);
    }
  }
  for (const link of input.hyperlinkEdits) {
    if (!isRecord(link) || typeof link.sheetId !== "string" || link.sheetId.length === 0 || !isNonnegativeInteger(link.row) || !isNonnegativeInteger(link.column) || link.target !== null && (typeof link.target !== "string" || link.target.length === 0 || link.target.length > 2083)) {
      throw new Error("Invalid workbook hyperlink edit.");
    }
  }
  for (const state of input.filterStates) {
    if (!isRecord(state) || typeof state.sheetId !== "string" || state.sheetId.length === 0 || !Array.isArray(state.hiddenRows) || state.hiddenRows.length > 1e5 || state.hiddenRows.some((row) => !isNonnegativeInteger(row))) {
      throw new Error("Invalid workbook filter state.");
    }
    parseCellArea(state.visibilityRange);
    if (state.filter === null) continue;
    if (!isRecord(state.filter) || !Array.isArray(state.filter.columns) || state.filter.columns.length > 1e3) {
      throw new Error("Invalid workbook filter state.");
    }
    parseCellArea(state.filter.range);
    for (const column of state.filter.columns) {
      if (!isFilterColumn(column)) throw new Error("Invalid workbook filter column.");
    }
  }
  for (const op of input.sheetOps) {
    if (!isRecord(op)) throw new Error("Invalid workbook sheet operation.");
    if (op.kind === "reorder-sheets") continue;
    if (typeof op.sheetId !== "string" || op.sheetId.length === 0) {
      throw new Error("Invalid workbook sheet operation.");
    }
    if (op.kind === "rename-sheet") {
      if (!isSheetName(op.newName)) throw new Error("Invalid workbook sheet operation.");
    } else if (op.kind === "add-sheet") {
      if (!isSheetName(op.name)) throw new Error("Invalid workbook sheet operation.");
    } else if (op.kind === "duplicate-sheet") {
      if (!isSheetName(op.name) || typeof op.sourceSheetId !== "string" || op.sourceSheetId.length === 0) {
        throw new Error("Invalid workbook sheet operation.");
      }
    } else if (op.kind === "set-sheet-hidden") {
      if (typeof op.hidden !== "boolean") throw new Error("Invalid workbook sheet operation.");
    } else if (op.kind !== "remove-sheet") {
      throw new Error("Invalid workbook sheet operation.");
    }
  }
  for (const chartEdit of input.chartEdits) {
    if (!isRecord(chartEdit) || typeof chartEdit.chartPath !== "string" || !/^xl\/charts\/[A-Za-z0-9._-]+\.xml$/.test(chartEdit.chartPath) || chartEdit.title !== void 0 && (typeof chartEdit.title !== "string" || chartEdit.title.length > 255) || chartEdit.chartType !== void 0 && !["column", "bar", "line", "area"].includes(String(chartEdit.chartType)) || chartEdit.seriesColors !== void 0 && !isSeriesColors(chartEdit.seriesColors)) {
      throw new Error("Invalid workbook chart edit.");
    }
  }
  for (const visualEdit of input.visualEdits) {
    if (!isRecord(visualEdit) || typeof visualEdit.drawingPath !== "string" || !/^xl\/drawings\/[A-Za-z0-9._/-]+\.xml$/.test(visualEdit.drawingPath) || !isNonnegativeInteger(visualEdit.drawingIndex) || visualEdit.drawingIndex > 1e4 || visualEdit.remove !== void 0 && visualEdit.remove !== true || visualEdit.remove === void 0 && !isRecord(visualEdit.anchor)) {
      throw new Error("Invalid workbook visual edit.");
    }
    if (visualEdit.anchor !== void 0) {
      if (!isRecord(visualEdit.anchor)) throw new Error("Invalid workbook visual edit.");
      parseDrawingAnchor(visualEdit.anchor);
    }
  }
  for (const op of input.structuralOps) {
    if (!isRecord(op) || typeof op.sheetId !== "string" || op.sheetId.length === 0) {
      throw new Error("Invalid workbook structural operation.");
    }
    if ("range" in op) {
      if (op.kind !== "merge-cells" && op.kind !== "unmerge-cells") {
        throw new Error("Invalid workbook structural operation.");
      }
      parseCellArea(op.range);
      continue;
    }
    if ("style" in op) {
      const { start, end } = op;
      if (op.kind !== "set-col-style" || !isNonnegativeInteger(start) || !isNonnegativeInteger(end) || end < start || end - start >= 1e5 || !isRecord(op.style) || Object.keys(op.style).length === 0) {
        throw new Error("Invalid workbook structural operation.");
      }
      continue;
    }
    if ("size" in op || "hidden" in op || "level" in op) {
      const { start, end } = op;
      if (!isNonnegativeInteger(start) || !isNonnegativeInteger(end) || end < start || end - start >= 1e5) {
        throw new Error("Invalid workbook structural operation.");
      }
      if ("size" in op) {
        if (op.kind !== "set-row-size" && op.kind !== "set-col-size" || op.size !== null && (typeof op.size !== "number" || !Number.isFinite(op.size) || op.size <= 0 || op.size > 500)) {
          throw new Error("Invalid workbook structural operation.");
        }
      } else if ("level" in op) {
        if (op.kind !== "set-rows-outline" && op.kind !== "set-cols-outline" || !isNonnegativeInteger(op.level) || op.level > 7 || op.collapsed !== void 0 && typeof op.collapsed !== "boolean") {
          throw new Error("Invalid workbook structural operation.");
        }
      } else if (op.kind !== "set-rows-hidden" && op.kind !== "set-cols-hidden" || typeof op.hidden !== "boolean") {
        throw new Error("Invalid workbook structural operation.");
      }
      continue;
    }
    const { index, count } = op;
    if ("before" in op) {
      if (op.kind !== "move-rows" || !isNonnegativeInteger(index) || !isNonnegativeInteger(count) || count === 0 || count > 1e4 || !isNonnegativeInteger(op.before) || op.before >= index && op.before <= index + count) {
        throw new Error("Invalid workbook structural operation.");
      }
      continue;
    }
    if (!["insert-rows", "remove-rows", "insert-cols", "remove-cols"].includes(String(op.kind)) || !isNonnegativeInteger(index) || !isNonnegativeInteger(count) || count === 0 || count > 1e4) {
      throw new Error("Invalid workbook structural operation.");
    }
  }
  for (const edit of input.edits) {
    if (!isRecord(edit) || typeof edit.sheetId !== "string" || edit.sheetId.length === 0 || !isNonnegativeInteger(edit.row) || !isNonnegativeInteger(edit.column) || typeof edit.writeValue !== "boolean" || !isCellScalar(edit.value) || edit.formula !== void 0 && (typeof edit.formula !== "string" || edit.formula.length === 0 || edit.formula.length > 8192) || edit.style !== void 0 && !isStyleEdit(edit.style) || edit.styleReset !== void 0 && typeof edit.styleReset !== "boolean" || !edit.writeValue && edit.style === void 0 && edit.styleReset !== true) {
      throw new Error("Invalid workbook cell edit.");
    }
    if (edit.rich !== void 0) parseRichRuns(edit.rich);
  }
  for (const fill of input.bulkConstantFills ?? []) {
    if (!isRecord(fill) || typeof fill.sheetId !== "string" || fill.sheetId.length === 0 || !isNonnegativeInteger(fill.startRow) || !isNonnegativeInteger(fill.endRow) || fill.endRow < fill.startRow || !isNonnegativeInteger(fill.startColumn) || !isNonnegativeInteger(fill.endColumn) || fill.endColumn < fill.startColumn || !isCellScalar(fill.value)) {
      invalid("bulk constant fills: malformed entry");
    }
  }
  return input;
}
const FILTER_OPERATORS = [
  "equal",
  "notEqual",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual"
];
function isFilterColumn(input) {
  if (!isRecord(input) || !isNonnegativeInteger(input.colId)) return false;
  if (input.values !== void 0 && (!Array.isArray(input.values) || input.values.length > 1e4 || // filter values are cell texts — cell cap, not a short-name cap
  input.values.some((value) => typeof value !== "string" || value.length > 32767))) {
    return false;
  }
  if (input.blank !== void 0 && typeof input.blank !== "boolean") return false;
  if (input.customs !== void 0) {
    if (!isRecord(input.customs)) return false;
    if (input.customs.and !== void 0 && typeof input.customs.and !== "boolean") return false;
    const filters = input.customs.filters;
    if (!Array.isArray(filters) || filters.length === 0 || filters.length > 2) return false;
    for (const custom of filters) {
      if (!isRecord(custom) || typeof custom.val !== "string" && typeof custom.val !== "number" || custom.operator !== void 0 && !FILTER_OPERATORS.includes(String(custom.operator))) {
        return false;
      }
    }
  }
  return input.values !== void 0 || input.blank !== void 0 || input.customs !== void 0;
}
function isPdfExportRequest(request) {
  return !(!isRecord(request) || typeof request.fileName !== "string" || request.fileName.length === 0 || request.fileName.length > 255 || typeof request.html !== "string" || request.html.length === 0 || request.html.length > 2e7 || typeof request.landscape !== "boolean" || !isPdfPageSize(request.pageSize) || !isRecord(request.margins) || !["top", "bottom", "left", "right"].every((edge) => {
    const value = request.margins[edge];
    return typeof value === "number" && value >= 0 && value <= 3;
  }) || typeof request.scale !== "number" || request.scale < 0.1 || request.scale > 2 || request.headerTemplate !== void 0 && !isBoundedString(request.headerTemplate, MAX_PDF_TEMPLATE_CHARS) || request.footerTemplate !== void 0 && !isBoundedString(request.footerTemplate, MAX_PDF_TEMPLATE_CHARS) || request.firstPage !== void 0 && !isPdfPageVariant(request.firstPage) || request.evenPages !== void 0 && !isPdfPageVariant(request.evenPages) || request.outPath !== void 0 && !isBoundedString(request.outPath, 4096));
}
function isPdfPageSize(input) {
  if (typeof input === "string") {
    return ["A3", "A4", "A5", "Legal", "Letter", "Tabloid"].includes(input);
  }
  return isRecord(input) && typeof input.width === "number" && input.width > 0 && input.width <= 100 && typeof input.height === "number" && input.height > 0 && input.height <= 100;
}
function isPdfPageVariant(input) {
  return isRecord(input) && Object.keys(input).every((key) => key === "headerTemplate" || key === "footerTemplate") && (input.headerTemplate === void 0 || isBoundedString(input.headerTemplate, MAX_PDF_TEMPLATE_CHARS)) && (input.footerTemplate === void 0 || isBoundedString(input.footerTemplate, MAX_PDF_TEMPLATE_CHARS));
}
function isPageSetupState(input) {
  if (!isRecord(input) || typeof input.sheetId !== "string" || input.sheetId.length === 0) {
    return false;
  }
  const isBoundedInt = (value, min, max) => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
  if (input.orientation !== void 0 && input.orientation !== "portrait" && input.orientation !== "landscape")
    return false;
  if (input.paperSize !== void 0 && !isBoundedInt(input.paperSize, 1, 118)) return false;
  if (input.scale !== void 0 && !isBoundedInt(input.scale, 10, 400)) return false;
  if (input.fitToWidth !== void 0 && !isBoundedInt(input.fitToWidth, 0, 1e3)) return false;
  if (input.fitToHeight !== void 0 && !isBoundedInt(input.fitToHeight, 0, 1e3)) return false;
  if (input.margins !== void 0 && !["normal", "wide", "narrow"].includes(String(input.margins)))
    return false;
  for (const key of [
    "printGridlines",
    "printHeadings",
    "showGridlines",
    "showFormulas",
    "showHeadings",
    "fitToPage"
  ]) {
    if (input[key] !== void 0 && typeof input[key] !== "boolean") return false;
  }
  if (input.printArea !== void 0 && input.printArea !== null && (typeof input.printArea !== "string" || input.printArea.length === 0 || input.printArea.length > 255))
    return false;
  if (input.printTitles !== void 0 && input.printTitles !== null && (typeof input.printTitles !== "string" || !/^\d{1,7}:\d{1,7}$/.test(input.printTitles)))
    return false;
  for (const [key, max] of [
    ["rowBreaks", 1048575],
    ["colBreaks", 16383]
  ]) {
    const breaks = input[key];
    if (breaks !== void 0 && (!Array.isArray(breaks) || breaks.length > 1023 || breaks.some((id) => !isBoundedInt(id, 1, max))))
      return false;
  }
  return Object.keys(input).length > 1;
}
function isSheetName(input) {
  return typeof input === "string" && input.length >= 1 && input.length <= 31 && !/[\\/?*[\]:]/.test(input) && !input.startsWith("'") && !input.endsWith("'");
}
function isSeriesColors(input) {
  if (!isRecord(input)) return false;
  return Object.entries(input).every(
    ([key, value]) => /^[0-9]{1,3}$/.test(key) && typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value)
  );
}
const BORDER_STYLE_NAMES = [
  "thin",
  "medium",
  "thick",
  "dashed",
  "dotted",
  "double",
  "hair",
  "dashDot",
  "dashDotDot",
  "mediumDashed",
  "mediumDashDot",
  "mediumDashDotDot",
  "slantDashDot"
];
function isStyleEdit(input) {
  if (!isRecord(input)) return false;
  const isHexColor = (value) => typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
  const isOptionalBoolean = (value) => value === void 0 || typeof value === "boolean";
  const isBorderEdge = (value) => value === void 0 || value === null || isRecord(value) && BORDER_STYLE_NAMES.includes(String(value.style)) && (value.color === void 0 || isHexColor(value.color)) && Object.keys(value).every((key) => ["style", "color"].includes(key));
  if (![input.borderTop, input.borderBottom, input.borderLeft, input.borderRight].every(isBorderEdge)) {
    return false;
  }
  return isOptionalBoolean(input.bold) && isOptionalBoolean(input.italic) && isOptionalBoolean(input.underline) && isOptionalBoolean(input.strikethrough) && isOptionalBoolean(input.wrapText) && (input.fontFamily === void 0 || typeof input.fontFamily === "string" && input.fontFamily.length > 0 && input.fontFamily.length <= 128) && (input.fontSize === void 0 || typeof input.fontSize === "number" && Number.isFinite(input.fontSize) && input.fontSize > 0 && input.fontSize <= 409) && (input.fontColor === void 0 || input.fontColor === null || isHexColor(input.fontColor)) && (input.fillColor === void 0 || input.fillColor === null || isHexColor(input.fillColor)) && (input.horizontalAlignment === void 0 || ["left", "center", "right", "justify", "distributed"].includes(
    String(input.horizontalAlignment)
  )) && (input.verticalAlignment === void 0 || ["top", "center", "bottom"].includes(String(input.verticalAlignment))) && (input.numberFormat === void 0 || typeof input.numberFormat === "string" && input.numberFormat.length > 0 && input.numberFormat.length <= 255) && (input.underlineStyle === void 0 || ["single", "double"].includes(String(input.underlineStyle))) && (input.textRotation === void 0 || typeof input.textRotation === "number" && Number.isInteger(input.textRotation) && (input.textRotation >= 0 && input.textRotation <= 180 || input.textRotation === 255)) && (input.indent === void 0 || typeof input.indent === "number" && Number.isInteger(input.indent) && input.indent >= 0 && input.indent <= 250) && isOptionalBoolean(input.protectionLocked) && isOptionalBoolean(input.protectionHidden) && Object.keys(input).every(
    (key) => [
      "bold",
      "italic",
      "underline",
      "underlineStyle",
      "strikethrough",
      "fontFamily",
      "fontSize",
      "fontColor",
      "fillColor",
      "horizontalAlignment",
      "verticalAlignment",
      "wrapText",
      "numberFormat",
      "textRotation",
      "indent",
      "protectionLocked",
      "protectionHidden",
      "borderTop",
      "borderBottom",
      "borderLeft",
      "borderRight"
    ].includes(key)
  );
}
function isThemeState(input) {
  if (input === null) return true;
  if (!isRecord(input)) return false;
  const { colors, fonts } = input;
  if (colors === void 0 && fonts === void 0) return false;
  if (colors !== void 0) {
    if (!isRecord(colors) || typeof colors.name !== "string" || colors.name.length === 0 || colors.name.length > 64 || !Array.isArray(colors.values) || colors.values.length !== 12 || colors.values.some((value) => typeof value !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(value)))
      return false;
  }
  if (fonts !== void 0) {
    if (!isRecord(fonts) || typeof fonts.name !== "string" || fonts.name.length === 0 || fonts.name.length > 64 || typeof fonts.major !== "string" || fonts.major.length === 0 || fonts.major.length > 128 || typeof fonts.minor !== "string" || fonts.minor.length === 0 || fonts.minor.length > 128)
      return false;
  }
  return true;
}
function isDefinedNamesState(input) {
  if (input === null) return true;
  if (!isRecord(input)) return false;
  const { names, preserveNames } = input;
  if (!Array.isArray(names) || names.length > 2e3 || !Array.isArray(preserveNames) || preserveNames.length > 2e3 || preserveNames.some((name) => typeof name !== "string" || name.length === 0)) {
    return false;
  }
  return names.every(
    (entry) => isRecord(entry) && typeof entry.name === "string" && entry.name.length >= 1 && entry.name.length <= 255 && typeof entry.formula === "string" && entry.formula.length >= 1 && entry.formula.length <= 8192 && (entry.sheetIndex === void 0 || isNonnegativeInteger(entry.sheetIndex))
  );
}
function parseSaveResult(input) {
  if (!isRecord(input)) throw new Error("Invalid workbook save response.");
  if (input.canceled === true) {
    if (input.csvSaveAsPath !== void 0) {
      if (typeof input.csvSaveAsPath !== "string" || input.csvSaveAsPath.length === 0) {
        throw new Error("Invalid workbook save response.");
      }
      return { canceled: true, csvSaveAsPath: input.csvSaveAsPath };
    }
    return { canceled: true };
  }
  if (input.canceled !== false || !Array.isArray(input.touchedEntries) || input.touchedEntries.length > 1e4 || input.touchedEntries.some((entry) => typeof entry !== "string")) {
    throw new Error("Invalid workbook save response.");
  }
  return {
    canceled: false,
    file: parseWorkbookFile(input.file),
    touchedEntries: input.touchedEntries
  };
}
function parseMediaRequest(input) {
  if (!isRecord(input) || !isUuid(input.sessionId) || typeof input.visualId !== "string") {
    throw new Error("Invalid workbook media request.");
  }
  return input;
}
function parseMediaResult(input) {
  if (!isRecord(input) || typeof input.mediaType !== "string" || !input.mediaType.startsWith("image/") || typeof input.base64 !== "string" || input.base64.length === 0) {
    throw new Error("Invalid workbook media response.");
  }
  return { mediaType: input.mediaType, base64: input.base64 };
}
function parseSparklineGroups(input) {
  if (!Array.isArray(input) || input.length > 100) {
    throw new Error("Invalid worksheet sparkline metadata.");
  }
  return input.map((entry) => {
    if (!isRecord(entry) || entry.type !== "line" && entry.type !== "column" && entry.type !== "stacked" || !Array.isArray(entry.cells) || entry.cells.length > 500 || entry.color !== void 0 && typeof entry.color !== "string" || entry.negativeColor !== void 0 && typeof entry.negativeColor !== "string") {
      throw new Error("Invalid worksheet sparkline metadata.");
    }
    return {
      type: entry.type,
      ...entry.color === void 0 ? {} : { color: entry.color },
      ...entry.negativeColor === void 0 ? {} : { negativeColor: entry.negativeColor },
      cells: entry.cells.map((cell) => {
        if (!isRecord(cell) || typeof cell.cell !== "string" || cell.cell.length < 2 || typeof cell.sourceRef !== "string" || cell.sourceRef.length === 0) {
          throw new Error("Invalid worksheet sparkline metadata.");
        }
        return { cell: cell.cell, sourceRef: cell.sourceRef };
      })
    };
  });
}
function parseCellImages(input) {
  if (!Array.isArray(input) || input.length > 500) {
    throw new Error("Invalid worksheet cell-image metadata.");
  }
  return input.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string" || entry.id.length === 0 || !isNonnegativeInteger(entry.row) || !isNonnegativeInteger(entry.column)) {
      throw new Error("Invalid worksheet cell-image metadata.");
    }
    return { id: entry.id, row: entry.row, column: entry.column };
  });
}
const PIVOT_PALETTE_COLOR_KEYS = [
  "headerFill",
  "headerFontColor",
  "firstHeaderCellFontColor",
  "wholeTableFill",
  "wholeTableFontColor",
  "stripeFill",
  "secondRowStripeFill",
  "columnStripeFill",
  "secondColumnStripeFill",
  "firstColumnFill",
  "subheadingFill",
  "subheadingFontColor",
  "subheading2Fill",
  "subheading2FontColor",
  "subtotalFill",
  "subtotalFontColor",
  "totalRowFill",
  "totalRowFontColor"
];
const PIVOT_PALETTE_BOLD_KEYS = [
  "headerBold",
  "firstHeaderCellBold",
  "firstColumnBold",
  "subheadingBold",
  "subheading2Bold",
  "subtotalBold",
  "totalRowBold"
];
function parsePivotTableInfos(input) {
  if (!Array.isArray(input) || input.length > 100) {
    throw new Error("Invalid worksheet pivot metadata.");
  }
  return input.map((entry) => {
    if (!isRecord(entry) || typeof entry.path !== "string" || entry.path.length === 0 || entry.cachePath !== null && typeof entry.cachePath !== "string" || typeof entry.outputRef !== "string" || entry.outputRef.length === 0 || PIVOT_PALETTE_COLOR_KEYS.some((key) => !isOptionalString(entry[key])) || PIVOT_PALETTE_BOLD_KEYS.some(
      (key) => entry[key] !== void 0 && typeof entry[key] !== "boolean"
    ) || entry.styled !== void 0 && typeof entry.styled !== "boolean" || entry.firstDataRow !== void 0 && !isNonnegativeInteger(entry.firstDataRow) || entry.firstDataCol !== void 0 && !isNonnegativeInteger(entry.firstDataCol) || entry.rowGrandTotals !== void 0 && typeof entry.rowGrandTotals !== "boolean" || entry.rowKinds !== void 0 && (typeof entry.rowKinds !== "string" || entry.rowKinds.length > 1048576 || !/^[dsStgb]*$/.test(entry.rowKinds))) {
      throw new Error("Invalid worksheet pivot metadata.");
    }
    const info = {
      path: entry.path,
      cachePath: entry.cachePath,
      outputRef: entry.outputRef,
      ...entry.styled === void 0 ? {} : { styled: entry.styled },
      ...entry.firstDataRow === void 0 ? {} : { firstDataRow: entry.firstDataRow },
      ...entry.firstDataCol === void 0 ? {} : { firstDataCol: entry.firstDataCol },
      ...entry.rowGrandTotals === void 0 ? {} : { rowGrandTotals: entry.rowGrandTotals },
      ...entry.rowKinds === void 0 ? {} : { rowKinds: entry.rowKinds }
    };
    for (const key of PIVOT_PALETTE_COLOR_KEYS) {
      const value = entry[key];
      if (typeof value === "string") info[key] = value;
    }
    for (const key of PIVOT_PALETTE_BOLD_KEYS) {
      const value = entry[key];
      if (typeof value === "boolean") info[key] = value;
    }
    return info;
  });
}
function parsePivotRequest(input) {
  const isPartPath = (value) => typeof value === "string" && value.length <= 256 && /^xl\/[A-Za-z0-9._/-]+\.xml$/.test(value);
  if (!isRecord(input) || !isUuid(input.sessionId) || !isPartPath(input.path) || !isPartPath(input.cachePath)) {
    throw new Error("Invalid pivot definition request.");
  }
  return input;
}
function parsePivotDefinitionResult(input) {
  if (!isRecord(input) || typeof input.outputRef !== "string" || typeof input.firstDataRow !== "number" || typeof input.firstDataCol !== "number" || typeof input.sourceSheet !== "string" || typeof input.sourceRef !== "string" || !Array.isArray(input.fields) || input.fields.length > 1e3 || !Array.isArray(input.fieldItems) || input.fieldItems.length > 1e3 || !Array.isArray(input.rowFields) || input.rowFields.length > 64 || !Array.isArray(input.colFields) || input.colFields.length > 64 || !Array.isArray(input.rowLines) || input.rowLines.length > 1e5 || !Array.isArray(input.colLines) || input.colLines.length > 1e4 || !Array.isArray(input.dataFields) || input.dataFields.length > 256 || !Array.isArray(input.pageFields) || input.pageFields.length > 256 || !Array.isArray(input.unsupported) || input.unsupported.length > 100 || input.unsupported.some((reason) => typeof reason !== "string")) {
    throw new Error("Invalid pivot definition response.");
  }
  return input;
}
function parseCellStyle(input) {
  if (!isRecord(input) || typeof input.bold !== "boolean" || typeof input.italic !== "boolean" || typeof input.underline !== "boolean" || typeof input.strikethrough !== "boolean" || typeof input.wrapText !== "boolean" || input.shrinkToFit !== void 0 && typeof input.shrinkToFit !== "boolean" || !isOptionalString(input.fontFamily) || input.fontSize !== void 0 && (typeof input.fontSize !== "number" || !Number.isFinite(input.fontSize) || input.fontSize <= 0) || !isOptionalString(input.fontColor) || !isOptionalString(input.fillColor) || !isOptionalString(input.horizontalAlignment) || !isOptionalString(input.verticalAlignment) || input.indent !== void 0 && !isNonnegativeInteger(input.indent) || input.textRotation !== void 0 && (!isNonnegativeInteger(input.textRotation) || input.textRotation > 255) || !isOptionalString(input.numberFormat) || input.fontColorTheme !== void 0 && !isNonnegativeInteger(input.fontColorTheme) || input.fillColorTheme !== void 0 && !isNonnegativeInteger(input.fillColorTheme) || input.fontColorTint !== void 0 && (typeof input.fontColorTint !== "number" || !Number.isFinite(input.fontColorTint)) || input.fillColorTint !== void 0 && (typeof input.fillColorTint !== "number" || !Number.isFinite(input.fillColorTint)) || input.fontScheme !== void 0 && input.fontScheme !== "major" && input.fontScheme !== "minor") {
    throw new Error("Invalid workbook style response.");
  }
  const borderTop = parseBorderEdge(input.borderTop);
  const borderBottom = parseBorderEdge(input.borderBottom);
  const borderLeft = parseBorderEdge(input.borderLeft);
  const borderRight = parseBorderEdge(input.borderRight);
  const borderDiagonal = parseBorderEdge(input.borderDiagonal);
  if (typeof input.diagonalUp !== "boolean" || typeof input.diagonalDown !== "boolean") {
    throw new Error("Invalid workbook style response.");
  }
  return {
    bold: input.bold,
    italic: input.italic,
    underline: input.underline,
    strikethrough: input.strikethrough,
    wrapText: input.wrapText,
    diagonalUp: input.diagonalUp,
    diagonalDown: input.diagonalDown,
    ...input.shrinkToFit === void 0 ? {} : { shrinkToFit: input.shrinkToFit },
    ...input.fontFamily === void 0 ? {} : { fontFamily: input.fontFamily },
    ...input.fontSize === void 0 ? {} : { fontSize: input.fontSize },
    ...input.fontColor === void 0 ? {} : { fontColor: input.fontColor },
    ...input.fillColor === void 0 ? {} : { fillColor: input.fillColor },
    ...input.horizontalAlignment === void 0 ? {} : { horizontalAlignment: input.horizontalAlignment },
    ...input.verticalAlignment === void 0 ? {} : { verticalAlignment: input.verticalAlignment },
    ...input.indent === void 0 ? {} : { indent: input.indent },
    ...input.textRotation === void 0 ? {} : { textRotation: input.textRotation },
    ...input.numberFormat === void 0 ? {} : { numberFormat: input.numberFormat },
    ...input.fontColorTheme === void 0 ? {} : { fontColorTheme: input.fontColorTheme },
    ...input.fontColorTint === void 0 ? {} : { fontColorTint: input.fontColorTint },
    ...input.fillColorTheme === void 0 ? {} : { fillColorTheme: input.fillColorTheme },
    ...input.fillColorTint === void 0 ? {} : { fillColorTint: input.fillColorTint },
    ...input.fontScheme === void 0 ? {} : { fontScheme: input.fontScheme },
    ...borderTop === void 0 ? {} : { borderTop },
    ...borderBottom === void 0 ? {} : { borderBottom },
    ...borderLeft === void 0 ? {} : { borderLeft },
    ...borderRight === void 0 ? {} : { borderRight },
    ...borderDiagonal === void 0 ? {} : { borderDiagonal }
  };
}
function parseFreeze(input) {
  if (input === null || input === void 0) return null;
  if (!isRecord(input) || !isNonnegativeInteger(input.frozenColumns) || !isNonnegativeInteger(input.frozenRows)) {
    throw new Error("Invalid worksheet freeze pane.");
  }
  return { frozenColumns: input.frozenColumns, frozenRows: input.frozenRows };
}
function parseBorderEdge(input) {
  if (input === void 0) return void 0;
  if (!isRecord(input) || typeof input.style !== "string" || input.style.length === 0 || !isOptionalString(input.color)) {
    throw new Error("Invalid workbook border response.");
  }
  return {
    style: input.style,
    ...input.color === void 0 ? {} : { color: input.color }
  };
}
function parseVisualObject(input) {
  if (!isRecord(input) || typeof input.id !== "string" || typeof input.sheetId !== "string" || !["chart", "image", "shape", "ole", "slicer"].includes(String(input.kind)) || !isRecord(input.anchor)) {
    throw new Error("Invalid workbook visual response.");
  }
  const anchor = parseDrawingAnchor(input.anchor);
  const chart = input.chart === void 0 ? void 0 : parseChart(input.chart);
  if (input.kind === "chart" && chart === void 0) {
    throw new Error("Workbook chart has no chart metadata.");
  }
  const paragraphs = input.paragraphs === void 0 ? void 0 : parseShapeParagraphs(input.paragraphs);
  const fillGradient = input.fillGradient === void 0 ? void 0 : parseFillGradient(input.fillGradient);
  const customPath = input.customPath === void 0 ? void 0 : parseCustomPath(input.customPath);
  const crop = input.crop === void 0 ? void 0 : parseCropRect(input.crop);
  if (!isOptionalString(input.shapeType) || input.opacity !== void 0 && (typeof input.opacity !== "number" || !Number.isFinite(input.opacity) || input.opacity < 0 || input.opacity > 1) || !isOptionalString(input.fillMediaPath) || !isOptionalString(input.fillMediaType) || !isOptionalString(input.fillColor) || !isOptionalString(input.lineColor) || input.lineWidth !== void 0 && (typeof input.lineWidth !== "number" || !Number.isFinite(input.lineWidth)) || !isOptionalString(input.lineDash) || !isOptionalString(input.lineCap) || input.flipH !== void 0 && typeof input.flipH !== "boolean" || input.flipV !== void 0 && typeof input.flipV !== "boolean" || !isOptionalString(input.textColor) || !isOptionalString(input.textAnchor) || !isOptionalString(input.textVertOverflow) || !isOptionalString(input.textHorzOverflow) || !isOptionalString(input.text) || !isOptionalString(input.progId) || input.rotation !== void 0 && (typeof input.rotation !== "number" || !Number.isFinite(input.rotation)) || input.frameWidth !== void 0 && (typeof input.frameWidth !== "number" || !Number.isFinite(input.frameWidth) || input.frameWidth <= 0) || input.frameHeight !== void 0 && (typeof input.frameHeight !== "number" || !Number.isFinite(input.frameHeight) || input.frameHeight <= 0) || input.drawingPath !== void 0 && (typeof input.drawingPath !== "string" || !/^xl\/drawings\/[A-Za-z0-9._/-]+\.xml$/.test(input.drawingPath)) || input.drawingIndex !== void 0 && (!isNonnegativeInteger(input.drawingIndex) || input.drawingIndex > 1e4)) {
    throw new Error("Invalid workbook visual response.");
  }
  return {
    id: input.id,
    sheetId: input.sheetId,
    kind: input.kind,
    anchor,
    ...chart === void 0 ? {} : { chart },
    ...typeof input.chartPath === "string" ? { chartPath: input.chartPath } : {},
    ...typeof input.mediaPath === "string" ? { mediaPath: input.mediaPath } : {},
    ...typeof input.mediaType === "string" ? { mediaType: input.mediaType } : {},
    ...input.opacity === void 0 ? {} : { opacity: input.opacity },
    ...crop === void 0 ? {} : { crop },
    ...input.fillMediaPath === void 0 ? {} : { fillMediaPath: input.fillMediaPath },
    ...input.fillMediaType === void 0 ? {} : { fillMediaType: input.fillMediaType },
    ...typeof input.name === "string" ? { name: input.name } : {},
    ...input.shapeType === void 0 ? {} : { shapeType: input.shapeType },
    ...customPath === void 0 ? {} : { customPath },
    ...input.fillColor === void 0 ? {} : { fillColor: input.fillColor },
    ...fillGradient === void 0 ? {} : { fillGradient },
    ...input.lineColor === void 0 ? {} : { lineColor: input.lineColor },
    ...input.lineWidth === void 0 ? {} : { lineWidth: input.lineWidth },
    ...input.lineDash === void 0 ? {} : { lineDash: input.lineDash },
    ...input.lineCap === void 0 ? {} : { lineCap: input.lineCap },
    ...input.flipH === void 0 ? {} : { flipH: input.flipH },
    ...input.flipV === void 0 ? {} : { flipV: input.flipV },
    ...input.textColor === void 0 ? {} : { textColor: input.textColor },
    ...input.textAnchor === void 0 ? {} : { textAnchor: input.textAnchor },
    ...input.textVertOverflow === void 0 ? {} : { textVertOverflow: input.textVertOverflow },
    ...input.textHorzOverflow === void 0 ? {} : { textHorzOverflow: input.textHorzOverflow },
    ...paragraphs === void 0 ? {} : { paragraphs },
    ...input.text === void 0 ? {} : { text: input.text },
    ...input.progId === void 0 ? {} : { progId: input.progId },
    ...input.rotation === void 0 ? {} : { rotation: input.rotation },
    ...input.frameWidth === void 0 ? {} : { frameWidth: input.frameWidth },
    ...input.frameHeight === void 0 ? {} : { frameHeight: input.frameHeight },
    ...input.drawingPath === void 0 ? {} : { drawingPath: input.drawingPath },
    ...input.drawingIndex === void 0 ? {} : { drawingIndex: input.drawingIndex }
  };
}
function parseCropRect(input) {
  if (!isRecord(input)) throw new Error("Invalid workbook image crop.");
  const side = (value) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < -1 || value > 1) {
      throw new Error("Invalid workbook image crop.");
    }
    return value;
  };
  return {
    left: side(input.left),
    top: side(input.top),
    right: side(input.right),
    bottom: side(input.bottom)
  };
}
function parseCustomPath(input) {
  if (!isRecord(input) || typeof input.width !== "number" || !Number.isFinite(input.width) || input.width <= 0 || typeof input.height !== "number" || !Number.isFinite(input.height) || input.height <= 0 || typeof input.d !== "string" || input.strokeOnly !== void 0 && typeof input.strokeOnly !== "boolean" || input.fillD !== void 0 && typeof input.fillD !== "string") {
    throw new Error("Invalid workbook shape custom path.");
  }
  return {
    width: input.width,
    height: input.height,
    d: input.d,
    ...input.strokeOnly === void 0 ? {} : { strokeOnly: input.strokeOnly },
    ...input.fillD === void 0 ? {} : { fillD: input.fillD }
  };
}
function parseFillGradient(input) {
  if (!isRecord(input) || typeof input.angle !== "number" || !Number.isFinite(input.angle) || !Array.isArray(input.stops) || input.stops.length < 2 || input.stops.length > 50) {
    throw new Error("Invalid workbook shape gradient.");
  }
  const stops = input.stops.map((stop) => {
    if (!isRecord(stop) || typeof stop.position !== "number" || !Number.isFinite(stop.position) || stop.position < 0 || stop.position > 1 || typeof stop.color !== "string") {
      throw new Error("Invalid workbook shape gradient stop.");
    }
    return { position: stop.position, color: stop.color };
  });
  return { angle: input.angle, stops };
}
function parseShapeParagraphs(input) {
  if (!Array.isArray(input) || input.length > 200) {
    throw new Error("Invalid workbook shape paragraphs.");
  }
  return input.map((paragraph) => {
    if (!isRecord(paragraph) || !isOptionalString(paragraph.align) || !isOptionalFiniteNumber(paragraph.marginLeft) || !isOptionalFiniteNumber(paragraph.indent) || !isOptionalString(paragraph.bulletScheme) || paragraph.bulletStartAt !== void 0 && (typeof paragraph.bulletStartAt !== "number" || !Number.isInteger(paragraph.bulletStartAt) || paragraph.bulletStartAt < 0) || !isOptionalString(paragraph.bulletChar) || !Array.isArray(paragraph.runs)) {
      throw new Error("Invalid workbook shape paragraph.");
    }
    const runs = paragraph.runs.map((run) => {
      if (!isRecord(run) || typeof run.text !== "string" || !isOptionalString(run.color) || run.bold !== void 0 && typeof run.bold !== "boolean" || run.italic !== void 0 && typeof run.italic !== "boolean" || run.underline !== void 0 && typeof run.underline !== "boolean" || run.size !== void 0 && (typeof run.size !== "number" || !Number.isFinite(run.size)) || run.caps !== void 0 && run.caps !== "all" && run.caps !== "small") {
        throw new Error("Invalid workbook shape run.");
      }
      const caps = run.caps === "all" || run.caps === "small" ? run.caps : void 0;
      return {
        text: run.text,
        ...run.color === void 0 ? {} : { color: run.color },
        ...run.bold === void 0 ? {} : { bold: run.bold },
        ...run.italic === void 0 ? {} : { italic: run.italic },
        ...run.underline === void 0 ? {} : { underline: run.underline },
        ...run.size === void 0 ? {} : { size: run.size },
        ...caps === void 0 ? {} : { caps }
      };
    });
    return {
      ...paragraph.align === void 0 ? {} : { align: paragraph.align },
      ...paragraph.marginLeft === void 0 ? {} : { marginLeft: paragraph.marginLeft },
      ...paragraph.indent === void 0 ? {} : { indent: paragraph.indent },
      ...paragraph.bulletScheme === void 0 ? {} : { bulletScheme: paragraph.bulletScheme },
      ...paragraph.bulletStartAt === void 0 ? {} : { bulletStartAt: paragraph.bulletStartAt },
      ...paragraph.bulletChar === void 0 ? {} : { bulletChar: paragraph.bulletChar },
      runs
    };
  });
}
function parseDrawingAnchor(input) {
  const values = [input.fromRow, input.fromColumn, input.toRow, input.toColumn];
  const offsets = [
    input.fromRowOffset,
    input.fromColumnOffset,
    input.toRowOffset,
    input.toColumnOffset
  ];
  if (values.some((value) => !isNonnegativeInteger(value)) || offsets.some((value) => typeof value !== "number" || !Number.isInteger(value)) || input.explicitTo !== void 0 && typeof input.explicitTo !== "boolean") {
    throw new Error("Invalid workbook drawing anchor.");
  }
  return {
    fromRow: input.fromRow,
    fromColumn: input.fromColumn,
    toRow: input.toRow,
    toColumn: input.toColumn,
    fromRowOffset: input.fromRowOffset,
    fromColumnOffset: input.fromColumnOffset,
    toRowOffset: input.toRowOffset,
    toColumnOffset: input.toColumnOffset,
    ...input.explicitTo === void 0 ? {} : { explicitTo: input.explicitTo }
  };
}
const CHART_LEGENDS = ["none", "right", "bottom", "top", "left"];
const CHART_DATA_LABELS = [
  "none",
  "value",
  "percent",
  "category-percent",
  "category-value-percent"
];
const CHART_DATA_LABEL_POSITIONS = ["center", "inside-end", "outside-end"];
const CHART_GROUPINGS = ["clustered", "stacked", "percentStacked", "standard"];
const CHART_DISP_BLANKS = ["gap", "zero", "span"];
function parseChart(input) {
  if (!isRecord(input) || !Array.isArray(input.chartTypes) || input.chartTypes.some((value) => typeof value !== "string") || typeof input.title !== "string" || !Array.isArray(input.series) || !isOptionalString(input.barDirection) || !isOptionalEnum(input.legend, CHART_LEGENDS) || !isOptionalEnum(input.dataLabels, CHART_DATA_LABELS) || !isOptionalEnum(input.dataLabelPosition, CHART_DATA_LABEL_POSITIONS) || !isOptionalString(input.dataLabelFormat) || !isOptionalEnum(input.grouping, CHART_GROUPINGS) || input.gridlines !== void 0 && typeof input.gridlines !== "boolean" || !isOptionalString(input.categoryAxisFormat) || !isOptionalFiniteNumber(input.gapWidthPct) || !isOptionalFiniteNumber(input.holeSizePct) || input.lineMarkers !== void 0 && typeof input.lineMarkers !== "boolean" || !isOptionalEnum(input.dispBlanksAs, CHART_DISP_BLANKS) || !isOptionalString(input.chartAreaFill) || !isOptionalString(input.plotAreaFill)) {
    throw new Error("Invalid workbook chart response.");
  }
  const axisTitles = parseChartAxisTitles(input.axisTitles);
  const valueAxis = parseChartValueAxis(input.valueAxis);
  const xAxis = parseChartAxisInfo(input.xAxis);
  const yAxis = parseChartAxisInfo(input.yAxis);
  const secondaryYAxis = parseChartAxisInfo(input.secondaryYAxis);
  const titleStyle = parseChartTitleStyle(input.titleStyle);
  const dataLabelStyle = parseChartTitleStyle(input.dataLabelStyle);
  if (!isOptionalString(input.scatterStyle)) {
    throw new Error("Invalid workbook chart response.");
  }
  const series = input.series.map((entry) => {
    if (!isRecord(entry) || typeof entry.name !== "string" || !isOptionalString(entry.nameRef) || !Array.isArray(entry.categories) || entry.categories.some((value) => typeof value !== "string") || !Array.isArray(entry.values) || entry.values.some((value) => typeof value !== "number" || !Number.isFinite(value)) || entry.blanks !== void 0 && (!Array.isArray(entry.blanks) || entry.blanks.some(
      (value) => typeof value !== "number" || !Number.isInteger(value) || value < 0
    )) || !isOptionalString(entry.numberFormat) || !isOptionalString(entry.categoryFormat) || !isOptionalString(entry.color) || !isOptionalString(entry.trendline) || !isOptionalString(entry.valuesRef) || !isOptionalString(entry.categoriesRef) || !isOptionalFiniteNumber(entry.explosionPct) || !isOptionalString(entry.lineColor) || !isOptionalFiniteNumber(entry.lineWidth) || entry.smooth !== void 0 && typeof entry.smooth !== "boolean" || !isOptionalString(entry.marker) || !isOptionalString(entry.plot) || !isOptionalEnum(entry.dataLabels, CHART_DATA_LABELS)) {
      throw new Error("Invalid workbook chart series.");
    }
    const pointColors = parseChartPointColors(entry.pointColors);
    const pointLabels = parseChartPointLabels(entry.pointLabels);
    const pointExplosions = parseChartPointExplosions(entry.pointExplosions);
    const categoryGroups = parseChartCategoryGroups(entry.categoryGroups);
    return {
      name: entry.name,
      ...entry.nameRef === void 0 ? {} : { nameRef: entry.nameRef },
      categories: entry.categories,
      values: entry.values,
      ...entry.blanks === void 0 ? {} : { blanks: entry.blanks },
      ...entry.numberFormat === void 0 ? {} : { numberFormat: entry.numberFormat },
      ...entry.categoryFormat === void 0 ? {} : { categoryFormat: entry.categoryFormat },
      ...entry.color === void 0 ? {} : { color: entry.color },
      ...entry.trendline === void 0 ? {} : { trendline: entry.trendline },
      ...entry.valuesRef === void 0 ? {} : { valuesRef: entry.valuesRef },
      ...entry.categoriesRef === void 0 ? {} : { categoriesRef: entry.categoriesRef },
      ...pointColors === void 0 ? {} : { pointColors },
      ...entry.explosionPct === void 0 ? {} : { explosionPct: entry.explosionPct },
      ...pointExplosions === void 0 ? {} : { pointExplosions },
      ...entry.lineColor === void 0 ? {} : { lineColor: entry.lineColor },
      ...entry.lineWidth === void 0 ? {} : { lineWidth: entry.lineWidth },
      ...entry.smooth === void 0 ? {} : { smooth: entry.smooth },
      ...entry.marker === void 0 ? {} : { marker: entry.marker },
      ...entry.plot === void 0 ? {} : { plot: entry.plot },
      ...categoryGroups === void 0 ? {} : { categoryGroups },
      ...entry.dataLabels === void 0 ? {} : { dataLabels: entry.dataLabels },
      ...pointLabels === void 0 ? {} : { pointLabels }
    };
  });
  return {
    chartTypes: input.chartTypes,
    title: input.title,
    series,
    ...input.barDirection === void 0 ? {} : { barDirection: input.barDirection },
    ...input.legend === void 0 ? {} : { legend: input.legend },
    ...axisTitles === void 0 ? {} : { axisTitles },
    ...input.dataLabels === void 0 ? {} : { dataLabels: input.dataLabels },
    ...input.dataLabelPosition === void 0 ? {} : { dataLabelPosition: input.dataLabelPosition },
    ...input.dataLabelFormat === void 0 ? {} : { dataLabelFormat: input.dataLabelFormat },
    ...input.grouping === void 0 ? {} : { grouping: input.grouping },
    ...input.gridlines === void 0 ? {} : { gridlines: input.gridlines },
    ...input.categoryAxisFormat === void 0 ? {} : { categoryAxisFormat: input.categoryAxisFormat },
    ...valueAxis === void 0 ? {} : { valueAxis },
    ...input.gapWidthPct === void 0 ? {} : { gapWidthPct: input.gapWidthPct },
    ...input.holeSizePct === void 0 ? {} : { holeSizePct: input.holeSizePct },
    ...xAxis === void 0 ? {} : { xAxis },
    ...yAxis === void 0 ? {} : { yAxis },
    ...secondaryYAxis === void 0 ? {} : { secondaryYAxis },
    ...titleStyle === void 0 ? {} : { titleStyle },
    ...dataLabelStyle === void 0 ? {} : { dataLabelStyle },
    ...input.scatterStyle === void 0 ? {} : { scatterStyle: input.scatterStyle },
    ...input.lineMarkers === void 0 ? {} : { lineMarkers: input.lineMarkers },
    ...input.dispBlanksAs === void 0 ? {} : { dispBlanksAs: input.dispBlanksAs },
    ...input.chartAreaFill === void 0 ? {} : { chartAreaFill: input.chartAreaFill },
    ...input.plotAreaFill === void 0 ? {} : { plotAreaFill: input.plotAreaFill }
  };
}
function parseChartTitleStyle(input) {
  if (input === void 0) return void 0;
  if (!isRecord(input) || !isOptionalFiniteNumber(input.size) || input.bold !== void 0 && typeof input.bold !== "boolean" || !isOptionalString(input.color)) {
    throw new Error("Invalid workbook chart title style.");
  }
  return {
    ...input.size === void 0 ? {} : { size: input.size },
    ...input.bold === void 0 ? {} : { bold: input.bold },
    ...input.color === void 0 ? {} : { color: input.color }
  };
}
function isOptionalAxisSide(value) {
  return value === void 0 || value === "l" || value === "r" || value === "t" || value === "b";
}
function parseChartAxisInfo(input) {
  if (input === void 0) return void 0;
  if (!isRecord(input) || !isOptionalString(input.title) || !isOptionalFiniteNumber(input.min) || !isOptionalFiniteNumber(input.max) || !isOptionalFiniteNumber(input.majorUnit) || !isOptionalString(input.numFmt) || typeof input.majorGridlines !== "boolean" || input.hidden !== void 0 && typeof input.hidden !== "boolean" || input.reversed !== void 0 && typeof input.reversed !== "boolean" || !isOptionalAxisSide(input.position) || !isOptionalFiniteNumber(input.labelSize) || !isOptionalString(input.labelColor) || !isOptionalFiniteNumber(input.titleSize) || !isOptionalString(input.titleColor) || !isOptionalFiniteNumber(input.displayUnit) || !isOptionalString(input.displayUnitLabel)) {
    throw new Error("Invalid workbook chart axis.");
  }
  return {
    ...input.title === void 0 ? {} : { title: input.title },
    ...input.min === void 0 ? {} : { min: input.min },
    ...input.max === void 0 ? {} : { max: input.max },
    ...input.majorUnit === void 0 ? {} : { majorUnit: input.majorUnit },
    ...input.numFmt === void 0 ? {} : { numFmt: input.numFmt },
    majorGridlines: input.majorGridlines,
    hidden: input.hidden === true,
    reversed: input.reversed === true,
    ...input.position === void 0 ? {} : { position: input.position },
    ...input.labelSize === void 0 ? {} : { labelSize: input.labelSize },
    ...input.labelColor === void 0 ? {} : { labelColor: input.labelColor },
    ...input.titleSize === void 0 ? {} : { titleSize: input.titleSize },
    ...input.titleColor === void 0 ? {} : { titleColor: input.titleColor },
    ...input.displayUnit === void 0 ? {} : { displayUnit: input.displayUnit },
    ...input.displayUnitLabel === void 0 ? {} : { displayUnitLabel: input.displayUnitLabel }
  };
}
function parseChartAxisTitles(input) {
  if (input === void 0) return void 0;
  if (!isRecord(input) || !isOptionalNullableString(input.category) || !isOptionalNullableString(input.value)) {
    throw new Error("Invalid workbook chart axis titles.");
  }
  return {
    ...input.category === void 0 ? {} : { category: input.category },
    ...input.value === void 0 ? {} : { value: input.value }
  };
}
function parseChartValueAxis(input) {
  if (input === void 0) return void 0;
  if (!isRecord(input) || !isOptionalFiniteNumber(input.min) || !isOptionalFiniteNumber(input.max)) {
    throw new Error("Invalid workbook chart value axis.");
  }
  return {
    ...input.min === void 0 ? {} : { min: input.min },
    ...input.max === void 0 ? {} : { max: input.max }
  };
}
function parseChartPointColors(input) {
  if (input === void 0) return void 0;
  if (!Array.isArray(input)) throw new Error("Invalid workbook chart point colors.");
  return input.map((entry) => {
    if (!isRecord(entry) || !isNonnegativeInteger(entry.index) || typeof entry.color !== "string") {
      throw new Error("Invalid workbook chart point colors.");
    }
    return { index: entry.index, color: entry.color };
  });
}
function parseChartPointLabels(input) {
  if (input === void 0) return void 0;
  if (!Array.isArray(input)) throw new Error("Invalid workbook chart point labels.");
  return input.map((entry) => {
    if (!isRecord(entry) || !isNonnegativeInteger(entry.index) || entry.showVal !== void 0 && typeof entry.showVal !== "boolean" || !isOptionalFiniteNumber(entry.offsetX) || !isOptionalFiniteNumber(entry.offsetY)) {
      throw new Error("Invalid workbook chart point labels.");
    }
    return {
      index: entry.index,
      ...entry.showVal === void 0 ? {} : { showVal: entry.showVal },
      ...entry.offsetX === void 0 ? {} : { offsetX: entry.offsetX },
      ...entry.offsetY === void 0 ? {} : { offsetY: entry.offsetY }
    };
  });
}
function parseChartCategoryGroups(input) {
  if (input === void 0) return void 0;
  if (!Array.isArray(input)) throw new Error("Invalid workbook chart category groups.");
  return input.map((entry) => {
    if (!isRecord(entry) || typeof entry.label !== "string" || !isNonnegativeInteger(entry.start) || !isNonnegativeInteger(entry.end)) {
      throw new Error("Invalid workbook chart category groups.");
    }
    return { label: entry.label, start: entry.start, end: entry.end };
  });
}
function parseChartPointExplosions(input) {
  if (input === void 0) return void 0;
  if (!Array.isArray(input)) throw new Error("Invalid workbook chart point explosions.");
  return input.map((entry) => {
    if (!isRecord(entry) || !isNonnegativeInteger(entry.index) || typeof entry.pct !== "number" || !Number.isFinite(entry.pct)) {
      throw new Error("Invalid workbook chart point explosions.");
    }
    return { index: entry.index, pct: entry.pct };
  });
}
function isRecord(input) {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
function isUuid(input) {
  return typeof input === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}
function isNonnegativeInteger(input) {
  return typeof input === "number" && Number.isInteger(input) && input >= 0;
}
function normalizedDefaultSize(input) {
  return typeof input === "number" && Number.isFinite(input) && input > 0 ? input : null;
}
function isPositiveInteger(input) {
  return isNonnegativeInteger(input) && input > 0;
}
function isCellScalar(input) {
  return input === null || ["string", "number", "boolean"].includes(typeof input);
}
function isOptionalString(input) {
  return input === void 0 || typeof input === "string";
}
function isBoundedString(input, maxLength) {
  return typeof input === "string" && input.length >= 1 && input.length <= maxLength;
}
function isOptionalNullableString(input) {
  return input === void 0 || input === null || typeof input === "string";
}
function isOptionalFiniteNumber(input) {
  return input === void 0 || typeof input === "number" && Number.isFinite(input);
}
function isOptionalEnum(input, values) {
  return input === void 0 || values.includes(input);
}
