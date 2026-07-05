import { copyTextWithFallback } from './clipboard.js';
import {
  filterLibraryProjects,
  progressStatusLabel,
  summarizeLibraryDashboard
} from './library-dashboard.js';
import { movePageSelection, sortPageIdsBySource } from './page-batch-reorder.js';
import { chooseNextReviewProblem } from './review-queue.js';

function createEmptySearchState() {
  return {
    query: '',
    result: null
  };
}

const PAGE_MARKER_TAGS = [
  'favorite',
  'review-later',
  'ocr-problem',
  'image-problem',
  'editorial-question'
];
const PAGE_MARKER_LABELS = {
  favorite: 'Favorito',
  'review-later': 'Revisar después',
  'ocr-problem': 'Problema OCR',
  'image-problem': 'Problema imagen',
  'editorial-question': 'Duda editorial'
};
const TEXT_HISTORY_SOURCE_LABELS = {
  'manual-edit': 'Edición manual',
  ocr: 'OCR',
  replacement: 'Reemplazo',
  'suspicious-word': 'Palabra dudosa',
  restore: 'Restauración'
};

const state = {
  projects: [],
  project: null,
  dictionary: null,
  system: null,
  installedVersion: null,
  systemError: null,
  checkingUpdates: false,
  updatingApp: false,
  selectedPageId: null,
  reviewQueueMessage: null,
  libraryFilter: 'all',
  markerFilter: 'all',
  exportHistory: null,
  snapshots: null,
  trash: null,
  reading: null,
  readingLoading: false,
  inboxPreview: null,
  inboxPreviewLoading: false,
  selectedBatchPageIds: new Set(),
  search: createEmptySearchState(),
  pageGroupOpen: {},
  batchOcr: null,
  stream: null,
  devices: [],
  mobileCapture: null,
  draftCrop: null,
  cropPageId: null,
  cropDrag: null,
  adjustmentComparison: null,
  suspiciousReview: null,
  busy: false
};

let exportChecklistResolve = null;

const els = {
  projectStatus: document.querySelector('#projectStatus'),
  projectSelect: document.querySelector('#projectSelect'),
  newProjectButton: document.querySelector('#newProjectButton'),
  importPackageButton: document.querySelector('#importPackageButton'),
  packageImportInput: document.querySelector('#packageImportInput'),
  reviewExportButton: document.querySelector('#reviewExportButton'),
  exportPackageButton: document.querySelector('#exportPackageButton'),
  exportButton: document.querySelector('#exportButton'),
  supportSummary: document.querySelector('#supportSummary'),
  supportFacts: document.querySelector('#supportFacts'),
  updateNotice: document.querySelector('#updateNotice'),
  updateStatus: document.querySelector('#updateStatus'),
  updateMeta: document.querySelector('#updateMeta'),
  runUpdateButton: document.querySelector('#runUpdateButton'),
  updateReleaseLink: document.querySelector('#updateReleaseLink'),
  configureAiOcrButton: document.querySelector('#configureAiOcrButton'),
  checkUpdatesButton: document.querySelector('#checkUpdatesButton'),
  setupGuideLink: document.querySelector('#setupGuideLink'),
  reportIssueLink: document.querySelector('#reportIssueLink'),
  cameraButton: document.querySelector('#cameraButton'),
  iphoneCameraButton: document.querySelector('#iphoneCameraButton'),
  captureDescription: document.querySelector('#captureDescription'),
  cameraSelect: document.querySelector('#cameraSelect'),
  cameraInfo: document.querySelector('#cameraInfo'),
  cameraDevicesList: document.querySelector('#cameraDevicesList'),
  cameraDiagnosticsHint: document.querySelector('#cameraDiagnosticsHint'),
  iphoneHelpLine: document.querySelector('#iphoneHelpLine'),
  iphoneHelpCopy: document.querySelector('#iphoneHelpCopy'),
  video: document.querySelector('#video'),
  cameraEmpty: document.querySelector('#cameraEmpty'),
  cameraStage: document.querySelector('.camera-stage'),
  captureButton: document.querySelector('#captureButton'),
  importPhotosButton: document.querySelector('#importPhotosButton'),
  photoImportInput: document.querySelector('#photoImportInput'),
  inboxPathInput: document.querySelector('#inboxPathInput'),
  inboxWatchInput: document.querySelector('#inboxWatchInput'),
  selectInboxButton: document.querySelector('#selectInboxButton'),
  saveInboxButton: document.querySelector('#saveInboxButton'),
  scanInboxButton: document.querySelector('#scanInboxButton'),
  inboxStatus: document.querySelector('#inboxStatus'),
  inboxPreviewPanel: document.querySelector('#inboxPreviewPanel'),
  inboxPreviewSummary: document.querySelector('#inboxPreviewSummary'),
  inboxPreviewList: document.querySelector('#inboxPreviewList'),
  inboxUnsupportedList: document.querySelector('#inboxUnsupportedList'),
  confirmInboxImportButton: document.querySelector('#confirmInboxImportButton'),
  cancelInboxPreviewButton: document.querySelector('#cancelInboxPreviewButton'),
  mobileCaptureButton: document.querySelector('#mobileCaptureButton'),
  copyMobileCaptureUrlButton: document.querySelector('#copyMobileCaptureUrlButton'),
  mobileCaptureUrl: document.querySelector('#mobileCaptureUrl'),
  mobileCaptureStatus: document.querySelector('#mobileCaptureStatus'),
  libraryStats: document.querySelector('#libraryStats'),
  libraryFilters: document.querySelector('#libraryFilters'),
  libraryList: document.querySelector('#libraryList'),
  openExportFolderButton: document.querySelector('#openExportFolderButton'),
  exportHistoryStatus: document.querySelector('#exportHistoryStatus'),
  exportHistoryList: document.querySelector('#exportHistoryList'),
  snapshotHistoryStatus: document.querySelector('#snapshotHistoryStatus'),
  snapshotHistoryList: document.querySelector('#snapshotHistoryList'),
  emptyTrashButton: document.querySelector('#emptyTrashButton'),
  trashHistoryStatus: document.querySelector('#trashHistoryStatus'),
  trashHistoryList: document.querySelector('#trashHistoryList'),
  pagesCount: document.querySelector('#pagesCount'),
  pageBatchToolbar: document.querySelector('#pageBatchToolbar'),
  pageBatchSummary: document.querySelector('#pageBatchSummary'),
  selectVisiblePagesButton: document.querySelector('#selectVisiblePagesButton'),
  clearPageSelectionButton: document.querySelector('#clearPageSelectionButton'),
  pageBatchAnchorInput: document.querySelector('#pageBatchAnchorInput'),
  moveBatchStartButton: document.querySelector('#moveBatchStartButton'),
  moveBatchBeforeButton: document.querySelector('#moveBatchBeforeButton'),
  moveBatchAfterButton: document.querySelector('#moveBatchAfterButton'),
  moveBatchEndButton: document.querySelector('#moveBatchEndButton'),
  sortPagesByDateButton: document.querySelector('#sortPagesByDateButton'),
  sortPagesByNameButton: document.querySelector('#sortPagesByNameButton'),
  pageMarkerFilters: document.querySelector('#pageMarkerFilters'),
  chapterIndex: document.querySelector('#chapterIndex'),
  pagesList: document.querySelector('#pagesList'),
  editorStatus: document.querySelector('#editorStatus'),
  imageReviewFrame: document.querySelector('#imageReviewFrame'),
  selectedImage: document.querySelector('#selectedImage'),
  cropOverlay: document.querySelector('#cropOverlay'),
  qualityPanel: document.querySelector('#qualityPanel'),
  qualityTitle: document.querySelector('#qualityTitle'),
  qualityList: document.querySelector('#qualityList'),
  ignoreQualityButton: document.querySelector('#ignoreQualityButton'),
  cropSuggestionPanel: document.querySelector('#cropSuggestionPanel'),
  cropSuggestionStatus: document.querySelector('#cropSuggestionStatus'),
  acceptCropSuggestionButton: document.querySelector('#acceptCropSuggestionButton'),
  rejectCropSuggestionButton: document.querySelector('#rejectCropSuggestionButton'),
  adjustmentComparePanel: document.querySelector('#adjustmentComparePanel'),
  adjustmentCompareStatus: document.querySelector('#adjustmentCompareStatus'),
  adjustmentBeforeImage: document.querySelector('#adjustmentBeforeImage'),
  adjustmentAfterImage: document.querySelector('#adjustmentAfterImage'),
  ocrModeInput: document.querySelector('#ocrModeInput'),
  ocrButton: document.querySelector('#ocrButton'),
  batchOcrPendingButton: document.querySelector('#batchOcrPendingButton'),
  batchOcrAllButton: document.querySelector('#batchOcrAllButton'),
  nextProblemButton: document.querySelector('#nextProblemButton'),
  batchOcrStatus: document.querySelector('#batchOcrStatus'),
  reviewQueueStatus: document.querySelector('#reviewQueueStatus'),
  bookSearchForm: document.querySelector('#bookSearchForm'),
  bookSearchInput: document.querySelector('#bookSearchInput'),
  bookSearchButton: document.querySelector('#bookSearchButton'),
  bookSearchStatus: document.querySelector('#bookSearchStatus'),
  bookSearchResults: document.querySelector('#bookSearchResults'),
  ocrText: document.querySelector('#ocrText'),
  formattedPreview: document.querySelector('#formattedPreview'),
  coverStatus: document.querySelector('#coverStatus'),
  coverPreview: document.querySelector('#coverPreview'),
  coverPreviewEmpty: document.querySelector('#coverPreviewEmpty'),
  usePageAsCoverButton: document.querySelector('#usePageAsCoverButton'),
  uploadCoverButton: document.querySelector('#uploadCoverButton'),
  clearCoverButton: document.querySelector('#clearCoverButton'),
  coverUploadInput: document.querySelector('#coverUploadInput'),
  textHistoryStatus: document.querySelector('#textHistoryStatus'),
  textHistoryList: document.querySelector('#textHistoryList'),
  pageMarkerTags: document.querySelector('#pageMarkerTags'),
  pageMarkerNote: document.querySelector('#pageMarkerNote'),
  saveMarkersButton: document.querySelector('#saveMarkersButton'),
  editorialStatus: document.querySelector('#editorialStatus'),
  pageReviewedInput: document.querySelector('#pageReviewedInput'),
  pageImageModeInput: document.querySelector('#pageImageModeInput'),
  partStartInput: document.querySelector('#partStartInput'),
  partTitleInput: document.querySelector('#partTitleInput'),
  chapterStartInput: document.querySelector('#chapterStartInput'),
  chapterTitleInput: document.querySelector('#chapterTitleInput'),
  chapterHeaderModeInput: document.querySelector('#chapterHeaderModeInput'),
  chapterEndInput: document.querySelector('#chapterEndInput'),
  movePageFirstButton: document.querySelector('#movePageFirstButton'),
  movePageUpButton: document.querySelector('#movePageUpButton'),
  movePageDownButton: document.querySelector('#movePageDownButton'),
  movePageLastButton: document.querySelector('#movePageLastButton'),
  rotationStatus: document.querySelector('#rotationStatus'),
  rotatePageLeftButton: document.querySelector('#rotatePageLeftButton'),
  rotatePageRightButton: document.querySelector('#rotatePageRightButton'),
  deskewAngleInput: document.querySelector('#deskewAngleInput'),
  saveDeskewButton: document.querySelector('#saveDeskewButton'),
  clearDeskewButton: document.querySelector('#clearDeskewButton'),
  saveEditorialButton: document.querySelector('#saveEditorialButton'),
  cropStatus: document.querySelector('#cropStatus'),
  saveCropButton: document.querySelector('#saveCropButton'),
  clearCropButton: document.querySelector('#clearCropButton'),
  compareAdjustmentButton: document.querySelector('#compareAdjustmentButton'),
  cropRangeStartInput: document.querySelector('#cropRangeStartInput'),
  cropRangeEndInput: document.querySelector('#cropRangeEndInput'),
  applyCropRangeButton: document.querySelector('#applyCropRangeButton'),
  saveTextButton: document.querySelector('#saveTextButton'),
  dictionaryTermInput: document.querySelector('#dictionaryTermInput'),
  addDictionaryTermButton: document.querySelector('#addDictionaryTermButton'),
  dictionaryTermsList: document.querySelector('#dictionaryTermsList'),
  replacementFromInput: document.querySelector('#replacementFromInput'),
  replacementToInput: document.querySelector('#replacementToInput'),
  addReplacementButton: document.querySelector('#addReplacementButton'),
  replacementList: document.querySelector('#replacementList'),
  previewReplacementsButton: document.querySelector('#previewReplacementsButton'),
  applyReplacementsButton: document.querySelector('#applyReplacementsButton'),
  replacementPreviewStatus: document.querySelector('#replacementPreviewStatus'),
  scanSuspiciousButton: document.querySelector('#scanSuspiciousButton'),
  acceptSuspiciousButton: document.querySelector('#acceptSuspiciousButton'),
  replaceSuspiciousButton: document.querySelector('#replaceSuspiciousButton'),
  suspiciousStatus: document.querySelector('#suspiciousStatus'),
  suspiciousList: document.querySelector('#suspiciousList'),
  deletePageButton: document.querySelector('#deletePageButton'),
  captureView: document.querySelector('#captureView'),
  editorView: document.querySelector('#editorView'),
  readingView: document.querySelector('#readingView'),
  refreshReadingButton: document.querySelector('#refreshReadingButton'),
  readingStatus: document.querySelector('#readingStatus'),
  readingNavigation: document.querySelector('#readingNavigation'),
  readingChapters: document.querySelector('#readingChapters'),
  coverSlot: document.querySelector('#coverSlot'),
  projectDialog: document.querySelector('#projectDialog'),
  projectForm: document.querySelector('#projectForm'),
  cancelProjectButton: document.querySelector('#cancelProjectButton'),
  metadataDialog: document.querySelector('#metadataDialog'),
  metadataForm: document.querySelector('#metadataForm'),
  metadataTitleInput: document.querySelector('#metadataTitleInput'),
  metadataAuthorInput: document.querySelector('#metadataAuthorInput'),
  metadataLanguageInput: document.querySelector('#metadataLanguageInput'),
  metadataNotesInput: document.querySelector('#metadataNotesInput'),
  metadataPublisherInput: document.querySelector('#metadataPublisherInput'),
  metadataCollectionInput: document.querySelector('#metadataCollectionInput'),
  metadataStyleTemplateInput: document.querySelector('#metadataStyleTemplateInput'),
  metadataDescriptionInput: document.querySelector('#metadataDescriptionInput'),
  metadataIdentifiersInput: document.querySelector('#metadataIdentifiersInput'),
  cancelMetadataButton: document.querySelector('#cancelMetadataButton'),
  exportChecklistDialog: document.querySelector('#exportChecklistDialog'),
  exportChecklistSummary: document.querySelector('#exportChecklistSummary'),
  exportChecklistIntro: document.querySelector('#exportChecklistIntro'),
  exportPreviewPanel: document.querySelector('#exportPreviewPanel'),
  exportPreviewSummary: document.querySelector('#exportPreviewSummary'),
  exportPreviewMetadata: document.querySelector('#exportPreviewMetadata'),
  exportPreviewSample: document.querySelector('#exportPreviewSample'),
  exportPreviewNavigation: document.querySelector('#exportPreviewNavigation'),
  exportChecklistList: document.querySelector('#exportChecklistList'),
  closeExportChecklistButton: document.querySelector('#closeExportChecklistButton'),
  confirmExportChecklistButton: document.querySelector('#confirmExportChecklistButton'),
  exportResultDialog: document.querySelector('#exportResultDialog'),
  exportResultTitle: document.querySelector('#exportResultTitle'),
  exportResultSummary: document.querySelector('#exportResultSummary'),
  exportResultFacts: document.querySelector('#exportResultFacts'),
  exportResultValidation: document.querySelector('#exportResultValidation'),
  closeExportResultButton: document.querySelector('#closeExportResultButton'),
  aiOcrDialog: document.querySelector('#aiOcrDialog'),
  aiOcrForm: document.querySelector('#aiOcrForm'),
  aiOcrConfirmSummary: document.querySelector('#aiOcrConfirmSummary'),
  aiOcrConfirmFacts: document.querySelector('#aiOcrConfirmFacts'),
  cancelAiOcrButton: document.querySelector('#cancelAiOcrButton'),
  aiOcrSettingsDialog: document.querySelector('#aiOcrSettingsDialog'),
  aiOcrSettingsForm: document.querySelector('#aiOcrSettingsForm'),
  aiOcrSettingsStatus: document.querySelector('#aiOcrSettingsStatus'),
  aiOcrProviderInput: document.querySelector('#aiOcrProviderInput'),
  aiOcrApiKeyInput: document.querySelector('#aiOcrApiKeyInput'),
  aiOcrModelInput: document.querySelector('#aiOcrModelInput'),
  aiOcrBaseUrlLabel: document.querySelector('#aiOcrBaseUrlLabel'),
  aiOcrBaseUrlInput: document.querySelector('#aiOcrBaseUrlInput'),
  clearAiOcrSettingsButton: document.querySelector('#clearAiOcrSettingsButton'),
  cancelAiOcrSettingsButton: document.querySelector('#cancelAiOcrSettingsButton'),
  titleInput: document.querySelector('#titleInput'),
  authorInput: document.querySelector('#authorInput'),
  languageInput: document.querySelector('#languageInput'),
  notesInput: document.querySelector('#notesInput'),
  toast: document.querySelector('#toast')
};

const IPHONE_CAMERA_PATTERN = /iphone|continuity|continuidad|camara de|camera de|cámara de/i;
const VERSION_PLACEHOLDER = '__BOOKSAVER_VERSION__';

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'No se pudo completar la accion.');
  }

  return payload;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => els.toast.classList.remove('visible'), 4200);
}

function pageStatus(page) {
  const labels = {
    captured: 'Capturada',
    'text-edited': 'Texto editado',
    'ocr-running': 'Leyendo texto',
    'ocr-complete': 'OCR listo',
    'ocr-error': 'OCR con error'
  };
  return labels[page.status] || page.status;
}

function ocrEngineLabel(engine) {
  if (engine === 'apple-vision') {
    return 'Apple Vision';
  }
  if (engine === 'tesseract') {
    return 'Tesseract';
  }
  if (engine === 'consensus') {
    return 'Consenso local';
  }
  if (engine === 'ai-advanced') {
    return 'IA avanzada';
  }
  return null;
}

function ocrProvenanceLabel(page) {
  const provenance = page?.ocrProvenance;
  if (!provenance?.provider || provenance.provider === 'local') {
    return '';
  }

  const provider =
    provenance.provider === 'openai-compatible'
      ? 'Compatible OpenAI'
      : provenance.provider === 'openai'
        ? 'OpenAI'
        : provenance.provider;
  return provenance.model ? `${provider} (${provenance.model})` : provider;
}

function selectedOcrMode() {
  return els.ocrModeInput?.value || 'local-improved';
}

function aiOcrAvailable() {
  return Boolean(state.system?.ocrCapabilities?.aiAdvanced?.available);
}

function aiOcrSettings() {
  return state.system?.aiOcr || {
    configured: false,
    source: null,
    provider: 'openai',
    providerLabel: 'OpenAI',
    model: 'gpt-5.4-mini',
    baseUrl: 'https://api.openai.com/v1/responses',
    maskedApiKey: null,
    canEditKey: true,
    adapters: []
  };
}

function selectedAiOcrAdapter(settings = aiOcrSettings()) {
  return settings.adapters?.find((adapter) => adapter.id === settings.provider) || null;
}

function aiOcrAdapterById(provider) {
  return aiOcrSettings().adapters?.find((adapter) => adapter.id === provider) || null;
}

function isMacSystem() {
  return state.system?.platform === 'darwin';
}

function folderPickerSupported() {
  return state.system?.folderPickerSupported !== false;
}

function summarizeTesseractLanguages(languages) {
  if (!languages?.length) {
    return 'Tesseract no está detectado.';
  }

  if (languages.length <= 8) {
    return `Idiomas Tesseract detectados: ${languages.join(', ')}.`;
  }

  const highlights = ['spa', 'eng', 'osd'].filter((language) => languages.includes(language));
  const extra = languages.filter((language) => !highlights.includes(language)).slice(0, 3);
  const preview = [...highlights, ...extra];
  const suffix = languages.length > preview.length ? `, ... (${languages.length} total)` : '';
  return `Idiomas Tesseract detectados: ${preview.join(', ')}${suffix}.`;
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return '';
  }
}

function textHistorySourceLabel(source) {
  return TEXT_HISTORY_SOURCE_LABELS[source] || 'Cambio';
}

function compactTextSnippet(value, maxLength = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) {
    return text || 'Texto vacío';
  }

  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function humanizeUpdateError(message) {
  const normalized = String(message || '').toLowerCase();

  if (!normalized) {
    return 'No se pudo completar la comprobación desde GitHub.';
  }

  if (normalized.includes('abort') || normalized.includes('timeout')) {
    return 'La comprobación tardó demasiado. Inténtalo de nuevo en un momento.';
  }

  if (normalized.includes('403')) {
    return 'GitHub ha rechazado temporalmente la comprobación.';
  }

  return 'No se pudo conectar con GitHub para comprobar nuevas versiones.';
}

function normalizeVersionValue(value) {
  const normalized = String(value || '').trim();

  if (
    !normalized ||
    normalized === VERSION_PLACEHOLDER ||
    normalized === 'undefined' ||
    normalized === 'null'
  ) {
    return null;
  }

  return normalized;
}

function installedVersionLabel(system = state.system) {
  return (
    normalizeVersionValue(system?.update?.currentVersion) ||
    normalizeVersionValue(system?.appVersion) ||
    normalizeVersionValue(state.installedVersion)
  );
}

function currentVersionMeta() {
  return normalizeVersionValue(
    document.querySelector('meta[name="booksaver-version"]')?.getAttribute('content')
  );
}

function upToDateToastCopy(system) {
  const version = installedVersionLabel(system);
  return version ? `BookSaver está al día en la versión ${version}.` : 'BookSaver está al día.';
}

function updatedToastCopy(system) {
  const version = installedVersionLabel(system);
  return version ? `BookSaver actualizado a ${version}.` : 'BookSaver actualizado.';
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function pageEditorial(page) {
  const editorial = page?.editorial || {};
  const chapterHeaderMode = ['auto', 'page'].includes(editorial.chapterHeaderMode)
    ? editorial.chapterHeaderMode
    : 'none';

  return {
    imageMode: editorial.imageMode === 'image' ? 'image' : 'text',
    partStart: Boolean(editorial.partStart),
    partTitle: String(editorial.partTitle || '').trim(),
    chapterStart: Boolean(editorial.chapterStart),
    chapterEnd: Boolean(editorial.chapterEnd),
    chapterTitle: String(editorial.chapterTitle || '').trim(),
    chapterHeaderMode: editorial.chapterStart ? chapterHeaderMode : 'none'
  };
}

function projectCover(project) {
  const cover = project?.cover || {};
  const mode = cover.mode === 'page' ? 'page' : cover.mode === 'upload' ? 'upload' : 'none';

  return {
    mode,
    pageId: mode === 'page' ? String(cover.pageId || '') : null,
    updatedAt: mode === 'none' ? null : String(cover.updatedAt || project?.updatedAt || '')
  };
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCrop(crop) {
  if (!crop) {
    return null;
  }

  const left = clamp(Number(crop.left));
  const top = clamp(Number(crop.top));
  const width = clamp(Number(crop.width), 0, 1 - left);
  const height = clamp(Number(crop.height), 0, 1 - top);

  if (![left, top, width, height].every(Number.isFinite) || width < 0.03 || height < 0.03) {
    return null;
  }

  if (left <= 0.005 && top <= 0.005 && width >= 0.99 && height >= 0.99) {
    return null;
  }

  return {
    left: Number(left.toFixed(4)),
    top: Number(top.toFixed(4)),
    width: Number(width.toFixed(4)),
    height: Number(height.toFixed(4))
  };
}

function analyzeCanvasCapture(sourceCanvas, source = 'capture') {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const sampleMaxSide = 160;
  const scale = Math.min(1, sampleMaxSide / Math.max(width, height));
  const sampleWidth = Math.max(1, Math.round(width * scale));
  const sampleHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(sourceCanvas, 0, 0, sampleWidth, sampleHeight);
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  let sum = 0;
  let min = 255;
  let max = 0;
  let edgeTotal = 0;
  let edgeCount = 0;

  function luminanceAt(offset) {
    return 0.2126 * pixels[offset] + 0.7152 * pixels[offset + 1] + 0.0722 * pixels[offset + 2];
  }

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const offset = (y * sampleWidth + x) * 4;
      const value = luminanceAt(offset);
      sum += value;
      min = Math.min(min, value);
      max = Math.max(max, value);
      if (x > 0) {
        edgeTotal += Math.abs(value - luminanceAt(offset - 4));
        edgeCount += 1;
      }
      if (y > 0) {
        edgeTotal += Math.abs(value - luminanceAt(offset - sampleWidth * 4));
        edgeCount += 1;
      }
    }
  }

  const brightness = Math.round((sum / (sampleWidth * sampleHeight)) * 10) / 10;
  const edgeScore = Math.round((edgeCount ? edgeTotal / edgeCount : 0) * 10) / 10;
  const megapixels = Math.round((width * height) / 10000) / 100;
  const flags = [];

  if (megapixels < 2 || Math.min(width, height) < 1000) {
    flags.push({
      code: 'low-resolution',
      severity: 'high',
      message: 'La captura tiene poca resolucion para OCR fiable.',
      cause: `Resolucion ${width} x ${height}.`
    });
  }
  if (width > height * 1.1) {
    flags.push({
      code: 'orientation-suspect',
      severity: 'medium',
      message: 'La captura parece apaisada para una pagina de libro.',
      cause: 'Comprueba que la pagina no este girada.'
    });
  }
  if (brightness < 70) {
    flags.push({
      code: 'dark-capture',
      severity: 'high',
      message: 'La captura esta demasiado oscura.',
      cause: `Brillo medio ${brightness}.`
    });
  }
  if (edgeScore < 8) {
    flags.push({
      code: 'blurred-capture',
      severity: 'medium',
      message: 'La captura parece desenfocada o con poco detalle.',
      cause: `Detalle local ${edgeScore}.`
    });
  }

  return {
    source,
    ok: flags.length === 0,
    ignored: false,
    metrics: {
      width,
      height,
      megapixels,
      brightness,
      contrast: Math.round((max - min) * 10) / 10,
      edgeScore,
      orientation: width > height ? 'landscape' : 'portrait'
    },
    flags
  };
}

function suggestCropFromCanvas(sourceCanvas) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const sampleMaxSide = 180;
  const scale = Math.min(1, sampleMaxSide / Math.max(width, height));
  const sampleWidth = Math.max(1, Math.round(width * scale));
  const sampleHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(sourceCanvas, 0, 0, sampleWidth, sampleHeight);
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const luminance = new Float32Array(sampleWidth * sampleHeight);
  let min = 255;
  let max = 0;

  function luminanceAt(offset) {
    return 0.2126 * pixels[offset] + 0.7152 * pixels[offset + 1] + 0.0722 * pixels[offset + 2];
  }

  for (let index = 0; index < sampleWidth * sampleHeight; index += 1) {
    const value = luminanceAt(index * 4);
    luminance[index] = value;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  const contrast = max - min;
  if (contrast < 35) {
    return null;
  }

  const threshold = min + contrast * 0.45;
  const rowHits = new Array(sampleHeight).fill(0);
  const colHits = new Array(sampleWidth).fill(0);

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      if (luminance[y * sampleWidth + x] >= threshold) {
        rowHits[y] += 1;
        colHits[x] += 1;
      }
    }
  }

  const top = rowHits.findIndex((count) => count >= sampleWidth * 0.2);
  const bottom = rowHits.findLastIndex((count) => count >= sampleWidth * 0.2);
  const left = colHits.findIndex((count) => count >= sampleHeight * 0.2);
  const right = colHits.findLastIndex((count) => count >= sampleHeight * 0.2);

  if (top < 0 || bottom <= top || left < 0 || right <= left) {
    return null;
  }

  const crop = normalizeCrop({
    left: left / sampleWidth,
    top: top / sampleHeight,
    width: (right - left + 1) / sampleWidth,
    height: (bottom - top + 1) / sampleHeight
  });
  if (!crop) {
    return null;
  }

  const margin = Math.min(crop.left, crop.top, 1 - crop.left - crop.width, 1 - crop.top - crop.height);
  if (margin < 0.015) {
    return null;
  }

  return {
    status: 'suggested',
    source: 'border-detection',
    confidence: Math.min(1, Math.round(((contrast / 255) * 0.8 + 0.2) * 1000) / 1000),
    crop
  };
}

function pageCrop(page) {
  return normalizeCrop(page?.crop);
}

function activeQualityFlags(page) {
  const quality = page?.quality;
  if (!quality || quality.ignored) {
    return [];
  }
  return Array.isArray(quality.flags) ? quality.flags : [];
}

function pageNeedsOcr(page) {
  return pageEditorial(page).imageMode !== 'image';
}

function pageReviewed(page) {
  return Boolean(page?.reviewed);
}

function pageMarkers(page) {
  const markers = page?.markers || {};
  const tags = Array.isArray(markers.tags)
    ? markers.tags.filter((tag, index, list) => PAGE_MARKER_TAGS.includes(tag) && list.indexOf(tag) === index)
    : [];
  return {
    tags,
    note: String(markers.note || '').trim()
  };
}

function markerLabel(tag) {
  return PAGE_MARKER_LABELS[tag] || tag;
}

function markerCount(pages, tag) {
  return pages.filter((page) => pageMarkers(page).tags.includes(tag)).length;
}

function filterPagesByMarker(pages) {
  if (!PAGE_MARKER_TAGS.includes(state.markerFilter)) {
    return pages;
  }
  return pages.filter((page) => pageMarkers(page).tags.includes(state.markerFilter));
}

function pageIds(pages = state.project?.pages || []) {
  return pages.map((page) => page.id);
}

function pruneBatchSelection(pages = state.project?.pages || []) {
  const available = new Set(pageIds(pages));
  state.selectedBatchPageIds = new Set(
    [...(state.selectedBatchPageIds || [])].filter((pageId) => available.has(pageId))
  );
}

function batchSelectedPages(pages = state.project?.pages || []) {
  return pages.filter((page) => state.selectedBatchPageIds.has(page.id));
}

function toggleBatchPageSelection(pageId, selected) {
  const next = new Set(state.selectedBatchPageIds);
  if (selected) {
    next.add(pageId);
  } else {
    next.delete(pageId);
  }
  state.selectedBatchPageIds = next;
  renderPages();
}

function pageNeedsReview(page) {
  return pageNeedsOcr(page) && !pageReviewed(page);
}

function ocrEligiblePages(pages) {
  return (pages || []).filter(pageNeedsOcr);
}

function reviewPendingPages(pages) {
  return (pages || []).filter(pageNeedsReview);
}

function pageRotation(page) {
  return [0, 90, 180, 270].includes(Number(page?.rotation)) ? Number(page.rotation) : 0;
}

function pageDeskew(page) {
  const angle = Number(page?.deskew?.angle);
  if (!Number.isFinite(angle) || Math.abs(angle) < 0.1) {
    return null;
  }
  return {
    angle,
    source: page.deskew.source || 'manual'
  };
}

function pageHasAdjustment(page) {
  return Boolean(pageCrop(page) || pageRotation(page) || pageDeskew(page));
}

function sameCrop(left, right) {
  return JSON.stringify(normalizeCrop(left)) === JSON.stringify(normalizeCrop(right));
}

function nextPageRotation(page, delta) {
  const steps = [0, 90, 180, 270];
  const currentIndex = steps.indexOf(pageRotation(page));
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (safeIndex + delta + steps.length) % steps.length;
  return steps[nextIndex];
}

function cropPercent(crop) {
  return `${Math.round(crop.left * 100)}%, ${Math.round(crop.top * 100)}%, ${Math.round(crop.width * 100)}% x ${Math.round(crop.height * 100)}%`;
}

function partTitleForPage(page, partNumber) {
  const editorial = pageEditorial(page);
  return editorial.partTitle || `Parte ${partNumber}`;
}

function chapterTitleForPage(page, chapterNumber, sectionNumber) {
  const editorial = pageEditorial(page);

  if (editorial.chapterStart) {
    return editorial.chapterTitle || `Capitulo ${chapterNumber}`;
  }

  return sectionNumber === 1 ? 'Inicio' : `Seccion ${sectionNumber}`;
}

function buildPageGroups(pages) {
  const groups = [];
  let currentChapter = null;
  let currentPart = null;
  let partNumber = 0;
  let chapterNumber = 0;
  let sectionNumber = 0;

  function closeCurrentChapter() {
    if (!currentChapter?.pages.length) {
      currentChapter = null;
      return;
    }

    if (currentPart) {
      currentPart.chapters.push(currentChapter);
      currentPart.pageCount += currentChapter.pages.length;
      currentPart.endPage = currentChapter.endPage;
    } else {
      groups.push(currentChapter);
    }

    currentChapter = null;
  }

  function startChapter(page) {
    const editorial = pageEditorial(page);
    if (editorial.chapterStart) {
      chapterNumber += 1;
    }
    sectionNumber += 1;

    return {
      type: 'chapter',
      key: `chapter:${page.id}`,
      title: chapterTitleForPage(page, chapterNumber || sectionNumber, sectionNumber),
      startPage: page.number,
      endPage: page.number,
      pages: []
    };
  }

  for (const page of pages) {
    const editorial = pageEditorial(page);

    if (editorial.partStart) {
      closeCurrentChapter();
      partNumber += 1;
      currentPart = {
        type: 'part',
        key: `part:${page.id}`,
        title: partTitleForPage(page, partNumber),
        startPage: page.number,
        endPage: page.number,
        pageCount: 0,
        leadPages: [],
        chapters: []
      };
      groups.push(currentPart);
    }

    if (editorial.chapterStart) {
      closeCurrentChapter();
      currentChapter = startChapter(page);
    } else if (!currentChapter) {
      const keepAsPartLead = currentPart && currentPart.chapters.length === 0;
      if (!keepAsPartLead) {
        currentChapter = startChapter(page);
      }
    }

    if (currentChapter) {
      currentChapter.pages.push(page);
      currentChapter.endPage = page.number;
    } else if (currentPart) {
      currentPart.leadPages.push(page);
      currentPart.pageCount += 1;
      currentPart.endPage = page.number;
    }

    if (editorial.chapterEnd) {
      closeCurrentChapter();
    }
  }

  closeCurrentChapter();
  return groups;
}

function buildBookIndexItems(pages) {
  const items = [];

  for (const group of buildPageGroups(pages)) {
    if (group.type === 'part') {
      items.push({
        type: 'part',
        title: group.title,
        page: group.startPage
      });

      for (const chapter of group.chapters) {
        items.push({
          type: 'chapter',
          title: chapter.title,
          startPage: chapter.startPage,
          endPage: chapter.endPage
        });
      }

      continue;
    }

    items.push({
      type: 'chapter',
      title: group.title,
      startPage: group.startPage,
      endPage: group.endPage
    });
  }

  return items;
}

function pageRangeLabel(startPage, endPage) {
  return startPage === endPage ? `pag. ${startPage}` : `pags. ${startPage}-${endPage}`;
}

function pagesCountLabel(count) {
  return `${count} ${count === 1 ? 'pagina' : 'paginas'}`;
}

function groupContainsPage(group, pageId) {
  if (!pageId) {
    return false;
  }

  if (group.type === 'part') {
    return (
      group.leadPages.some((page) => page.id === pageId) ||
      group.chapters.some((chapter) => groupContainsPage(chapter, pageId))
    );
  }

  return group.pages.some((page) => page.id === pageId);
}

function groupOpenState(key, fallback = false) {
  if (Object.prototype.hasOwnProperty.call(state.pageGroupOpen, key)) {
    return state.pageGroupOpen[key];
  }

  return fallback;
}

async function selectPage(pageId, options = {}) {
  const { reviewQueueMessage = null } = options;

  if (pageId === state.selectedPageId) {
    state.reviewQueueMessage = reviewQueueMessage;
    render();
    return;
  }

  try {
    await persistCurrentPageDraft();
  } catch (error) {
    showToast(error.message);
    return;
  }

  state.reviewQueueMessage = reviewQueueMessage;
  state.selectedPageId = pageId;
  render();
  await loadSelectedPageText();
}

async function openReadingPage(target = {}) {
  if (!target.pageId || state.busy) {
    return;
  }

  showMainView('editor');
  await selectPage(target.pageId);
  showEditorPane(target.pane || 'text');

  const focusTarget = target.pane === 'structure' ? els.editorialStatus : els.ocrText;
  focusTarget?.focus?.();
}

function createPageItem(page) {
  const row = document.createElement('div');
  row.className = 'page-item-row';
  row.dataset.pageId = page.id;

  const selectorLabel = document.createElement('label');
  selectorLabel.className = 'page-select-control';
  selectorLabel.title = `Seleccionar pagina ${page.number}`;
  const selector = document.createElement('input');
  selector.type = 'checkbox';
  selector.checked = state.selectedBatchPageIds.has(page.id);
  selector.disabled = state.busy;
  selector.setAttribute('aria-label', `Seleccionar pagina ${page.number}`);
  selector.addEventListener('change', () => {
    toggleBatchPageSelection(page.id, selector.checked);
  });
  selectorLabel.append(selector);

  const item = document.createElement('button');
  item.type = 'button';
  item.className = `page-item ${page.id === state.selectedPageId ? 'selected' : ''} ${
    pageNeedsReview(page) ? 'pending-review' : ''
  }`.trim();
  item.dataset.pageId = page.id;
  item.addEventListener('click', async () => {
    await selectPage(page.id);
  });

  const image = document.createElement('img');
  image.alt = `Pagina ${page.number}`;
  image.src = `/api/projects/${state.project.id}/pages/${page.id}/image?${page.updatedAt}`;

  const body = document.createElement('span');
  body.className = 'page-item-meta';

  const title = document.createElement('strong');
  title.textContent = `Pagina ${page.number}`;

  const status = document.createElement('span');
  status.className = `status-${page.status}`;
  status.textContent = pageStatus(page);
  body.append(title, status);

  const badges = pageBadges(page);
  if (badges.length) {
    const metadata = document.createElement('span');
    metadata.className = 'page-badges';
    metadata.textContent = badges.join(' · ');
    body.append(metadata);
  }

  item.append(image, body);
  row.append(selectorLabel, item);
  return row;
}

function createChapterGroup(chapter, options = {}) {
  const { nested = false, fallbackOpen = false } = options;
  const containsSelected = groupContainsPage(chapter, state.selectedPageId);
  const details = document.createElement('details');
  details.className = `page-group page-group-chapter${nested ? ' nested' : ''}`;
  details.open = containsSelected || groupOpenState(chapter.key, fallbackOpen);
  details.addEventListener('toggle', () => {
    state.pageGroupOpen[chapter.key] = details.open;
  });

  const summary = document.createElement('summary');
  summary.className = 'page-group-summary';

  const heading = document.createElement('span');
  heading.className = 'page-group-heading';

  const title = document.createElement('strong');
  title.textContent = chapter.title;

  const meta = document.createElement('span');
  meta.className = 'page-group-meta';
  meta.textContent = `${pagesCountLabel(chapter.pages.length)} · ${pageRangeLabel(chapter.startPage, chapter.endPage)}`;
  heading.append(title, meta);

  summary.append(heading);
  details.append(summary);

  const pages = document.createElement('div');
  pages.className = 'page-group-pages';

  for (const page of chapter.pages) {
    pages.append(createPageItem(page));
  }

  details.append(pages);
  return details;
}

function createPartGroup(part, fallbackOpen = false) {
  const containsSelected = groupContainsPage(part, state.selectedPageId);
  const details = document.createElement('details');
  details.className = 'page-group page-group-part';
  details.open = containsSelected || groupOpenState(part.key, fallbackOpen);
  details.addEventListener('toggle', () => {
    state.pageGroupOpen[part.key] = details.open;
  });

  const summary = document.createElement('summary');
  summary.className = 'page-group-summary';

  const heading = document.createElement('span');
  heading.className = 'page-group-heading';

  const title = document.createElement('strong');
  title.textContent = part.title;

  const meta = document.createElement('span');
  meta.className = 'page-group-meta';
  const metaParts = [];
  if (part.chapters.length) {
    metaParts.push(`${part.chapters.length} ${part.chapters.length === 1 ? 'capitulo' : 'capitulos'}`);
  }
  metaParts.push(pagesCountLabel(part.pageCount), pageRangeLabel(part.startPage, part.endPage));
  meta.textContent = metaParts.join(' · ');
  heading.append(title, meta);

  summary.append(heading);
  details.append(summary);

  if (part.leadPages.length) {
    const leadPages = document.createElement('div');
    leadPages.className = 'page-group-pages page-group-pages-inline';

    for (const page of part.leadPages) {
      leadPages.append(createPageItem(page));
    }

    details.append(leadPages);
  }

  if (part.chapters.length) {
    const chapters = document.createElement('div');
    chapters.className = 'page-subgroups';

    part.chapters.forEach((chapter, index) => {
      const chapterFallbackOpen = containsSelected
        ? groupContainsPage(chapter, state.selectedPageId)
        : !state.selectedPageId && index === 0;
      chapters.append(createChapterGroup(chapter, { nested: true, fallbackOpen: chapterFallbackOpen }));
    });

    details.append(chapters);
  }

  return details;
}

function editorialDraftFromInputs() {
  return {
    reviewed: els.pageReviewedInput.checked,
    imageMode: els.pageImageModeInput.checked ? 'image' : 'text',
    partStart: els.partStartInput.checked,
    partTitle: els.partTitleInput.value,
    chapterStart: els.chapterStartInput.checked,
    chapterTitle: els.chapterTitleInput.value,
    chapterHeaderMode: els.chapterHeaderModeInput.value,
    chapterEnd: els.chapterEndInput.checked
  };
}

function sameEditorial(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function textToPreviewBlocks(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((paragraph, index) => ({
      type: paragraph.length <= 80 && paragraph === paragraph.toUpperCase() ? 'heading' : 'paragraph',
      text: paragraph,
      indent: index !== 0
    }));
}

function renderFormattedPreview(layout, text) {
  const blocks = layout?.blocks?.length ? layout.blocks : textToPreviewBlocks(text);

  if (!blocks.length) {
    els.formattedPreview.innerHTML = '<p class="empty-page">Sin texto para previsualizar.</p>';
    return;
  }

  els.formattedPreview.innerHTML = blocks
    .map((block, index) => {
      const escapedText = escapeHtml(block.text);
      if (block.type === 'heading') {
        return `<h3>${escapedText}</h3>`;
      }
      if (block.type === 'centered') {
        return `<p class="centered">${escapedText}</p>`;
      }
      const className = block.indent === false || index === 0 ? 'no-indent' : '';
      return `<p class="${className}">${escapedText}</p>`;
    })
    .join('');
}

function currentPage() {
  return state.project?.pages.find((page) => page.id === state.selectedPageId) || null;
}

function activeMainView() {
  return document.querySelector('[data-view-tab][aria-selected="true"]')?.getAttribute('data-view-tab') || 'library';
}

function updateEditorialControlState() {
  const hasPage = Boolean(currentPage());
  const enabled = hasPage && !state.busy;
  const partStart = els.partStartInput.checked;
  const chapterStart = els.chapterStartInput.checked;
  const crop = normalizeCrop(state.draftCrop);

  els.pageReviewedInput.disabled = !enabled;
  els.pageImageModeInput.disabled = !enabled;
  els.partStartInput.disabled = !enabled;
  els.partTitleInput.disabled = !enabled || !partStart;
  els.chapterStartInput.disabled = !enabled;
  els.chapterEndInput.disabled = !enabled;
  els.chapterTitleInput.disabled = !enabled || !chapterStart;
  els.chapterHeaderModeInput.disabled = !enabled || !chapterStart;
  els.saveEditorialButton.disabled = !enabled;
  els.saveCropButton.disabled = !enabled || !crop;
  els.clearCropButton.disabled = !enabled || (!crop && !pageCrop(currentPage()));
  els.compareAdjustmentButton.disabled = !enabled || !pageHasAdjustment(currentPage());
  els.cropRangeStartInput.disabled = !enabled;
  els.cropRangeEndInput.disabled = !enabled;
  els.applyCropRangeButton.disabled = !enabled || !(crop || pageCrop(currentPage()));

  if (!partStart) {
    els.partTitleInput.value = '';
  }
  if (!chapterStart) {
    els.chapterHeaderModeInput.value = 'none';
  }
}

function setDraftCrop(crop) {
  state.draftCrop = normalizeCrop(crop);
  renderCropOverlay();
  updateEditorialControlState();
}

function renderCropOverlay() {
  const crop = normalizeCrop(state.draftCrop);

  if (!crop) {
    els.cropOverlay.hidden = true;
    els.cropStatus.textContent = currentPage()
      ? 'Arrastra sobre la imagen para elegir el area util.'
      : 'Elige una pagina para recortarla.';
    return;
  }

  els.cropOverlay.hidden = false;
  els.cropOverlay.style.left = `${crop.left * 100}%`;
  els.cropOverlay.style.top = `${crop.top * 100}%`;
  els.cropOverlay.style.width = `${crop.width * 100}%`;
  els.cropOverlay.style.height = `${crop.height * 100}%`;
  els.cropStatus.textContent = `Recorte preparado: ${cropPercent(crop)}.`;
}

function pointInImage(event) {
  const rect = els.selectedImage.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return null;
  }

  return {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp((event.clientY - rect.top) / rect.height)
  };
}

function cropFromPoints(start, end) {
  if (!start || !end) {
    return null;
  }

  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return normalizeCrop({ left, top, width, height });
}

function setBusy(value) {
  state.busy = value;
  render();
}

async function loadProjects() {
  const { projects } = await api('/api/projects');
  state.projects = projects;

  if (!state.project && projects.length > 0) {
    await loadProject(projects[0].id);
  } else {
    render();
  }
}

async function loadSystemSupport({ refresh = false, silent = false } = {}) {
  state.checkingUpdates = true;
  state.installedVersion = currentVersionMeta() || state.installedVersion;
  if (!state.system) {
    renderSupportPanel();
  } else {
    render();
  }

  try {
    const { system } = await api(`/api/system${refresh ? '?refresh=1' : ''}`);
    state.system = system;
    state.installedVersion = system.appVersion || state.installedVersion;
    state.systemError = null;
    if (refresh && !silent) {
      if (system.update?.available) {
        showToast(`Nueva versión disponible: ${system.update.latestVersion}`);
      } else if (system.update?.error) {
        showToast('No se pudo comprobar si hay una versión nueva.');
      } else {
        showToast(upToDateToastCopy(system));
      }
    }
  } catch (error) {
    state.systemError = `No se pudo leer la compatibilidad del sistema. ${error.message}`;
    if (state.system) {
      showToast(error.message);
    }
  } finally {
    state.checkingUpdates = false;
    render();
  }
}

async function waitForServerAfterUpdate(expectedVersion) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await delay(1500);

    try {
      const { system } = await api('/api/system?refresh=1');
      state.system = system;
      state.installedVersion = system.appVersion || state.installedVersion;
      state.systemError = null;
      state.updatingApp = false;
      render();

      if (!expectedVersion || system.appVersion === expectedVersion) {
        showToast(updatedToastCopy(system));
        window.location.reload();
        return;
      }
    } catch {
      // The server may be offline for a few seconds while the update is applied.
    }
  }

  state.updatingApp = false;
  render();
  showToast('La actualización se lanzó, pero no se pudo confirmar el reinicio automático.');
}

async function runSelfUpdate() {
  if (state.updatingApp) {
    return;
  }

  state.updatingApp = true;
  render();

  try {
    const result = await api('/api/system/update', {
      method: 'POST',
      body: '{}'
    });
    showToast(result.message);
    await waitForServerAfterUpdate(result.expectedVersion);
  } catch (error) {
    state.updatingApp = false;
    render();
    showToast(error.message);
  }
}

function openAiOcrSettings() {
  const settings = aiOcrSettings();
  const adapter = selectedAiOcrAdapter(settings);
  els.aiOcrSettingsStatus.textContent = settings.configured
    ? `Proveedor: ${settings.providerLabel}. Clave configurada: ${settings.maskedApiKey}. Origen: ${
        settings.source === 'env' ? 'variable de entorno' : 'archivo local'
      }.`
    : 'Configura una clave local para activar el OCR avanzado con IA.';
  els.aiOcrProviderInput.value = settings.provider || 'openai';
  els.aiOcrProviderInput.disabled = !settings.canEditKey;
  els.aiOcrApiKeyInput.value = '';
  els.aiOcrApiKeyInput.disabled = !settings.canEditKey;
  els.aiOcrApiKeyInput.placeholder = settings.canEditKey
    ? settings.configured
      ? 'Dejar vacio para conservar la clave actual'
      : 'sk-...'
    : 'Gestionada por variable de entorno';
  ensureSelectOption(els.aiOcrModelInput, settings.model || adapter?.defaultModel, settings.model || adapter?.defaultModel);
  els.aiOcrModelInput.value = settings.model || adapter?.defaultModel || 'gpt-5.4-mini';
  els.aiOcrModelInput.disabled = !settings.canEditKey;
  els.aiOcrBaseUrlInput.value = settings.baseUrl || '';
  els.aiOcrBaseUrlInput.disabled = !settings.canEditKey;
  els.aiOcrBaseUrlLabel.hidden = !adapter?.requiresBaseUrl;
  els.clearAiOcrSettingsButton.disabled = !settings.configured || !settings.canEditKey;
  els.aiOcrSettingsDialog.showModal();
}

function updateAiOcrProviderFields() {
  const adapter = aiOcrAdapterById(els.aiOcrProviderInput.value);
  if (!adapter) {
    return;
  }

  ensureSelectOption(els.aiOcrModelInput, adapter.defaultModel, adapter.defaultModel);
  if (!els.aiOcrModelInput.value) {
    els.aiOcrModelInput.value = adapter.defaultModel;
  }
  if (!els.aiOcrBaseUrlInput.value && adapter.defaultBaseUrl) {
    els.aiOcrBaseUrlInput.value = adapter.defaultBaseUrl;
  }
  els.aiOcrBaseUrlLabel.hidden = !adapter.requiresBaseUrl;
}

async function saveAiOcrSettings(event) {
  event.preventDefault();

  try {
    const { aiOcr } = await api('/api/settings/ai-ocr', {
      method: 'PUT',
      body: JSON.stringify({
        apiKey: els.aiOcrApiKeyInput.value,
        provider: els.aiOcrProviderInput.value,
        model: els.aiOcrModelInput.value,
        baseUrl: els.aiOcrBaseUrlInput.value
      })
    });
    els.aiOcrApiKeyInput.value = '';
    if (state.system) {
      state.system.aiOcr = aiOcr;
    }
    await loadSystemSupport();
    els.aiOcrSettingsDialog.close();
    showToast(aiOcr.configured ? 'OCR con IA configurado.' : 'Ajustes de IA OCR guardados.');
  } catch (error) {
    showToast(error.message);
  }
}

async function clearAiOcrSettings() {
  try {
    const { aiOcr } = await api('/api/settings/ai-ocr', { method: 'DELETE' });
    els.aiOcrApiKeyInput.value = '';
    if (state.system) {
      state.system.aiOcr = aiOcr;
    }
    await loadSystemSupport();
    els.aiOcrSettingsDialog.close();
    showToast('Clave local de IA OCR eliminada.');
  } catch (error) {
    showToast(error.message);
  }
}

async function loadProject(projectId) {
  const { project } = await api(`/api/projects/${projectId}`);
  const selectedPageId = state.selectedPageId;
  const projectChanged = state.project?.id !== project.id;
  state.project = project;
  state.dictionary = null;
  state.reading = null;
  state.inboxPreview = null;
  if (projectChanged) {
    state.pageGroupOpen = {};
    state.reviewQueueMessage = null;
    state.adjustmentComparison = null;
    state.suspiciousReview = null;
    state.exportHistory = null;
    state.trash = null;
    state.search = createEmptySearchState();
    state.markerFilter = 'all';
    state.selectedBatchPageIds = new Set();
  }
  pruneBatchSelection(project.pages);
  state.selectedPageId = project.pages.some((page) => page.id === selectedPageId)
    ? selectedPageId
    : project.pages[0]?.id || null;
  await loadMobileCaptureStatus({ renderAfter: false });
  await loadDictionary(project.id, { renderAfter: false });
  await loadExportHistory(project.id, { renderAfter: false });
  await loadSnapshots(project.id, { renderAfter: false });
  await loadTrash(project.id, { renderAfter: false });
  render();
  await loadSelectedPageText();
  if (activeMainView() === 'reading') {
    await loadReadingView({ renderAfter: true });
  }
}

async function loadDictionary(projectId, { renderAfter = true } = {}) {
  const { dictionary } = await api(`/api/projects/${projectId}/dictionary`);
  if (state.project?.id === projectId) {
    state.dictionary = dictionary;
  }
  if (renderAfter) {
    render();
  }
}

async function loadExportHistory(projectId, { renderAfter = true } = {}) {
  const { history } = await api(`/api/projects/${projectId}/export/history`);
  if (state.project?.id === projectId) {
    state.exportHistory = history;
  }
  if (renderAfter) {
    render();
  }
}

async function loadSnapshots(projectId, { renderAfter = true } = {}) {
  const { snapshots } = await api(`/api/projects/${projectId}/snapshots`);
  if (state.project?.id === projectId) {
    state.snapshots = snapshots;
  }
  if (renderAfter) {
    render();
  }
}

async function loadTrash(projectId, { renderAfter = true } = {}) {
  const { trash } = await api(`/api/projects/${projectId}/trash`);
  if (state.project?.id === projectId) {
    state.trash = trash;
  }
  if (renderAfter) {
    render();
  }
}

async function loadReadingView({ force = false, renderAfter = true } = {}) {
  if (!state.project || state.readingLoading) {
    return;
  }

  if (state.reading && !force) {
    if (renderAfter) {
      render();
    }
    return;
  }

  const projectId = state.project.id;
  state.readingLoading = true;
  if (renderAfter) {
    render();
  }

  try {
    const { reading } = await api(`/api/projects/${projectId}/reading`);
    if (state.project?.id === projectId) {
      state.reading = reading;
    }
  } catch (error) {
    showToast(error.message);
  } finally {
    state.readingLoading = false;
    if (renderAfter) {
      render();
    }
  }
}

async function refreshProject() {
  if (!state.project) {
    return;
  }
  await loadProject(state.project.id);
}

function mobileCaptureIsActive() {
  return Boolean(state.mobileCapture?.active && state.mobileCapture.projectId === state.project?.id);
}

async function loadMobileCaptureStatus({ renderAfter = true } = {}) {
  if (!state.project) {
    state.mobileCapture = null;
    if (renderAfter) {
      render();
    }
    return;
  }

  const projectId = state.project.id;
  const { mobileCapture } = await api(`/api/projects/${projectId}/mobile-capture`);
  if (state.project?.id === projectId) {
    state.mobileCapture = mobileCapture;
  }

  if (renderAfter) {
    render();
  }
}

function renderProjects() {
  els.projectSelect.innerHTML = '';

  if (state.projects.length === 0) {
    const option = document.createElement('option');
    option.textContent = 'Sin libros';
    option.value = '';
    els.projectSelect.append(option);
    els.projectSelect.disabled = true;
    return;
  }

  els.projectSelect.disabled = false;
  for (const project of state.projects) {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = `${project.title} (${project.pageCount})`;
    option.selected = project.id === state.project?.id;
    els.projectSelect.append(option);
  }
}

function createLibraryStat(label, value, meta = '') {
  const item = document.createElement('article');
  item.className = 'library-stat';
  const title = document.createElement('span');
  title.textContent = label;
  const number = document.createElement('strong');
  number.textContent = String(value);
  item.append(title, number);
  if (meta) {
    const detail = document.createElement('small');
    detail.textContent = meta;
    item.append(detail);
  }
  return item;
}

async function openDashboardProject(projectId, view = 'editor') {
  if (!projectId || state.busy) {
    return;
  }

  setBusy(true);
  try {
    await persistCurrentPageDraft({ keepBusy: true });
    await loadProject(projectId);
    showMainView(view);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

function createLibraryProjectCard(project) {
  const progress = project.progress || {};
  const card = document.createElement('article');
  card.className = 'library-project';

  const body = document.createElement('div');
  body.className = 'library-project-body';

  const title = document.createElement('h2');
  title.textContent = project.title || 'Libro sin título';
  const meta = document.createElement('p');
  meta.textContent = [
    project.author || 'Autor sin indicar',
    `${progress.pageCount || project.pageCount || 0} páginas`,
    `${progress.reviewedPercent || 0}% revisado`
  ].join(' · ');
  const status = document.createElement('span');
  status.className = `library-status status-${progress.exportStatus || 'draft'}`;
  status.textContent = `${progressStatusLabel(progress.exportStatus)} · ${
    progress.pendingProblemCount || 0
  } problemas`;
  body.append(title, meta, status);

  const actions = document.createElement('div');
  actions.className = 'library-project-actions';
  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'ghost';
  editButton.textContent = 'Abrir';
  editButton.disabled = state.busy;
  editButton.addEventListener('click', () => openDashboardProject(project.id, 'editor'));

  const captureButton = document.createElement('button');
  captureButton.type = 'button';
  captureButton.className = 'subtle';
  captureButton.textContent = 'Capturar';
  captureButton.disabled = state.busy;
  captureButton.addEventListener('click', () => openDashboardProject(project.id, 'capture'));

  actions.append(editButton, captureButton);
  card.append(body, actions);
  return card;
}

function renderLibraryDashboard() {
  const summary = summarizeLibraryDashboard(state.projects);
  const filters = [
    ['all', 'Todos'],
    ['capture', 'Captura'],
    ['review', 'Revisión'],
    ['ready', 'Listos'],
    ['exported', 'Exportados']
  ];
  const visibleProjects = filterLibraryProjects(state.projects, state.libraryFilter);
  els.libraryStats.innerHTML = '';
  els.libraryFilters.innerHTML = '';
  els.libraryList.innerHTML = '';

  els.libraryStats.append(
    createLibraryStat('Libros', summary.bookCount),
    createLibraryStat('Páginas', summary.pageCount),
    createLibraryStat('Revisión media', `${summary.averageReviewedPercent}%`),
    createLibraryStat('Problemas', summary.pendingProblemCount, `${summary.readyCount} listos`)
  );

  for (const [filter, label] of filters) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = state.libraryFilter === filter ? 'library-filter active' : 'library-filter';
    button.textContent = label;
    button.disabled = state.busy;
    button.setAttribute('aria-pressed', state.libraryFilter === filter ? 'true' : 'false');
    button.addEventListener('click', () => {
      state.libraryFilter = filter;
      render();
    });
    els.libraryFilters.append(button);
  }

  if (!state.projects.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Aún no hay libros locales. Crea uno para empezar a capturar páginas.';
    els.libraryList.append(empty);
    return;
  }

  if (!visibleProjects.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No hay libros en este filtro.';
    els.libraryList.append(empty);
    return;
  }

  for (const project of visibleProjects) {
    els.libraryList.append(createLibraryProjectCard(project));
  }
}

function renderExportHistory() {
  const history = state.exportHistory || [];
  els.exportHistoryList.innerHTML = '';
  els.openExportFolderButton.disabled = !state.project || state.busy;

  if (!state.project) {
    els.exportHistoryStatus.textContent = 'Abre un libro para ver sus EPUBs generados.';
    return;
  }

  if (!history.length) {
    els.exportHistoryStatus.textContent = 'Este libro todavía no tiene exportaciones registradas.';
    return;
  }

  els.exportHistoryStatus.textContent = `${history.length} ${history.length === 1 ? 'exportación registrada' : 'exportaciones registradas'}.`;

  for (const entry of history) {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = entry.fileName;
    const summary = entry.summary || {};
    const validation = entry.validation || {};
    const meta = document.createElement('span');
    meta.textContent = [
      formatDateTime(entry.exportedAt),
      `BookSaver ${entry.appVersion || 'desconocida'}`,
      `${summary.pageCount || 0} páginas`,
      `${summary.chapterCount || 0} capítulos`,
      validation.valid === false ? `${validation.errorCount || 0} avisos` : 'sin avisos'
    ].join(' · ');
    item.append(title, meta);
    els.exportHistoryList.append(item);
  }
}

function snapshotReasonLabel(reason) {
  const labels = {
    manual: 'Manual',
    'delete-page': 'Borrado de página',
    'reorder-pages': 'Reordenado de páginas',
    'crop-range': 'Recorte por rango',
    'run-ocr': 'Lectura OCR',
    'dictionary-replacements': 'Reemplazos',
    'import-inbox': 'Importación',
    'restore-snapshot': 'Antes de restaurar'
  };
  return labels[reason] || 'Snapshot local';
}

function renderSnapshotHistory() {
  const snapshots = state.snapshots || [];
  els.snapshotHistoryList.innerHTML = '';

  if (!state.project) {
    els.snapshotHistoryStatus.textContent = 'Abre un libro para ver puntos de recuperación locales.';
    return;
  }

  if (!snapshots.length) {
    els.snapshotHistoryStatus.textContent = 'Este libro todavía no tiene snapshots de recuperación.';
    return;
  }

  els.snapshotHistoryStatus.textContent = `${snapshots.length} ${snapshots.length === 1 ? 'snapshot local' : 'snapshots locales'}.`;

  for (const snapshot of snapshots) {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = snapshotReasonLabel(snapshot.reason);
    const affectedCount = snapshot.affectedPageIds?.length || 0;
    const meta = document.createElement('span');
    meta.textContent = [
      formatDateTime(snapshot.createdAt),
      `${snapshot.pageCount || 0} páginas`,
      affectedCount ? `${affectedCount} afectadas` : 'libro completo'
    ].join(' · ');
    const actions = document.createElement('div');
    actions.className = 'snapshot-history-actions';
    const restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'subtle';
    restoreButton.textContent = 'Restaurar';
    restoreButton.disabled = state.busy;
    restoreButton.addEventListener('click', () => restoreSnapshot(snapshot.id));
    actions.append(restoreButton);
    item.append(title, meta, actions);
    els.snapshotHistoryList.append(item);
  }
}

function renderTrashHistory() {
  const trash = state.trash || [];
  const maxPosition = (state.project?.pages.length || 0) + 1;
  els.trashHistoryList.innerHTML = '';
  els.emptyTrashButton.disabled = !state.project || !trash.length || state.busy;

  if (!state.project) {
    els.trashHistoryStatus.textContent = 'Abre un libro para ver páginas borradas recuperables.';
    return;
  }

  if (!trash.length) {
    els.trashHistoryStatus.textContent = 'La papelera de este libro está vacía.';
    return;
  }

  els.trashHistoryStatus.textContent = `${trash.length} ${trash.length === 1 ? 'página recuperable' : 'páginas recuperables'}.`;

  for (const entry of trash) {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = `Página ${entry.originalNumber || entry.pageId}`;
    const meta = document.createElement('span');
    meta.textContent = [
      formatDateTime(entry.deletedAt),
      entry.chapterTitle || 'Sin capítulo',
      entry.reviewed ? 'revisada' : 'sin revisar'
    ].join(' · ');
    const actions = document.createElement('div');
    actions.className = 'trash-history-actions';
    const positionLabel = document.createElement('label');
    positionLabel.textContent = 'Pos.';
    const positionInput = document.createElement('input');
    positionInput.type = 'number';
    positionInput.min = '1';
    positionInput.max = String(maxPosition);
    positionInput.value = String(maxPosition);
    positionInput.inputMode = 'numeric';
    positionInput.setAttribute('aria-label', `Posición para restaurar la página ${entry.originalNumber || entry.pageId}`);
    positionInput.disabled = state.busy;
    const restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'subtle';
    restoreButton.textContent = 'Restaurar';
    restoreButton.disabled = state.busy;
    restoreButton.addEventListener('click', () => restoreTrashedPage(entry.id, positionInput.value));
    positionLabel.append(positionInput);
    actions.append(positionLabel, restoreButton);
    item.append(title, meta, actions);
    els.trashHistoryList.append(item);
  }
}

function renderBookSearch() {
  const pages = state.project?.pages || [];
  const query = state.search.query || '';
  const result = state.search.result;
  els.bookSearchInput.value = query;
  els.bookSearchInput.disabled = !state.project || pages.length === 0 || state.busy;
  els.bookSearchButton.disabled = !state.project || pages.length === 0 || state.busy || !query.trim();
  els.bookSearchResults.innerHTML = '';

  if (!state.project) {
    els.bookSearchStatus.textContent = 'Abre un libro para buscar en su OCR.';
    return;
  }

  if (!pages.length) {
    els.bookSearchStatus.textContent = 'Captura o importa páginas antes de buscar.';
    return;
  }

  if (!result) {
    els.bookSearchStatus.textContent = 'Busca una palabra o frase en el texto OCR del libro.';
    return;
  }

  if (!result.totalMatches) {
    els.bookSearchStatus.textContent = `Sin resultados para "${result.query}".`;
    return;
  }

  els.bookSearchStatus.textContent = `${result.totalMatches} ${
    result.totalMatches === 1 ? 'coincidencia' : 'coincidencias'
  } en ${result.pages.length} ${result.pages.length === 1 ? 'página' : 'páginas'}.`;

  for (const pageResult of result.pages) {
    const item = document.createElement('li');
    const header = document.createElement('div');
    header.className = 'book-search-result-header';
    const title = document.createElement('strong');
    title.textContent = `Página ${pageResult.pageNumber}`;
    const count = document.createElement('span');
    count.textContent = `${pageResult.matchCount} ${pageResult.matchCount === 1 ? 'coincidencia' : 'coincidencias'}`;
    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.className = 'subtle';
    openButton.textContent = 'Abrir';
    openButton.disabled = state.busy;
    openButton.addEventListener('click', () => openSearchResult(pageResult.pageId));
    header.append(title, count, openButton);

    const excerpts = document.createElement('ul');
    excerpts.className = 'book-search-excerpts';
    for (const match of pageResult.matches.slice(0, 3)) {
      const excerpt = document.createElement('li');
      excerpt.textContent = match.excerpt;
      excerpts.append(excerpt);
    }

    item.append(header, excerpts);
    els.bookSearchResults.append(item);
  }
}

function renderPageMarkers() {
  const page = currentPage();
  const markers = pageMarkers(page);
  els.pageMarkerTags.innerHTML = '';
  els.pageMarkerNote.value = markers.note;
  els.pageMarkerNote.disabled = !page || state.busy;
  els.saveMarkersButton.disabled = !page || state.busy;

  for (const tag of PAGE_MARKER_TAGS) {
    const label = document.createElement('label');
    label.className = 'checkbox-label marker-tag-control';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = tag;
    input.checked = markers.tags.includes(tag);
    input.disabled = !page || state.busy;
    label.append(input, markerLabel(tag));
    els.pageMarkerTags.append(label);
  }
}

function renderPageTextHistory() {
  const page = currentPage();
  const history = Array.isArray(page?.textHistory) ? page.textHistory : [];
  els.textHistoryList.innerHTML = '';

  if (!page) {
    els.textHistoryStatus.textContent = 'Elige una página para ver versiones anteriores.';
    return;
  }

  if (!history.length) {
    els.textHistoryStatus.textContent = 'Sin versiones anteriores guardadas para esta página.';
    return;
  }

  els.textHistoryStatus.textContent =
    history.length === 1 ? '1 versión anterior disponible.' : `${history.length} versiones anteriores disponibles.`;
  const currentText = els.ocrText.value || page.ocrText || '';

  for (const entry of history) {
    const item = document.createElement('li');
    const header = document.createElement('div');
    header.className = 'text-history-header';
    const title = document.createElement('strong');
    title.textContent = textHistorySourceLabel(entry.source);
    const meta = document.createElement('span');
    meta.textContent = formatDateTime(entry.createdAt);
    header.append(title, meta);

    const before = document.createElement('p');
    before.className = 'text-history-snippet';
    before.textContent = `Versión guardada: ${compactTextSnippet(entry.text)}`;
    const after = document.createElement('p');
    after.className = 'text-history-snippet';
    after.textContent = `Texto actual: ${compactTextSnippet(currentText)}`;

    const actions = document.createElement('div');
    actions.className = 'text-history-actions';
    if (entry.note) {
      const note = document.createElement('span');
      note.textContent = entry.note;
      actions.append(note);
    }
    const restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'subtle';
    restoreButton.textContent = 'Restaurar';
    restoreButton.disabled = state.busy;
    restoreButton.addEventListener('click', () => restoreTextHistory(entry.id));
    actions.append(restoreButton);

    item.append(header, before, after, actions);
    els.textHistoryList.append(item);
  }
}

function readingWarningLabel(warning) {
  return warning?.message || 'Aviso de revisión.';
}

function renderReadingBlocks(container, page) {
  const blocks = Array.isArray(page.blocks) ? page.blocks : [];

  if (page.imageMode === 'image') {
    const imageNotice = document.createElement('p');
    imageNotice.className = 'reading-image-notice';
    imageNotice.textContent = 'Página marcada como imagen en el EPUB.';
    container.append(imageNotice);
    return;
  }

  if (!blocks.length) {
    const empty = document.createElement('p');
    empty.className = 'reading-empty-text';
    empty.textContent = 'Sin texto revisado.';
    container.append(empty);
    return;
  }

  for (const [index, block] of blocks.entries()) {
    const element = block.type === 'heading' ? document.createElement('h3') : document.createElement('p');
    element.textContent = block.text;
    if (block.indent === false || index === 0) {
      element.classList.add('no-indent');
    }
    if (block.type === 'centered') {
      element.classList.add('centered');
    }
    container.append(element);
  }
}

function createReadingPage(page) {
  const item = document.createElement('article');
  item.className = `reading-page ${page.warnings?.length ? 'has-warnings' : ''}`.trim();
  item.id = `reading-${page.pageId}`;

  const header = document.createElement('div');
  header.className = 'reading-page-header';
  const title = document.createElement('strong');
  title.textContent = `Página ${page.number || page.pageId}`;
  const meta = document.createElement('span');
  meta.textContent = page.imageMode === 'image' ? 'Imagen EPUB' : pageStatus(page);
  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'subtle';
  openButton.textContent = 'Abrir';
  openButton.disabled = state.busy;
  openButton.addEventListener('click', () => openReadingPage(page.jumpTarget));
  header.append(title, meta, openButton);
  item.append(header);

  if (page.warnings?.length) {
    const warnings = document.createElement('ul');
    warnings.className = 'reading-page-warnings';
    for (const warning of page.warnings) {
      const warningItem = document.createElement('li');
      warningItem.textContent = readingWarningLabel(warning);
      warnings.append(warningItem);
    }
    item.append(warnings);
  }

  const body = document.createElement('div');
  body.className = 'reading-page-body';
  renderReadingBlocks(body, page);
  item.append(body);

  return item;
}

function renderReadingView() {
  els.readingNavigation.innerHTML = '';
  els.readingChapters.innerHTML = '';
  els.refreshReadingButton.disabled = !state.project || state.readingLoading || state.busy;

  if (!state.project) {
    els.readingStatus.textContent = 'Abre un libro para revisar la lectura continua.';
    return;
  }

  if (state.readingLoading) {
    els.readingStatus.textContent = 'Preparando lectura continua...';
    return;
  }

  const reading = state.reading;
  if (!reading) {
    els.readingStatus.textContent = 'Actualiza la vista para revisar el libro completo en orden de lectura.';
    return;
  }

  els.readingStatus.textContent = `${reading.pageCount} ${
    reading.pageCount === 1 ? 'página' : 'páginas'
  } · ${reading.chapterCount} ${reading.chapterCount === 1 ? 'capítulo' : 'capítulos'} · ${
    reading.warningCount
  } ${reading.warningCount === 1 ? 'aviso' : 'avisos'}.`;

  for (const chapter of reading.chapters) {
    const navItem = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#reading-${chapter.id}`;
    link.textContent = chapter.title;
    navItem.append(link);
    els.readingNavigation.append(navItem);

    const section = document.createElement('section');
    section.id = `reading-${chapter.id}`;
    section.className = 'reading-chapter';
    const heading = document.createElement('div');
    heading.className = 'reading-chapter-heading';
    const title = document.createElement('h2');
    title.textContent = chapter.title;
    const meta = document.createElement('span');
    meta.textContent =
      chapter.pageStart && chapter.pageEnd
        ? `Páginas ${chapter.pageStart}-${chapter.pageEnd}`
        : `${chapter.pageCount} ${chapter.pageCount === 1 ? 'página' : 'páginas'}`;
    heading.append(title, meta);
    section.append(heading);

    if (!chapter.pages.length) {
      const empty = document.createElement('p');
      empty.className = 'reading-empty-text';
      empty.textContent = 'Sin páginas en este capítulo.';
      section.append(empty);
    }

    for (const page of chapter.pages) {
      section.append(createReadingPage(page));
    }

    els.readingChapters.append(section);
  }
}

function pageBadges(page) {
  const editorial = pageEditorial(page);
  const cover = projectCover(state.project);
  const markers = pageMarkers(page);
  const badges = [];

  if (pageNeedsReview(page)) {
    badges.push('Pendiente');
  }
  if (cover.mode === 'page' && cover.pageId === page.id) {
    badges.push('Portada');
  }
  if (editorial.partStart) {
    badges.push(editorial.partTitle ? `Parte: ${editorial.partTitle}` : 'Inicio de parte');
  }
  if (editorial.chapterStart) {
    badges.push(editorial.chapterTitle ? `Inicio: ${editorial.chapterTitle}` : 'Inicio de capitulo');
  }
  if (editorial.chapterEnd) {
    badges.push('Fin de capitulo');
  }
  if (editorial.imageMode === 'image') {
    badges.push('Imagen EPUB');
  }
  if (editorial.chapterHeaderMode === 'auto') {
    badges.push('Cabecera auto');
  }
  if (editorial.chapterHeaderMode === 'page') {
    badges.push('Cabecera completa');
  }
  if (pageCrop(page)) {
    badges.push('Recortada');
  }
  if (page.cropSuggestion?.status === 'suggested') {
    badges.push('Recorte sugerido');
  }
  if (pageRotation(page)) {
    badges.push(`Giro ${pageRotation(page)}°`);
  }
  const deskew = pageDeskew(page);
  if (deskew) {
    badges.push(`Enderezado ${deskew.angle}°`);
  }
  if (activeQualityFlags(page).length) {
    badges.push('Calidad');
  }
  for (const tag of markers.tags) {
    badges.push(markerLabel(tag));
  }
  if (markers.note) {
    badges.push('Nota');
  }

  return badges;
}

function pendingOcrPages(pages) {
  return ocrEligiblePages(pages).filter((page) => {
    return (
      !pageReviewed(page) &&
      (
        page.status === 'captured' ||
        page.status === 'ocr-error' ||
        (page.status === 'ocr-complete' && page.layoutStale)
      )
    );
  });
}

function batchOcrLabel() {
  if (!state.batchOcr) {
    return '';
  }

  const currentPage = state.project?.pages.find((page) => page.id === state.batchOcr.currentPageId);
  const currentLabel = currentPage ? ` · página ${currentPage.number}` : '';
  const modeLabel = state.batchOcr.mode === 'all' ? 'Leyendo todo' : 'Leyendo pendientes';
  return `${modeLabel}: ${state.batchOcr.completed} de ${state.batchOcr.total}${currentLabel}.`;
}

function warningSeverityLabel(severity) {
  const labels = {
    high: 'Alta',
    medium: 'Media',
    low: 'Baja'
  };
  return labels[severity] || 'Aviso';
}

function firstPageForWarning(warning) {
  const pages = state.project?.pages || [];
  const sectionPageId = warning.sections?.find((section) => section.pageId)?.pageId;

  if (sectionPageId) {
    const page = pages.find((item) => item.id === sectionPageId);
    if (page) {
      return page;
    }
  }

  const [pageNumber] = warning.pages?.length ? warning.pages : warning.target?.pages || [];
  if (pageNumber === undefined) {
    return null;
  }

  return pages.find((page) => Number(page.number) === Number(pageNumber)) || null;
}

function warningIsSectionTarget(warning) {
  return (
    warning.scope === 'section' ||
    ['section-title', 'part-chapter-sequence'].includes(warning.type) ||
    ['untitled-part', 'untitled-chapter', 'incoherent-structure'].includes(warning.code)
  );
}

function warningTargetActionLabel(warning) {
  if (warning.code === 'metadata-incomplete') {
    return 'Editar metadatos';
  }

  if (warning.code === 'missing-cover') {
    return 'Elegir portada';
  }

  const page = firstPageForWarning(warning);
  if (page) {
    return warningIsSectionTarget(warning)
      ? `Ir a la sección en página ${page.number}`
      : `Ir a la página ${page.number}`;
  }

  return 'Ir al punto a corregir';
}

function focusElementForWarning(warning) {
  if (warning.code === 'untitled-part') {
    return els.partTitleInput;
  }

  if (warning.code === 'untitled-chapter') {
    return els.chapterTitleInput;
  }

  if (warning.code === 'incoherent-structure') {
    return els.partStartInput;
  }

  if (warning.code === 'unreviewed-pages') {
    return els.pageReviewedInput;
  }

  return warningIsSectionTarget(warning) ? els.editorialStatus : els.ocrText;
}

function formatBytes(value = 0) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let current = size;

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  return `${current >= 10 || unitIndex === 0 ? current.toFixed(0) : current.toFixed(1)} ${units[unitIndex]}`;
}

function coverModeLabel(mode) {
  if (mode === 'page') {
    return 'Página del libro';
  }

  if (mode === 'upload' || mode === 'embedded') {
    return 'Imagen incluida';
  }

  return 'Sin portada';
}

function appendDescriptionRow(list, label, value) {
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = value || '-';
  list.append(term, description);
}

function renderExportPreviewSample(sample = null) {
  els.exportPreviewSample.innerHTML = '';
  if (!sample) {
    els.exportPreviewSample.hidden = true;
    els.exportPreviewSample.className = 'export-preview-sample';
    return;
  }

  els.exportPreviewSample.hidden = false;
  els.exportPreviewSample.className = `export-preview-sample template-${sample.styleTemplate || 'simple'}`;

  const meta = document.createElement('span');
  meta.className = 'export-preview-sample-meta';
  meta.textContent = `${sample.styleTemplateLabel || 'Simple'} · ${sample.contentMode || 'Texto'} · ${sample.source || 'Muestra'}`;

  const title = document.createElement('h3');
  title.textContent = sample.title || 'Muestra EPUB';

  const text = document.createElement('p');
  text.textContent = sample.text || 'Muestra segura pendiente de texto.';

  els.exportPreviewSample.append(meta, title, text);

  if (sample.imageHint) {
    const hint = document.createElement('p');
    hint.className = 'export-preview-sample-hint';
    hint.textContent = sample.imageHint;
    els.exportPreviewSample.append(hint);
  }
}

function renderExportPreview(preview = null) {
  if (!preview) {
    els.exportPreviewPanel.hidden = true;
    els.exportPreviewMetadata.innerHTML = '';
    renderExportPreviewSample(null);
    els.exportPreviewNavigation.innerHTML = '';
    return;
  }

  const metadata = preview.metadata || {};
  els.exportPreviewPanel.hidden = false;
  els.exportPreviewSummary.textContent = preview.summary || 'Previsualización calculada.';
  els.exportPreviewMetadata.innerHTML = '';
  els.exportPreviewNavigation.innerHTML = '';

  appendDescriptionRow(els.exportPreviewMetadata, 'Título', metadata.title);
  appendDescriptionRow(els.exportPreviewMetadata, 'Autor', metadata.author);
  appendDescriptionRow(els.exportPreviewMetadata, 'Idioma', metadata.language);
  appendDescriptionRow(els.exportPreviewMetadata, 'Plantilla', metadata.styleTemplateLabel);
  appendDescriptionRow(els.exportPreviewMetadata, 'Modo', metadata.contentMode);
  if (metadata.publisher) {
    appendDescriptionRow(els.exportPreviewMetadata, 'Editorial', metadata.publisher);
  }
  if (metadata.collection) {
    appendDescriptionRow(els.exportPreviewMetadata, 'Colección', metadata.collection);
  }
  if (metadata.identifiers?.length) {
    appendDescriptionRow(els.exportPreviewMetadata, 'Identificadores', metadata.identifiers.join(', '));
  }
  appendDescriptionRow(els.exportPreviewMetadata, 'Portada', coverModeLabel(metadata.coverMode));
  appendDescriptionRow(
    els.exportPreviewMetadata,
    'Páginas',
    `${metadata.pageCount || 0} totales · ${metadata.textPageCount || 0} texto · ${metadata.imagePageCount || 0} imagen`
  );
  renderExportPreviewSample(preview.sample);

  const items = preview.navigation || [];
  if (!items.length) {
    const item = document.createElement('li');
    item.className = 'export-preview-empty';
    item.textContent = 'Sin entradas de índice todavía.';
    els.exportPreviewNavigation.append(item);
    return;
  }

  for (const entry of items) {
    const item = document.createElement('li');
    item.className = entry.type === 'part' ? 'export-preview-part' : 'export-preview-chapter';
    item.textContent = entry.title || 'Entrada sin título';
    els.exportPreviewNavigation.append(item);
  }
}

function renderExportChecklist(check, options = {}) {
  const { allowExport = false, preview = null } = options;
  const warnings = check.warnings || [];

  renderExportPreview(preview);
  els.exportChecklistSummary.textContent = check.summary || 'Checklist calculado.';
  els.exportChecklistIntro.textContent = warnings.length
    ? 'Revisa estos avisos antes de generar el EPUB. Cada aviso incluye una acción recomendada y un enlace al punto que debes corregir.'
    : 'No hay avisos pendientes. Puedes continuar con la exportación.';
  els.exportChecklistList.innerHTML = '';

  if (!warnings.length) {
    const ready = document.createElement('p');
    ready.className = 'export-checklist-ready';
    ready.textContent = 'Todo listo: metadatos, portada, OCR y estructura no tienen avisos del checklist.';
    els.exportChecklistList.append(ready);
  }

  for (const warning of warnings) {
    const item = document.createElement('article');
    item.className = `export-warning export-warning-${warning.severity || 'medium'}`;

    const heading = document.createElement('div');
    heading.className = 'export-warning-heading';

    const severity = document.createElement('span');
    severity.className = 'export-warning-severity';
    severity.textContent = warningSeverityLabel(warning.severity);

    const title = document.createElement('h3');
    title.textContent = warning.message || 'Aviso del checklist';
    heading.append(severity, title);

    const action = document.createElement('p');
    action.className = 'export-warning-action';
    action.textContent = warning.action || 'Revisa este punto antes de exportar.';

    const footer = document.createElement('div');
    footer.className = 'export-warning-footer';

    if (warning.target?.label) {
      const target = document.createElement('span');
      target.className = 'export-warning-target';
      target.textContent = warning.target.label;
      footer.append(target);
    }

    const jumpButton = document.createElement('button');
    jumpButton.type = 'button';
    jumpButton.className = 'button-link ghost';
    jumpButton.textContent = warningTargetActionLabel(warning);
    jumpButton.addEventListener('click', () => {
      jumpToWarning(warning);
    });
    footer.append(jumpButton);

    item.append(heading, action, footer);
    els.exportChecklistList.append(item);
  }

  els.closeExportChecklistButton.textContent = allowExport
    ? warnings.length
      ? 'Corregir primero'
      : 'Cancelar'
    : 'Cerrar';
  els.confirmExportChecklistButton.hidden = !allowExport;
  els.confirmExportChecklistButton.textContent = warnings.length
    ? 'Exportar de todos modos'
    : 'Exportar EPUB';
}

function closeExportChecklist(result = false) {
  const resolve = exportChecklistResolve;
  exportChecklistResolve = null;

  if (els.exportChecklistDialog.open) {
    els.exportChecklistDialog.close();
  }

  if (resolve) {
    resolve(result);
  }
}

function openExportChecklist(check, options = {}) {
  renderExportChecklist(check, options);

  return new Promise((resolve) => {
    exportChecklistResolve = resolve;
    if (els.exportChecklistDialog.open) {
      els.exportChecklistDialog.close();
    }
    els.exportChecklistDialog.showModal();
  });
}

function renderExportResult(exported) {
  const validation = exported?.validation || {};
  const summary = exported?.summary || {};
  const errors = validation.errors || [];
  const valid = validation.valid !== false && errors.length === 0;

  els.exportResultTitle.textContent = valid ? 'EPUB generado' : 'EPUB generado con avisos';
  els.exportResultSummary.textContent = `${exported.fileName} · ${formatBytes(exported.size)} · ${summary.chapterCount || validation.chapterCount || 0} capítulos`;
  els.exportResultFacts.innerHTML = '';
  els.exportResultValidation.innerHTML = '';

  appendDescriptionRow(els.exportResultFacts, 'Archivo', exported.fileName);
  appendDescriptionRow(els.exportResultFacts, 'Ruta local', exported.path);
  appendDescriptionRow(els.exportResultFacts, 'Tamaño', formatBytes(exported.size));
  appendDescriptionRow(
    els.exportResultFacts,
    'Capítulos',
    String(summary.chapterCount || validation.chapterCount || 0)
  );
  appendDescriptionRow(
    els.exportResultFacts,
    'Validación',
    valid ? 'Estructura correcta' : `${errors.length} aviso${errors.length === 1 ? '' : 's'}`
  );

  if (!errors.length) {
    const item = document.createElement('li');
    item.innerHTML =
      '<strong>Validación correcta</strong>El EPUB contiene navegación, manifiesto, capítulos y recursos referenciados.';
    els.exportResultValidation.append(item);
    return;
  }

  for (const error of errors) {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = error.message || 'Problema de validación EPUB';
    const action = document.createElement('span');
    action.textContent = error.action || 'Regenera el EPUB y revisa el proyecto.';
    item.append(title, action);
    els.exportResultValidation.append(item);
  }
}

function openExportResult(exported) {
  renderExportResult(exported);
  if (els.exportResultDialog.open) {
    els.exportResultDialog.close();
  }
  els.exportResultDialog.showModal();
}

function ensureSelectOption(select, value, label = value) {
  if (!value || Array.from(select.options).some((option) => option.value === value)) {
    return;
  }

  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function openMetadataEditor() {
  if (!state.project) {
    return;
  }

  els.metadataTitleInput.value = state.project.title || '';
  els.metadataAuthorInput.value = state.project.author || '';
  ensureSelectOption(els.metadataLanguageInput, state.project.language, state.project.language);
  els.metadataLanguageInput.value = state.project.language || 'es';
  els.metadataNotesInput.value = state.project.notes || '';
  els.metadataPublisherInput.value = state.project.epub?.publisher || '';
  els.metadataCollectionInput.value = state.project.epub?.collection || '';
  ensureSelectOption(
    els.metadataStyleTemplateInput,
    state.project.epub?.styleTemplate,
    state.project.epub?.styleTemplate
  );
  els.metadataStyleTemplateInput.value = state.project.epub?.styleTemplate || 'simple';
  els.metadataDescriptionInput.value = state.project.epub?.description || '';
  els.metadataIdentifiersInput.value = (state.project.epub?.identifiers || []).join('\n');
  els.metadataDialog.showModal();
  els.metadataTitleInput.focus();
}

async function saveProjectMetadata(event) {
  event.preventDefault();
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);

  try {
    const { project } = await api(`/api/projects/${state.project.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: els.metadataTitleInput.value,
        author: els.metadataAuthorInput.value,
        language: els.metadataLanguageInput.value,
        notes: els.metadataNotesInput.value,
        epub: {
          publisher: els.metadataPublisherInput.value,
          collection: els.metadataCollectionInput.value,
          styleTemplate: els.metadataStyleTemplateInput.value,
          description: els.metadataDescriptionInput.value,
          identifiers: els.metadataIdentifiersInput.value
        }
      })
    });
    state.project = project;
    els.metadataDialog.close();
    await loadProjects();
    render();
    showToast('Metadatos guardados.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function jumpToCover() {
  showMainView('editor');

  const firstPage = state.project?.pages?.[0];
  if (firstPage && firstPage.id !== state.selectedPageId) {
    await selectPage(firstPage.id);
  }

  els.coverSlot.scrollIntoView({ behavior: 'smooth', block: 'center' });
  els.usePageAsCoverButton.focus({ preventScroll: true });
  showToast('Elige una página o sube una imagen de portada.');
}

async function jumpToWarning(warning) {
  closeExportChecklist(false);

  if (warning.code === 'metadata-incomplete') {
    openMetadataEditor();
    return;
  }

  if (warning.code === 'missing-cover') {
    await jumpToCover();
    return;
  }

  const page = firstPageForWarning(warning);
  if (!page) {
    showToast('No se encontró la página asociada al aviso.');
    return;
  }

  showMainView('editor');

  if (page.id !== state.selectedPageId) {
    await selectPage(page.id);
  } else {
    render();
  }

  showEditorPane(warningIsSectionTarget(warning) ? 'structure' : 'text');

  const target = focusElementForWarning(warning);
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target?.focus({ preventScroll: true });
  showToast(`Abierta la página ${page.number} para corregir el aviso.`);
}

function renderChapterIndex() {
  const pages = state.project?.pages || [];
  els.chapterIndex.innerHTML = '';

  if (pages.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'Sin paginas todavia.';
    els.chapterIndex.append(item);
    return;
  }

  for (const itemData of buildBookIndexItems(pages)) {
    const item = document.createElement('li');
    item.className = `${itemData.type}-index-item`;
    if (itemData.type === 'part') {
      item.textContent = `${itemData.title} · pag. ${itemData.page}`;
    } else {
      item.textContent = `${itemData.title} · ${pageRangeLabel(itemData.startPage, itemData.endPage)}`;
    }
    els.chapterIndex.append(item);
  }
}

function renderPageMarkerFilters(pages) {
  els.pageMarkerFilters.innerHTML = '';
  const filters = [
    { tag: 'all', label: 'Todas', count: pages.length },
    ...PAGE_MARKER_TAGS.map((tag) => ({
      tag,
      label: markerLabel(tag),
      count: markerCount(pages, tag)
    }))
  ];

  for (const filter of filters) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = state.markerFilter === filter.tag ? 'page-marker-filter active' : 'page-marker-filter';
    button.disabled = state.busy || (filter.tag !== 'all' && filter.count === 0);
    button.setAttribute('aria-pressed', state.markerFilter === filter.tag ? 'true' : 'false');
    button.textContent = `${filter.label} ${filter.count}`;
    button.addEventListener('click', () => {
      state.markerFilter = filter.tag;
      renderPages();
    });
    els.pageMarkerFilters.append(button);
  }
}

function renderPageBatchToolbar(allPages, visiblePages) {
  pruneBatchSelection(allPages);

  const selectedPages = batchSelectedPages(allPages);
  const selectedCount = selectedPages.length;
  const visiblePageIds = pageIds(visiblePages);
  const visibleSelectedCount = visiblePageIds.filter((pageId) => state.selectedBatchPageIds.has(pageId)).length;
  const anchorPages = allPages.filter((page) => !state.selectedBatchPageIds.has(page.id));
  const canMoveSelection = selectedCount > 0 && anchorPages.length > 0 && !state.busy;
  const canSort = allPages.length > 1 && !state.busy;

  els.pageBatchSummary.textContent = `${selectedCount} ${
    selectedCount === 1 ? 'seleccionada' : 'seleccionadas'
  }`;
  els.selectVisiblePagesButton.disabled =
    state.busy || visiblePageIds.length === 0 || visibleSelectedCount === visiblePageIds.length;
  els.clearPageSelectionButton.disabled = state.busy || selectedCount === 0;
  els.moveBatchStartButton.disabled = state.busy || selectedCount === 0;
  els.moveBatchEndButton.disabled = state.busy || selectedCount === 0;
  els.moveBatchBeforeButton.disabled = !canMoveSelection;
  els.moveBatchAfterButton.disabled = !canMoveSelection;
  els.sortPagesByDateButton.disabled = !canSort;
  els.sortPagesByNameButton.disabled = !canSort;

  const currentAnchor = els.pageBatchAnchorInput.value;
  els.pageBatchAnchorInput.innerHTML = '';

  for (const page of anchorPages) {
    const option = document.createElement('option');
    option.value = page.id;
    option.textContent = `Pagina ${page.number}`;
    els.pageBatchAnchorInput.append(option);
  }

  const fallbackAnchor =
    anchorPages.find((page) => page.id === currentAnchor) ||
    anchorPages.find((page) => page.id === state.selectedPageId) ||
    anchorPages[0];
  els.pageBatchAnchorInput.value = fallbackAnchor?.id || '';
  els.pageBatchAnchorInput.disabled = !canMoveSelection;
}

function renderPages() {
  const allPages = state.project?.pages || [];
  const pages = filterPagesByMarker(allPages);
  const pendingReviewCount = reviewPendingPages(allPages).length;
  const filterSuffix = pages.length !== allPages.length ? ` · ${pages.length} visibles` : '';
  els.pagesCount.textContent = `${allPages.length} ${allPages.length === 1 ? 'captura' : 'capturas'}${
    pendingReviewCount ? ` · ${pendingReviewCount} pendientes` : ''
  }${filterSuffix}`;
  els.pagesList.innerHTML = '';
  renderPageMarkerFilters(allPages);
  renderPageBatchToolbar(allPages, pages);
  renderChapterIndex();

  if (allPages.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Aun no hay paginas capturadas.';
    els.pagesList.append(empty);
    return;
  }

  if (pages.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No hay paginas con este marcador.';
    els.pagesList.append(empty);
    return;
  }

  const groups = buildPageGroups(pages);

  groups.forEach((group, index) => {
    const fallbackOpen = groupContainsPage(group, state.selectedPageId) || (!state.selectedPageId && index === 0);
    els.pagesList.append(
      group.type === 'part'
        ? createPartGroup(group, fallbackOpen)
        : createChapterGroup(group, { fallbackOpen })
    );
  });
}

function renderEditor() {
  const page = currentPage();
  const hasPage = Boolean(page);
  const pages = state.project?.pages || [];
  const eligibleOcrPages = ocrEligiblePages(pages);
  const pageIndex = hasPage ? pages.findIndex((item) => item.id === page.id) : -1;
  const canMoveBackward = hasPage && pageIndex > 0 && !state.busy;
  const canMoveForward = hasPage && pageIndex >= 0 && pageIndex < pages.length - 1 && !state.busy;
  const pendingPages = pendingOcrPages(pages);
  const ocrCapabilities = state.system?.ocrCapabilities || {};

  els.ocrButton.disabled = !hasPage || state.busy;
  els.batchOcrPendingButton.disabled = pendingPages.length === 0 || state.busy;
  els.batchOcrAllButton.disabled = eligibleOcrPages.length === 0 || state.busy;
  els.nextProblemButton.disabled = !state.project || pages.length === 0 || state.busy;
  els.saveTextButton.disabled = !hasPage || state.busy;
  els.dictionaryTermInput.disabled = !state.project || state.busy;
  els.addDictionaryTermButton.disabled = !state.project || state.busy;
  els.replacementFromInput.disabled = !state.project || state.busy;
  els.replacementToInput.disabled = !state.project || state.busy;
  els.addReplacementButton.disabled = !state.project || state.busy;
  els.previewReplacementsButton.disabled = !hasPage || state.busy || !(state.dictionary?.replacements || []).length;
  els.applyReplacementsButton.disabled = !hasPage || state.busy || !(state.dictionary?.replacements || []).length;
  els.scanSuspiciousButton.disabled = !state.project || state.busy;
  els.acceptSuspiciousButton.disabled = !nextSuspiciousItem() || state.busy;
  els.replaceSuspiciousButton.disabled = !nextSuspiciousItem() || state.busy;
  els.deletePageButton.disabled = !hasPage || state.busy;
  els.ocrText.disabled = !hasPage || state.busy;
  els.movePageFirstButton.disabled = !canMoveBackward;
  els.movePageUpButton.disabled = !canMoveBackward;
  els.movePageDownButton.disabled = !canMoveForward;
  els.movePageLastButton.disabled = !canMoveForward;
  els.rotatePageLeftButton.disabled = !hasPage || state.busy;
  els.rotatePageRightButton.disabled = !hasPage || state.busy;
  els.deskewAngleInput.disabled = !hasPage || state.busy;
  els.saveDeskewButton.disabled = !hasPage || state.busy;
  els.clearDeskewButton.disabled = !hasPage || state.busy || !pageDeskew(page);
  if (els.ocrModeInput) {
    for (const option of els.ocrModeInput.options) {
      if (option.value === 'consensus') {
        option.disabled = !ocrCapabilities.consensus?.available;
      }
      if (option.value === 'ai-advanced') {
        option.disabled = !ocrCapabilities.aiAdvanced?.available;
      }
    }

    if (els.ocrModeInput.selectedOptions[0]?.disabled) {
      els.ocrModeInput.value = 'local-improved';
    }
  }
  els.batchOcrPendingButton.textContent = pendingPages.length
    ? `Leer pendientes (${pendingPages.length})`
    : 'Leer pendientes';
  els.batchOcrStatus.hidden = !state.batchOcr;
  els.batchOcrStatus.textContent = batchOcrLabel();
  els.reviewQueueStatus.hidden = !state.reviewQueueMessage;
  els.reviewQueueStatus.textContent = state.reviewQueueMessage || '';
  els.rotationStatus.textContent = hasPage ? `Giro ${pageRotation(page)}°` : 'Giro 0°';

  if (!page) {
    els.editorStatus.textContent = 'Elige una pagina para revisar el texto.';
    els.editorialStatus.textContent = 'Elige una pagina para marcar su estructura EPUB.';
    els.selectedImage.classList.remove('visible');
    els.selectedImage.removeAttribute('src');
    els.ocrText.value = '';
    state.cropPageId = null;
    state.draftCrop = null;
    renderCropOverlay();
    renderQualityPanel(null);
    renderCropSuggestionPanel(null);
    renderAdjustmentComparePanel(null);
    els.pageReviewedInput.checked = false;
    els.pageImageModeInput.checked = false;
    els.partStartInput.checked = false;
    els.partTitleInput.value = '';
    els.chapterStartInput.checked = false;
    els.chapterTitleInput.value = '';
    els.chapterHeaderModeInput.value = 'none';
    els.chapterEndInput.checked = false;
    els.deskewAngleInput.value = '0';
    els.cropRangeStartInput.value = '';
    els.cropRangeEndInput.value = '';
    updateEditorialControlState();
    renderFormattedPreview(null, '');
    return;
  }

  const editorial = pageEditorial(page);
  if (state.cropPageId !== page.id) {
    state.cropPageId = page.id;
    state.draftCrop = pageCrop(page);
  }
  const engine = ocrEngineLabel(page.ocrEngine);
  const provenance = ocrProvenanceLabel(page);
  const confidenceStatus =
    page.ocrNeedsReview && !pageReviewed(page) ? ' - baja confianza' : '';
  els.editorStatus.textContent =
    editorial.imageMode === 'image'
      ? 'Pagina de imagen para EPUB; no necesita OCR pendiente.'
      : `${pageStatus(page)}${engine ? ` - ${engine}` : ''}${provenance ? ` - ${provenance}` : ''}${
          page.ocrWarning ? ` - ${page.ocrWarning}` : ''
        }${confidenceStatus}`;
  els.editorialStatus.textContent = editorial.chapterStart
    ? `Capitulo: ${editorial.chapterTitle || 'sin titulo todavia'} · ${
        pageNeedsReview(page) ? 'Pendiente de revision' : 'Revision completada'
      }`
    : editorial.imageMode === 'image'
      ? 'Esta captura saldra como imagen en el EPUB y no necesita OCR.'
      : pageNeedsReview(page)
        ? 'Texto normal en el EPUB · pendiente de revision.'
        : 'Texto normal en el EPUB · revision completada.';
  els.pageReviewedInput.checked = pageReviewed(page);
  els.pageImageModeInput.checked = editorial.imageMode === 'image';
  els.partStartInput.checked = editorial.partStart;
  els.partTitleInput.value = editorial.partTitle;
  els.chapterStartInput.checked = editorial.chapterStart;
  els.chapterTitleInput.value = editorial.chapterTitle;
  els.chapterHeaderModeInput.value = editorial.chapterHeaderMode;
  els.chapterEndInput.checked = editorial.chapterEnd;
  if (document.activeElement !== els.deskewAngleInput) {
    els.deskewAngleInput.value = String(pageDeskew(page)?.angle || 0);
  }
  if (document.activeElement !== els.cropRangeStartInput && !els.cropRangeStartInput.value) {
    els.cropRangeStartInput.value = String(page.number);
  }
  if (document.activeElement !== els.cropRangeEndInput && !els.cropRangeEndInput.value) {
    els.cropRangeEndInput.value = String(page.number);
  }
  updateEditorialControlState();
  els.selectedImage.src = `/api/projects/${state.project.id}/pages/${page.id}/image?${page.updatedAt}`;
  els.selectedImage.alt = `Pagina ${page.number}`;
  els.selectedImage.classList.add('visible');
  renderCropOverlay();
  renderQualityPanel(page);
  renderCropSuggestionPanel(page);
  renderAdjustmentComparePanel(page);
  renderFormattedPreview(page.layoutData, els.ocrText.value);
}

function renderQualityPanel(page) {
  const flags = activeQualityFlags(page);
  const ignored = Boolean(page?.quality?.ignored);

  if (!page || (!flags.length && !ignored)) {
    els.qualityPanel.hidden = true;
    els.qualityList.innerHTML = '';
    return;
  }

  els.qualityPanel.hidden = false;
  els.qualityTitle.textContent = ignored
    ? 'Avisos de captura ignorados'
    : `${flags.length} ${flags.length === 1 ? 'aviso de captura' : 'avisos de captura'}`;
  els.qualityList.innerHTML = '';

  const visibleFlags = flags.length ? flags : page.quality.flags || [];
  for (const flag of visibleFlags) {
    const item = document.createElement('li');
    item.textContent = flag.cause ? `${flag.message} ${flag.cause}` : flag.message;
    els.qualityList.append(item);
  }

  els.ignoreQualityButton.disabled = state.busy;
  els.ignoreQualityButton.textContent = ignored ? 'Reactivar avisos' : 'Ignorar avisos';
}

function renderCropSuggestionPanel(page) {
  const suggestion = page?.cropSuggestion;
  const visible = suggestion?.status === 'suggested' && suggestion.crop;

  els.cropSuggestionPanel.hidden = !visible;
  if (!visible) {
    return;
  }

  els.cropSuggestionStatus.textContent = `Recorte sugerido: ${cropPercent(suggestion.crop)} · confianza ${Math.round((suggestion.confidence || 0) * 100)}%.`;
  els.acceptCropSuggestionButton.disabled = state.busy;
  els.rejectCropSuggestionButton.disabled = state.busy;
}

function renderAdjustmentComparePanel(page) {
  const comparison = state.adjustmentComparison;
  const visible = page && comparison?.pageId === page.id;

  els.adjustmentComparePanel.hidden = !visible;
  els.compareAdjustmentButton.textContent = visible ? 'Ocultar comparación' : 'Comparar ajuste';

  if (!visible) {
    els.adjustmentBeforeImage.removeAttribute('src');
    els.adjustmentAfterImage.removeAttribute('src');
    return;
  }

  const version = encodeURIComponent(page.updatedAt || Date.now());
  els.adjustmentCompareStatus.textContent =
    comparison.status === 'adjusted'
      ? 'El original se conserva; la imagen ajustada es derivada.'
      : 'Esta página todavía no tiene ajustes activos.';
  els.adjustmentBeforeImage.src = `${comparison.beforeUrl}?${version}`;
  els.adjustmentAfterImage.src = `${comparison.afterUrl}?${version}`;
}

function renderDictionary() {
  els.dictionaryTermsList.innerHTML = '';
  els.replacementList.innerHTML = '';

  if (!state.project) {
    if (document.activeElement !== els.dictionaryTermInput) {
      els.dictionaryTermInput.value = '';
    }
    els.replacementPreviewStatus.textContent = '';
    const item = document.createElement('li');
    item.textContent = 'Abre un libro para editar su vocabulario local.';
    els.dictionaryTermsList.append(item);
    return;
  }

  const terms = state.dictionary?.terms || [];
  if (!terms.length) {
    const item = document.createElement('li');
    item.className = 'muted';
    item.textContent = 'Sin términos guardados todavía.';
    els.dictionaryTermsList.append(item);
    return;
  }

  for (const term of terms) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = term;
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'subtle';
    removeButton.textContent = 'Quitar';
    removeButton.disabled = state.busy;
    removeButton.addEventListener('click', () => removeDictionaryTerm(term));
    item.append(label, removeButton);
    els.dictionaryTermsList.append(item);
  }

  const replacements = state.dictionary?.replacements || [];
  if (!replacements.length) {
    const item = document.createElement('li');
    item.className = 'muted';
    item.textContent = 'Sin reemplazos guardados.';
    els.replacementList.append(item);
  }

  for (const replacement of replacements) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${replacement.from} -> ${replacement.to}`;
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'subtle';
    removeButton.textContent = 'Quitar';
    removeButton.disabled = state.busy;
    removeButton.addEventListener('click', () => removeReplacement(replacement.from));
    item.append(label, removeButton);
    els.replacementList.append(item);
  }
}

function nextSuspiciousItem() {
  const items = state.suspiciousReview?.items || [];
  if (!items.length) {
    return null;
  }

  const page = currentPage();
  return items.find((item) => item.pageId === page?.id) || items[0];
}

function renderSuspiciousReview() {
  const review = state.suspiciousReview;
  const items = review?.items || [];
  const nextItem = nextSuspiciousItem();
  els.suspiciousList.innerHTML = '';
  els.scanSuspiciousButton.disabled = !state.project || state.busy;
  els.acceptSuspiciousButton.disabled = !nextItem || state.busy;
  els.replaceSuspiciousButton.disabled = !nextItem || state.busy;

  if (!state.project) {
    els.suspiciousStatus.textContent = 'Abre un libro para revisar palabras dudosas.';
    return;
  }

  if (!review) {
    els.suspiciousStatus.textContent =
      'Busca palabras con dígitos, símbolos raros o patrones poco habituales.';
    return;
  }

  els.suspiciousStatus.textContent = `${review.summary} Atajos: A acepta, C corrige.`;
  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'muted';
    empty.textContent = 'Sin palabras dudosas pendientes.';
    els.suspiciousList.append(empty);
    return;
  }

  for (const itemData of items.slice(0, 12)) {
    const item = document.createElement('li');
    item.className = itemData.pageId === currentPage()?.id ? 'current' : '';

    const body = document.createElement('span');
    body.className = 'suspicious-item-body';

    const title = document.createElement('strong');
    title.textContent = `${itemData.word} · página ${itemData.page}`;

    const context = document.createElement('span');
    context.textContent = itemData.context || itemData.reason;
    body.append(title, context);

    const actions = document.createElement('span');
    actions.className = 'inline-actions';

    const acceptButton = document.createElement('button');
    acceptButton.type = 'button';
    acceptButton.className = 'subtle';
    acceptButton.textContent = 'Aceptar';
    acceptButton.disabled = state.busy;
    acceptButton.addEventListener('click', () => acceptSuspiciousItem(itemData));

    const replaceButton = document.createElement('button');
    replaceButton.type = 'button';
    replaceButton.className = 'ghost';
    replaceButton.textContent = 'Corregir';
    replaceButton.disabled = state.busy;
    replaceButton.addEventListener('click', () => replaceSuspiciousItem(itemData));

    actions.append(acceptButton, replaceButton);
    item.append(body, actions);
    els.suspiciousList.append(item);
  }
}

function renderCover() {
  const project = state.project;
  const page = currentPage();
  const cover = projectCover(project);
  const coverPage = cover.mode === 'page' ? project?.pages.find((item) => item.id === cover.pageId) : null;
  const coverVersion =
    cover.mode === 'page'
      ? coverPage?.updatedAt || cover.updatedAt || project?.updatedAt || ''
      : cover.updatedAt || project?.updatedAt || '';

  els.uploadCoverButton.disabled = !project || state.busy;
  els.usePageAsCoverButton.disabled =
    !project || !page || state.busy || (cover.mode === 'page' && cover.pageId === page.id);
  els.clearCoverButton.disabled = !project || state.busy || cover.mode === 'none';

  if (!project) {
    els.usePageAsCoverButton.textContent = 'Usar página seleccionada';
  } else if (!page) {
    els.usePageAsCoverButton.textContent = 'Selecciona una página';
  } else if (cover.mode === 'page' && cover.pageId === page.id) {
    els.usePageAsCoverButton.textContent = 'La selección ya es portada';
  } else {
    els.usePageAsCoverButton.textContent = `Usar página ${page.number}`;
  }

  if (!project) {
    els.coverStatus.textContent = 'Crea o abre un libro para configurar la portada.';
    els.coverPreview.classList.remove('visible');
    els.coverPreview.removeAttribute('src');
    els.coverPreviewEmpty.hidden = false;
    return;
  }

  if (cover.mode === 'none') {
    els.coverStatus.textContent = 'Sin portada configurada todavía.';
    els.coverPreview.classList.remove('visible');
    els.coverPreview.removeAttribute('src');
    els.coverPreviewEmpty.hidden = false;
    return;
  }

  if (cover.mode === 'page') {
    els.coverStatus.textContent = `Portada actual: página ${coverPage?.number || cover.pageId}.`;
  } else {
    els.coverStatus.textContent = 'Portada actual: imagen externa.';
  }

  els.coverPreview.src = `/api/projects/${project.id}/cover/image?${encodeURIComponent(coverVersion)}`;
  els.coverPreview.classList.add('visible');
  els.coverPreviewEmpty.hidden = true;
}

function renderPlatformCopy() {
  els.cameraButton.textContent = 'Activar cámara';
  els.captureDescription.textContent = isMacSystem()
    ? 'Selecciona una webcam, cámara USB o el iPhone, encuadra la página y guarda cada toma en orden.'
    : 'Selecciona una webcam o cámara USB, encuadra la página y guarda cada toma en orden.';
  els.iphoneCameraButton.textContent = isMacSystem()
    ? findIphoneCamera()
      ? 'Usar iPhone'
      : 'Buscar iPhone'
    : 'Actualizar cámaras';
  els.iphoneHelpLine.hidden = !isMacSystem();
  if (isMacSystem()) {
    els.iphoneHelpCopy.textContent = 'Si quieres usar el iPhone y no aparece aquí, prueba esta misma URL en Safari o Chrome:';
  }
  els.selectInboxButton.textContent = folderPickerSupported() ? 'Seleccionar carpeta' : 'Selector en macOS';
}

function renderCamera() {
  const active = Boolean(state.stream);
  els.captureButton.disabled = !active || !state.project || state.busy;
  els.importPhotosButton.disabled = !state.project || state.busy;
  els.cameraButton.disabled = state.busy;
  els.iphoneCameraButton.disabled = state.busy;
  els.cameraSelect.disabled = state.busy || state.devices.length === 0;
  els.cameraStage.classList.toggle('active', active);
  if (active) {
    const resolution = `${els.video.videoWidth || '-'} x ${els.video.videoHeight || '-'}`;
    els.cameraInfo.textContent = `En uso: ${selectedCameraLabel()} · ${resolution}`;
  } else if (state.devices.length > 0) {
    els.cameraInfo.textContent = `Seleccionada: ${selectedCameraLabel()}`;
  } else {
    els.cameraInfo.textContent = 'Sin cámaras detectadas';
  }
  renderCameraDiagnostics();
}

function defaultInboxCandidateAction(candidate) {
  return candidate.duplicate?.defaultAction === 'ignore' ? 'ignore' : 'import';
}

function inboxCandidateAction(candidate) {
  return state.inboxPreview?.candidateActions?.[candidate.id] || defaultInboxCandidateAction(candidate);
}

function setInboxCandidateAction(candidateId, action) {
  if (!state.inboxPreview) {
    return;
  }

  state.inboxPreview.candidateActions = {
    ...(state.inboxPreview.candidateActions || {}),
    [candidateId]: action === 'ignore' ? 'ignore' : 'import-anyway'
  };
  renderInboxPreview();
}

function inboxCandidateActions() {
  const actions = {};
  for (const candidate of state.inboxPreview?.candidates || []) {
    actions[candidate.id] = inboxCandidateAction(candidate);
  }
  return actions;
}

async function openInboxDuplicatePage(pageId) {
  if (!pageId || state.busy) {
    return;
  }

  showMainView('editor');
  await selectPage(pageId);
  showEditorPane('text');
}

function renderInboxPreview() {
  const preview = state.inboxPreview;
  const candidates = preview?.candidates || [];
  const unsupported = preview?.unsupported || [];
  const importCount = candidates.filter((candidate) => inboxCandidateAction(candidate) !== 'ignore').length;
  const ignoredCount = candidates.length - importCount;
  const duplicateCount = candidates.filter((candidate) => candidate.duplicate).length;

  els.inboxPreviewPanel.hidden = !preview && !state.inboxPreviewLoading;
  els.inboxPreviewList.innerHTML = '';
  els.inboxUnsupportedList.innerHTML = '';
  els.confirmInboxImportButton.disabled =
    !preview || candidates.length === 0 || state.busy || state.inboxPreviewLoading;
  els.cancelInboxPreviewButton.disabled = !preview || state.busy || state.inboxPreviewLoading;

  if (state.inboxPreviewLoading) {
    els.inboxPreviewSummary.textContent = 'Revisando carpeta...';
    return;
  }

  if (!preview) {
    els.inboxPreviewSummary.textContent = 'Sin fotos revisadas.';
    return;
  }

  els.inboxPreviewSummary.textContent = `${candidates.length} ${
    candidates.length === 1 ? 'foto revisada' : 'fotos revisadas'
  } · ${importCount} para importar${ignoredCount ? ` · ${ignoredCount} ignoradas` : ''}${
    duplicateCount ? ` · ${duplicateCount} duplicadas o posibles` : ''
  }${unsupported.length ? ` · ${unsupported.length} no soportadas` : ''}.`;

  for (const candidate of candidates) {
    const item = document.createElement('li');
    item.className = candidate.duplicate
      ? `inbox-preview-candidate duplicate-${candidate.duplicate.kind}`
      : 'inbox-preview-candidate';
    const title = document.createElement('strong');
    title.textContent = `${candidate.order}. ${candidate.fileName}`;
    const meta = document.createElement('span');
    meta.textContent = [
      formatBytes(candidate.size),
      candidate.capturedAt ? formatDateTime(candidate.capturedAt) : 'fecha desconocida',
      candidate.extension.toUpperCase()
    ].join(' · ');
    item.append(title, meta);

    if (candidate.duplicate) {
      const duplicate = candidate.duplicate;
      const notice = document.createElement('span');
      notice.className = 'inbox-duplicate-notice';
      notice.textContent = `${duplicate.kind === 'exact' ? 'Duplicada' : 'Posible duplicado'}: ${
        duplicate.reason
      } Pagina ${duplicate.pageNumber}${duplicate.fileName ? ` (${duplicate.fileName})` : ''}.`;

      const actions = document.createElement('div');
      actions.className = 'inbox-duplicate-actions';

      const select = document.createElement('select');
      select.setAttribute('aria-label', `Accion para ${candidate.fileName}`);
      const ignoreOption = document.createElement('option');
      ignoreOption.value = 'ignore';
      ignoreOption.textContent = 'Ignorar';
      const importOption = document.createElement('option');
      importOption.value = 'import-anyway';
      importOption.textContent = 'Importar de todos modos';
      select.append(ignoreOption, importOption);
      select.value = inboxCandidateAction(candidate) === 'ignore' ? 'ignore' : 'import-anyway';
      select.disabled = state.busy || state.inboxPreviewLoading;
      select.addEventListener('change', () => setInboxCandidateAction(candidate.id, select.value));

      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'subtle';
      openButton.textContent = 'Ver pagina existente';
      openButton.disabled = state.busy || state.inboxPreviewLoading;
      openButton.addEventListener('click', () => {
        void openInboxDuplicatePage(duplicate.pageId);
      });

      actions.append(select, openButton);
      item.append(notice, actions);
    }

    els.inboxPreviewList.append(item);
  }

  for (const fileName of unsupported) {
    const item = document.createElement('li');
    item.textContent = `${fileName} no se puede importar.`;
    els.inboxUnsupportedList.append(item);
  }
}

function renderInbox() {
  const inbox = state.project?.inbox || {};
  const hasProject = Boolean(state.project);
  const path = inbox.path || '';
  const canPickFolder = folderPickerSupported();

  renderInboxPreview();

  if (document.activeElement !== els.inboxPathInput) {
    els.inboxPathInput.value = path;
  }

  els.inboxWatchInput.checked = Boolean(inbox.watch);
  els.inboxPathInput.disabled = !hasProject || state.busy;
  els.inboxWatchInput.disabled = !hasProject || state.busy;
  els.selectInboxButton.disabled = !hasProject || state.busy || !canPickFolder;
  els.saveInboxButton.disabled = !hasProject || state.busy;
  els.scanInboxButton.disabled = !hasProject || state.busy || !path || state.inboxPreviewLoading;

  if (!hasProject) {
    els.inboxStatus.textContent = 'Crea o abre un libro para configurar la bandeja.';
    return;
  }

  if (!path) {
    els.inboxStatus.textContent = canPickFolder
      ? 'Configura una carpeta para importar fotos desde el móvil o desde otra cámara.'
      : 'Pega la ruta de una carpeta local para importar fotos. En este sistema no hay selector nativo todavía.';
    return;
  }

  const mode = inbox.watch ? 'vigilancia activa' : 'revision manual';
  const lastScan = inbox.lastScanAt ? new Date(inbox.lastScanAt).toLocaleString() : 'sin revisar';
  const imported = inbox.lastImportedCount ?? 0;
  const skipped = inbox.lastSkippedCount ?? 0;
  const ignored = inbox.lastIgnoredCount ?? 0;
  const cleaned = inbox.lastCleanedCount ?? 0;
  const unsupported = inbox.lastUnsupportedCount ?? 0;
  const errors = inbox.lastErrorCount ?? 0;
  const pickerNote = canPickFolder ? '' : ' Ruta editable manualmente.';
  const sourceNote =
    inbox.lastScanSourceType === 'project-folder'
      ? ' Se usaron imagenes encontradas en la carpeta del libro.'
      : '';
  els.inboxStatus.textContent = `${mode}. Ultima revision: ${lastScan}. Importadas: ${imported}. Retiradas de origen: ${cleaned}. Ya conocidas: ${skipped}. Ignoradas: ${ignored}. No soportadas: ${unsupported}. Errores: ${errors}.${sourceNote}${pickerNote}`;
}

function renderMobileCapture() {
  const hasProject = Boolean(state.project);
  const active = mobileCaptureIsActive();
  const status = state.mobileCapture || {};
  const uploadedCount = status.uploadedCount || 0;

  els.mobileCaptureButton.disabled = !hasProject || state.busy;
  els.mobileCaptureButton.textContent = active ? 'Desactivar captura móvil' : 'Activar captura móvil';
  els.copyMobileCaptureUrlButton.disabled = !active || state.busy;

  if (!hasProject) {
    els.mobileCaptureUrl.hidden = true;
    els.mobileCaptureUrl.removeAttribute('href');
    els.mobileCaptureUrl.textContent = '';
    els.mobileCaptureStatus.textContent = 'Crea o abre un libro para activar la captura móvil.';
    return;
  }

  if (!active) {
    els.mobileCaptureUrl.hidden = true;
    els.mobileCaptureUrl.removeAttribute('href');
    els.mobileCaptureUrl.textContent = '';
    els.mobileCaptureStatus.textContent =
      'Activa una URL temporal y ábrela desde el móvil conectado a la misma Wi-Fi.';
    return;
  }

  els.mobileCaptureUrl.hidden = false;
  els.mobileCaptureUrl.href = status.url;
  els.mobileCaptureUrl.textContent = status.url;
  els.mobileCaptureStatus.textContent = `Servidor móvil activo. Fotos recibidas: ${uploadedCount}. Si la URL no carga, revisa que ordenador y móvil estén en la misma red Wi-Fi.`;
}

function renderSupportPanel() {
  if (!state.system) {
    els.supportSummary.textContent =
      state.systemError || 'Comprobando compatibilidad del sistema...';
    els.supportFacts.innerHTML = '';
    els.updateNotice.hidden = true;
    els.checkUpdatesButton.disabled = true;
    return;
  }

  els.setupGuideLink.href = state.system.links?.setupGuide || els.setupGuideLink.href;
  els.reportIssueLink.href = state.system.links?.reportIssue || els.reportIssueLink.href;
  els.configureAiOcrButton.disabled = state.busy;
  els.configureAiOcrButton.textContent = state.system.aiOcr?.configured
    ? 'Ajustes IA OCR'
    : 'Configurar IA OCR';
  els.checkUpdatesButton.disabled = state.checkingUpdates || state.updatingApp;
  els.checkUpdatesButton.textContent = state.checkingUpdates
    ? 'Comprobando versiones...'
    : 'Comprobar versiones';
  els.supportSummary.textContent = state.system.summary;
  els.supportFacts.innerHTML = '';

  const facts = [
    `Versión instalada: ${installedVersionLabel() || 'pendiente de detectar'}.`,
    `Sistema operativo: ${state.system.platformLabel}.`,
    `Datos de usuario: ${state.system.dataRootDir}.`,
    `OCR por defecto: ${state.system.preferredEngineLabel}.`,
    state.system.appleVisionAvailable
      ? 'Apple Vision disponible en este equipo.'
      : 'Apple Vision no está disponible en este equipo.',
    summarizeTesseractLanguages(state.system.tesseractLanguages),
    state.system.aiOcr?.configured
      ? `OCR con IA configurado (${state.system.aiOcr.providerLabel}, ${
          state.system.aiOcr.source === 'env' ? 'entorno' : 'clave local'
        }, ${state.system.aiOcr.model}).`
      : 'OCR con IA no configurado.',
    folderPickerSupported()
      ? 'Selector nativo de carpetas disponible.'
      : 'Selector nativo de carpetas no disponible: pega la ruta manualmente.'
  ];

  for (const warning of state.system.warnings || []) {
    facts.push(warning);
  }

  if (state.system.storage?.migrated) {
    facts.push(
      `BookSaver ha movido ${state.system.storage.movedEntries} elementos a la carpeta segura del sistema.`
    );
  } else if (
    state.system.storage?.dataRootDir &&
    state.system.storage.dataRootDir !== state.system.storage.legacyRootDir
  ) {
    facts.push('Los libros y la bandeja ya no dependen de la carpeta donde está instalada la app.');
  }

  if (state.system.storage?.skippedEntries) {
    facts.push(
      `Algunos elementos ya existían en la carpeta nueva y no se han sobrescrito (${state.system.storage.skippedEntries}).`
    );
  }

  for (const fact of facts) {
    const item = document.createElement('li');
    item.textContent = fact;
    els.supportFacts.append(item);
  }

  const update = state.system.update;
  if (!update) {
    els.updateNotice.hidden = true;
    els.runUpdateButton.hidden = true;
    return;
  }

  els.updateReleaseLink.href =
    update.releaseUrl || state.system.links?.releases || state.system.releasesUrl || els.updateReleaseLink.href;
  els.updateNotice.hidden = false;
  els.runUpdateButton.hidden = true;
  els.runUpdateButton.disabled = state.updatingApp;
  els.runUpdateButton.textContent = state.updatingApp ? 'Actualizando...' : 'Actualizar ahora';

  if (state.updatingApp && update.latestVersion) {
    els.updateNotice.dataset.state = 'available';
    els.updateStatus.textContent = `Instalando BookSaver ${update.latestVersion}...`;
    els.updateMeta.textContent =
      'La app descargará la nueva versión y volverá a levantar el servidor local en esta misma carpeta.';
    els.runUpdateButton.hidden = false;
    els.updateReleaseLink.textContent = `Ver cambios de ${update.latestVersion}`;
    return;
  }

  if (update.available) {
    els.updateNotice.dataset.state = 'available';
    els.updateStatus.textContent = installedVersionLabel()
      ? `Hay una nueva versión de BookSaver: ${update.latestVersion}. En este equipo tienes la ${installedVersionLabel()}.`
      : `Hay una nueva versión de BookSaver: ${update.latestVersion}.`;
    const meta = [];
    if (update.publishedAt) {
      meta.push(`Publicada el ${formatDate(update.publishedAt)}.`);
    }
    meta.push(`Última comprobación: ${formatDateTime(update.checkedAt)}.`);
    if (update.guideMessage) {
      meta.push(update.guideMessage);
    }
    els.updateMeta.textContent = meta.join(' ');
    els.updateReleaseLink.textContent = update.autoInstallSupported
      ? `Ver cambios de ${update.latestVersion}`
      : update.actionLabel || 'Abrir release';
    els.runUpdateButton.hidden = !update.autoInstallSupported;
    els.runUpdateButton.textContent = update.actionLabel || 'Actualizar ahora';
    return;
  }

  if (update.error) {
    els.updateNotice.dataset.state = 'error';
    els.updateStatus.textContent = installedVersionLabel()
      ? `No se pudo comprobar si hay una versión nueva. Tienes la ${installedVersionLabel()}.`
      : 'No se pudo comprobar si hay una versión nueva.';
    els.updateMeta.textContent = `Último intento: ${formatDateTime(update.checkedAt)}. ${humanizeUpdateError(update.error)}`;
    els.updateReleaseLink.textContent = 'Ver versiones publicadas';
    return;
  }

  els.updateNotice.dataset.state = 'current';
  els.updateStatus.textContent = installedVersionLabel()
    ? `BookSaver está al día en la versión ${installedVersionLabel()}.`
    : 'BookSaver está al día.';
  els.updateMeta.textContent = update.latestVersion
    ? `Última comprobación: ${formatDateTime(update.checkedAt)}. Última versión publicada: ${update.latestVersion}.`
    : `Última comprobación: ${formatDateTime(update.checkedAt)}.`;
  els.updateReleaseLink.textContent = 'Ver historial de versiones';
}

function render() {
  renderPlatformCopy();
  renderProjects();
  renderLibraryDashboard();
  renderExportHistory();
  renderSnapshotHistory();
  renderTrashHistory();
  renderPages();
  renderCover();
  renderEditor();
  renderReadingView();
  renderBookSearch();
  renderPageTextHistory();
  renderPageMarkers();
  renderCamera();
  renderInbox();
  renderMobileCapture();
  renderSupportPanel();
  renderDictionary();
  renderSuspiciousReview();

  const pageCount = state.project?.pages.length || 0;
  els.projectStatus.textContent = state.project
    ? `${state.project.title} - ${pageCount} ${pageCount === 1 ? 'pagina' : 'paginas'}`
    : 'Sin libro abierto';
  els.reviewExportButton.disabled = !state.project || pageCount === 0 || state.busy;
  els.importPackageButton.disabled = state.busy;
  els.exportPackageButton.disabled = !state.project || pageCount === 0 || state.busy;
  els.exportButton.disabled = !state.project || pageCount === 0 || state.busy;
}

async function loadSelectedPageText() {
  const page = currentPage();
  if (!page) {
    renderEditor();
    return;
  }

  try {
    const { page: payload } = await api(`/api/projects/${state.project.id}/pages/${page.id}`);
    els.ocrText.value = payload.ocrText || '';
    Object.assign(page, payload);
    render();
  } catch (error) {
    showToast(error.message);
  }
}

async function refreshCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    els.cameraSelect.innerHTML = '<option>Camara no disponible</option>';
    state.devices = [];
    renderCameraDiagnostics();
    return;
  }

  const previousDeviceId =
    els.cameraSelect.value || state.stream?.getVideoTracks?.()[0]?.getSettings?.().deviceId || '';
  const devices = await navigator.mediaDevices.enumerateDevices();
  state.devices = devices.filter((device) => device.kind === 'videoinput');
  els.cameraSelect.innerHTML = '';

  if (state.devices.length === 0) {
    const option = document.createElement('option');
    option.textContent = 'No hay camaras';
    option.value = '';
    els.cameraSelect.append(option);
    renderCameraDiagnostics();
    return;
  }

  for (const [index, device] of state.devices.entries()) {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Camara ${index + 1}`;
    if (isIphoneCamera(device)) {
      option.textContent = `${option.textContent} - iPhone`;
    }
    els.cameraSelect.append(option);
  }

  const preferredDevice =
    state.devices.find((device) => device.deviceId === previousDeviceId) ||
    state.devices.find((device) => !isIphoneCamera(device)) ||
    state.devices[0];
  if (preferredDevice) {
    els.cameraSelect.value = preferredDevice.deviceId;
  }

  renderCameraDiagnostics();
}

function isIphoneCamera(device) {
  return IPHONE_CAMERA_PATTERN.test(device.label || '');
}

function hasCameraLabels() {
  return state.devices.some((device) => device.label);
}

function renderCameraDiagnostics() {
  els.cameraDevicesList.innerHTML = '';

  if (state.devices.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No hay camaras detectadas por este navegador.';
    els.cameraDevicesList.append(item);
  }

  for (const [index, device] of state.devices.entries()) {
    const item = document.createElement('li');
    const label = device.label || `Camara ${index + 1} (nombre oculto hasta dar permiso)`;
    const suffix = device.deviceId ? ` · id ${device.deviceId.slice(0, 8)}` : '';
    item.textContent = `${label}${suffix}`;

    if (isIphoneCamera(device)) {
      const match = document.createElement('span');
      match.className = 'iphone-match';
      match.textContent = ' · posible iPhone';
      item.append(match);
    }

    els.cameraDevicesList.append(item);
  }

  if (state.devices.length === 0) {
    els.cameraDiagnosticsHint.textContent = isMacSystem()
      ? 'No se han detectado cámaras. Conecta una webcam, una cámara USB o prueba con el iPhone mediante Continuity Camera.'
      : 'No se han detectado cámaras. Conecta una webcam o una cámara USB y vuelve a actualizar.';
    return;
  }

  if (!hasCameraLabels()) {
    els.cameraDiagnosticsHint.textContent =
      'Pulsa Activar cámara para conceder permiso al navegador y ver los nombres reales.';
    return;
  }

  if (!isMacSystem()) {
    els.cameraDiagnosticsHint.textContent =
      'Elige una cámara del listado y pulsa Activar cámara para empezar.';
    return;
  }

  const iphoneCamera = findIphoneCamera();
  els.cameraDiagnosticsHint.textContent = iphoneCamera
    ? `Lista preparada. También hemos detectado un iPhone: ${iphoneCamera.label}.`
    : 'Lista preparada. Si quieres usar el iPhone, desbloquéalo y pulsa Buscar iPhone.';
}

function findIphoneCamera() {
  return state.devices.find(isIphoneCamera) || null;
}

function selectedCameraLabel() {
  const selectedDevice = state.devices.find((device) => device.deviceId === els.cameraSelect.value);
  return selectedDevice?.label || 'camara seleccionada';
}

async function requestCameraLabels() {
  if (hasCameraLabels()) {
    return;
  }

  const permissionStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });

  for (const track of permissionStream.getTracks()) {
    track.stop();
  }
}

function cameraConstraints(deviceId) {
  return {
    video: {
      width: { ideal: 3840 },
      height: { ideal: 2160 },
      frameRate: { ideal: 30 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : {})
    },
    audio: false
  };
}

async function openCamera(deviceId) {
  state.stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(deviceId));
  els.video.srcObject = state.stream;
  await els.video.play();
}

async function startSelectedCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('El navegador no permite acceder a la camara.');
    return;
  }

  stopCamera();
  setBusy(true);

  try {
    const deviceId = els.cameraSelect.value;
    await openCamera(deviceId);
    await refreshCameras();
    if (deviceId) {
      els.cameraSelect.value = deviceId;
    }
    showToast(`Camara lista: ${selectedCameraLabel()}.`);
  } catch (error) {
    state.stream = null;
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function startPrimaryCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('El navegador no permite acceder a la camara.');
    return;
  }

  if (state.devices.length === 0) {
    await refreshCameras();
  }

  if (!els.cameraSelect.value && state.devices[0]) {
    els.cameraSelect.value = state.devices[0].deviceId;
  }

  if (!els.cameraSelect.value) {
    showToast('No se detectaron camaras en este navegador.');
    return;
  }

  await startSelectedCamera();
}

async function startIphoneCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('El navegador no permite acceder a la camara.');
    return;
  }

  stopCamera();
  setBusy(true);

  try {
    await requestCameraLabels();
    await refreshCameras();

    const iphoneCamera = findIphoneCamera();
    if (!iphoneCamera) {
      showToast(
        'No veo un iPhone disponible. Desbloquéalo, acércalo al Mac, activa Continuity Camera y vuelve a pulsar Buscar iPhone.'
      );
      return;
    }

    els.cameraSelect.value = iphoneCamera.deviceId;
    await openCamera(iphoneCamera.deviceId);
    await refreshCameras();
    els.cameraSelect.value = iphoneCamera.deviceId;
    showToast(`Usando iPhone: ${iphoneCamera.label}.`);
  } catch (error) {
    state.stream = null;
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function handleCameraButtonClick() {
  await startPrimaryCamera();
}

async function handleSecondaryCameraButtonClick() {
  if (isMacSystem()) {
    await startIphoneCamera();
    return;
  }

  await refreshCameras();
  render();
  showToast(state.devices.length ? 'Camaras actualizadas.' : 'No se detectaron camaras.');
}

function stopCamera() {
  if (state.stream) {
    for (const track of state.stream.getTracks()) {
      track.stop();
    }
  }
  state.stream = null;
  els.video.srcObject = null;
}

function pageIdsWithMove(pageIds, fromIndex, toIndex) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= pageIds.length ||
    toIndex >= pageIds.length ||
    fromIndex === toIndex
  ) {
    return pageIds;
  }

  const nextPageIds = [...pageIds];
  const [pageId] = nextPageIds.splice(fromIndex, 1);
  nextPageIds.splice(toIndex, 0, pageId);
  return nextPageIds;
}

function samePageOrder(left, right) {
  return left.length === right.length && left.every((pageId, index) => pageId === right[index]);
}

function revealPageInList(pageId) {
  if (!pageId) {
    return;
  }

  requestAnimationFrame(() => {
    const item = els.pagesList.querySelector(`[data-page-id="${pageId}"]`);
    item?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });
  });
}

function selectVisiblePages() {
  const visiblePageIds = pageIds(filterPagesByMarker(state.project?.pages || []));
  state.selectedBatchPageIds = new Set([...state.selectedBatchPageIds, ...visiblePageIds]);
  renderPages();
}

function clearPageSelection() {
  state.selectedBatchPageIds = new Set();
  renderPages();
}

async function applyPageOrder(pageIds, options = {}) {
  const pages = state.project?.pages || [];
  const currentIds = pages.map((page) => page.id);
  if (!state.project || state.busy || samePageOrder(currentIds, pageIds)) {
    showToast('El orden no cambia.');
    return;
  }

  if (options.confirmMessage && !window.confirm(options.confirmMessage)) {
    return;
  }

  try {
    await persistCurrentPageDraft();
  } catch (error) {
    showToast(error.message);
    return;
  }

  setBusy(true);

  try {
    const { pages: reorderedPages } = await api(`/api/projects/${state.project.id}/pages`, {
      method: 'PATCH',
      body: JSON.stringify({ pageIds })
    });
    state.project = {
      ...state.project,
      pages: reorderedPages
    };
    pruneBatchSelection(reorderedPages);
    await loadSnapshots(state.project.id, { renderAfter: false });
    render();
    revealPageInList(options.revealPageId || state.selectedPageId);
    showToast(options.successMessage || 'Paginas reordenadas.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function moveBatchPages(target) {
  const pages = state.project?.pages || [];
  const selectedCount = state.selectedBatchPageIds.size;
  if (selectedCount === 0) {
    showToast('Selecciona al menos una pagina.');
    return;
  }

  const pageIds = pages.map((page) => page.id);
  const nextPageIds = movePageSelection(pageIds, [...state.selectedBatchPageIds], target);
  const revealPageId = [...state.selectedBatchPageIds][0] || state.selectedPageId;
  await applyPageOrder(nextPageIds, {
    revealPageId,
    confirmMessage: `Mover ${selectedCount} ${selectedCount === 1 ? 'pagina' : 'paginas'} seleccionadas?`,
    successMessage: `${selectedCount} ${selectedCount === 1 ? 'pagina movida' : 'paginas movidas'}.`
  });
}

async function moveBatchRelative(mode) {
  const anchorId = els.pageBatchAnchorInput.value;
  if (!anchorId) {
    showToast('Elige una pagina de referencia.');
    return;
  }

  await moveBatchPages({ mode, anchorId });
}

async function sortPagesBySource(mode) {
  const pages = state.project?.pages || [];
  const nextPageIds = sortPageIdsBySource(pages, mode);
  await applyPageOrder(nextPageIds, {
    revealPageId: nextPageIds[0],
    confirmMessage: `Ordenar todas las paginas por ${mode === 'name' ? 'nombre de archivo' : 'fecha de captura'}?`,
    successMessage: `Paginas ordenadas por ${mode === 'name' ? 'nombre de archivo' : 'fecha de captura'}.`
  });
}

async function reorderSelectedPage(targetIndex) {
  const page = currentPage();
  const pages = state.project?.pages || [];

  if (!page || state.busy || pages.length <= 1) {
    return;
  }

  const currentIndex = pages.findIndex((item) => item.id === page.id);
  if (currentIndex < 0) {
    return;
  }

  const nextIndex = Math.max(0, Math.min(pages.length - 1, targetIndex));
  if (nextIndex === currentIndex) {
    return;
  }

  try {
    await persistCurrentPageDraft();
  } catch (error) {
    showToast(error.message);
    return;
  }

  setBusy(true);

  try {
    const pageIds = pageIdsWithMove(
      pages.map((item) => item.id),
      currentIndex,
      nextIndex
    );
    const { pages: reorderedPages } = await api(`/api/projects/${state.project.id}/pages`, {
      method: 'PATCH',
      body: JSON.stringify({ pageIds })
    });
    state.project = {
      ...state.project,
      pages: reorderedPages
    };
    await loadSnapshots(state.project.id, { renderAfter: false });
    render();
    revealPageInList(page.id);
    showToast(`Pagina movida a la posicion ${nextIndex + 1}.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function moveSelectedPageBy(delta) {
  const page = currentPage();
  const pages = state.project?.pages || [];

  if (!page || pages.length <= 1) {
    return;
  }

  const currentIndex = pages.findIndex((item) => item.id === page.id);
  await reorderSelectedPage(currentIndex + delta);
}

async function moveSelectedPageToStart() {
  await reorderSelectedPage(0);
}

async function moveSelectedPageToEnd() {
  const pages = state.project?.pages || [];
  await reorderSelectedPage(pages.length - 1);
}

async function capturePage() {
  if (!state.project || !state.stream || state.busy) {
    return;
  }

  const width = els.video.videoWidth;
  const height = els.video.videoHeight;

  if (!width || !height) {
    showToast('La camara aun no entrega imagen.');
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(els.video, 0, 0, width, height);
    const imageData = canvas.toDataURL('image/jpeg', 0.95);
    const quality = analyzeCanvasCapture(canvas, 'camera');
    const cropSuggestion = suggestCropFromCanvas(canvas);
    const { page } = await api(`/api/projects/${state.project.id}/pages`, {
      method: 'POST',
      body: JSON.stringify({ imageData, quality, cropSuggestion })
    });
    state.selectedPageId = page.id;
    await refreshProject();
    showToast('Pagina capturada.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('No se pudo leer esta imagen.')));
    image.src = url;
  });
}

async function fileToCaptureDataUrl(file) {
  if (file.type === 'image/jpeg' || file.type === 'image/png') {
    return readFileAsDataUrl(file);
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.95);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function fileCaptureQuality(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return analyzeCanvasCapture(canvas, 'import');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function fileCropSuggestion(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return suggestCropFromCanvas(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function fileToCapturePayload(file) {
  const imageData = await fileToCaptureDataUrl(file);
  let quality = null;
  let cropSuggestion = null;
  try {
    quality = await fileCaptureQuality(file);
  } catch {
    quality = null;
  }
  try {
    cropSuggestion = await fileCropSuggestion(file);
  } catch {
    cropSuggestion = null;
  }
  return { imageData, quality, cropSuggestion };
}

async function importPhotos(files) {
  if (!state.project || state.busy) {
    return;
  }

  const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));

  if (imageFiles.length === 0) {
    showToast('Elige una o varias fotos.');
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    let imported = 0;
    for (const file of imageFiles) {
      const { imageData, quality, cropSuggestion } = await fileToCapturePayload(file);
      const { page } = await api(`/api/projects/${state.project.id}/pages`, {
        method: 'POST',
        body: JSON.stringify({ imageData, quality, cropSuggestion })
      });
      state.selectedPageId = page.id;
      imported += 1;
    }

    await refreshProject();
    showToast(`${imported} ${imported === 1 ? 'foto importada' : 'fotos importadas'}.`);
  } catch (error) {
    showToast(`${error.message} Si son HEIC, prueba a compartirlas como JPEG.`);
  } finally {
    els.photoImportInput.value = '';
    setBusy(false);
  }
}

async function updateInbox(showSuccess = true) {
  if (!state.project) {
    return;
  }

  state.inboxPreview = null;
  const { project } = await api(`/api/projects/${state.project.id}/inbox`, {
    method: 'PATCH',
    body: JSON.stringify({
      path: els.inboxPathInput.value,
      watch: els.inboxWatchInput.checked
    })
  });
  state.project = project;
  await loadProjects();
  render();
  if (showSuccess) {
    showToast('Carpeta guardada.');
  }
}

async function saveInbox() {
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);

  try {
    await updateInbox(true);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function selectInboxFolder() {
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);

  try {
    const result = await api('/api/folder-picker', {
      method: 'POST',
      body: '{}'
    });
    els.inboxPathInput.value = result.path;
    await updateInbox(false);
    showToast('Carpeta seleccionada.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function scanInbox() {
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);
  state.inboxPreviewLoading = true;
  state.inboxPreview = null;
  render();

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    await updateInbox(false);
    const { preview } = await api(`/api/projects/${state.project.id}/inbox/preview`);
    state.inboxPreview = {
      ...preview,
      candidateActions: Object.fromEntries(
        preview.candidates.map((candidate) => [candidate.id, defaultInboxCandidateAction(candidate)])
      )
    };
    const count = preview.candidates.length;
    const unsupported = preview.unsupported.length;
    const duplicates = preview.candidates.filter((candidate) => candidate.duplicate).length;
    const importCount = preview.candidates.filter(
      (candidate) => defaultInboxCandidateAction(candidate) !== 'ignore'
    ).length;
    const summary = `${count} ${count === 1 ? 'foto revisada' : 'fotos revisadas'}, ${importCount} para importar${
      unsupported ? `, ${unsupported} no soportadas` : ''
    }${duplicates ? `, ${duplicates} duplicadas o posibles` : ''}.`;
    showToast(preview.notice ? `${summary} ${preview.notice}` : summary);
  } catch (error) {
    showToast(error.message);
  } finally {
    state.inboxPreviewLoading = false;
    setBusy(false);
  }
}

async function confirmInboxImport() {
  if (!state.project || !state.inboxPreview || state.busy) {
    return;
  }

  const candidateIds = state.inboxPreview.candidates.map((candidate) => candidate.id);
  if (!candidateIds.length) {
    showToast('No hay fotos listas para importar.');
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const result = await api(`/api/projects/${state.project.id}/inbox/scan`, {
      method: 'POST',
      body: JSON.stringify({
        candidateIds,
        candidateActions: inboxCandidateActions()
      })
    });
    state.inboxPreview = null;
    state.project = result.project;
    const lastPage = result.importedPages.at(-1);
    if (lastPage) {
      state.selectedPageId = lastPage.id;
    }
    await loadProjects();
    render();
    await loadSelectedPageText();

    const pieces = [`${result.importedCount} nuevas`];
    if (result.skippedDuplicates) {
      pieces.push(`${result.skippedDuplicates} ya conocidas`);
    }
    if (result.ignoredCount) {
      pieces.push(`${result.ignoredCount} ignoradas`);
    }
    if (result.cleanedUpCount) {
      pieces.push(`${result.cleanedUpCount} retiradas de origen`);
    }
    if (result.unsupported.length) {
      pieces.push(`${result.unsupported.length} no soportadas`);
    }
    if (result.errors.length) {
      pieces.push(`${result.errors.length} con error`);
    }
    const summary = `Importación completa: ${pieces.join(', ')}.`;
    showToast(result.notice ? `${summary} ${result.notice}` : summary);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

function cancelInboxPreview() {
  state.inboxPreview = null;
  render();
  showToast('Importación cancelada. No se ha movido ningún archivo.');
}

async function toggleMobileCapture() {
  if (!state.project || state.busy) {
    return;
  }

  const projectId = state.project.id;
  const active = mobileCaptureIsActive();
  setBusy(true);

  try {
    const { mobileCapture } = await api(`/api/projects/${projectId}/mobile-capture`, {
      method: active ? 'DELETE' : 'POST',
      body: '{}'
    });
    state.mobileCapture = mobileCapture;
    render();
    showToast(active ? 'Captura móvil desactivada.' : 'Captura móvil activada.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function copyMobileCaptureUrl() {
  const url = state.mobileCapture?.url;
  if (!url) {
    return;
  }

  const result = await copyTextWithFallback(url, {
    fallbackElement: els.mobileCaptureUrl
  });

  if (result.copied) {
    showToast('URL de captura móvil copiada.');
    return;
  }

  if (result.selected) {
    showToast('No se pudo copiar automáticamente, pero he seleccionado la URL.');
    return;
  }

  showToast('No se pudo copiar automáticamente. Mantén pulsada la URL para copiarla.');
}

async function runOcrForPage() {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  const mode = selectedOcrMode();
  const allowCloud = mode === 'ai-advanced' ? await confirmAiOcrForPage() : false;
  if (mode === 'ai-advanced' && !allowCloud) {
    showToast('OCR con IA cancelado.');
    return;
  }

  setBusy(true);

  try {
    els.editorStatus.textContent = 'Leyendo texto...';
    const { page: nextPage } = await api(
      `/api/projects/${state.project.id}/pages/${page.id}/ocr`,
      {
        method: 'POST',
        body: JSON.stringify({ mode, allowCloud, confirmedCostPrivacy: allowCloud })
      }
    );
    Object.assign(page, nextPage);
    els.ocrText.value = nextPage.ocrText || '';
    renderFormattedPreview(nextPage.layoutData, nextPage.ocrText || '');
    showToast(nextPage.ocrWarning || 'Texto extraido.');
    await refreshProject();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

function confirmAiOcrForPage() {
  if (!aiOcrAvailable()) {
    showToast('Configura IA OCR o usa OPENAI_API_KEY para activar el modo avanzado.');
    return Promise.resolve(false);
  }

  const settings = aiOcrSettings();
  const page = currentPage();
  els.aiOcrConfirmSummary.textContent =
    'BookSaver necesita tu confirmación antes de enviar la captura al proveedor OCR avanzado.';
  els.aiOcrConfirmFacts.innerHTML = '';
  appendDescriptionRow(els.aiOcrConfirmFacts, 'Proveedor', settings.providerLabel || settings.provider);
  appendDescriptionRow(els.aiOcrConfirmFacts, 'Modelo', settings.model);
  if (settings.provider === 'openai-compatible') {
    appendDescriptionRow(els.aiOcrConfirmFacts, 'Endpoint', settings.baseUrl);
  }
  appendDescriptionRow(
    els.aiOcrConfirmFacts,
    'Privacidad',
    `La imagen de la página ${page?.number || ''} sale de tu equipo para esta solicitud.`
  );
  appendDescriptionRow(
    els.aiOcrConfirmFacts,
    'Coste',
    'Esta llamada puede tener coste según tu proveedor, modelo y contrato.'
  );

  return new Promise((resolve) => {
    const cleanup = () => {
      els.aiOcrForm.removeEventListener('submit', onSubmit);
      els.cancelAiOcrButton.removeEventListener('click', onCancel);
      els.aiOcrDialog.removeEventListener('cancel', onCancel);
    };
    const onSubmit = (event) => {
      event.preventDefault();
      cleanup();
      els.aiOcrDialog.close();
      resolve(true);
    };
    const onCancel = (event) => {
      event?.preventDefault();
      cleanup();
      if (els.aiOcrDialog.open) {
        els.aiOcrDialog.close();
      }
      resolve(false);
    };

    els.aiOcrForm.addEventListener('submit', onSubmit);
    els.cancelAiOcrButton.addEventListener('click', onCancel);
    els.aiOcrDialog.addEventListener('cancel', onCancel);
    els.aiOcrDialog.showModal();
  });
}

async function runBatchOcr(batchMode = 'pending') {
  if (!state.project || state.busy) {
    return;
  }

  const ocrMode = selectedOcrMode();
  if (ocrMode === 'ai-advanced') {
    showToast('El OCR con IA se ejecuta pagina a pagina para confirmar cada envio.');
    return;
  }

  const candidates =
    batchMode === 'all'
      ? [...ocrEligiblePages(state.project.pages || [])]
      : pendingOcrPages(state.project.pages || []);

  if (candidates.length === 0) {
    showToast(
      batchMode === 'all' ? 'No hay paginas para releer ahora mismo.' : 'No hay paginas pendientes de OCR.'
    );
    return;
  }

  setBusy(true);
  state.batchOcr = {
    mode: batchMode,
    total: candidates.length,
    completed: 0,
    currentPageId: null
  };
  render();

  try {
    await persistCurrentPageDraft({ keepBusy: true });

    let failed = 0;
    let warned = 0;

    for (const candidate of candidates) {
      state.batchOcr.currentPageId = candidate.id;
      render();

      try {
        const { page: nextPage } = await api(
          `/api/projects/${state.project.id}/pages/${candidate.id}/ocr`,
          {
            method: 'POST',
            body: JSON.stringify({ mode: ocrMode, allowCloud: false })
          }
        );
        const pageIndex = state.project.pages.findIndex((page) => page.id === candidate.id);
        if (pageIndex >= 0) {
          state.project.pages[pageIndex] = {
            ...state.project.pages[pageIndex],
            ...nextPage
          };
        }
        if (nextPage.ocrWarning) {
          warned += 1;
        }
      } catch {
        failed += 1;
      } finally {
        state.batchOcr.completed += 1;
        render();
      }
    }

    await refreshProject();

    const success = candidates.length - failed;
    const summary = [`${success} ${success === 1 ? 'pagina leida' : 'paginas leidas'}`];
    if (failed) {
      summary.push(`${failed} con error`);
    }
    if (warned) {
      summary.push(`${warned} con aviso`);
    }
    showToast(`OCR por lotes completado: ${summary.join(', ')}.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    state.batchOcr = null;
    setBusy(false);
  }
}

async function saveText() {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  const text = els.ocrText.value;
  setBusy(true);

  try {
    const { page: nextPage } = await api(`/api/projects/${state.project.id}/pages/${page.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ text })
    });
    Object.assign(page, nextPage);
    page.ocrText = text;
    page.layoutData = null;
    renderFormattedPreview(null, text);
    showToast('Texto guardado.');
    await refreshProject();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function restoreTextHistory(historyId) {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  const confirmed = window.confirm(`Restaurar una versión anterior en la página ${page.number}?`);
  if (!confirmed) {
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const { page: nextPage } = await api(
      `/api/projects/${state.project.id}/pages/${page.id}/text-history/${historyId}/restore`,
      {
        method: 'POST',
        body: JSON.stringify({})
      }
    );
    Object.assign(page, nextPage);
    els.ocrText.value = nextPage.ocrText || '';
    renderFormattedPreview(nextPage.layoutData, nextPage.ocrText || '');
    await refreshProject();
    showToast('Versión de texto restaurada.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function saveDictionary(nextDictionary) {
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);

  try {
    const { dictionary } = await api(`/api/projects/${state.project.id}/dictionary`, {
      method: 'PATCH',
      body: JSON.stringify(nextDictionary)
    });
    state.dictionary = dictionary;
    els.dictionaryTermInput.value = '';
    render();
    showToast('Diccionario local guardado.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function addDictionaryTerm() {
  const term = els.dictionaryTermInput.value.trim();
  if (!term) {
    showToast('Escribe un término para añadirlo al diccionario.');
    return;
  }

  await saveDictionary({
    ...(state.dictionary || {}),
    terms: [...(state.dictionary?.terms || []), term]
  });
}

async function removeDictionaryTerm(term) {
  await saveDictionary({
    ...(state.dictionary || {}),
    terms: (state.dictionary?.terms || []).filter((item) => item !== term)
  });
}

async function addReplacement() {
  const from = els.replacementFromInput.value.trim();
  const to = els.replacementToInput.value.trim();
  if (!from) {
    showToast('Escribe el texto que quieres buscar.');
    return;
  }

  await saveDictionary({
    ...(state.dictionary || {}),
    replacements: [
      ...(state.dictionary?.replacements || []).filter((item) => item.from !== from),
      { from, to }
    ]
  });
  els.replacementFromInput.value = '';
  els.replacementToInput.value = '';
}

async function removeReplacement(from) {
  await saveDictionary({
    ...(state.dictionary || {}),
    replacements: (state.dictionary?.replacements || []).filter((item) => item.from !== from)
  });
}

async function previewReplacementsForCurrentPage() {
  const page = currentPage();
  if (!state.project || !page || state.busy) {
    return null;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const { preview } = await api(`/api/projects/${state.project.id}/dictionary/replacements/preview`, {
      method: 'POST',
      body: JSON.stringify({ pageIds: [page.id] })
    });
    const pagePreview = preview.pages[0];
    if (!pagePreview) {
      els.replacementPreviewStatus.textContent = 'No hay cambios para esta página.';
      showToast('No hay cambios para esta página.');
      return preview;
    }
    els.replacementPreviewStatus.textContent = `${pagePreview.changeCount} cambios previstos en esta página.`;
    showToast(`${pagePreview.changeCount} cambios previstos. Revisa antes de aplicar.`);
    return preview;
  } catch (error) {
    showToast(error.message);
    return null;
  } finally {
    setBusy(false);
  }
}

async function applyReplacementsToCurrentPage() {
  const page = currentPage();
  if (!state.project || !page || state.busy) {
    return;
  }

  const preview = await previewReplacementsForCurrentPage();
  const pagePreview = preview?.pages?.[0];
  if (!pagePreview) {
    return;
  }

  const confirmed = window.confirm(`Aplicar ${pagePreview.changeCount} cambios a la página ${page.number}?`);
  if (!confirmed) {
    return;
  }

  setBusy(true);

  try {
    const { result } = await api(`/api/projects/${state.project.id}/dictionary/replacements/apply`, {
      method: 'POST',
      body: JSON.stringify({ pageIds: [page.id] })
    });
    await refreshProject();
    showToast(`Reemplazos aplicados en ${result.updatedCount} página.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function scanSuspiciousWords() {
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const { review } = await api(`/api/projects/${state.project.id}/review/suspicious`);
    state.suspiciousReview = review;
    render();
    showToast(review.summary);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function acceptSuspiciousItem(item = nextSuspiciousItem()) {
  if (!state.project || !item || state.busy) {
    return;
  }

  setBusy(true);

  try {
    const { dictionary } = await api(`/api/projects/${state.project.id}/review/suspicious/accept`, {
      method: 'POST',
      body: JSON.stringify({ word: item.word })
    });
    state.dictionary = dictionary;
    const { review } = await api(`/api/projects/${state.project.id}/review/suspicious`);
    state.suspiciousReview = review;
    render();
    showToast(`"${item.word}" aceptada en el diccionario local.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function replaceSuspiciousItem(item = nextSuspiciousItem()) {
  if (!state.project || !item || state.busy) {
    return;
  }

  const replacement = window.prompt(`Corregir "${item.word}" por:`, item.word);
  if (!replacement || replacement.trim() === item.word) {
    return;
  }

  setBusy(true);

  try {
    const { page } = await api(`/api/projects/${state.project.id}/review/suspicious/replace`, {
      method: 'POST',
      body: JSON.stringify({
        pageId: item.pageId,
        word: item.word,
        replacement: replacement.trim()
      })
    });
    if (page.id === state.selectedPageId) {
      els.ocrText.value = page.ocrText || '';
      renderFormattedPreview(page.layoutData, page.ocrText || '');
    }
    await refreshProject();
    await loadDictionary(state.project.id, { renderAfter: false });
    const { review } = await api(`/api/projects/${state.project.id}/review/suspicious`);
    state.suspiciousReview = review;
    render();
    showToast(`Corrección aplicada en la página ${page.number}.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function savePageMarkers() {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  const tags = Array.from(els.pageMarkerTags.querySelectorAll('input[type="checkbox"]:checked')).map(
    (input) => input.value
  );
  setBusy(true);

  try {
    const { page: nextPage } = await api(`/api/projects/${state.project.id}/pages/${page.id}/markers`, {
      method: 'PATCH',
      body: JSON.stringify({
        tags,
        note: els.pageMarkerNote.value
      })
    });
    Object.assign(page, nextPage);
    await refreshProject();
    showToast('Marcadores guardados.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function saveEditorial() {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  const editorialDraft = editorialDraftFromInputs();
  setBusy(true);

  try {
    const { page: nextPage } = await api(
      `/api/projects/${state.project.id}/pages/${page.id}/editorial`,
      {
        method: 'PATCH',
        body: JSON.stringify(editorialDraft)
      }
    );
    Object.assign(page, nextPage);
    await refreshProject();
    showToast('Estructura EPUB guardada.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function useSelectedPageAsCover() {
  const page = currentPage();
  if (!state.project || !page || state.busy) {
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const { project } = await api(`/api/projects/${state.project.id}/cover`, {
      method: 'PATCH',
      body: JSON.stringify({
        mode: 'page',
        pageId: page.id
      })
    });
    state.project = project;
    await loadProjects();
    render();
    showToast(`Portada actualizada con la pagina ${page.number}.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function uploadProjectCover(files) {
  if (!state.project || state.busy) {
    return;
  }

  const file = Array.from(files || []).find((item) => item.type.startsWith('image/'));
  if (!file) {
    showToast('Elige una imagen para la portada.');
    return;
  }

  setBusy(true);

  try {
    const imageData = await fileToCaptureDataUrl(file);
    const { project } = await api(`/api/projects/${state.project.id}/cover`, {
      method: 'POST',
      body: JSON.stringify({ imageData })
    });
    state.project = project;
    await loadProjects();
    render();
    showToast('Portada externa guardada.');
  } catch (error) {
    showToast(`${error.message} Si es HEIC, prueba a compartirla como JPEG.`);
  } finally {
    els.coverUploadInput.value = '';
    setBusy(false);
  }
}

async function clearProjectCover() {
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);

  try {
    const { project } = await api(`/api/projects/${state.project.id}/cover`, {
      method: 'PATCH',
      body: JSON.stringify({ mode: 'none' })
    });
    state.project = project;
    await loadProjects();
    render();
    showToast('Portada eliminada.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function updatePageCrop(crop) {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  setBusy(true);

  try {
    const { page: nextPage } = await api(`/api/projects/${state.project.id}/pages/${page.id}/crop`, {
      method: 'PATCH',
      body: JSON.stringify({ crop })
    });
    Object.assign(page, nextPage);
    state.adjustmentComparison = null;
    state.cropPageId = page.id;
    state.draftCrop = pageCrop(nextPage);
    await refreshProject();
    showToast(crop ? 'Recorte guardado.' : 'Recorte eliminado.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function rotateCurrentPage(delta) {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const rotation = nextPageRotation(page, delta);
    const { page: nextPage } = await api(
      `/api/projects/${state.project.id}/pages/${page.id}/rotation`,
      {
        method: 'PATCH',
        body: JSON.stringify({ rotation })
      }
    );
    Object.assign(page, nextPage);
    state.adjustmentComparison = null;
    state.cropPageId = page.id;
    state.draftCrop = pageCrop(nextPage);
    await refreshProject();
    showToast(`Pagina girada a ${pageRotation(nextPage)}°.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function updatePageDeskew(angle) {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const { page: nextPage } = await api(
      `/api/projects/${state.project.id}/pages/${page.id}/deskew`,
      {
        method: 'PATCH',
        body: JSON.stringify({ angle, source: 'manual' })
      }
    );
    Object.assign(page, nextPage);
    state.adjustmentComparison = null;
    await refreshProject();
    showToast(nextPage.deskew ? `Enderezado guardado (${nextPage.deskew.angle}°).` : 'Enderezado revertido.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function saveDeskew() {
  await updatePageDeskew(Number(els.deskewAngleInput.value));
}

async function clearDeskew() {
  els.deskewAngleInput.value = '0';
  await updatePageDeskew(0);
}

async function saveCrop() {
  const crop = normalizeCrop(state.draftCrop);
  if (!crop) {
    showToast('Arrastra sobre la imagen para preparar un recorte.');
    return;
  }

  await updatePageCrop(crop);
}

async function clearCrop() {
  state.draftCrop = null;
  renderCropOverlay();
  await updatePageCrop(null);
}

async function applyCropRange() {
  const page = currentPage();
  const crop = normalizeCrop(state.draftCrop) || pageCrop(page);
  if (!page || !crop || state.busy) {
    showToast('Prepara o guarda un recorte antes de aplicarlo a un rango.');
    return;
  }

  const fromPage = Number(els.cropRangeStartInput.value || page.number);
  const toPage = Number(els.cropRangeEndInput.value || fromPage);
  const start = Math.min(fromPage, toPage);
  const end = Math.max(fromPage, toPage);
  const confirmed = window.confirm(
    `Aplicar este recorte a las paginas ${start}-${end}? Podras quitarlo pagina por pagina.`
  );
  if (!confirmed) {
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const result = await api(`/api/projects/${state.project.id}/crop-range`, {
      method: 'POST',
      body: JSON.stringify({
        fromPage: start,
        toPage: end,
        crop,
        sourcePageId: page.id
      })
    });
    state.project = {
      ...state.project,
      pages: result.pages
    };
    state.adjustmentComparison = null;
    await refreshProject();
    showToast(`Recorte aplicado a ${result.updatedCount} ${result.updatedCount === 1 ? 'pagina' : 'paginas'}.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function toggleQualityIgnored() {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  setBusy(true);

  try {
    const { page: nextPage } = await api(`/api/projects/${state.project.id}/pages/${page.id}/quality`, {
      method: 'PATCH',
      body: JSON.stringify({ ignored: !page.quality?.ignored })
    });
    Object.assign(page, nextPage);
    await refreshProject();
    showToast(nextPage.quality?.ignored ? 'Avisos de captura ignorados.' : 'Avisos de captura reactivados.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function updateCropSuggestion(action) {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  setBusy(true);

  try {
    const { page: nextPage } = await api(
      `/api/projects/${state.project.id}/pages/${page.id}/crop-suggestion`,
      {
        method: 'POST',
        body: JSON.stringify({ action })
      }
    );
    Object.assign(page, nextPage);
    state.adjustmentComparison = null;
    state.cropPageId = page.id;
    state.draftCrop = pageCrop(nextPage);
    await refreshProject();
    showToast(action === 'accept' ? 'Recorte sugerido aplicado.' : 'Sugerencia descartada.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function toggleAdjustmentComparison() {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  if (state.adjustmentComparison?.pageId === page.id) {
    state.adjustmentComparison = null;
    render();
    return;
  }

  setBusy(true);

  try {
    const { comparison } = await api(
      `/api/projects/${state.project.id}/pages/${page.id}/adjustment-comparison`
    );
    state.adjustmentComparison = comparison;
    render();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function persistCurrentPageDraft(options = {}) {
  const { keepBusy = false } = options;
  const page = currentPage();
  if (!page) {
    return;
  }

  const textDraft = els.ocrText.value;
  const editorialDraft = editorialDraftFromInputs();
  const cropDraft = normalizeCrop(state.cropPageId === page.id ? state.draftCrop : page.crop);
  const textDirty = String(page.ocrText || '') !== String(textDraft);
  const editorialDirty = !sameEditorial(pageEditorial(page), pageEditorial({ editorial: editorialDraft }));
  const reviewDirty = pageReviewed(page) !== Boolean(editorialDraft.reviewed);
  const cropDirty = !sameCrop(page.crop, cropDraft);

  if (!textDirty && !editorialDirty && !reviewDirty && !cropDirty) {
    return;
  }

  if (!keepBusy) {
    setBusy(true);
  }

  try {
    if (textDirty) {
      const { page: nextPage } = await api(`/api/projects/${state.project.id}/pages/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ text: textDraft })
      });
      Object.assign(page, nextPage);
      page.ocrText = textDraft;
      page.layoutData = null;
    }

    if (editorialDirty || reviewDirty) {
      const { page: nextPage } = await api(
        `/api/projects/${state.project.id}/pages/${page.id}/editorial`,
        {
          method: 'PATCH',
          body: JSON.stringify(editorialDraft)
        }
      );
      Object.assign(page, nextPage);
    }

    if (cropDirty) {
      const { page: nextPage } = await api(`/api/projects/${state.project.id}/pages/${page.id}/crop`, {
        method: 'PATCH',
        body: JSON.stringify({ crop: cropDraft })
      });
      Object.assign(page, nextPage);
      state.cropPageId = page.id;
      state.draftCrop = pageCrop(nextPage);
    }

    await refreshProject();
  } finally {
    if (!keepBusy) {
      setBusy(false);
    }
  }
}

async function deletePage() {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  const confirmed = window.confirm(`Mover la pagina ${page.number} a la papelera local?`);
  if (!confirmed) {
    return;
  }

  setBusy(true);

  try {
    const { pages } = await api(`/api/projects/${state.project.id}/pages/${page.id}`, {
      method: 'DELETE'
    });
    state.selectedPageId = pages[0]?.id || null;
    await refreshProject();
    showToast('Pagina movida a la papelera.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function fetchExportCheck() {
  const { check } = await api(`/api/projects/${state.project.id}/export/check`);
  return check;
}

async function fetchExportPreview() {
  const { preview } = await api(`/api/projects/${state.project.id}/export/preview`);
  return preview;
}

async function fetchExportReadiness() {
  const [check, preview] = await Promise.all([fetchExportCheck(), fetchExportPreview()]);
  return { check, preview };
}

async function fetchReviewQueue() {
  const { queue } = await api(`/api/projects/${state.project.id}/review/queue`);
  return queue;
}

async function goToNextReviewProblem() {
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const queue = await fetchReviewQueue();
    const result = chooseNextReviewProblem(queue, state.selectedPageId);
    state.reviewQueueMessage = result.message;

    if (result.status === 'empty') {
      render();
      showToast(result.message);
      return;
    }

    await selectPage(result.item.pageId, { reviewQueueMessage: result.message });
    showToast(result.message);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function reviewExport() {
  if (!state.project || state.busy) {
    return;
  }

  let readiness = null;
  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    readiness = await fetchExportReadiness();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }

  if (readiness) {
    await openExportChecklist(readiness.check, { preview: readiness.preview });
  }
}

async function exportEpub() {
  if (!state.project || state.busy) {
    return;
  }

  let readiness = null;
  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    readiness = await fetchExportReadiness();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }

  if (!readiness) {
    return;
  }

  const confirmed = await openExportChecklist(readiness.check, {
    allowExport: true,
    preview: readiness.preview
  });
  if (!confirmed) {
    return;
  }

  setBusy(true);

  try {
    const { export: exported } = await api(`/api/projects/${state.project.id}/export`, {
      method: 'POST',
      body: '{}'
    });
    await loadExportHistory(state.project.id, { renderAfter: false });
    const link = document.createElement('a');
    link.href = exported.downloadUrl;
    link.download = exported.fileName;
    link.click();
    openExportResult(exported);
    const validationLabel = exported.validation?.valid ? 'validación correcta' : 'revisa avisos';
    showToast(
      `EPUB generado: ${exported.fileName} · ${formatBytes(exported.size)} · ${exported.summary?.chapterCount || exported.validation?.chapterCount || 0} capítulos · ${validationLabel}`
    );
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function runBookSearch(event) {
  event?.preventDefault();
  if (!state.project || state.busy) {
    return;
  }

  const query = els.bookSearchInput.value.trim();
  state.search.query = query;
  if (!query) {
    state.search.result = null;
    renderBookSearch();
    showToast('Escribe una palabra o frase para buscar.');
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const { search } = await api(`/api/projects/${state.project.id}/search?query=${encodeURIComponent(query)}`);
    state.search = {
      query,
      result: search
    };
    render();
    showToast(
      search.totalMatches
        ? `${search.totalMatches} ${search.totalMatches === 1 ? 'coincidencia encontrada' : 'coincidencias encontradas'}.`
        : 'Sin resultados.'
    );
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function openSearchResult(pageId) {
  if (!pageId || state.busy) {
    return;
  }

  await selectPage(pageId);
  revealPageInList(pageId);
}

async function openExportFolder() {
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);

  try {
    await api(`/api/projects/${state.project.id}/export/history/open-folder`, {
      method: 'POST',
      body: '{}'
    });
    showToast('Carpeta de exportaciones abierta.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function restoreSnapshot(snapshotId) {
  if (!state.project || state.busy || !snapshotId) {
    return;
  }

  const snapshot = (state.snapshots || []).find((item) => item.id === snapshotId);
  const label = snapshot ? snapshotReasonLabel(snapshot.reason) : 'snapshot local';
  const confirmed = window.confirm(
    `Restaurar "${label}" reemplazara el estado editable actual del libro. BookSaver creara otro snapshot antes de restaurar.`
  );
  if (!confirmed) {
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    await api(`/api/projects/${state.project.id}/snapshots/${snapshotId}/restore`, {
      method: 'POST',
      body: '{}'
    });
    await loadProject(state.project.id);
    showToast('Snapshot restaurado.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function restoreTrashedPage(trashId, position) {
  if (!state.project || state.busy || !trashId) {
    return;
  }

  const parsedPosition = Math.max(1, Number.parseInt(position, 10) || state.project.pages.length + 1);
  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const { project } = await api(`/api/projects/${state.project.id}/trash/${trashId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ position: parsedPosition })
    });
    state.selectedPageId = project.pages[Math.min(parsedPosition - 1, project.pages.length - 1)]?.id || null;
    await loadProject(state.project.id);
    showToast('Página restaurada desde la papelera.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function emptyTrash() {
  if (!state.project || state.busy || !(state.trash || []).length) {
    return;
  }

  const confirmed = window.confirm('Vaciar la papelera borrará definitivamente sus páginas.');
  if (!confirmed) {
    return;
  }

  setBusy(true);

  try {
    await api(`/api/projects/${state.project.id}/trash`, {
      method: 'DELETE'
    });
    await loadTrash(state.project.id, { renderAfter: false });
    render();
    showToast('Papelera vaciada.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function exportBookPackage() {
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);

  let packageCheck = null;
  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const response = await api(`/api/projects/${state.project.id}/package/check`);
    packageCheck = response.package;
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }

  if (!packageCheck) {
    return;
  }

  if (packageCheck.warning) {
    const confirmed = window.confirm(packageCheck.warning.message);
    if (!confirmed) {
      return;
    }
  }

  setBusy(true);

  try {
    const { package: exported } = await api(`/api/projects/${state.project.id}/package`, {
      method: 'POST',
      body: '{}'
    });
    const link = document.createElement('a');
    link.href = exported.downloadUrl;
    link.download = exported.fileName;
    link.click();
    showToast(`Paquete generado: ${exported.fileName} · ${formatBytes(exported.size)}`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function importBookPackage(files) {
  if (state.busy) {
    return;
  }

  const file = Array.from(files || []).find(
    (item) => item.name.endsWith('.booksaver.zip') || item.type.includes('zip')
  );
  els.packageImportInput.value = '';

  if (!file) {
    showToast('Elige un archivo .booksaver.zip.');
    return;
  }

  setBusy(true);

  try {
    const packageData = await readFileAsDataUrl(file);
    const { import: imported } = await api('/api/packages/import', {
      method: 'POST',
      body: JSON.stringify({ packageData })
    });
    await loadProjects();
    await loadProject(imported.project.id);
    showToast(
      `Paquete importado: ${imported.project.title} · ${imported.summary.pageCount} ${imported.summary.pageCount === 1 ? 'página' : 'páginas'}`
    );
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function createProject(event) {
  event.preventDefault();

  try {
    const payload = {
      title: els.titleInput.value,
      author: els.authorInput.value,
      language: els.languageInput.value,
      notes: els.notesInput.value
    };
    const { project } = await api('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    els.projectDialog.close();
    els.projectForm.reset();
    await loadProjects();
    await loadProject(project.id);
    showToast('Libro creado.');
  } catch (error) {
    showToast(error.message);
  }
}

function beginCropDrag(event) {
  const page = currentPage();
  if (!page || state.busy || !els.selectedImage.classList.contains('visible')) {
    return;
  }

  const start = pointInImage(event);
  if (!start) {
    return;
  }

  event.preventDefault();
  els.imageReviewFrame.setPointerCapture(event.pointerId);
  state.cropDrag = {
    pointerId: event.pointerId,
    start
  };
  setDraftCrop(null);
}

function updateCropDrag(event) {
  if (!state.cropDrag || event.pointerId !== state.cropDrag.pointerId) {
    return;
  }

  event.preventDefault();
  setDraftCrop(cropFromPoints(state.cropDrag.start, pointInImage(event)));
}

function endCropDrag(event) {
  if (!state.cropDrag || event.pointerId !== state.cropDrag.pointerId) {
    return;
  }

  updateCropDrag(event);
  state.cropDrag = null;

  if (els.imageReviewFrame.hasPointerCapture(event.pointerId)) {
    els.imageReviewFrame.releasePointerCapture(event.pointerId);
  }

  if (!state.draftCrop) {
    showToast('El recorte es demasiado pequeno.');
  }
}

els.newProjectButton.addEventListener('click', () => {
  els.projectDialog.showModal();
  els.titleInput.focus();
});
els.importPackageButton.addEventListener('click', () => els.packageImportInput.click());
els.packageImportInput.addEventListener('change', () => importBookPackage(els.packageImportInput.files));

els.cancelProjectButton.addEventListener('click', () => {
  els.projectDialog.close();
});
els.projectForm.addEventListener('submit', createProject);
els.metadataForm.addEventListener('submit', saveProjectMetadata);
els.cancelMetadataButton.addEventListener('click', () => {
  els.metadataDialog.close();
});
els.closeExportChecklistButton.addEventListener('click', () => closeExportChecklist(false));
els.confirmExportChecklistButton.addEventListener('click', () => closeExportChecklist(true));
els.exportChecklistDialog.addEventListener('cancel', () => closeExportChecklist(false));
els.closeExportResultButton.addEventListener('click', () => {
  els.exportResultDialog.close();
});
els.projectSelect.addEventListener('change', async () => {
  const nextProjectId = els.projectSelect.value;
  if (!nextProjectId || nextProjectId === state.project?.id) {
    return;
  }

  try {
    await persistCurrentPageDraft();
    await loadProject(nextProjectId);
  } catch (error) {
    showToast(error.message);
    els.projectSelect.value = state.project?.id || '';
  }
});
els.cameraButton.addEventListener('click', handleCameraButtonClick);
els.iphoneCameraButton.addEventListener('click', handleSecondaryCameraButtonClick);
els.cameraSelect.addEventListener('change', startSelectedCamera);
els.captureButton.addEventListener('click', capturePage);
els.importPhotosButton.addEventListener('click', () => els.photoImportInput.click());
els.photoImportInput.addEventListener('change', () => importPhotos(els.photoImportInput.files));
els.selectInboxButton.addEventListener('click', selectInboxFolder);
els.saveInboxButton.addEventListener('click', saveInbox);
els.scanInboxButton.addEventListener('click', scanInbox);
els.confirmInboxImportButton.addEventListener('click', confirmInboxImport);
els.cancelInboxPreviewButton.addEventListener('click', cancelInboxPreview);
els.mobileCaptureButton.addEventListener('click', toggleMobileCapture);
els.copyMobileCaptureUrlButton.addEventListener('click', copyMobileCaptureUrl);
els.configureAiOcrButton.addEventListener('click', openAiOcrSettings);
els.checkUpdatesButton.addEventListener('click', () => loadSystemSupport({ refresh: true }));
els.runUpdateButton.addEventListener('click', runSelfUpdate);
els.aiOcrSettingsForm.addEventListener('submit', saveAiOcrSettings);
els.aiOcrProviderInput.addEventListener('change', updateAiOcrProviderFields);
els.clearAiOcrSettingsButton.addEventListener('click', clearAiOcrSettings);
els.cancelAiOcrSettingsButton.addEventListener('click', () => {
  els.aiOcrSettingsDialog.close();
});
els.ocrModeInput.addEventListener('change', render);
els.ocrButton.addEventListener('click', runOcrForPage);
els.batchOcrPendingButton.addEventListener('click', () => runBatchOcr('pending'));
els.batchOcrAllButton.addEventListener('click', () => runBatchOcr('all'));
els.nextProblemButton.addEventListener('click', goToNextReviewProblem);
els.bookSearchForm.addEventListener('submit', runBookSearch);
els.bookSearchInput.addEventListener('input', () => {
  state.search.query = els.bookSearchInput.value;
  state.search.result = null;
  renderBookSearch();
});
els.saveTextButton.addEventListener('click', saveText);
els.addDictionaryTermButton.addEventListener('click', addDictionaryTerm);
els.dictionaryTermInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') {
    return;
  }
  event.preventDefault();
  addDictionaryTerm();
});
els.addReplacementButton.addEventListener('click', addReplacement);
els.previewReplacementsButton.addEventListener('click', previewReplacementsForCurrentPage);
els.applyReplacementsButton.addEventListener('click', applyReplacementsToCurrentPage);
els.scanSuspiciousButton.addEventListener('click', scanSuspiciousWords);
els.acceptSuspiciousButton.addEventListener('click', () => acceptSuspiciousItem());
els.replaceSuspiciousButton.addEventListener('click', () => replaceSuspiciousItem());
els.saveMarkersButton.addEventListener('click', savePageMarkers);
els.selectVisiblePagesButton.addEventListener('click', selectVisiblePages);
els.clearPageSelectionButton.addEventListener('click', clearPageSelection);
els.moveBatchStartButton.addEventListener('click', () => moveBatchPages('start'));
els.moveBatchBeforeButton.addEventListener('click', () => moveBatchRelative('before'));
els.moveBatchAfterButton.addEventListener('click', () => moveBatchRelative('after'));
els.moveBatchEndButton.addEventListener('click', () => moveBatchPages('end'));
els.sortPagesByDateButton.addEventListener('click', () => sortPagesBySource('date'));
els.sortPagesByNameButton.addEventListener('click', () => sortPagesBySource('name'));
els.usePageAsCoverButton.addEventListener('click', useSelectedPageAsCover);
els.uploadCoverButton.addEventListener('click', () => els.coverUploadInput.click());
els.coverUploadInput.addEventListener('change', () => uploadProjectCover(els.coverUploadInput.files));
els.clearCoverButton.addEventListener('click', clearProjectCover);
els.saveEditorialButton.addEventListener('click', saveEditorial);
els.saveCropButton.addEventListener('click', saveCrop);
els.clearCropButton.addEventListener('click', clearCrop);
els.compareAdjustmentButton.addEventListener('click', toggleAdjustmentComparison);
els.applyCropRangeButton.addEventListener('click', applyCropRange);
els.ignoreQualityButton.addEventListener('click', toggleQualityIgnored);
els.acceptCropSuggestionButton.addEventListener('click', () => updateCropSuggestion('accept'));
els.rejectCropSuggestionButton.addEventListener('click', () => updateCropSuggestion('reject'));
els.partStartInput.addEventListener('change', updateEditorialControlState);
els.chapterStartInput.addEventListener('change', updateEditorialControlState);
els.movePageFirstButton.addEventListener('click', moveSelectedPageToStart);
els.movePageUpButton.addEventListener('click', () => moveSelectedPageBy(-1));
els.movePageDownButton.addEventListener('click', () => moveSelectedPageBy(1));
els.movePageLastButton.addEventListener('click', moveSelectedPageToEnd);
els.rotatePageLeftButton.addEventListener('click', () => rotateCurrentPage(-1));
els.rotatePageRightButton.addEventListener('click', () => rotateCurrentPage(1));
els.saveDeskewButton.addEventListener('click', saveDeskew);
els.clearDeskewButton.addEventListener('click', clearDeskew);
els.deletePageButton.addEventListener('click', deletePage);
els.reviewExportButton.addEventListener('click', reviewExport);
els.exportPackageButton.addEventListener('click', exportBookPackage);
els.exportButton.addEventListener('click', exportEpub);
els.openExportFolderButton.addEventListener('click', openExportFolder);
els.emptyTrashButton.addEventListener('click', emptyTrash);
els.refreshReadingButton.addEventListener('click', () => loadReadingView({ force: true }));
els.video.addEventListener('loadedmetadata', renderCamera);
els.selectedImage.addEventListener('load', renderCropOverlay);
els.imageReviewFrame.addEventListener('pointerdown', beginCropDrag);
els.imageReviewFrame.addEventListener('pointermove', updateCropDrag);
els.imageReviewFrame.addEventListener('pointerup', endCropDrag);
els.imageReviewFrame.addEventListener('pointercancel', endCropDrag);
els.ocrText.addEventListener('input', () => renderFormattedPreview(null, els.ocrText.value));

function canUseCaptureShortcut(event) {
  if (event.defaultPrevented || event.repeat || event.code !== 'Space') {
    return false;
  }

  if (
    els.captureView.hidden ||
    els.projectDialog.open ||
    els.metadataDialog.open ||
    els.exportChecklistDialog.open ||
    els.exportResultDialog.open
  ) {
    return false;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return true;
  }

  if (target.isContentEditable) {
    return false;
  }

  return !target.closest('button, input, textarea, select, [role="button"]');
}

document.addEventListener('keydown', (event) => {
  if (!canUseCaptureShortcut(event)) {
    return;
  }

  event.preventDefault();
  capturePage();
});

function canUseSuspiciousShortcut(event) {
  if (event.defaultPrevented || event.repeat || !['a', 'c'].includes(event.key.toLowerCase())) {
    return false;
  }

  if (
    els.editorView.hidden ||
    els.projectDialog.open ||
    els.metadataDialog.open ||
    els.exportChecklistDialog.open ||
    els.exportResultDialog.open ||
    !nextSuspiciousItem()
  ) {
    return false;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return true;
  }

  if (target.isContentEditable) {
    return false;
  }

  return !target.closest('button, input, textarea, select, [role="button"]');
}

document.addEventListener('keydown', (event) => {
  if (!canUseSuspiciousShortcut(event)) {
    return;
  }

  event.preventDefault();
  if (event.key.toLowerCase() === 'a') {
    acceptSuspiciousItem();
  } else {
    replaceSuspiciousItem();
  }
});

function setActiveTab(buttonAttr, selected) {
  const buttons = document.querySelectorAll(`[${buttonAttr}]`);

  for (const tab of buttons) {
    const tabSelected = tab.getAttribute(buttonAttr) === selected;
    tab.setAttribute('aria-selected', tabSelected ? 'true' : 'false');

    const target = tab.getAttribute('aria-controls');
    const panel = target ? document.getElementById(target) : null;
    if (panel) {
      panel.hidden = !tabSelected;
    }
  }
}

function showMainView(view) {
  setActiveTab('data-view-tab', view);
  if (view === 'reading') {
    void loadReadingView();
  }
}

function showEditorPane(pane) {
  setActiveTab('data-pane-tab', pane);
}

function activateTabGroup(buttonAttr) {
  const buttons = document.querySelectorAll(`[${buttonAttr}]`);

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const value = button.getAttribute(buttonAttr);
      if (buttonAttr === 'data-view-tab') {
        showMainView(value);
      } else {
        setActiveTab(buttonAttr, value);
      }
    });
  }
}

activateTabGroup('data-view-tab');
activateTabGroup('data-pane-tab');

await loadSystemSupport();
await refreshCameras();
await loadProjects();
render();

if (navigator.mediaDevices) {
  navigator.mediaDevices.addEventListener('devicechange', async () => {
    await refreshCameras();
    render();
  });
}

function userEditingDraftField() {
  return [
    els.ocrText,
    els.inboxPathInput,
    els.partTitleInput,
    els.chapterTitleInput,
    els.chapterHeaderModeInput
  ].includes(document.activeElement);
}

window.setInterval(async () => {
  if (!state.project?.inbox?.watch || state.busy || userEditingDraftField()) {
    return;
  }

  try {
    await refreshProject();
  } catch {
    // The next explicit user action will surface any persistent problem.
  }
}, 7000);

window.setInterval(async () => {
  if (!mobileCaptureIsActive() || state.busy || userEditingDraftField()) {
    return;
  }

  const previousCount = state.mobileCapture?.uploadedCount || 0;

  try {
    await loadMobileCaptureStatus({ renderAfter: false });
    const nextCount = state.mobileCapture?.uploadedCount || 0;
    if (nextCount > previousCount) {
      await refreshProject();
      await loadProjects();
      const added = nextCount - previousCount;
      showToast(`${added} ${added === 1 ? 'foto recibida' : 'fotos recibidas'} desde el móvil.`);
    } else {
      renderMobileCapture();
    }
  } catch {
    // The mobile session may have been stopped; the next render or action will refresh the state.
  }
}, 2000);
