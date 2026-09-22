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
  setShowFullScreen: (on) => electron.ipcRenderer.invoke("slides:show-fullscreen", on),
  privateFontFaces: () => electron.ipcRenderer.invoke("slides:private-font-faces"),
  privateFontData: (id) => electron.ipcRenderer.invoke("slides:private-font-data", id),
  fontCatalog: () => electron.ipcRenderer.invoke("slides:font-catalog"),
  fontDownload: (family) => electron.ipcRenderer.invoke("slides:font-download", family),
  fontInstallLocal: () => electron.ipcRenderer.invoke("slides:font-install-local"),
  fontMissing: () => electron.ipcRenderer.invoke("slides:font-missing"),
  onFontsChanged: (handler) => {
    const listener = () => handler();
    electron.ipcRenderer.on("slides:fonts-changed", listener);
    return () => electron.ipcRenderer.removeListener("slides:fonts-changed", listener);
  },
  openPptx: (fitWidthPx) => electron.ipcRenderer.invoke("slides:open", fitWidthPx),
  openPptxPath: (path, fitWidthPx) => electron.ipcRenderer.invoke("slides:open-path", path, fitWidthPx),
  consumePendingOpen: (fitWidthPx) => electron.ipcRenderer.invoke("slides:consume-pending-open", fitWidthPx),
  consumeHeadlessExport: () => electron.ipcRenderer.invoke("slides:consume-headless-export"),
  headlessExportDone: (result) => electron.ipcRenderer.send("slides:headless-export-done", result),
  newBlank: (fitWidthPx) => electron.ipcRenderer.invoke("slides:new-blank", fitWidthPx),
  landGeneratedPages: (pageMarkers, fitWidthPx, mode, atIndex, deckName) => electron.ipcRenderer.invoke(
    "slides:land-generated-pages",
    pageMarkers,
    fitWidthPx,
    mode,
    atIndex,
    deckName
  ),
  cloudGenStatus: () => electron.ipcRenderer.invoke("slides:cloud-gen-status"),
  cloudGeneratePage: (op) => electron.ipcRenderer.invoke("slides:cloud-page-generate", op),
  localGeneratePage: (op) => electron.ipcRenderer.invoke("slides:local-page-generate", op),
  editText: (op) => electron.ipcRenderer.invoke("slides:edit-text", op),
  setElementFont: (op) => electron.ipcRenderer.invoke("slides:set-element-font", op),
  setElementParagraphFormat: (op) => electron.ipcRenderer.invoke("slides:set-element-paragraph-format", op),
  findReplace: (op) => electron.ipcRenderer.invoke("slides:find-replace", op),
  setSlideLayout: (op) => electron.ipcRenderer.invoke("slides:set-slide-layout", op),
  setSlideSize: (op) => electron.ipcRenderer.invoke("slides:set-slide-size", op),
  getSlideSize: () => electron.ipcRenderer.invoke("slides:get-slide-size"),
  editTransform: (op) => electron.ipcRenderer.invoke("slides:edit-transform", op),
  editConnectorEndpoints: (op) => electron.ipcRenderer.invoke("slides:edit-connector-endpoints", op),
  editPictureSrcRect: (op) => electron.ipcRenderer.invoke("slides:edit-picture-src-rect", op),
  editPictureOpacity: (op) => electron.ipcRenderer.invoke("slides:edit-picture-opacity", op),
  editImageFill: (op) => electron.ipcRenderer.invoke("slides:edit-image-fill", op),
  changeShape: (op) => electron.ipcRenderer.invoke("slides:change-shape", op),
  setShapeAdjust: (op) => electron.ipcRenderer.invoke("slides:set-shape-adjust", op),
  setTextAnchor: (op) => electron.ipcRenderer.invoke("slides:set-text-anchor", op),
  setTextBodyProps: (op) => electron.ipcRenderer.invoke("slides:set-text-body-props", op),
  setEffects: (op) => electron.ipcRenderer.invoke("slides:set-effects", op),
  clipboardExternal: () => electron.ipcRenderer.invoke("slides:clipboard-external"),
  groupElements: (op) => electron.ipcRenderer.invoke("slides:group-elements", op),
  ungroupElement: (op) => electron.ipcRenderer.invoke("slides:ungroup-element", op),
  batchEditTransform: (op) => electron.ipcRenderer.invoke("slides:batch-edit-transform", op),
  getRenderSlides: () => electron.ipcRenderer.invoke("slides:get-render-slides"),
  addElement: (op) => electron.ipcRenderer.invoke("slides:add-element", op),
  deleteElement: (op) => electron.ipcRenderer.invoke("slides:delete-element", op),
  addSlide: (op) => electron.ipcRenderer.invoke("slides:add-slide", op),
  addBlankSlide: (op) => electron.ipcRenderer.invoke("slides:add-blank-slide", op),
  addSlideWithLayout: (op) => electron.ipcRenderer.invoke("slides:add-slide-with-layout", op),
  getLayouts: () => electron.ipcRenderer.invoke("slides:get-layouts"),
  masterEnter: (fitWidthPx) => electron.ipcRenderer.invoke("slides:master-enter", fitWidthPx),
  masterOpen: (partPath) => electron.ipcRenderer.invoke("slides:master-open", partPath),
  masterClose: () => electron.ipcRenderer.invoke("slides:master-close"),
  masterEditText: (op) => electron.ipcRenderer.invoke("slides:master-edit-text", op),
  masterEditTransform: (op) => electron.ipcRenderer.invoke("slides:master-edit-transform", op),
  masterEditFill: (op) => electron.ipcRenderer.invoke("slides:master-edit-fill", op),
  masterEditStroke: (op) => electron.ipcRenderer.invoke("slides:master-edit-stroke", op),
  masterDeleteElement: (op) => electron.ipcRenderer.invoke("slides:master-delete-element", op),
  editFill: (op) => electron.ipcRenderer.invoke("slides:edit-fill", op),
  editStroke: (op) => electron.ipcRenderer.invoke("slides:edit-stroke", op),
  flipElements: (op) => electron.ipcRenderer.invoke("slides:flip-elements", op),
  editBackground: (op) => electron.ipcRenderer.invoke("slides:edit-background", op),
  pickPictureFile: () => electron.ipcRenderer.invoke("slides:pick-picture-file"),
  insertImage: (slideIndex, fitWidthPx) => electron.ipcRenderer.invoke("slides:insert-image", slideIndex, fitWidthPx),
  copySlide: (slideIndex, pngBase64) => electron.ipcRenderer.invoke("slides:copy-slide", slideIndex, pngBase64),
  pasteSlide: (op) => electron.ipcRenderer.invoke("slides:paste-slide", op),
  repasteSlide: (op) => electron.ipcRenderer.invoke("slides:repaste-slide", op),
  hasSlideClipboard: () => electron.ipcRenderer.invoke("slides:has-slide-clipboard"),
  clipboardProbe: () => electron.ipcRenderer.invoke("slides:clipboard-probe"),
  deleteSlide: (slideIndex) => electron.ipcRenderer.invoke("slides:delete-slide", slideIndex),
  reorderElement: (op) => electron.ipcRenderer.invoke("slides:reorder-element", op),
  editTableCell: (op) => electron.ipcRenderer.invoke("slides:edit-table-cell", op),
  tableStructure: (op) => electron.ipcRenderer.invoke("slides:table-structure", op),
  tableMerge: (op) => electron.ipcRenderer.invoke("slides:table-merge", op),
  setTableColWidth: (op) => electron.ipcRenderer.invoke("slides:set-table-col-width", op),
  setTableRowHeight: (op) => electron.ipcRenderer.invoke("slides:set-table-row-height", op),
  setTableCellAnchor: (op) => electron.ipcRenderer.invoke("slides:set-table-cell-anchor", op),
  editTableStyle: (op) => electron.ipcRenderer.invoke("slides:edit-table-style", op),
  editChart: (op) => electron.ipcRenderer.invoke("slides:edit-chart", op),
  getChartColorSchemes: () => electron.ipcRenderer.invoke("slides:chart-color-schemes"),
  getChartData: (slideIndex, sourceId) => electron.ipcRenderer.invoke("slides:get-chart-data", slideIndex, sourceId),
  copyElements: (op) => electron.ipcRenderer.invoke("slides:copy-elements", op),
  pasteElements: (op) => electron.ipcRenderer.invoke("slides:paste-elements", op),
  duplicateElements: (op) => electron.ipcRenderer.invoke("slides:duplicate-elements", op),
  addTable: (op) => electron.ipcRenderer.invoke("slides:add-table", op),
  addInk: (op) => electron.ipcRenderer.invoke("slides:add-ink", op),
  addChart: (op) => electron.ipcRenderer.invoke("slides:add-chart", op),
  addSmartArt: (op) => electron.ipcRenderer.invoke("slides:add-smartart", op),
  addImageBytes: (op) => electron.ipcRenderer.invoke("slides:add-image-bytes", op),
  replacePictureBytes: (op) => electron.ipcRenderer.invoke("slides:replace-picture-bytes", op),
  insertMedia: (slideIndex, kind, fitWidthPx) => electron.ipcRenderer.invoke("slides:insert-media", slideIndex, kind, fitWidthPx),
  addMediaBytes: (op) => electron.ipcRenderer.invoke("slides:add-media-bytes", op),
  getMediaData: (slideIndex, sourceId) => electron.ipcRenderer.invoke("slides:media-data", slideIndex, sourceId),
  insertModel3d: (slideIndex, fitWidthPx) => electron.ipcRenderer.invoke("slides:insert-model3d", slideIndex, fitWidthPx),
  setLink: (op) => electron.ipcRenderer.invoke("slides:set-link", op),
  getLink: (slideIndex, sourceId) => electron.ipcRenderer.invoke("slides:get-link", slideIndex, sourceId),
  getSlideLinks: (slideIndex) => electron.ipcRenderer.invoke("slides:get-slide-links", slideIndex),
  getRunLinks: (slideIndex) => electron.ipcRenderer.invoke("slides:get-run-links", slideIndex),
  applyHeaderFooter: (op) => electron.ipcRenderer.invoke("slides:apply-header-footer", op),
  getHeaderFooter: (slideIndex) => electron.ipcRenderer.invoke("slides:get-header-footer", slideIndex),
  applyTheme: (op) => electron.ipcRenderer.invoke("slides:apply-theme", op),
  setTransition: (op) => electron.ipcRenderer.invoke("slides:set-transition", op),
  getTransition: (slideIndex) => electron.ipcRenderer.invoke("slides:get-transition", slideIndex),
  setAdvanceTimes: (op) => electron.ipcRenderer.invoke("slides:set-advance-times", op),
  getAnimations: (slideIndex) => electron.ipcRenderer.invoke("slides:get-animations", slideIndex),
  getShapeKeys: (slideIndex) => electron.ipcRenderer.invoke("slides:get-shape-keys", slideIndex),
  setAnimations: (op) => electron.ipcRenderer.invoke("slides:set-animations", op),
  setSlideHidden: (op) => electron.ipcRenderer.invoke("slides:set-hidden", op),
  getSections: () => electron.ipcRenderer.invoke("slides:get-sections"),
  setSections: (sections) => electron.ipcRenderer.invoke("slides:set-sections", sections),
  addSection: (op) => electron.ipcRenderer.invoke("slides:add-section", op),
  renameSection: (op) => electron.ipcRenderer.invoke("slides:rename-section", op),
  removeSection: (op) => electron.ipcRenderer.invoke("slides:remove-section", op),
  moveSection: (op) => electron.ipcRenderer.invoke("slides:move-section", op),
  moveSlide: (op) => electron.ipcRenderer.invoke("slides:move-slide", op),
  getNotes: (slideIndex) => electron.ipcRenderer.invoke("slides:get-notes", slideIndex),
  setNotes: (op) => electron.ipcRenderer.invoke("slides:set-notes", op),
  getComments: (slideIndex) => electron.ipcRenderer.invoke("slides:get-comments", slideIndex),
  addComment: (op) => electron.ipcRenderer.invoke("slides:add-comment", op),
  deleteComment: (op) => electron.ipcRenderer.invoke("slides:delete-comment", op),
  nativeClipboard: (op) => electron.ipcRenderer.invoke("slides:native-clipboard", op),
  beginHistoryBatch: () => electron.ipcRenderer.invoke("slides:history-batch-begin"),
  endHistoryBatch: () => electron.ipcRenderer.invoke("slides:history-batch-end"),
  applyEditScript: (op) => electron.ipcRenderer.invoke("slides:apply-edit-script", op),
  applyTxn: (op) => electron.ipcRenderer.invoke("slides:apply-txn", op),
  aiSnapshotRestore: (id) => electron.ipcRenderer.invoke("slides:ai-snapshot-restore", id),
  undo: () => electron.ipcRenderer.invoke("slides:undo"),
  redo: () => electron.ipcRenderer.invoke("slides:redo"),
  pickExportDir: () => electron.ipcRenderer.invoke("slides:pick-export-dir"),
  exportImages: (op) => electron.ipcRenderer.invoke("slides:export-images", op),
  pickExportPdfPath: (defaultName) => electron.ipcRenderer.invoke("slides:pick-export-pdf-path", defaultName),
  exportPdf: (op) => electron.ipcRenderer.invoke("slides:export-pdf", op),
  printSlides: (op) => electron.ipcRenderer.invoke("slides:print", op),
  save: () => electron.ipcRenderer.invoke("slides:save"),
  saveAs: (defaultName) => electron.ipcRenderer.invoke("slides:save-as", defaultName),
  onCloseSaveRequest: (handler) => {
    const listener = () => handler();
    electron.ipcRenderer.on("slides:close-save-request", listener);
    return () => electron.ipcRenderer.removeListener("slides:close-save-request", listener);
  },
  onHistoryChanged: (handler) => {
    const listener = (_e, state) => handler(state);
    electron.ipcRenderer.on("slides:history-changed", listener);
    return () => electron.ipcRenderer.removeListener("slides:history-changed", listener);
  },
  onDeckChanged: (handler) => {
    const listener = (_e, state) => handler(state);
    electron.ipcRenderer.on("slides:deck-changed", listener);
    return () => electron.ipcRenderer.removeListener("slides:deck-changed", listener);
  },
  reportCloseSaveResult: (ok) => electron.ipcRenderer.send("slides:close-save-result", ok === true),
  setAutoSavePref: (on) => electron.ipcRenderer.send("slides:autosave-pref", on === true),
  isDirty: () => electron.ipcRenderer.invoke("slides:is-dirty"),
  getRecentFiles: () => electron.ipcRenderer.invoke("slides:recent"),
  onMenuCommand: (handler) => {
    const listener = (_e, cmd) => handler(cmd);
    electron.ipcRenderer.on("slides:menu", listener);
    return () => electron.ipcRenderer.removeListener("slides:menu", listener);
  },
  onOpened: (handler) => {
    const listener = (_e, result) => handler(result);
    electron.ipcRenderer.on("slides:opened", listener);
    return () => electron.ipcRenderer.removeListener("slides:opened", listener);
  },
  onRenamed: (handler) => {
    const listener = (_e, newPath) => handler(newPath);
    electron.ipcRenderer.on("slides:renamed", listener);
    return () => electron.ipcRenderer.removeListener("slides:renamed", listener);
  },
  getAiSettings: () => electron.ipcRenderer.invoke("ai:get-settings"),
  setAiSettings: (settings) => electron.ipcRenderer.invoke("ai:set-settings", settings),
  aiStream: (request) => electron.ipcRenderer.invoke("ai:stream", request),
  aiStreamCancel: (requestId) => electron.ipcRenderer.invoke("ai:stream-cancel", requestId),
  aiGskStatus: (withEmail) => electron.ipcRenderer.invoke("ai:gsk-status", withEmail),
  aiGskLogin: () => electron.ipcRenderer.invoke("ai:gsk-login"),
  aiLogRunFailure: (entry) => electron.ipcRenderer.invoke("ai:log-run-failure", entry),
  webSearch: (query, maxResults) => electron.ipcRenderer.invoke("ai:web-search", query, maxResults),
  imageSearch: (query, maxResults) => electron.ipcRenderer.invoke("ai:image-search", query, maxResults),
  insertImageUrl: (op) => electron.ipcRenderer.invoke("ai:insert-image-url", op),
  replacePictureUrl: (op) => electron.ipcRenderer.invoke("ai:replace-picture-url", op),
  generateImage: (op) => electron.ipcRenderer.invoke("ai:generate-image", op),
  analyzeMedia: (op) => electron.ipcRenderer.invoke("ai:analyze-media", op),
  gskStatus: () => electron.ipcRenderer.invoke("ai:gsk-status"),
  onAiStream: (handler) => {
    const listener = (_e, chunk) => handler(chunk);
    electron.ipcRenderer.on("ai:stream-chunk", listener);
    return () => electron.ipcRenderer.removeListener("ai:stream-chunk", listener);
  },
  saveStyleSidecar: (data) => electron.ipcRenderer.invoke("ai:save-sidecar", data),
  saveStyleTemplate: (name, data) => electron.ipcRenderer.invoke("ai:save-style-template", name, data),
  listStyleTemplates: () => electron.ipcRenderer.invoke("ai:list-style-templates"),
  loadStyleTemplate: (name) => electron.ipcRenderer.invoke("ai:load-style-template", name),
  presenterStart: () => electron.ipcRenderer.invoke("slides:presenter-start"),
  presenterSync: (state) => electron.ipcRenderer.send("slides:presenter-sync", state),
  presenterInk: (ev) => electron.ipcRenderer.send("slides:presenter-ink", ev),
  presenterSwap: () => electron.ipcRenderer.invoke("slides:presenter-swap"),
  presenterEnd: () => electron.ipcRenderer.invoke("slides:presenter-end"),
  audienceReady: () => electron.ipcRenderer.invoke("slides:audience-ready"),
  audienceNav: (action) => electron.ipcRenderer.send("slides:audience-nav", action),
  onShowSync: (handler) => {
    const listener = (_e, state) => handler(state);
    electron.ipcRenderer.on("slides:show-sync", listener);
    return () => electron.ipcRenderer.removeListener("slides:show-sync", listener);
  },
  onShowInk: (handler) => {
    const listener = (_e, ev) => handler(ev);
    electron.ipcRenderer.on("slides:show-ink", listener);
    return () => electron.ipcRenderer.removeListener("slides:show-ink", listener);
  },
  onAudienceNav: (handler) => {
    const listener = (_e, action) => handler(action);
    electron.ipcRenderer.on("slides:audience-nav", listener);
    return () => electron.ipcRenderer.removeListener("slides:audience-nav", listener);
  }
};
electron.contextBridge.exposeInMainWorld("slidesApi", api);
const filesApi = {
  pickAttachments: () => electron.ipcRenderer.invoke("slides:files-pick"),
  addAttachmentPaths: (paths) => electron.ipcRenderer.invoke("slides:files-add", paths),
  addPastedImage: (data, ext) => electron.ipcRenderer.invoke("slides:files-add-pasted-image", data, ext),
  readAttachment: (path, offset, maxChars) => electron.ipcRenderer.invoke("slides:files-read", path, offset, maxChars),
  readAttachmentImage: (path) => electron.ipcRenderer.invoke("slides:files-read-image", path),
  getPathForFile: (file) => electron.webUtils.getPathForFile(file)
};
electron.contextBridge.exposeInMainWorld("desktop", filesApi);
const projectApi = {
  resolveChat: (args) => electron.ipcRenderer.invoke("project:resolveChat", args),
  appendChat: (args) => electron.ipcRenderer.invoke("project:appendChat", args),
  loadChat: (args) => electron.ipcRenderer.invoke("project:loadChat", args),
  rebindChat: (args) => electron.ipcRenderer.invoke("project:rebindChat", args)
};
electron.contextBridge.exposeInMainWorld("projectApi", projectApi);
installDropOpenBridge();
