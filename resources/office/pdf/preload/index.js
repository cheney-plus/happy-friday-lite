"use strict";
const electron = require("electron");
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
const PDF_CHANNELS = {
  consumePending: "pdf:consume-pending",
  readFile: "pdf:read-file",
  save: "pdf:save",
  requestRedactionCopy: "pdf:request-redaction-copy",
  autoRename: "pdf:auto-rename",
  isUntitled: "pdf:is-untitled",
  validateTextEdits: "pdf:validate-text-edits",
  listEditFonts: "pdf:list-edit-fonts",
  canDrawText: "pdf:can-draw-text",
  listPageImages: "pdf:list-page-images",
  listStaticFormFills: "pdf:list-static-form-fills",
  pageImagePng: "pdf:page-image-png",
  ocrPage: "pdf:ocr-page",
  pagePreviewPng: "pdf:page-preview-png",
  extractPages: "pdf:extract-pages",
  insertPdf: "pdf:insert-pdf",
  insertBlankPage: "pdf:insert-blank-page",
  splitPdf: "pdf:split-pdf",
  mergePdf: "pdf:merge-pdf",
  mergePages: "pdf:merge-pages",
  replacePages: "pdf:replace-pages",
  setPageSize: "pdf:set-page-size",
  splitPages: "pdf:split-pages",
  cropPages: "pdf:crop-pages",
  exportImages: "pdf:export-images",
  convertOffice: "pdf:convert-office",
  createDocument: "pdf:create-document",
  generateImage: "pdf:generate-image",
  listSignatures: "pdf:list-signatures",
  addSignature: "pdf:add-signature",
  removeSignature: "pdf:remove-signature",
  getUsername: "pdf:get-username",
  dirtyChanged: "pdf:dirty-changed",
  closeSaveRequest: "pdf:close-save-request",
  closeSaveResult: "pdf:close-save-result",
  saveAsRequest: "pdf:save-as-request",
  saveAsResult: "pdf:save-as-result",
  saveAsFlow: "pdf:save-as-flow",
  printRequest: "pdf:print-request",
  fileRenamed: "pdf:file-renamed",
  getLanguage: "app:get-language",
  languageChanged: "app:language-changed",
  getTheme: "app:get-theme",
  themeChanged: "app:theme-changed",
  getAiPanelPrefs: "app:get-ai-panel-prefs",
  aiPanelPrefsChanged: "app:ai-panel-prefs-changed"
};
const AI_CHANNELS = {
  getSettings: "ai:get-settings",
  gskStatus: "ai:gsk-status",
  stream: "ai:stream",
  streamChunk: "ai:stream-chunk",
  streamCancel: "ai:stream-cancel",
  imageSearch: "ai:image-search",
  fetchImage: "ai:fetch-image"
};
const api = {
  consumePending: () => electron.ipcRenderer.invoke(PDF_CHANNELS.consumePending),
  readFile: (path) => electron.ipcRenderer.invoke(PDF_CHANNELS.readFile, path),
  save: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.save, request),
  requestRedactionCopy: (path) => electron.ipcRenderer.invoke(PDF_CHANNELS.requestRedactionCopy, path),
  autoRename: (path, baseName) => electron.ipcRenderer.invoke(PDF_CHANNELS.autoRename, path, baseName),
  isUntitled: (path) => electron.ipcRenderer.invoke(PDF_CHANNELS.isUntitled, path),
  validateTextEdits: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.validateTextEdits, request),
  listEditFonts: () => electron.ipcRenderer.invoke(PDF_CHANNELS.listEditFonts),
  canDrawText: (text, font, bold, italic) => electron.ipcRenderer.invoke(PDF_CHANNELS.canDrawText, text, font, bold, italic),
  listPageImages: (path) => electron.ipcRenderer.invoke(PDF_CHANNELS.listPageImages, path),
  listStaticFormFills: (path) => electron.ipcRenderer.invoke(PDF_CHANNELS.listStaticFormFills, path),
  ocrPage: (png) => electron.ipcRenderer.invoke(PDF_CHANNELS.ocrPage, png),
  pageImagePng: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.pageImagePng, request),
  pagePreviewPng: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.pagePreviewPng, request),
  extractPages: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.extractPages, request),
  insertPdf: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.insertPdf, request),
  insertBlankPage: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.insertBlankPage, request),
  splitPdf: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.splitPdf, request),
  mergePdf: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.mergePdf, request),
  mergePages: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.mergePages, request),
  replacePages: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.replacePages, request),
  setPageSize: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.setPageSize, request),
  splitPages: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.splitPages, request),
  cropPages: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.cropPages, request),
  exportImages: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.exportImages, request),
  convertOffice: (format) => electron.ipcRenderer.invoke(PDF_CHANNELS.convertOffice, format),
  createDocument: (request) => electron.ipcRenderer.invoke(PDF_CHANNELS.createDocument, request),
  imageSearch: (query, maxResults) => electron.ipcRenderer.invoke(AI_CHANNELS.imageSearch, query, maxResults),
  fetchImage: (url) => electron.ipcRenderer.invoke(AI_CHANNELS.fetchImage, url),
  generateImage: (op) => electron.ipcRenderer.invoke(PDF_CHANNELS.generateImage, op),
  listSavedSignatures: () => electron.ipcRenderer.invoke(PDF_CHANNELS.listSignatures),
  addSavedSignature: (data) => electron.ipcRenderer.invoke(PDF_CHANNELS.addSignature, data),
  removeSavedSignature: (id) => electron.ipcRenderer.invoke(PDF_CHANNELS.removeSignature, id),
  getUsername: () => electron.ipcRenderer.invoke(PDF_CHANNELS.getUsername),
  setDirty: (dirty) => electron.ipcRenderer.send(PDF_CHANNELS.dirtyChanged, dirty),
  onCloseSaveRequest: (handler) => {
    const listener = () => handler();
    electron.ipcRenderer.on(PDF_CHANNELS.closeSaveRequest, listener);
    return () => electron.ipcRenderer.removeListener(PDF_CHANNELS.closeSaveRequest, listener);
  },
  sendCloseSaveResult: (ok) => electron.ipcRenderer.send(PDF_CHANNELS.closeSaveResult, ok),
  onSaveAsRequest: (handler) => {
    const listener = (_e, targetPath) => handler(targetPath);
    electron.ipcRenderer.on(PDF_CHANNELS.saveAsRequest, listener);
    return () => electron.ipcRenderer.removeListener(PDF_CHANNELS.saveAsRequest, listener);
  },
  sendSaveAsResult: (ok) => electron.ipcRenderer.send(PDF_CHANNELS.saveAsResult, ok),
  onSaveAsFlow: (handler) => {
    const listener = (_e, inFlight) => handler(inFlight);
    electron.ipcRenderer.on(PDF_CHANNELS.saveAsFlow, listener);
    return () => electron.ipcRenderer.removeListener(PDF_CHANNELS.saveAsFlow, listener);
  },
  onPrintRequest: (handler) => {
    const listener = () => handler();
    electron.ipcRenderer.on(PDF_CHANNELS.printRequest, listener);
    return () => electron.ipcRenderer.removeListener(PDF_CHANNELS.printRequest, listener);
  },
  onFileRenamed: (handler) => {
    const listener = (_e, newPath) => handler(newPath);
    electron.ipcRenderer.on(PDF_CHANNELS.fileRenamed, listener);
    return () => electron.ipcRenderer.removeListener(PDF_CHANNELS.fileRenamed, listener);
  },
  getLanguage: () => electron.ipcRenderer.invoke(PDF_CHANNELS.getLanguage),
  onLanguageChanged: (handler) => {
    const listener = (_e, lang) => handler(lang);
    electron.ipcRenderer.on(PDF_CHANNELS.languageChanged, listener);
    return () => electron.ipcRenderer.removeListener(PDF_CHANNELS.languageChanged, listener);
  },
  getTheme: () => electron.ipcRenderer.invoke(PDF_CHANNELS.getTheme),
  onThemeChanged: (handler) => {
    const listener = (_e, theme) => handler(theme);
    electron.ipcRenderer.on(PDF_CHANNELS.themeChanged, listener);
    return () => electron.ipcRenderer.removeListener(PDF_CHANNELS.themeChanged, listener);
  },
  getAiPanelPrefs: () => electron.ipcRenderer.invoke(PDF_CHANNELS.getAiPanelPrefs),
  setAiPanelPrefs: (patch) => electron.ipcRenderer.invoke("app:set-ai-panel-prefs", patch),
  onAiPanelPrefsChanged: (handler) => {
    const listener = (_event, prefs) => handler(prefs);
    electron.ipcRenderer.on(PDF_CHANNELS.aiPanelPrefsChanged, listener);
    return () => electron.ipcRenderer.removeListener(PDF_CHANNELS.aiPanelPrefsChanged, listener);
  },
  onChromePressed: (handler) => {
    const listener = () => handler();
    electron.ipcRenderer.on("app:chrome-pressed", listener);
    return () => electron.ipcRenderer.removeListener("app:chrome-pressed", listener);
  },
  getAiSettings: () => electron.ipcRenderer.invoke(AI_CHANNELS.getSettings),
  gskStatus: () => electron.ipcRenderer.invoke(AI_CHANNELS.gskStatus),
  aiStream: (request) => electron.ipcRenderer.invoke(AI_CHANNELS.stream, request),
  aiStreamCancel: (requestId) => electron.ipcRenderer.invoke(AI_CHANNELS.streamCancel, requestId),
  onAiStream: (handler) => {
    const listener = (_e, chunk) => handler(chunk);
    electron.ipcRenderer.on(AI_CHANNELS.streamChunk, listener);
    return () => electron.ipcRenderer.removeListener(AI_CHANNELS.streamChunk, listener);
  }
};
const projectApi = {
  resolveChat: (args) => electron.ipcRenderer.invoke("project:resolveChat", args),
  appendChat: (args) => electron.ipcRenderer.invoke("project:appendChat", args),
  loadChat: (args) => electron.ipcRenderer.invoke("project:loadChat", args),
  rebindChat: (args) => electron.ipcRenderer.invoke("project:rebindChat", args)
};
electron.contextBridge.exposeInMainWorld("pdfApi", api);
electron.contextBridge.exposeInMainWorld("projectApi", projectApi);
installDropOpenBridge();
