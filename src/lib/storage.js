import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { createEpubArchive } from './epub.js';
import { runOcr } from './ocr.js';

const execFileAsync = promisify(execFile);
const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/;
const PAGE_ID_PATTERN = /^page-\d{4}$/;
const PAGE_IMAGE_MODES = new Set(['text', 'image']);
const CHAPTER_HEADER_MODES = new Set(['none', 'auto', 'page']);
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

function captureDate(fileStat) {
  return new Date(fileStat.mtimeMs).toISOString();
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

function normalizePage(page, index) {
  return {
    ...page,
    number: index + 1,
    crop: normalizeCrop(page.crop),
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
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.booksDir = path.join(rootDir, 'books');
    this.inboxDir = path.join(rootDir, 'inbox');
  }

  async ensure() {
    await mkdir(this.booksDir, { recursive: true });
    await mkdir(this.inboxDir, { recursive: true });
  }

  projectDir(projectId) {
    assertProjectId(projectId);
    return path.join(this.booksDir, projectId);
  }

  metadataPath(projectId) {
    return path.join(this.projectDir(projectId), 'metadata.json');
  }

  pagesPath(projectId) {
    return path.join(this.projectDir(projectId), 'pages.json');
  }

  defaultInboxPath(projectId) {
    assertProjectId(projectId);
    return path.join(this.inboxDir, projectId);
  }

  async ensureProjectInbox(projectId, metadata) {
    const inbox = metadata.inbox || {};
    const timestamp = now();

    if (inbox.path) {
      const inboxCreatedAt = inbox.createdAt || inbox.updatedAt || timestamp;
      const inboxUpdatedAt =
        inbox.updatedAt && Date.parse(inbox.updatedAt) >= Date.parse(inboxCreatedAt)
          ? inbox.updatedAt
          : inboxCreatedAt;
      const needsNormalization =
        inbox.watch !== Boolean(inbox.watch) ||
        inbox.createdAt !== inboxCreatedAt ||
        inbox.updatedAt !== inboxUpdatedAt;
      const nextInbox = {
        ...inbox,
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
        path: this.defaultInboxPath(projectId),
        watch: Boolean(inbox.watch),
        createdAt: inbox.createdAt || inbox.updatedAt || timestamp,
        updatedAt: timestamp
      }
    };

    await mkdir(nextMetadata.inbox.path, { recursive: true });
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
        const metadata = await this.ensureProjectInbox(entry.name, await this.readMetadata(entry.name));
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
    const metadata = await this.ensureProjectInbox(projectId, await this.readMetadata(projectId));
    const pages = await this.readPages(projectId);
    return { ...metadata, pages };
  }

  async updateProject(projectId, input) {
    const metadata = await this.readMetadata(projectId);
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

  createPageRecord(projectId, pages, imageData, mime, extension, source = null) {
    const pageId = nextPageId(pages);
    const pageDir = path.join(this.projectDir(projectId), 'pages', pageId);
    const imageName = `original.${extension}`;
    const textName = 'ocr.txt';
    const tsvName = 'ocr.tsv';
    const layoutName = 'layout.json';

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

  async addPage(projectId, dataUrl) {
    const pages = await this.readPages(projectId);
    const parsed = parseDataUrl(dataUrl);
    const extension = parsed.mime === 'image/png' ? 'png' : 'jpg';
    const pageRecord = this.createPageRecord(projectId, pages, parsed.data, parsed.mime, extension);

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
      capturedAt: captureDate(sourceStat),
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
      source
    );

    await mkdir(pageRecord.pageDir, { recursive: true });

    const destinationPath = path.join(pageRecord.pageDir, pageRecord.imageName);
    if (importType.convert) {
      await convertWithSips(resolvedSourcePath, destinationPath);
      const convertedData = await readFile(destinationPath);
      pageRecord.page.size = convertedData.length;
      pageRecord.page.checksum = createHash('sha256').update(convertedData).digest('hex');
      pageRecord.page.source.convertedFrom = sourceExtension.slice(1);
    } else {
      await copyFile(resolvedSourcePath, destinationPath);
    }

    await writeFile(path.join(pageRecord.pageDir, pageRecord.textName), '', 'utf8');
    pages.push(pageRecord.page);
    await this.writePages(projectId, pages);

    return { page: pageRecord.page, imported: true, skippedReason: null };
  }

  async updateInbox(projectId, input) {
    const metadata = await this.readMetadata(projectId);
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

  async importFromInbox(projectId) {
    const metadata = await this.readMetadata(projectId);
    const inboxPath = String(metadata.inbox?.path || '').trim();

    if (!inboxPath) {
      throw Object.assign(new Error('Configura primero una carpeta de entrada.'), { statusCode: 400 });
    }

    assertAbsoluteFolder(inboxPath);
    const folderStat = await stat(inboxPath);
    if (!folderStat.isDirectory()) {
      throw Object.assign(new Error('La carpeta de entrada no existe.'), { statusCode: 400 });
    }

    const entries = await readdir(inboxPath, { withFileTypes: true });
    const candidates = [];
    const unsupported = [];

    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith('.')) {
        continue;
      }

      const sourcePath = path.join(inboxPath, entry.name);
      const extension = path.extname(entry.name).toLowerCase();
      if (!IMPORTABLE_EXTENSIONS.has(extension)) {
        unsupported.push(entry.name);
        continue;
      }

      const fileStat = await stat(sourcePath);
      candidates.push({ sourcePath, fileStat });
    }

    candidates.sort((a, b) => {
      return a.fileStat.mtimeMs - b.fileStat.mtimeMs || a.sourcePath.localeCompare(b.sourcePath);
    });

    const importedPages = [];
    let skippedDuplicates = 0;
    const errors = [];

    for (const candidate of candidates) {
      try {
        const result = await this.addPageFromFile(projectId, candidate.sourcePath, candidate.fileStat);
        if (result.imported) {
          importedPages.push(result.page);
        } else {
          skippedDuplicates += 1;
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
      lastUnsupportedCount: unsupported.length,
      lastErrorCount: errors.length
    };
    await this.writeMetadata(projectId, nextMetadata);

    return {
      importedPages,
      importedCount: importedPages.length,
      skippedDuplicates,
      unsupported,
      errors,
      project: await this.getProject(projectId)
    };
  }

  async deletePage(projectId, pageId) {
    assertPageId(pageId);
    const pages = await this.readPages(projectId);
    const page = pages.find((item) => item.id === pageId);

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

    page.editorial = normalizeEditorial(input);
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
    page.crop = nextCrop;
    page.layoutStale = page.status === 'ocr-complete' || Boolean(nextCrop);
    if (page.status === 'ocr-complete') {
      page.ocrWarning = nextCrop
        ? 'Recorte cambiado; vuelve a leer texto.'
        : 'Recorte eliminado; vuelve a leer texto si quieres rehacer el OCR.';
    }
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

  async runPageOcr(projectId, pageId) {
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

    const imagePath = path.join(this.projectDir(projectId), page.image);
    const ocrImage = await this.preparePageImage(projectId, page, imagePath, 'ocr');
    const result = await runOcr(ocrImage.path, metadata.language);

    page.tsv = page.tsv || `pages/${pageId}/ocr.tsv`;
    page.layout = page.layout || `pages/${pageId}/layout.json`;

    await writeFile(path.join(this.projectDir(projectId), page.text), result.text, 'utf8');
    await writeFile(path.join(this.projectDir(projectId), page.tsv), result.tsv || '', 'utf8');
    await writeJson(path.join(this.projectDir(projectId), page.layout), result.layout || {});
    page.status = result.status;
    page.ocrEngine = result.engine;
    page.ocrLanguage = result.language;
    page.ocrWarning = result.warning;
    page.layoutStale = false;
    page.updatedAt = now();
    await this.writePages(projectId, pages);

    return {
      ...page,
      ocrText: result.text,
      layoutData: result.layout
    };
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

  async preparePageImage(projectId, page, sourcePath, purpose) {
    if (!page.crop) {
      return {
        path: sourcePath,
        data: await readFile(sourcePath),
        mime: page.mime || imageMimeFromExtension(imageExtensionFromPath(page.image)),
        extension: imageExtensionFromPath(page.image),
        cropped: false
      };
    }

    const baseDir =
      purpose === 'ocr'
        ? path.join(this.projectDir(projectId), 'pages', page.id)
        : path.join(this.projectDir(projectId), 'exports', 'assets');
    const outputPath = path.join(baseDir, `${page.id}-${purpose}-crop.jpg`);

    await this.cropImage(sourcePath, outputPath, page.crop);

    return {
      path: outputPath,
      data: await readFile(outputPath),
      mime: 'image/jpeg',
      extension: 'jpg',
      cropped: true
    };
  }

  async exportEpub(projectId) {
    const metadata = await this.readMetadata(projectId);
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

    const archive = createEpubArchive(metadata, pagesWithText);
    const exportDir = path.join(this.projectDir(projectId), 'exports');
    await mkdir(exportDir, { recursive: true });
    const outputPath = path.join(exportDir, `${slugify(metadata.title)}.epub`);
    await writeFile(outputPath, archive);

    return {
      fileName: path.basename(outputPath),
      path: outputPath,
      size: archive.length,
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

  async imagePath(projectId, pageId) {
    const page = await this.getPagePayload(projectId, pageId);
    const filePath = path.join(this.projectDir(projectId), page.image);

    if (!(await pathExists(filePath))) {
      throw Object.assign(new Error('Imagen no encontrada.'), { statusCode: 404 });
    }

    return { filePath, mime: page.mime || 'image/jpeg' };
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
