import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { migrateLegacyStorage } from './app-data.js';
import {
  BOOK_PACKAGE_EXTENSION,
  BOOK_PACKAGE_SIZE_WARNING_BYTES,
  createBookSaverPackage,
  readBookSaverPackage,
  safePackagePath
} from './book-package.js';
import { normalizeBookDictionary, previewDictionaryReplacements } from './book-dictionary.js';
import { buildBookChecklist, buildReviewQueue } from './book-checklist.js';
import { buildEpubFiles, buildEpubPreview, createStoreZip, validateEpubFiles } from './epub.js';
import { normalizeCropSuggestion, normalizeDeskew } from './image-adjustments.js';
import { analyzeImageMetadata, normalizeImageQuality } from './image-quality.js';
import { runOcr } from './ocr.js';
import { findSuspiciousWords, normalizeSuspiciousWord } from './text-review.js';

const execFileAsync = promisify(execFile);
const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/;
const PAGE_ID_PATTERN = /^page-\d{4}$/;
const PAGE_IMAGE_MODES = new Set(['text', 'image']);
const CHAPTER_HEADER_MODES = new Set(['none', 'auto', 'page']);
const COVER_MODES = new Set(['none', 'page', 'upload']);
const PAGE_ROTATIONS = new Set([0, 90, 180, 270]);
const PROJECT_ROOT_IGNORED_FILES = new Set(['metadata.json', 'pages.json']);
const IMPORTABLE_EXTENSIONS = new Map([
  ['.jpg', { mime: 'image/jpeg', extension: 'jpg', convert: false }],
  ['.jpeg', { mime: 'image/jpeg', extension: 'jpg', convert: false }],
  ['.png', { mime: 'image/png', extension: 'png', convert: false }],
  ['.heic', { mime: 'image/jpeg', extension: 'jpg', convert: true }],
  ['.heif', { mime: 'image/jpeg', extension: 'jpg', convert: true }]
]);

function now() {
  return new Date().toISOString();
}

function slugify(value) {
  return String(value || 'libro')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'libro';
}

function assertProjectId(projectId) {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw Object.assign(new Error('Identificador de proyecto no valido.'), { statusCode: 400 });
  }
}

function assertPageId(pageId) {
  if (!PAGE_ID_PATTERN.test(pageId)) {
    throw Object.assign(new Error('Identificador de pagina no valido.'), { statusCode: 400 });
  }
}

function assertAbsoluteFolder(folderPath) {
  if (!path.isAbsolute(folderPath)) {
    throw Object.assign(new Error('La ruta de carpeta debe ser absoluta.'), { statusCode: 400 });
  }
}

function sourceFingerprint(filePath, fileStat) {
  return `${path.resolve(filePath)}:${fileStat.size}:${Math.round(fileStat.mtimeMs)}`;
}

function stripLocalSourcePaths(source) {
  if (!source || typeof source !== 'object') {
    return source || null;
  }

  const next = { ...source };
  delete next.path;
  delete next.fingerprint;
  return next;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function captureDate(fileStat) {
  return new Date(fileStat.mtimeMs).toISOString();
}

function validTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

async function readMacContentCreationDate(filePath) {
  if (process.platform !== 'darwin') {
    return null;
  }

  try {
    const { stdout } = await execFileAsync(
      'mdls',
      ['-raw', '-name', 'kMDItemContentCreationDate', filePath],
      { maxBuffer: 1024 * 1024 }
    );
    const value = stdout.trim();
    if (!value || value === '(null)') {
      return null;
    }

    return validTimestamp(Date.parse(value));
  } catch {
    return null;
  }
}

async function detectCaptureInfo(filePath, fileStat) {
  const metadataTimestamp = await readMacContentCreationDate(filePath);
  const modifiedTimestamp = validTimestamp(fileStat?.mtimeMs);
  const captureMs = metadataTimestamp || modifiedTimestamp || Date.now();

  return {
    captureMs,
    capturedAt: new Date(captureMs).toISOString(),
    captureSource: metadataTimestamp ? 'metadata' : 'mtime'
  };
}

function imageExtensionFromPath(imagePath) {
  const extension = path.extname(imagePath).toLowerCase().replace('.', '');
  return extension === 'jpeg' ? 'jpg' : extension || 'jpg';
}

function imageMimeFromExtension(extension) {
  return extension === 'png' ? 'image/png' : 'image/jpeg';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCrop(input) {
  if (!input) {
    return null;
  }

  const left = clamp(Number(input.left), 0, 1);
  const top = clamp(Number(input.top), 0, 1);
  const width = clamp(Number(input.width), 0, 1 - left);
  const height = clamp(Number(input.height), 0, 1 - top);

  if (![left, top, width, height].every(Number.isFinite)) {
    throw Object.assign(new Error('El recorte no tiene coordenadas validas.'), { statusCode: 400 });
  }

  if (width < 0.03 || height < 0.03) {
    throw Object.assign(new Error('El recorte es demasiado pequeno.'), { statusCode: 400 });
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

function normalizeEditorial(input = {}) {
  const imageMode =
    input.imageMode === 'image' || input.imagePage === true || input.renderMode === 'image'
      ? 'image'
      : 'text';
  const partStart = Boolean(input.partStart);
  const partTitle = String(input.partTitle || '').trim();
  const chapterStart = Boolean(input.chapterStart);
  const chapterEnd = Boolean(input.chapterEnd);
  const chapterTitle = String(input.chapterTitle || '').trim();
  const rawHeaderMode = String(input.chapterHeaderMode || input.headerMode || 'none');
  const chapterHeaderMode =
    chapterStart && CHAPTER_HEADER_MODES.has(rawHeaderMode) ? rawHeaderMode : 'none';

  return {
    imageMode: PAGE_IMAGE_MODES.has(imageMode) ? imageMode : 'text',
    partStart,
    partTitle,
    chapterStart,
    chapterEnd,
    chapterTitle,
    chapterHeaderMode
  };
}

function normalizeCover(input = {}) {
  const rawMode = String(input.mode || 'none');
  const mode = COVER_MODES.has(rawMode) ? rawMode : 'none';
  const pageId = mode === 'page' && PAGE_ID_PATTERN.test(String(input.pageId || '')) ? String(input.pageId) : null;
  const image = mode === 'upload' && typeof input.image === 'string' && input.image
    ? String(input.image)
    : null;
  const mime = mode === 'upload' ? String(input.mime || imageMimeFromExtension(imageExtensionFromPath(image || 'cover.jpg'))) : null;
  const updatedAt = mode === 'none' ? null : String(input.updatedAt || now());

  if (mode === 'page' && pageId) {
    return {
      mode,
      pageId,
      image: null,
      mime: null,
      updatedAt
    };
  }

  if (mode === 'upload' && image) {
    return {
      mode,
      pageId: null,
      image,
      mime,
      updatedAt
    };
  }

  return {
    mode: 'none',
    pageId: null,
    image: null,
    mime: null,
    updatedAt: null
  };
}

function normalizeRotation(input) {
  const rotation = Number(input);
  return PAGE_ROTATIONS.has(rotation) ? rotation : 0;
}

function normalizeStoredQuality(input) {
  return input ? normalizeImageQuality(input) : null;
}

function normalizeStoredCropSuggestion(input) {
  return input ? normalizeCropSuggestion(input) : null;
}

function normalizeStoredDeskew(input) {
  return input ? normalizeDeskew(input) : null;
}

function pageReviewed(page) {
  return Boolean(page?.reviewed);
}

function normalizePage(page, index) {
  return {
    ...page,
    number: index + 1,
    crop: normalizeCrop(page.crop),
    cropSuggestion: normalizeStoredCropSuggestion(page.cropSuggestion),
    cropBatch: page.cropBatch || null,
    rotation: normalizeRotation(page.rotation),
    deskew: normalizeStoredDeskew(page.deskew),
    quality: normalizeStoredQuality(page.quality),
    reviewed: pageReviewed(page),
    editorial: normalizeEditorial(page.editorial || page)
  };
}

function parseSipsDimensions(output) {
  const width = Number(/pixelWidth:\s*(\d+)/.exec(output)?.[1] || 0);
  const height = Number(/pixelHeight:\s*(\d+)/.exec(output)?.[1] || 0);

  if (!width || !height) {
    throw Object.assign(new Error('No se pudieron leer las dimensiones de la imagen.'), {
      statusCode: 500
    });
  }

  return { width, height };
}

function pngDimensions(buffer) {
  if (
    buffer.length < 24 ||
    buffer.readUInt32BE(0) !== 0x89504e47 ||
    buffer.readUInt32BE(4) !== 0x0d0a1a0a
  ) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const size = buffer.readUInt16BE(offset + 2);
    if (size < 2) {
      return null;
    }

    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    ) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5)
      };
    }

    offset += 2 + size;
  }

  return null;
}

function imageDimensionsFromBuffer(buffer) {
  return pngDimensions(buffer) || jpegDimensions(buffer) || { width: 0, height: 0 };
}

function qualityForImageData(imageData, source = 'capture', quality = null) {
  if (quality) {
    return normalizeImageQuality({
      ...quality,
      source: quality.source || source
    });
  }

  return analyzeImageMetadata({
    ...imageDimensionsFromBuffer(imageData),
    source
  });
}

function nextPageId(pages) {
  const maxNumber = pages.reduce((max, page) => {
    const match = /^page-(\d{4})$/.exec(page.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `page-${String(maxNumber + 1).padStart(4, '0')}`;
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function convertWithSips(sourcePath, destinationPath) {
  await execFileAsync('sips', ['-s', 'format', 'jpeg', sourcePath, '--out', destinationPath], {
    maxBuffer: 1024 * 1024 * 5
  });
}

export class LibraryStore {
  constructor(rootDir, options = {}) {
    this.rootDir = rootDir;
    this.dataRootDir = path.resolve(options.dataRootDir || rootDir);
    this.legacyDataRootDir = path.resolve(options.legacyDataRootDir || rootDir);
    this.booksDir = path.join(this.dataRootDir, 'books');
    this.inboxDir = path.join(this.dataRootDir, 'inbox');
    this.storageInfo = {
      legacyRootDir: this.legacyDataRootDir,
      dataRootDir: this.dataRootDir,
      migrated: false,
      movedEntries: 0,
      skippedEntries: 0,
      folders: []
    };
    this.ocrRunner = options.ocrRunner || runOcr;
    this.ensurePromise = null;
  }

  async ensure() {
    if (!this.ensurePromise) {
      this.ensurePromise = (async () => {
        this.storageInfo = await migrateLegacyStorage({
          legacyRootDir: this.legacyDataRootDir,
          dataRootDir: this.dataRootDir
        });
        await mkdir(this.booksDir, { recursive: true });
        await mkdir(this.inboxDir, { recursive: true });
      })().catch((error) => {
        this.ensurePromise = null;
        throw error;
      });
    }

    await this.ensurePromise;
  }

  projectDir(projectId) {
    assertProjectId(projectId);
    return path.join(this.booksDir, projectId);
  }

  metadataPath(projectId) {
    return path.join(this.projectDir(projectId), 'metadata.json');
  }

  coverDir(projectId) {
    return path.join(this.projectDir(projectId), 'cover');
  }

  pagesPath(projectId) {
    return path.join(this.projectDir(projectId), 'pages.json');
  }

  dictionaryPath(projectId) {
    return path.join(this.projectDir(projectId), 'dictionary.json');
  }

  defaultInboxPath(projectId) {
    assertProjectId(projectId);
    return path.join(this.inboxDir, projectId);
  }

  legacyInboxPath(projectId) {
    assertProjectId(projectId);
    return path.join(this.legacyDataRootDir, 'inbox', projectId);
  }

  getStorageInfo() {
    return {
      ...this.storageInfo,
      booksDir: this.booksDir,
      inboxDir: this.inboxDir
    };
  }

  async ensureProjectInbox(projectId, metadata) {
    const inbox = metadata.inbox || {};
    const timestamp = now();
    const defaultInboxPath = this.defaultInboxPath(projectId);
    const legacyInboxPath = this.legacyInboxPath(projectId);
    const currentInboxPath = String(inbox.path || '').trim();
    const resolvedCurrentInboxPath = currentInboxPath ? path.resolve(currentInboxPath) : '';
    const nextInboxPath =
      !currentInboxPath ||
      resolvedCurrentInboxPath === path.resolve(defaultInboxPath) ||
      resolvedCurrentInboxPath === path.resolve(legacyInboxPath)
        ? defaultInboxPath
        : currentInboxPath;

    if (currentInboxPath) {
      const inboxCreatedAt = inbox.createdAt || inbox.updatedAt || timestamp;
      const inboxUpdatedAt =
        inbox.updatedAt && Date.parse(inbox.updatedAt) >= Date.parse(inboxCreatedAt)
          ? inbox.updatedAt
          : inboxCreatedAt;
      const needsNormalization =
        inbox.path !== nextInboxPath ||
        inbox.watch !== Boolean(inbox.watch) ||
        inbox.createdAt !== inboxCreatedAt ||
        inbox.updatedAt !== inboxUpdatedAt;
      const nextInbox = {
        ...inbox,
        path: nextInboxPath,
        watch: Boolean(inbox.watch),
        createdAt: inboxCreatedAt,
        updatedAt: inboxUpdatedAt
      };

      if (!needsNormalization) {
        return metadata;
      }

      const nextMetadata = { ...metadata, inbox: nextInbox };
      await writeJson(this.metadataPath(projectId), nextMetadata);
      return nextMetadata;
    }

    const nextMetadata = {
      ...metadata,
      inbox: {
        ...inbox,
        path: nextInboxPath,
        watch: Boolean(inbox.watch),
        createdAt: inbox.createdAt || inbox.updatedAt || timestamp,
        updatedAt: timestamp
      }
    };

    await mkdir(nextMetadata.inbox.path, { recursive: true });
    await writeJson(this.metadataPath(projectId), nextMetadata);
    return nextMetadata;
  }

  async ensureProjectMetadata(projectId, metadata) {
    const withInbox = await this.ensureProjectInbox(projectId, metadata);
    const cover = normalizeCover(withInbox.cover || {});

    if (JSON.stringify(cover) === JSON.stringify(withInbox.cover || {})) {
      return withInbox;
    }

    const nextMetadata = {
      ...withInbox,
      cover
    };
    await writeJson(this.metadataPath(projectId), nextMetadata);
    return nextMetadata;
  }

  async listProjects() {
    await this.ensure();
    const entries = await readdir(this.booksDir, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || !PROJECT_ID_PATTERN.test(entry.name)) {
        continue;
      }

      try {
        const metadata = await this.ensureProjectMetadata(entry.name, await this.readMetadata(entry.name));
        const pages = await this.readPages(entry.name);
        projects.push({
          ...metadata,
          pageCount: pages.length
        });
      } catch {
        // Ignore partial folders; the UI should only show readable projects.
      }
    }

    return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createProject(input) {
    await this.ensure();
    const title = String(input.title || 'Libro sin titulo').trim() || 'Libro sin titulo';
    const baseId = `${slugify(title)}-${Date.now().toString(36)}`;
    const id = PROJECT_ID_PATTERN.test(baseId) ? baseId : randomUUID();
    const projectDir = this.projectDir(id);
    const inboxPath = this.defaultInboxPath(id);
    const timestamp = now();

    await mkdir(path.join(projectDir, 'pages'), { recursive: true });
    await mkdir(path.join(projectDir, 'exports'), { recursive: true });
    await mkdir(inboxPath, { recursive: true });

    const metadata = {
      id,
      title,
      author: String(input.author || '').trim(),
      language: String(input.language || 'es').trim() || 'es',
      notes: String(input.notes || '').trim(),
      cover: normalizeCover(),
      inbox: {
        path: inboxPath,
        watch: false,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await writeJson(this.metadataPath(id), metadata);
    await writeJson(this.pagesPath(id), { pages: [] });
    return { ...metadata, pages: [] };
  }

  async readMetadata(projectId) {
    return readJson(this.metadataPath(projectId));
  }

  async writeMetadata(projectId, metadata) {
    metadata.updatedAt = now();
    await writeJson(this.metadataPath(projectId), metadata);
  }

  async readDictionary(projectId) {
    assertProjectId(projectId);
    return normalizeBookDictionary(await readJson(this.dictionaryPath(projectId), {}));
  }

  async updateDictionary(projectId, input = {}) {
    assertProjectId(projectId);
    const dictionary = normalizeBookDictionary(input);
    await writeJson(this.dictionaryPath(projectId), dictionary);
    const metadata = await this.readMetadata(projectId);
    await this.writeMetadata(projectId, metadata);
    return dictionary;
  }

  async selectedPagesForDictionary(projectId, pageIds = []) {
    const pages = await this.readPages(projectId);
    const wanted = new Set((Array.isArray(pageIds) ? pageIds : []).filter(Boolean));
    const selected = wanted.size ? pages.filter((page) => wanted.has(page.id)) : pages;

    for (const pageId of wanted) {
      assertPageId(pageId);
    }

    return selected;
  }

  async previewDictionaryReplacements(projectId, input = {}) {
    const dictionary = await this.readDictionary(projectId);
    const selected = await this.selectedPagesForDictionary(projectId, input.pageIds);
    const pages = [];
    let changeCount = 0;

    for (const page of selected) {
      const text = await this.readPageText(projectId, page);
      const preview = previewDictionaryReplacements(text, dictionary.replacements);
      if (!preview.changed) {
        continue;
      }
      changeCount += preview.changeCount;
      pages.push({
        pageId: page.id,
        page: page.number,
        changeCount: preview.changeCount,
        replacements: preview.replacements,
        previewText: preview.text
      });
    }

    return {
      checkedAt: now(),
      replacementCount: dictionary.replacements.length,
      changeCount,
      pages
    };
  }

  async applyDictionaryReplacements(projectId, input = {}) {
    const dictionary = await this.readDictionary(projectId);
    const selected = await this.selectedPagesForDictionary(projectId, input.pageIds);
    const pages = await this.readPages(projectId);
    const pageMap = new Map(pages.map((page) => [page.id, page]));
    const timestamp = now();
    let updatedCount = 0;
    let changeCount = 0;

    for (const selectedPage of selected) {
      const page = pageMap.get(selectedPage.id);
      const text = await this.readPageText(projectId, page);
      const preview = previewDictionaryReplacements(text, dictionary.replacements);
      if (!preview.changed) {
        continue;
      }

      await writeFile(path.join(this.projectDir(projectId), page.text), preview.text, 'utf8');
      page.status = page.status === 'captured' ? 'text-edited' : page.status;
      page.layoutStale = true;
      page.reviewed = false;
      page.replacementHistory = [
        ...(Array.isArray(page.replacementHistory) ? page.replacementHistory : []),
        {
          appliedAt: timestamp,
          changeCount: preview.changeCount,
          replacements: preview.replacements
        }
      ];
      page.updatedAt = timestamp;
      updatedCount += 1;
      changeCount += preview.changeCount;
    }

    if (updatedCount) {
      await this.writePages(projectId, pages);
    }

    return {
      updatedCount,
      changeCount,
      pages: await this.readPages(projectId)
    };
  }

  async inspectSuspiciousWords(projectId) {
    const dictionary = await this.readDictionary(projectId);
    const pages = await this.readPages(projectId);
    const items = [];

    for (const page of pages) {
      const editorial = normalizeEditorial(page.editorial || page);
      if (editorial.imageMode === 'image') {
        continue;
      }

      const text = await this.readPageText(projectId, page);
      for (const finding of findSuspiciousWords({ text, dictionary })) {
        items.push({
          ...finding,
          pageId: page.id,
          page: page.number
        });
      }
    }

    return {
      checkedAt: now(),
      itemCount: items.length,
      summary: items.length
        ? `${items.length} ${items.length === 1 ? 'palabra dudosa' : 'palabras dudosas'} pendientes.`
        : 'No hay palabras dudosas pendientes.',
      items
    };
  }

  async acceptSuspiciousWord(projectId, input = {}) {
    const word = String(input.word || '').trim();
    if (!word) {
      throw Object.assign(new Error('Indica la palabra que quieres aceptar.'), { statusCode: 400 });
    }

    const dictionary = await this.readDictionary(projectId);
    return this.updateDictionary(projectId, {
      ...dictionary,
      terms: [...dictionary.terms, word]
    });
  }

  async replaceSuspiciousWord(projectId, input = {}) {
    assertPageId(input.pageId);
    const word = String(input.word || '').trim();
    const replacement = String(input.replacement || '').trim();
    if (!word || !replacement) {
      throw Object.assign(new Error('Indica palabra y correccion.'), { statusCode: 400 });
    }

    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === input.pageId);
    if (!page) {
      throw Object.assign(new Error('Pagina no encontrada.'), { statusCode: 404 });
    }

    const text = await this.readPageText(projectId, page);
    const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gu');
    const nextText = text.replace(pattern, replacement);
    if (nextText === text) {
      throw Object.assign(new Error('No se encontro esa palabra en la pagina.'), { statusCode: 404 });
    }

    const changeCount = (text.match(pattern) || []).length;
    const timestamp = now();
    await writeFile(path.join(this.projectDir(projectId), page.text), nextText, 'utf8');
    page.status = page.status === 'captured' ? 'text-edited' : page.status;
    page.layoutStale = true;
    page.reviewed = false;
    page.suspiciousWordHistory = [
      ...(Array.isArray(page.suspiciousWordHistory) ? page.suspiciousWordHistory : []),
      {
        reviewedAt: timestamp,
        word,
        replacement,
        changeCount
      }
    ];
    page.updatedAt = timestamp;
    await this.writePages(projectId, pages);

    const dictionary = await this.readDictionary(projectId);
    const normalizedReplacement = normalizeSuspiciousWord(replacement);
    if (!dictionary.terms.some((term) => normalizeSuspiciousWord(term) === normalizedReplacement)) {
      await this.updateDictionary(projectId, {
        ...dictionary,
        terms: [...dictionary.terms, replacement]
      });
    }

    return this.getPagePayload(projectId, page.id);
  }

  async readPages(projectId) {
    const data = await readJson(this.pagesPath(projectId), { pages: [] });
    return Array.isArray(data.pages) ? data.pages.map(normalizePage) : [];
  }

  async writePages(projectId, pages) {
    await writeJson(this.pagesPath(projectId), { pages });
    const metadata = await this.readMetadata(projectId);
    await this.writeMetadata(projectId, metadata);
  }

  async getProject(projectId) {
    const metadata = await this.ensureProjectMetadata(projectId, await this.readMetadata(projectId));
    const pages = await this.readPages(projectId);
    return { ...metadata, pages };
  }

  async updateProject(projectId, input) {
    const metadata = await this.ensureProjectMetadata(projectId, await this.readMetadata(projectId));
    const next = {
      ...metadata,
      title: String(input.title ?? metadata.title).trim() || metadata.title,
      author: String(input.author ?? metadata.author).trim(),
      language: String(input.language ?? metadata.language).trim() || metadata.language,
      notes: String(input.notes ?? metadata.notes).trim()
    };
    await this.writeMetadata(projectId, next);
    return this.getProject(projectId);
  }

  createPageRecord(projectId, pages, imageData, mime, extension, source = null, options = {}) {
    const pageId = nextPageId(pages);
    const pageDir = path.join(this.projectDir(projectId), 'pages', pageId);
    const imageName = `original.${extension}`;
    const textName = 'ocr.txt';
    const tsvName = 'ocr.tsv';
    const layoutName = 'layout.json';
    const qualitySource = source ? 'inbox' : 'capture';

    return {
      pageId,
      pageDir,
      imageName,
      textName,
      page: {
        id: pageId,
        number: pages.length + 1,
        image: `pages/${pageId}/${imageName}`,
        text: `pages/${pageId}/${textName}`,
        tsv: `pages/${pageId}/${tsvName}`,
        layout: `pages/${pageId}/${layoutName}`,
        layoutStale: false,
        mime,
        size: imageData.length,
        checksum: createHash('sha256').update(imageData).digest('hex'),
        source,
        crop: null,
        cropSuggestion: options.cropSuggestion ? normalizeCropSuggestion(options.cropSuggestion) : null,
        cropBatch: null,
        rotation: 0,
        deskew: null,
        quality: qualityForImageData(imageData, options.qualitySource || qualitySource, options.quality),
        reviewed: false,
        editorial: normalizeEditorial(),
        status: 'captured',
        ocrEngine: null,
        ocrLanguage: null,
        ocrWarning: null,
        createdAt: now(),
        updatedAt: now()
      }
    };
  }

  async addPage(projectId, dataUrl, options = {}) {
    const pages = await this.readPages(projectId);
    const parsed = parseDataUrl(dataUrl);
    const extension = parsed.mime === 'image/png' ? 'png' : 'jpg';
    const pageRecord = this.createPageRecord(projectId, pages, parsed.data, parsed.mime, extension, null, {
      quality: options.quality,
      cropSuggestion: options.cropSuggestion,
      qualitySource: 'capture'
    });

    await mkdir(pageRecord.pageDir, { recursive: true });
    await writeFile(path.join(pageRecord.pageDir, pageRecord.imageName), parsed.data);
    await writeFile(path.join(pageRecord.pageDir, pageRecord.textName), '', 'utf8');

    pages.push(pageRecord.page);
    await this.writePages(projectId, pages);
    return pageRecord.page;
  }

  async addPageFromFile(projectId, sourcePath, fileStat = null) {
    const resolvedSourcePath = path.resolve(sourcePath);
    const sourceStat = fileStat || (await stat(resolvedSourcePath));
    const sourceExtension = path.extname(resolvedSourcePath).toLowerCase();
    const importType = IMPORTABLE_EXTENSIONS.get(sourceExtension);

    if (!importType) {
      throw Object.assign(new Error('Formato de imagen no soportado.'), { statusCode: 400 });
    }

    const pages = await this.readPages(projectId);
    const captureInfo = await detectCaptureInfo(resolvedSourcePath, sourceStat);
    const fingerprint = sourceFingerprint(resolvedSourcePath, sourceStat);
    const existing = pages.find((page) => page.source?.fingerprint === fingerprint);

    if (existing) {
      return { page: existing, imported: false, skippedReason: 'duplicate' };
    }

    const source = {
      path: resolvedSourcePath,
      fileName: path.basename(resolvedSourcePath),
      size: sourceStat.size,
      mtimeMs: sourceStat.mtimeMs,
      captureMs: captureInfo.captureMs,
      capturedAt: captureInfo.capturedAt,
      captureSource: captureInfo.captureSource,
      fingerprint
    };
    const placeholderData = importType.convert
      ? Buffer.from(`${resolvedSourcePath}:${sourceStat.size}:${sourceStat.mtimeMs}`)
      : await readFile(resolvedSourcePath);
    const pageRecord = this.createPageRecord(
      projectId,
      pages,
      placeholderData,
      importType.mime,
      importType.extension,
      source,
      { qualitySource: 'inbox' }
    );

    await mkdir(pageRecord.pageDir, { recursive: true });

    const destinationPath = path.join(pageRecord.pageDir, pageRecord.imageName);
    if (importType.convert) {
      const preservedOriginalName = `source${sourceExtension}`;
      const preservedOriginalPath = path.join(pageRecord.pageDir, preservedOriginalName);
      await copyFile(resolvedSourcePath, preservedOriginalPath);
      await convertWithSips(resolvedSourcePath, destinationPath);
      const convertedData = await readFile(destinationPath);
      pageRecord.page.size = convertedData.length;
      pageRecord.page.checksum = createHash('sha256').update(convertedData).digest('hex');
      pageRecord.page.quality = qualityForImageData(convertedData, 'inbox');
      pageRecord.page.source.convertedFrom = sourceExtension.slice(1);
      pageRecord.page.source.preservedOriginal = `pages/${pageRecord.pageId}/${preservedOriginalName}`;
    } else {
      await copyFile(resolvedSourcePath, destinationPath);
      pageRecord.page.source.preservedOriginal = pageRecord.page.image;
    }

    await writeFile(path.join(pageRecord.pageDir, pageRecord.textName), '', 'utf8');
    pages.push(pageRecord.page);
    await this.writePages(projectId, pages);

    return { page: pageRecord.page, imported: true, skippedReason: null };
  }

  async updateInbox(projectId, input) {
    const metadata = await this.ensureProjectMetadata(projectId, await this.readMetadata(projectId));
    const inboxPath = String(input.path ?? metadata.inbox?.path ?? '').trim();
    const watch = Boolean(input.watch);

    if (inboxPath) {
      assertAbsoluteFolder(inboxPath);
      const folderStat = await stat(inboxPath);
      if (!folderStat.isDirectory()) {
        throw Object.assign(new Error('La ruta indicada no es una carpeta.'), { statusCode: 400 });
      }
    }

    metadata.inbox = {
      ...(metadata.inbox || {}),
      path: inboxPath,
      watch,
      updatedAt: now()
    };

    await this.writeMetadata(projectId, metadata);
    return this.getProject(projectId);
  }

  async collectImportCandidates(folderPath, options = {}) {
    const { ignoredNames = new Set() } = options;
    const entries = await readdir(folderPath, { withFileTypes: true });
    const candidates = [];
    const unsupported = [];

    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith('.')) {
        continue;
      }

      if (ignoredNames.has(entry.name)) {
        continue;
      }

      const sourcePath = path.join(folderPath, entry.name);
      const extension = path.extname(entry.name).toLowerCase();
      if (!IMPORTABLE_EXTENSIONS.has(extension)) {
        unsupported.push(entry.name);
        continue;
      }

      const fileStat = await stat(sourcePath);
      const captureInfo = await detectCaptureInfo(sourcePath, fileStat);
      candidates.push({ sourcePath, fileStat, captureInfo });
    }

    candidates.sort((a, b) => {
      return a.captureInfo.captureMs - b.captureInfo.captureMs || a.sourcePath.localeCompare(b.sourcePath);
    });

    return { candidates, unsupported };
  }

  async importFromInbox(projectId) {
    const metadata = await this.ensureProjectMetadata(projectId, await this.readMetadata(projectId));
    const inboxPath = String(metadata.inbox?.path || '').trim();

    if (!inboxPath) {
      throw Object.assign(new Error('Configura primero una carpeta de entrada.'), { statusCode: 400 });
    }

    assertAbsoluteFolder(inboxPath);
    const folderStat = await stat(inboxPath);
    if (!folderStat.isDirectory()) {
      throw Object.assign(new Error('La carpeta de entrada no existe.'), { statusCode: 400 });
    }

    let { candidates, unsupported } = await this.collectImportCandidates(inboxPath);
    let scanSourceType = 'inbox';
    let scanSourcePath = inboxPath;
    let notice = null;

    if (candidates.length === 0) {
      const projectPath = this.projectDir(projectId);
      if (projectPath !== inboxPath) {
        const fallback = await this.collectImportCandidates(projectPath, {
          ignoredNames: PROJECT_ROOT_IGNORED_FILES
        });

        if (fallback.candidates.length > 0) {
          candidates = fallback.candidates;
          unsupported = fallback.unsupported;
          scanSourceType = 'project-folder';
          scanSourcePath = projectPath;
          notice = `No habia fotos en la bandeja; se han usado las imagenes dejadas en la carpeta del libro (${projectPath}).`;
        }
      }
    }

    const importedPages = [];
    let skippedDuplicates = 0;
    let cleanedUpCount = 0;
    const errors = [];

    for (const candidate of candidates) {
      try {
        const result = await this.addPageFromFile(projectId, candidate.sourcePath, candidate.fileStat);
        if (result.imported) {
          importedPages.push(result.page);
        } else {
          skippedDuplicates += 1;
        }

        if (result.imported || result.skippedReason === 'duplicate') {
          try {
            await rm(candidate.sourcePath, { force: true });
            cleanedUpCount += 1;
          } catch (cleanupError) {
            errors.push({
              fileName: path.basename(candidate.sourcePath),
              error: `Se importo, pero no se pudo retirar de la carpeta origen: ${cleanupError.message}`
            });
          }
        }
      } catch (error) {
        errors.push({
          fileName: path.basename(candidate.sourcePath),
          error: error.message
        });
      }
    }

    const nextMetadata = await this.readMetadata(projectId);
    nextMetadata.inbox = {
      ...(nextMetadata.inbox || {}),
      path: inboxPath,
      lastScanAt: now(),
      lastImportedCount: importedPages.length,
      lastSkippedCount: skippedDuplicates,
      lastCleanedCount: cleanedUpCount,
      lastUnsupportedCount: unsupported.length,
      lastErrorCount: errors.length,
      lastScanSourceType: scanSourceType,
      lastScanSourcePath: scanSourcePath
    };
    await this.writeMetadata(projectId, nextMetadata);

    return {
      importedPages,
      importedCount: importedPages.length,
      skippedDuplicates,
      cleanedUpCount,
      unsupported,
      errors,
      scanSourceType,
      scanSourcePath,
      notice,
      project: await this.getProject(projectId)
    };
  }

  async deletePage(projectId, pageId) {
    assertPageId(pageId);
    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === pageId);
    const metadata = await this.ensureProjectMetadata(projectId, await this.readMetadata(projectId));

    if (!page) {
      throw Object.assign(new Error('Pagina no encontrada.'), { statusCode: 404 });
    }

    await rm(path.join(this.projectDir(projectId), 'pages', pageId), {
      recursive: true,
      force: true
    });

    const nextPages = pages
      .filter((item) => item.id !== pageId)
      .map((item, index) => ({ ...item, number: index + 1 }));

    await this.writePages(projectId, nextPages);

    if (metadata.cover?.mode === 'page' && metadata.cover.pageId === pageId) {
      metadata.cover = normalizeCover();
      await this.writeMetadata(projectId, metadata);
    }

    return nextPages;
  }

  async reorderPages(projectId, pageIds) {
    const pages = await this.readPages(projectId);
    const pageMap = new Map(pages.map((page) => [page.id, page]));

    if (!Array.isArray(pageIds) || pageIds.length !== pages.length) {
      throw Object.assign(new Error('El orden recibido no coincide con las paginas.'), {
        statusCode: 400
      });
    }

    const ordered = pageIds.map((pageId) => {
      assertPageId(pageId);
      const page = pageMap.get(pageId);
      if (!page) {
        throw Object.assign(new Error(`Pagina no encontrada: ${pageId}`), { statusCode: 404 });
      }
      return page;
    });

    const nextPages = ordered.map((page, index) => ({
      ...page,
      number: index + 1,
      updatedAt: now()
    }));

    await this.writePages(projectId, nextPages);
    return nextPages;
  }

  async readPageText(projectId, page) {
    return readFile(path.join(this.projectDir(projectId), page.text), 'utf8');
  }

  async readPageLayout(projectId, page) {
    if (!page.layout || page.layoutStale) {
      return null;
    }

    return readJson(path.join(this.projectDir(projectId), page.layout), null);
  }

  async updatePageText(projectId, pageId, text) {
    assertPageId(pageId);
    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === pageId);

    if (!page) {
      throw Object.assign(new Error('Pagina no encontrada.'), { statusCode: 404 });
    }

    await writeFile(path.join(this.projectDir(projectId), page.text), String(text || ''), 'utf8');
    page.status = page.status === 'captured' ? 'text-edited' : page.status;
    page.layoutStale = true;
    page.reviewed = false;
    page.updatedAt = now();
    await this.writePages(projectId, pages);
    return page;
  }

  async updatePageEditorial(projectId, pageId, input) {
    assertPageId(pageId);
    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === pageId);

    if (!page) {
      throw Object.assign(new Error('Pagina no encontrada.'), { statusCode: 404 });
    }

    const currentEditorial = normalizeEditorial(page.editorial || page);
    const nextEditorial = normalizeEditorial({
      ...currentEditorial,
      ...(input || {})
    });
    const editorialChanged = JSON.stringify(currentEditorial) !== JSON.stringify(nextEditorial);
    page.editorial = nextEditorial;

    if (Object.prototype.hasOwnProperty.call(input || {}, 'reviewed')) {
      page.reviewed = Boolean(input.reviewed);
    } else if (editorialChanged) {
      page.reviewed = false;
    }

    page.updatedAt = now();
    await this.writePages(projectId, pages);
    return this.getPagePayload(projectId, pageId);
  }

  async updatePageCrop(projectId, pageId, input) {
    assertPageId(pageId);
    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === pageId);

    if (!page) {
      throw Object.assign(new Error('Pagina no encontrada.'), { statusCode: 404 });
    }

    const cropInput = Object.prototype.hasOwnProperty.call(input, 'crop') ? input.crop : input;
    const nextCrop = normalizeCrop(cropInput);
    const cropChanged = JSON.stringify(page.crop) !== JSON.stringify(nextCrop);
    page.crop = nextCrop;
    if (cropChanged) {
      page.cropBatch = null;
    }
    page.layoutStale = page.status === 'ocr-complete' || Boolean(nextCrop);
    if (page.status === 'ocr-complete') {
      page.ocrWarning = nextCrop
        ? 'Recorte cambiado; vuelve a leer texto.'
        : 'Recorte eliminado; vuelve a leer texto si quieres rehacer el OCR.';
    }
    if (cropChanged) {
      page.reviewed = false;
    }
    page.updatedAt = now();
    await this.writePages(projectId, pages);
    return this.getPagePayload(projectId, pageId);
  }

  async applyCropToRange(projectId, input = {}) {
    const pages = await this.readPages(projectId);
    const fromPage = Math.max(1, Math.round(Number(input.fromPage || 0)));
    const toPage = Math.max(fromPage, Math.round(Number(input.toPage || fromPage)));
    const nextCrop = normalizeCrop(input.crop);

    if (!nextCrop) {
      throw Object.assign(new Error('El recorte de rango no tiene coordenadas validas.'), { statusCode: 400 });
    }

    if (input.sourcePageId) {
      assertPageId(input.sourcePageId);
    }

    const timestamp = now();
    let updatedCount = 0;

    for (const page of pages) {
      if (page.number < fromPage || page.number > toPage) {
        continue;
      }

      const previousCrop = page.crop || null;
      page.crop = nextCrop;
      page.cropBatch = {
        sourcePageId: input.sourcePageId || null,
        fromPage,
        toPage,
        previousCrop,
        reversible: true,
        appliedAt: timestamp
      };
      page.layoutStale = page.status === 'ocr-complete' || Boolean(nextCrop);
      if (page.status === 'ocr-complete') {
        page.ocrWarning = 'Recorte de rango aplicado; vuelve a leer texto.';
      }
      page.reviewed = false;
      page.updatedAt = timestamp;
      updatedCount += 1;
    }

    if (!updatedCount) {
      throw Object.assign(new Error('El rango no contiene paginas.'), { statusCode: 400 });
    }

    await this.writePages(projectId, pages);
    return {
      updatedCount,
      pages: await this.readPages(projectId)
    };
  }

  async updatePageCropSuggestion(projectId, pageId, input = {}) {
    assertPageId(pageId);
    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === pageId);

    if (!page) {
      throw Object.assign(new Error('Pagina no encontrada.'), { statusCode: 404 });
    }

    page.cropSuggestion = normalizeCropSuggestion(input);
    page.updatedAt = now();
    await this.writePages(projectId, pages);
    return this.getPagePayload(projectId, pageId);
  }

  async acceptPageCropSuggestion(projectId, pageId) {
    assertPageId(pageId);
    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === pageId);

    if (!page) {
      throw Object.assign(new Error('Pagina no encontrada.'), { statusCode: 404 });
    }

    const suggestion = normalizeCropSuggestion(page.cropSuggestion);
    if (!suggestion || suggestion.status === 'rejected') {
      throw Object.assign(new Error('No hay una sugerencia de recorte disponible.'), { statusCode: 400 });
    }

    const nextCrop = normalizeCrop(suggestion.crop);
    const cropChanged = JSON.stringify(page.crop) !== JSON.stringify(nextCrop);
    page.crop = nextCrop;
    page.cropSuggestion = {
      ...suggestion,
      status: 'accepted'
    };
    page.layoutStale = page.status === 'ocr-complete' || Boolean(nextCrop);
    if (page.status === 'ocr-complete') {
      page.ocrWarning = 'Recorte sugerido aceptado; vuelve a leer texto.';
    }
    if (cropChanged) {
      page.reviewed = false;
    }
    page.updatedAt = now();
    await this.writePages(projectId, pages);
    return this.getPagePayload(projectId, pageId);
  }

  async rejectPageCropSuggestion(projectId, pageId) {
    assertPageId(pageId);
    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === pageId);

    if (!page) {
      throw Object.assign(new Error('Pagina no encontrada.'), { statusCode: 404 });
    }

    const suggestion = normalizeCropSuggestion(page.cropSuggestion);
    if (!suggestion) {
      throw Object.assign(new Error('No hay una sugerencia de recorte disponible.'), { statusCode: 400 });
    }

    page.cropSuggestion = {
      ...suggestion,
      status: 'rejected'
    };
    page.updatedAt = now();
    await this.writePages(projectId, pages);
    return this.getPagePayload(projectId, pageId);
  }

  async updatePageRotation(projectId, pageId, input) {
    assertPageId(pageId);
    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === pageId);

    if (!page) {
      throw Object.assign(new Error('Pagina no encontrada.'), { statusCode: 404 });
    }

    const nextRotation = normalizeRotation(
      Object.prototype.hasOwnProperty.call(input || {}, 'rotation') ? input.rotation : input
    );

    if (nextRotation === page.rotation) {
      return this.getPagePayload(projectId, pageId);
    }

    const hadCrop = Boolean(page.crop);
    page.rotation = nextRotation;
    page.crop = null;
    page.layoutStale = page.status === 'ocr-complete';
    page.reviewed = false;

    if (page.status === 'ocr-complete') {
      page.ocrWarning = hadCrop
        ? 'Rotacion cambiada; ajusta otra vez el recorte y vuelve a leer texto.'
        : 'Rotacion cambiada; vuelve a leer texto.';
    } else if (hadCrop) {
      page.ocrWarning = 'Rotacion cambiada; el recorte anterior se ha quitado.';
    }

    page.updatedAt = now();
    await this.writePages(projectId, pages);
    return this.getPagePayload(projectId, pageId);
  }

  async updatePageDeskew(projectId, pageId, input = {}) {
    assertPageId(pageId);
    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === pageId);

    if (!page) {
      throw Object.assign(new Error('Pagina no encontrada.'), { statusCode: 404 });
    }

    const nextDeskew = normalizeDeskew(input);
    const deskewChanged = JSON.stringify(page.deskew || null) !== JSON.stringify(nextDeskew);
    page.deskew = nextDeskew;
    page.layoutStale = page.status === 'ocr-complete' || page.layoutStale;
    if (page.status === 'ocr-complete') {
      page.ocrWarning = nextDeskew
        ? 'Enderezado cambiado; vuelve a leer texto.'
        : 'Enderezado eliminado; vuelve a leer texto si quieres rehacer el OCR.';
    }
    if (deskewChanged) {
      page.reviewed = false;
    }
    page.updatedAt = now();
    await this.writePages(projectId, pages);
    return this.getPagePayload(projectId, pageId);
  }

  async updatePageQualityReview(projectId, pageId, input = {}) {
    assertPageId(pageId);
    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === pageId);

    if (!page) {
      throw Object.assign(new Error('Pagina no encontrada.'), { statusCode: 404 });
    }

    page.quality = normalizeImageQuality({
      ...(page.quality || {}),
      ignored: Boolean(input.ignored)
    });
    page.updatedAt = now();
    await this.writePages(projectId, pages);
    return this.getPagePayload(projectId, pageId);
  }

  async getPagePayload(projectId, pageId) {
    assertPageId(pageId);
    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === pageId);

    if (!page) {
      throw Object.assign(new Error('Pagina no encontrada.'), { statusCode: 404 });
    }

    return {
      ...page,
      ocrText: await this.readPageText(projectId, page),
      layoutData: await this.readPageLayout(projectId, page)
    };
  }

  async runPageOcr(projectId, pageId, options = {}) {
    assertPageId(pageId);
    const metadata = await this.readMetadata(projectId);
    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === pageId);

    if (!page) {
      throw Object.assign(new Error('Pagina no encontrada.'), { statusCode: 404 });
    }

    page.status = 'ocr-running';
    page.updatedAt = now();
    await this.writePages(projectId, pages);

    try {
      const imagePath = path.join(this.projectDir(projectId), page.image);
      const ocrImage = await this.preparePageImage(projectId, page, imagePath, 'ocr');
      const result = await this.ocrRunner(ocrImage.path, metadata.language, {
        ...options,
        outputDir: path.dirname(ocrImage.path)
      });

      page.tsv = page.tsv || `pages/${pageId}/ocr.tsv`;
      page.layout = page.layout || `pages/${pageId}/layout.json`;

      await writeFile(path.join(this.projectDir(projectId), page.text), result.text, 'utf8');
      await writeFile(path.join(this.projectDir(projectId), page.tsv), result.tsv || '', 'utf8');
      await writeJson(path.join(this.projectDir(projectId), page.layout), result.layout || {});
      page.status = result.status;
      page.ocrEngine = result.engine;
      page.ocrLanguage = result.language;
      page.ocrWarning = result.warning;
      page.ocrStrategy = result.ocrStrategy || options.mode || 'local-improved';
      page.ocrProvider = result.ocrProvider || 'local';
      page.ocrModel = result.ocrModel || null;
      page.ocrConfidence = Number(result.ocrConfidence || 0);
      page.ocrQualityScore = Number(result.ocrQualityScore || 0);
      page.ocrNeedsReview = Boolean(result.ocrNeedsReview);
      page.ocrCandidates = Array.isArray(result.candidates) ? result.candidates : [];
      page.layoutStale = false;
      page.reviewed = false;
      page.updatedAt = now();
      await this.writePages(projectId, pages);

      return {
        ...page,
        ocrText: result.text,
        layoutData: result.layout
      };
    } catch (error) {
      page.status = 'ocr-error';
      page.ocrWarning = error.message;
      page.updatedAt = now();
      await this.writePages(projectId, pages);
      throw error;
    }
  }

  async extractChapterHeaderImage(projectId, page, imagePath) {
    const pageWidth = Number(page.layout?.page?.width || 0);
    const pageHeight = Number(page.layout?.page?.height || 0);
    const textTop = Number(page.layout?.textBounds?.top || page.layout?.lines?.[0]?.top || 0);

    if (!pageWidth || !pageHeight || textTop < pageHeight * 0.12) {
      return null;
    }

    const cropWidth = Math.round(pageWidth);
    const minimumHeight = Math.round(pageHeight * 0.08);
    const maximumHeight = Math.round(pageHeight * 0.45);
    const cropHeight = Math.min(
      maximumHeight,
      Math.max(minimumHeight, Math.round(textTop - pageHeight * 0.02))
    );

    if (cropHeight < minimumHeight) {
      return null;
    }

    const assetsDir = path.join(this.projectDir(projectId), 'exports', 'assets');
    const outputPath = path.join(assetsDir, `${page.id}-chapter-header.jpg`);

    try {
      await mkdir(assetsDir, { recursive: true });
      await execFileAsync(
        'sips',
        [
          '-s',
          'format',
          'jpeg',
          '-c',
          String(cropHeight),
          String(cropWidth),
          '--cropOffset',
          '0',
          '0',
          imagePath,
          '--out',
          outputPath
        ],
        { maxBuffer: 1024 * 1024 * 5 }
      );

      return {
        data: await readFile(outputPath),
        mime: 'image/jpeg',
        extension: 'jpg',
        source: 'auto-crop'
      };
    } catch {
      return null;
    }
  }

  async imageDimensions(imagePath) {
    const { stdout } = await execFileAsync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', imagePath], {
      maxBuffer: 1024 * 1024
    });
    return parseSipsDimensions(stdout);
  }

  async cropImage(sourcePath, destinationPath, crop) {
    const dimensions = await this.imageDimensions(sourcePath);
    const left = clamp(Math.round(crop.left * dimensions.width), 0, dimensions.width - 1);
    const top = clamp(Math.round(crop.top * dimensions.height), 0, dimensions.height - 1);
    const width = clamp(Math.round(crop.width * dimensions.width), 1, dimensions.width - left);
    const height = clamp(Math.round(crop.height * dimensions.height), 1, dimensions.height - top);

    await mkdir(path.dirname(destinationPath), { recursive: true });
    await execFileAsync(
      'sips',
      [
        '-s',
        'format',
        'jpeg',
        '-c',
        String(height),
        String(width),
        '--cropOffset',
        String(top),
        String(left),
        sourcePath,
        '--out',
        destinationPath
      ],
      { maxBuffer: 1024 * 1024 * 5 }
    );
  }

  preparedImageBaseDir(projectId, page, purpose) {
    if (purpose === 'ocr' || purpose === 'preview' || purpose === 'cover-preview') {
      return path.join(this.projectDir(projectId), 'pages', page.id);
    }

    return path.join(this.projectDir(projectId), 'exports', 'assets');
  }

  async rotateImage(sourcePath, destinationPath, rotation) {
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await execFileAsync('sips', ['-r', String(rotation), sourcePath, '--out', destinationPath], {
      maxBuffer: 1024 * 1024 * 5
    });
  }

  async preparePageImage(projectId, page, sourcePath, purpose, options = {}) {
    const includeCrop = options.includeCrop !== false;
    const sourceExtension = imageExtensionFromPath(page.image);
    const sourceMime = page.mime || imageMimeFromExtension(sourceExtension);
    const baseDir = this.preparedImageBaseDir(projectId, page, purpose);

    if (!page.crop && !page.rotation && !page.deskew) {
      return {
        path: sourcePath,
        data: await readFile(sourcePath),
        mime: sourceMime,
        extension: sourceExtension,
        rotated: false,
        deskewed: false,
        cropped: false
      };
    }

    let preparedSourcePath = sourcePath;
    let outputPath = sourcePath;
    let mime = sourceMime;
    let extension = sourceExtension;
    let rotated = false;
    let deskewed = false;

    if (page.rotation) {
      preparedSourcePath = path.join(baseDir, `${page.id}-${purpose}-rotate.${sourceExtension}`);
      await this.rotateImage(sourcePath, preparedSourcePath, page.rotation);
      outputPath = preparedSourcePath;
      rotated = true;
    }

    if (page.deskew) {
      const deskewLabel = String(page.deskew.angle).replace('-', 'neg').replace('.', '_');
      outputPath = path.join(baseDir, `${page.id}-${purpose}-deskew-${deskewLabel}.${sourceExtension}`);
      await this.rotateImage(preparedSourcePath, outputPath, page.deskew.angle);
      preparedSourcePath = outputPath;
      deskewed = true;
    }

    if (includeCrop && page.crop) {
      outputPath = path.join(baseDir, `${page.id}-${purpose}-crop.jpg`);
      await this.cropImage(preparedSourcePath, outputPath, page.crop);
      mime = 'image/jpeg';
      extension = 'jpg';
    }

    return {
      path: outputPath,
      data: await readFile(outputPath),
      mime,
      extension,
      rotated,
      deskewed,
      cropped: includeCrop && Boolean(page.crop)
    };
  }

  async clearStoredCoverFiles(projectId) {
    await rm(this.coverDir(projectId), {
      recursive: true,
      force: true
    });
  }

  async updateProjectCover(projectId, input) {
    const metadata = await this.ensureProjectMetadata(projectId, await this.readMetadata(projectId));
    const requestedMode = String(input.mode || 'none');

    if (requestedMode === 'none') {
      metadata.cover = normalizeCover();
      await this.clearStoredCoverFiles(projectId);
      await this.writeMetadata(projectId, metadata);
      return this.getProject(projectId);
    }

    if (requestedMode === 'page') {
      assertPageId(input.pageId);
      const pages = await this.readPages(projectId);
      const page = pages.find((item) => item.id === input.pageId);

      if (!page) {
        throw Object.assign(new Error('Pagina no encontrada.'), { statusCode: 404 });
      }

      metadata.cover = normalizeCover({
        mode: 'page',
        pageId: page.id,
        updatedAt: now()
      });
      await this.clearStoredCoverFiles(projectId);
      await this.writeMetadata(projectId, metadata);
      return this.getProject(projectId);
    }

    throw Object.assign(new Error('Configuracion de portada no valida.'), { statusCode: 400 });
  }

  async uploadProjectCover(projectId, dataUrl) {
    const metadata = await this.ensureProjectMetadata(projectId, await this.readMetadata(projectId));
    const parsed = parseDataUrl(dataUrl);
    const extension = parsed.mime === 'image/png' ? 'png' : 'jpg';
    const imageName = `cover.${extension}`;
    const imagePath = path.join(this.coverDir(projectId), imageName);

    await this.clearStoredCoverFiles(projectId);
    await mkdir(this.coverDir(projectId), { recursive: true });
    await writeFile(imagePath, parsed.data);

    metadata.cover = normalizeCover({
      mode: 'upload',
      image: `cover/${imageName}`,
      mime: parsed.mime,
      updatedAt: now()
    });
    await this.writeMetadata(projectId, metadata);
    return this.getProject(projectId);
  }

  async projectCoverImage(projectId) {
    const metadata = await this.ensureProjectMetadata(projectId, await this.readMetadata(projectId));
    const cover = normalizeCover(metadata.cover || {});

    if (cover.mode === 'none') {
      throw Object.assign(new Error('Portada no encontrada.'), { statusCode: 404 });
    }

    if (cover.mode === 'upload') {
      const filePath = path.join(this.projectDir(projectId), cover.image);
      if (!(await pathExists(filePath))) {
        throw Object.assign(new Error('Portada no encontrada.'), { statusCode: 404 });
      }

      return {
        filePath,
        mime: cover.mime || imageMimeFromExtension(imageExtensionFromPath(filePath))
      };
    }

    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === cover.pageId);

    if (!page) {
      throw Object.assign(new Error('Portada no encontrada.'), { statusCode: 404 });
    }

    const imagePath = path.join(this.projectDir(projectId), page.image);
    if (!(await pathExists(imagePath))) {
      throw Object.assign(new Error('Portada no encontrada.'), { statusCode: 404 });
    }

    const preparedImage = await this.preparePageImage(projectId, page, imagePath, 'cover-preview');
    return {
      filePath: preparedImage.path,
      mime: preparedImage.mime
    };
  }

  async prepareProjectCover(projectId, metadata, pages) {
    const cover = normalizeCover(metadata.cover || {});

    if (cover.mode === 'none') {
      return null;
    }

    if (cover.mode === 'upload') {
      const filePath = path.join(this.projectDir(projectId), cover.image);
      if (!(await pathExists(filePath))) {
        return null;
      }

      return {
        data: await readFile(filePath),
        mime: cover.mime || imageMimeFromExtension(imageExtensionFromPath(filePath)),
        extension: imageExtensionFromPath(filePath),
        source: 'upload'
      };
    }

    const page = pages.find((item) => item.id === cover.pageId);
    if (!page) {
      return null;
    }

    const imagePath = path.join(this.projectDir(projectId), page.image);
    if (!(await pathExists(imagePath))) {
      return null;
    }

    return this.preparePageImage(projectId, page, imagePath, 'cover');
  }

  async readPagesWithText(projectId) {
    const pages = await this.readPages(projectId);
    const pagesWithText = [];

    for (const page of pages) {
      const editorial = normalizeEditorial(page.editorial || page);
      let text = '';

      if (editorial.imageMode !== 'image') {
        try {
          text = await this.readPageText(projectId, page);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
      }

      pagesWithText.push({
        ...page,
        editorial,
        text
      });
    }

    return pagesWithText;
  }

  async inspectExport(projectId) {
    const metadata = await this.ensureProjectMetadata(projectId, await this.readMetadata(projectId));
    const pagesWithText = await this.readPagesWithText(projectId);

    return buildBookChecklist({
      metadata,
      pages: pagesWithText,
      checkedAt: now()
    });
  }

  async inspectReviewQueue(projectId) {
    return buildReviewQueue({
      pages: await this.readPagesWithText(projectId),
      checkedAt: now()
    });
  }

  async previewExport(projectId) {
    const metadata = await this.ensureProjectMetadata(projectId, await this.readMetadata(projectId));

    return buildEpubPreview(metadata, await this.readPagesWithText(projectId));
  }

  sanitizeMetadataForPackage(metadata) {
    return {
      ...metadata,
      inbox: {
        path: '',
        watch: false,
        createdAt: metadata.inbox?.createdAt || metadata.createdAt || now(),
        updatedAt: metadata.inbox?.updatedAt || metadata.updatedAt || now()
      }
    };
  }

  async packagePageForExport(projectId, page) {
    const projectDir = this.projectDir(projectId);
    const next = {
      ...page,
      source: stripLocalSourcePaths(page.source)
    };
    const assets = [];

    async function addExistingAsset(relativePath, options = {}) {
      const { required = false, fallback = null } = options;
      const safePath = safePackagePath(relativePath);
      const filePath = path.join(projectDir, safePath);

      if (await pathExists(filePath)) {
        assets.push({
          name: safePath,
          data: await readFile(filePath)
        });
        return safePath;
      }

      if (fallback !== null) {
        assets.push({
          name: safePath,
          data: Buffer.isBuffer(fallback) ? fallback : Buffer.from(String(fallback), 'utf8')
        });
        return safePath;
      }

      if (required) {
        throw Object.assign(new Error(`Falta ${safePath}; no se puede crear el paquete.`), {
          statusCode: 400
        });
      }

      return null;
    }

    next.image = await addExistingAsset(page.image, { required: true });
    next.text = await addExistingAsset(page.text || `pages/${page.id}/ocr.txt`, { fallback: '' });
    next.tsv = page.tsv ? await addExistingAsset(page.tsv) : null;
    next.layout = page.layout ? await addExistingAsset(page.layout) : null;

    if (next.source?.preservedOriginal && next.source.preservedOriginal !== next.image) {
      const preservedOriginal = await addExistingAsset(next.source.preservedOriginal);
      if (preservedOriginal) {
        next.source.preservedOriginal = preservedOriginal;
      } else {
        delete next.source.preservedOriginal;
      }
    }

    return { page: next, assets };
  }

  async packageDataForProject(projectId) {
    const metadata = await this.ensureProjectMetadata(projectId, await this.readMetadata(projectId));
    const pages = await this.readPages(projectId);
    const packageMetadata = this.sanitizeMetadataForPackage(metadata);
    const packagePages = [];
    const assets = [];
    const seenAssets = new Set();

    function addAsset(asset) {
      if (!asset || seenAssets.has(asset.name)) {
        return;
      }
      seenAssets.add(asset.name);
      assets.push(asset);
    }

    for (const page of pages) {
      const packaged = await this.packagePageForExport(projectId, page);
      packagePages.push(packaged.page);
      for (const asset of packaged.assets) {
        addAsset(asset);
      }
    }

    const cover = normalizeCover(packageMetadata.cover || {});
    if (cover.mode === 'upload' && cover.image) {
      const safeCoverPath = safePackagePath(cover.image);
      const coverPath = path.join(this.projectDir(projectId), safeCoverPath);
      if (await pathExists(coverPath)) {
        addAsset({
          name: safeCoverPath,
          data: await readFile(coverPath)
        });
        packageMetadata.cover = {
          ...cover,
          image: safeCoverPath
        };
      } else {
        packageMetadata.cover = normalizeCover();
      }
    } else {
      packageMetadata.cover = cover;
    }

    return {
      metadata: packageMetadata,
      pages: packagePages,
      assets
    };
  }

  packageFileName(metadata) {
    return `${slugify(metadata.title)}${BOOK_PACKAGE_EXTENSION}`;
  }

  packageSummary(packageResult) {
    const estimatedSize = packageResult.entries.reduce((total, entry) => {
      const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data || ''));
      return total + Buffer.byteLength(entry.name) + data.length;
    }, 0);
    const warning =
      estimatedSize > BOOK_PACKAGE_SIZE_WARNING_BYTES
        ? {
            code: 'large-package',
            threshold: BOOK_PACKAGE_SIZE_WARNING_BYTES,
            estimatedSize,
            message:
              'El paquete puede ser grande y tardar en generarse o copiarse. Puedes continuar si quieres conservar una copia completa.'
          }
        : null;

    return {
      estimatedSize,
      warning
    };
  }

  async inspectPackageExport(projectId) {
    const data = await this.packageDataForProject(projectId);
    const packageResult = createBookSaverPackage(data);
    const summary = this.packageSummary(packageResult);

    return {
      fileName: this.packageFileName(data.metadata),
      manifest: packageResult.manifest,
      pageCount: data.pages.length,
      assetCount: data.assets.length,
      ...summary
    };
  }

  async exportPackage(projectId) {
    const data = await this.packageDataForProject(projectId);
    const packageResult = createBookSaverPackage(data);
    const summary = this.packageSummary(packageResult);
    const exportDir = path.join(this.projectDir(projectId), 'exports');
    await mkdir(exportDir, { recursive: true });

    const outputPath = path.join(exportDir, this.packageFileName(data.metadata));
    await writeFile(outputPath, packageResult.archive);

    return {
      fileName: path.basename(outputPath),
      path: outputPath,
      size: packageResult.archive.length,
      manifest: packageResult.manifest,
      estimatedSize: summary.estimatedSize,
      warning: summary.warning,
      downloadUrl: `/api/projects/${projectId}/packages/${encodeURIComponent(path.basename(outputPath))}`
    };
  }

  async uniqueImportedProjectId(preferredId, title) {
    const preferred = PROJECT_ID_PATTERN.test(String(preferredId || '')) ? String(preferredId) : '';
    if (preferred && !(await pathExists(this.projectDir(preferred)))) {
      return preferred;
    }

    const base = slugify(title || preferred || 'libro-importado');
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const suffix = attempt === 0 ? Date.now().toString(36) : `${Date.now().toString(36)}-${attempt}`;
      const candidate = `${base}-${suffix}`.slice(0, 80).replace(/-+$/g, '');
      if (PROJECT_ID_PATTERN.test(candidate) && !(await pathExists(this.projectDir(candidate)))) {
        return candidate;
      }
    }

    return randomUUID();
  }

  async importPackage(input) {
    await this.ensure();
    const parsed = readBookSaverPackage(input);
    const timestamp = now();
    const title = String(parsed.metadata.title || parsed.manifest.title || 'Libro importado').trim();
    const projectId = await this.uniqueImportedProjectId(parsed.metadata.id || parsed.manifest.projectId, title);
    const projectDir = this.projectDir(projectId);
    const inboxPath = this.defaultInboxPath(projectId);
    const pageIds = new Set();

    const pages = parsed.pages.map((page, index) => {
      const pageId = String(page.id || `page-${String(index + 1).padStart(4, '0')}`);
      assertPageId(pageId);
      if (pageIds.has(pageId)) {
        throw Object.assign(new Error('El paquete contiene paginas duplicadas.'), { statusCode: 400 });
      }
      pageIds.add(pageId);

      return normalizePage(
        {
          ...page,
          id: pageId,
          image: safePackagePath(page.image),
          text: page.text ? safePackagePath(page.text) : `pages/${pageId}/ocr.txt`,
          tsv: page.tsv ? safePackagePath(page.tsv) : null,
          layout: page.layout ? safePackagePath(page.layout) : null,
          source: stripLocalSourcePaths(page.source),
          updatedAt: page.updatedAt || timestamp,
          createdAt: page.createdAt || timestamp
        },
        index
      );
    });

    const metadata = {
      ...parsed.metadata,
      id: projectId,
      title: title || 'Libro importado',
      author: String(parsed.metadata.author || '').trim(),
      language: String(parsed.metadata.language || 'es').trim() || 'es',
      notes: String(parsed.metadata.notes || '').trim(),
      cover: normalizeCover(parsed.metadata.cover || {}),
      inbox: {
        path: inboxPath,
        watch: false,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      createdAt: parsed.metadata.createdAt || timestamp,
      updatedAt: timestamp
    };

    await mkdir(path.join(projectDir, 'pages'), { recursive: true });
    await mkdir(path.join(projectDir, 'exports'), { recursive: true });
    await mkdir(inboxPath, { recursive: true });

    for (const assetPath of parsed.assetPaths) {
      const targetPath = path.join(projectDir, safePackagePath(assetPath));
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, parsed.entryMap.get(assetPath));
    }

    await writeJson(this.metadataPath(projectId), metadata);
    await writeJson(this.pagesPath(projectId), { pages });

    return {
      project: await this.getProject(projectId),
      summary: {
        sourceProjectId: parsed.manifest.projectId,
        pageCount: pages.length,
        assetCount: parsed.assetPaths.size
      }
    };
  }

  async exportEpub(projectId) {
    const metadata = await this.ensureProjectMetadata(projectId, await this.readMetadata(projectId));
    const pages = await this.readPages(projectId);
    const pagesWithText = [];

    for (const page of pages) {
      const imagePath = path.join(this.projectDir(projectId), page.image);
      const preparedImage = (await pathExists(imagePath))
        ? await this.preparePageImage(projectId, page, imagePath, 'epub')
        : null;
      const layout = await this.readPageLayout(projectId, page);
      const exportPage = {
        ...page,
        text: await this.readPageText(projectId, page),
        layout,
        imageData: preparedImage?.data || null,
        imageMime: preparedImage?.mime || page.mime || imageMimeFromExtension(imageExtensionFromPath(page.image)),
        imageExtension: preparedImage?.extension || imageExtensionFromPath(page.image)
      };

      if (preparedImage?.data && page.editorial?.chapterHeaderMode === 'auto') {
        exportPage.headerImage = await this.extractChapterHeaderImage(
          projectId,
          exportPage,
          preparedImage.path
        );
      }

      pagesWithText.push({
        ...exportPage
      });
    }

    const coverImage = await this.prepareProjectCover(projectId, metadata, pages);
    const exportMetadata = {
      ...metadata,
      cover: coverImage
        ? {
            ...(metadata.cover || {}),
            imageData: coverImage.data,
            imageMime: coverImage.mime,
            imageExtension: coverImage.extension
          }
        : metadata.cover
    };
    const files = buildEpubFiles(exportMetadata, pagesWithText);
    const validation = validateEpubFiles(files);
    const preview = buildEpubPreview(metadata, pagesWithText);
    const archive = createStoreZip(files);
    const exportDir = path.join(this.projectDir(projectId), 'exports');
    await mkdir(exportDir, { recursive: true });
    const outputPath = path.join(exportDir, `${slugify(metadata.title)}.epub`);
    await writeFile(outputPath, archive);

    return {
      fileName: path.basename(outputPath),
      path: outputPath,
      size: archive.length,
      summary: {
        chapterCount: preview.chapterCount,
        navigationItemCount: preview.navigationItemCount,
        pageCount: preview.metadata.pageCount
      },
      validation,
      downloadUrl: `/api/projects/${projectId}/exports/${encodeURIComponent(path.basename(outputPath))}`
    };
  }

  async exportPath(projectId, fileName) {
    const exportDir = path.join(this.projectDir(projectId), 'exports');
    const safeName = path.basename(fileName);
    const filePath = path.join(exportDir, safeName);

    if (!(await pathExists(filePath))) {
      throw Object.assign(new Error('Exportacion no encontrada.'), { statusCode: 404 });
    }

    return filePath;
  }

  async packagePath(projectId, fileName) {
    const exportDir = path.join(this.projectDir(projectId), 'exports');
    const safeName = path.basename(fileName);

    if (!safeName.endsWith(BOOK_PACKAGE_EXTENSION)) {
      throw Object.assign(new Error('Paquete no encontrado.'), { statusCode: 404 });
    }

    const filePath = path.join(exportDir, safeName);
    if (!(await pathExists(filePath))) {
      throw Object.assign(new Error('Paquete no encontrado.'), { statusCode: 404 });
    }

    return filePath;
  }

  async pageAdjustmentComparison(projectId, pageId) {
    const page = await this.getPagePayload(projectId, pageId);
    const adjustments = {
      crop: page.crop || null,
      rotation: page.rotation || 0,
      deskew: page.deskew || null
    };
    const hasAdjustment = Boolean(adjustments.crop || adjustments.rotation || adjustments.deskew);

    return {
      pageId,
      status: hasAdjustment ? 'adjusted' : 'original',
      originalPreserved: true,
      beforeUrl: `/api/projects/${projectId}/pages/${pageId}/image`,
      afterUrl: `/api/projects/${projectId}/pages/${pageId}/adjusted-image`,
      adjustments
    };
  }

  async imagePath(projectId, pageId) {
    const page = await this.getPagePayload(projectId, pageId);
    const sourcePath = path.join(this.projectDir(projectId), page.image);

    if (!(await pathExists(sourcePath))) {
      throw Object.assign(new Error('Imagen no encontrada.'), { statusCode: 404 });
    }

    const preview = await this.preparePageImage(projectId, page, sourcePath, 'preview', {
      includeCrop: false
    });
    return { filePath: preview.path, mime: preview.mime };
  }

  async adjustedImagePath(projectId, pageId) {
    const page = await this.getPagePayload(projectId, pageId);
    const sourcePath = path.join(this.projectDir(projectId), page.image);

    if (!(await pathExists(sourcePath))) {
      throw Object.assign(new Error('Imagen no encontrada.'), { statusCode: 404 });
    }

    const preview = await this.preparePageImage(projectId, page, sourcePath, 'adjusted-preview', {
      includeCrop: true
    });
    return { filePath: preview.path, mime: preview.mime };
  }
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png));base64,(.+)$/u.exec(String(dataUrl || ''));

  if (!match) {
    throw Object.assign(new Error('La captura no tiene un formato de imagen valido.'), {
      statusCode: 400
    });
  }

  return {
    mime: match[1],
    data: Buffer.from(match[2], 'base64')
  };
}
