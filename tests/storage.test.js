import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { readStoreZipEntries } from '../src/lib/book-package.js';
import { createStoreZip } from '../src/lib/epub.js';
import { captureQualityNeedsReview } from '../src/lib/image-quality.js';
import { LibraryStore } from '../src/lib/storage.js';

const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lXz9hwAAAABJRU5ErkJggg==';
const ONE_PIXEL_PNG_BYTES = Buffer.from(ONE_PIXEL_PNG.split(',')[1], 'base64');

test('LibraryStore captures pages and exports an EPUB', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({
      title: 'Libro de prueba',
      author: 'Codex',
      language: 'es'
    });
    const inboxStat = await stat(project.inbox.path);

    assert.equal(project.inbox.watch, false);
    assert.ok(project.inbox.path.includes(`${path.sep}inbox${path.sep}`));
    assert.equal(inboxStat.isDirectory(), true);

    const firstPage = await store.addPage(project.id, ONE_PIXEL_PNG);
    const secondPage = await store.addPage(project.id, ONE_PIXEL_PNG);
    await store.deletePage(project.id, firstPage.id);
    const thirdPage = await store.addPage(project.id, ONE_PIXEL_PNG);

    assert.equal(secondPage.id, 'page-0002');
    assert.equal(thirdPage.id, 'page-0003');

    await store.updatePageText(project.id, secondPage.id, 'Texto revisado');
    const editorialPage = await store.updatePageEditorial(project.id, secondPage.id, {
      imageMode: 'image',
      partStart: true,
      partTitle: 'Primera parte',
      chapterStart: true,
      chapterTitle: 'Capitulo de prueba',
      chapterHeaderMode: 'page',
      chapterEnd: true
    });
    const croppedPage = await store.updatePageCrop(project.id, secondPage.id, {
      left: 0.1,
      top: 0.05,
      width: 0.8,
      height: 0.9
    });
    assert.equal(editorialPage.editorial.imageMode, 'image');
    assert.equal(editorialPage.editorial.partTitle, 'Primera parte');
    assert.equal(editorialPage.editorial.chapterTitle, 'Capitulo de prueba');
    assert.deepEqual(croppedPage.crop, {
      left: 0.1,
      top: 0.05,
      width: 0.8,
      height: 0.9
    });
    const coveredProject = await store.updateProjectCover(project.id, {
      mode: 'page',
      pageId: secondPage.id
    });
    assert.equal(coveredProject.cover.mode, 'page');
    assert.equal(coveredProject.cover.pageId, secondPage.id);
    const exported = await store.exportEpub(project.id);
    const archive = await readFile(exported.path);

    assert.equal(exported.fileName, 'libro-de-prueba.epub');
    assert.ok(archive.includes(Buffer.from('Primera parte')));
    assert.ok(archive.includes(Buffer.from('Capitulo de prueba')));
    assert.ok(archive.includes(Buffer.from('OEBPS/text/cover.xhtml')));
    assert.ok(archive.includes(Buffer.from('OEBPS/images/cover.jpg')));
    assert.ok(archive.includes(Buffer.from('OEBPS/images/page-0002.jpg')));
    assert.equal(exported.validation.valid, true);
    assert.equal(exported.validation.chapterCount, 2);
    assert.equal(exported.summary.chapterCount, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore previews export metadata and navigation without creating an EPUB', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({
      title: 'Vista previa',
      author: 'Codex',
      language: 'es'
    });
    const firstPage = await store.addPage(project.id, ONE_PIXEL_PNG);
    const secondPage = await store.addPage(project.id, ONE_PIXEL_PNG);

    await store.updatePageText(project.id, firstPage.id, 'Texto inicial');
    await store.updatePageText(project.id, secondPage.id, 'Texto final');
    await store.updatePageEditorial(project.id, firstPage.id, {
      partStart: true,
      partTitle: 'Primera parte',
      chapterStart: true,
      chapterTitle: 'Capitulo uno'
    });
    await store.updatePageEditorial(project.id, secondPage.id, {
      chapterStart: true,
      chapterTitle: 'Capitulo dos'
    });

    const preview = await store.previewExport(project.id);
    const exportDir = path.join(root, 'books', project.id, 'exports');

    assert.deepEqual(preview.metadata, {
      title: 'Vista previa',
      author: 'Codex',
      language: 'es',
      pageCount: 2,
      textPageCount: 2,
      imagePageCount: 0,
      coverMode: 'none'
    });
    assert.deepEqual(
      preview.navigation.map((item) => item.title),
      ['Primera parte', 'Capitulo uno', 'Capitulo dos']
    );
    const exportFiles = await readdir(exportDir);
    assert.equal(exportFiles.some((fileName) => fileName.endsWith('.epub')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore stores local capture quality diagnostics for new pages', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({
      title: 'Calidad local',
      author: 'Codex',
      language: 'es'
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);
    const payload = await store.getPagePayload(project.id, page.id);

    assert.equal(payload.quality.source, 'capture');
    assert.equal(payload.quality.metrics.width, 1);
    assert.equal(payload.quality.metrics.height, 1);
    assert.equal(captureQualityNeedsReview(payload.quality), true);
    assert.ok(payload.quality.flags.some((flag) => flag.code === 'low-resolution'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore lets the user ignore capture quality warnings', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({
      title: 'Ignorar calidad',
      author: 'Codex',
      language: 'es'
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);
    const ignored = await store.updatePageQualityReview(project.id, page.id, { ignored: true });
    const payload = await store.getPagePayload(project.id, page.id);

    assert.equal(ignored.quality.ignored, true);
    assert.equal(ignored.quality.ok, true);
    assert.equal(payload.quality.ignored, true);
    assert.equal(captureQualityNeedsReview(payload.quality), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore stores, accepts and rejects derived crop suggestions', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({
      title: 'Recorte sugerido',
      author: 'Codex',
      language: 'es'
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);
    const suggestion = {
      status: 'suggested',
      source: 'border-detection',
      confidence: 0.82,
      crop: { left: 0.1, top: 0.08, width: 0.8, height: 0.85 }
    };

    const suggested = await store.updatePageCropSuggestion(project.id, page.id, suggestion);
    assert.equal(suggested.cropSuggestion.status, 'suggested');
    assert.equal(suggested.crop, null);

    const accepted = await store.acceptPageCropSuggestion(project.id, page.id);
    assert.deepEqual(accepted.crop, suggestion.crop);
    assert.equal(accepted.cropSuggestion.status, 'accepted');

    await store.updatePageCropSuggestion(project.id, page.id, suggestion);
    const rejected = await store.rejectPageCropSuggestion(project.id, page.id);
    assert.equal(rejected.cropSuggestion.status, 'rejected');
    assert.deepEqual(rejected.crop, suggestion.crop);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore applies and reverts small deskew metadata without replacing the original image', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({
      title: 'Enderezado',
      author: 'Codex',
      language: 'es'
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);
    const originalImage = page.image;
    await store.updatePageText(project.id, page.id, 'Texto ya leido');
    const pages = await store.readPages(project.id);
    pages[0] = {
      ...pages[0],
      status: 'ocr-complete',
      layoutStale: false,
      reviewed: true
    };
    await store.writePages(project.id, pages);

    const adjusted = await store.updatePageDeskew(project.id, page.id, {
      angle: 1.7,
      source: 'manual'
    });
    assert.deepEqual(adjusted.deskew, { angle: 1.7, source: 'manual' });
    assert.equal(adjusted.image, originalImage);
    assert.equal(adjusted.layoutStale, true);
    assert.equal(adjusted.reviewed, false);
    assert.match(adjusted.ocrWarning, /enderezado/i);

    const reverted = await store.updatePageDeskew(project.id, page.id, { angle: 0 });
    assert.equal(reverted.deskew, null);
    assert.equal(reverted.image, originalImage);
    assert.equal(reverted.layoutStale, true);
    assert.match(reverted.ocrWarning, /enderezado/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore applies a crop to a confirmed page range', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({
      title: 'Recorte por rango',
      author: 'Codex',
      language: 'es'
    });
    const firstPage = await store.addPage(project.id, ONE_PIXEL_PNG);
    const secondPage = await store.addPage(project.id, ONE_PIXEL_PNG);
    const thirdPage = await store.addPage(project.id, ONE_PIXEL_PNG);
    const crop = { left: 0.1, top: 0.1, width: 0.75, height: 0.8 };

    const result = await store.applyCropToRange(project.id, {
      fromPage: 2,
      toPage: 3,
      crop,
      sourcePageId: firstPage.id
    });
    const projectAfterRange = await store.getProject(project.id);

    assert.equal(result.updatedCount, 2);
    assert.equal(projectAfterRange.pages[0].crop, null);
    assert.deepEqual(projectAfterRange.pages[1].crop, crop);
    assert.deepEqual(projectAfterRange.pages[2].crop, crop);
    assert.equal(projectAfterRange.pages[1].cropBatch.sourcePageId, firstPage.id);
    assert.equal(projectAfterRange.pages[2].cropBatch.reversible, true);

    const cleared = await store.updatePageCrop(project.id, secondPage.id, { crop: null });
    assert.equal(cleared.crop, null);
    assert.deepEqual((await store.getProject(project.id)).pages[2].crop, crop);
    assert.equal(thirdPage.number, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore describes before and after adjustment comparison for a page', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({
      title: 'Comparacion ajustes',
      author: 'Codex',
      language: 'es'
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);
    await store.updatePageCrop(project.id, page.id, {
      left: 0.1,
      top: 0.1,
      width: 0.8,
      height: 0.8
    });
    await store.updatePageDeskew(project.id, page.id, {
      angle: 1.2,
      source: 'manual'
    });

    const comparison = await store.pageAdjustmentComparison(project.id, page.id);

    assert.equal(comparison.pageId, page.id);
    assert.equal(comparison.status, 'adjusted');
    assert.equal(comparison.originalPreserved, true);
    assert.match(comparison.beforeUrl, /\/image$/);
    assert.match(comparison.afterUrl, /\/adjusted-image$/);
    assert.deepEqual(comparison.adjustments.crop, {
      left: 0.1,
      top: 0.1,
      width: 0.8,
      height: 0.8
    });
    assert.deepEqual(comparison.adjustments.deskew, {
      angle: 1.2,
      source: 'manual'
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore persists an editable local dictionary per book', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({
      title: 'Diccionario local',
      author: 'Codex',
      language: 'es'
    });

    await store.updateDictionary(project.id, {
      terms: ['Dulcinea', ' Quijote ', 'Dulcinea'],
      replacements: [{ from: 'rn', to: 'm' }]
    });

    const reloadedStore = new LibraryStore(root);
    const dictionary = await reloadedStore.readDictionary(project.id);

    assert.deepEqual(dictionary.terms, ['Dulcinea', 'Quijote']);
    assert.deepEqual(dictionary.replacements, [{ from: 'rn', to: 'm' }]);
    assert.match(dictionary.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore previews and applies dictionary replacements to selected pages', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({
      title: 'Reemplazos revisables',
      author: 'Codex',
      language: 'es'
    });
    const firstPage = await store.addPage(project.id, ONE_PIXEL_PNG);
    const secondPage = await store.addPage(project.id, ONE_PIXEL_PNG);
    await store.updatePageText(project.id, firstPage.id, 'E1 rnundo');
    await store.updatePageText(project.id, secondPage.id, 'Sin cambios');
    await store.updateDictionary(project.id, {
      replacements: [
        { from: 'E1', to: 'El' },
        { from: 'rn', to: 'm' }
      ]
    });

    const preview = await store.previewDictionaryReplacements(project.id, {
      pageIds: [firstPage.id, secondPage.id]
    });
    assert.equal(preview.changeCount, 2);
    assert.equal(preview.pages.length, 1);
    assert.equal(preview.pages[0].previewText, 'El mundo');
    assert.equal((await store.getPagePayload(project.id, firstPage.id)).ocrText, 'E1 rnundo');

    const applied = await store.applyDictionaryReplacements(project.id, {
      pageIds: [firstPage.id]
    });
    const updated = await store.getPagePayload(project.id, firstPage.id);

    assert.equal(applied.updatedCount, 1);
    assert.equal(updated.ocrText, 'El mundo');
    assert.equal(updated.reviewed, false);
    assert.equal(updated.replacementHistory.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore exports a local BookSaver package without generated EPUB artifacts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({
      title: 'Paquete local',
      author: 'Codex',
      language: 'es',
      notes: 'Proyecto de prueba'
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);

    await store.updatePageText(project.id, page.id, 'Texto revisado del paquete');
    await store.updatePageCrop(project.id, page.id, {
      left: 0.1,
      top: 0.05,
      width: 0.8,
      height: 0.9
    });
    await store.updatePageEditorial(project.id, page.id, {
      partStart: true,
      partTitle: 'Parte empaquetada',
      chapterStart: true,
      chapterTitle: 'Capitulo empaquetado'
    });
    await store.uploadProjectCover(project.id, ONE_PIXEL_PNG);
    await store.exportEpub(project.id);

    const exported = await store.exportPackage(project.id);
    const archive = await readFile(exported.path);
    const entries = readStoreZipEntries(archive);
    const entryMap = new Map(entries.map((entry) => [entry.name, entry.data]));

    assert.equal(exported.fileName, 'paquete-local.booksaver.zip');
    assert.equal(exported.manifest.format, 'booksaver-package');
    assert.equal(exported.manifest.version, 1);
    assert.equal(exported.manifest.includes.exports, false);
    assert.ok(entryMap.has('booksaver-package.json'));
    assert.ok(entryMap.has('metadata.json'));
    assert.ok(entryMap.has('pages.json'));
    assert.ok(entryMap.has('pages/page-0001/original.png'));
    assert.ok(entryMap.has('pages/page-0001/ocr.txt'));
    assert.ok(entryMap.has('cover/cover.png'));
    assert.ok(entryMap.has('checksums.sha256'));
    assert.equal(entries.some((entry) => entry.name.startsWith('exports/')), false);
    assert.equal(entries.some((entry) => entry.name.endsWith('.epub')), false);

    const metadata = JSON.parse(entryMap.get('metadata.json').toString('utf8'));
    const pages = JSON.parse(entryMap.get('pages.json').toString('utf8')).pages;
    assert.equal(metadata.inbox.path, '');
    assert.equal(metadata.inbox.watch, false);
    assert.equal(pages[0].crop.left, 0.1);
    assert.equal(pages[0].editorial.chapterTitle, 'Capitulo empaquetado');
    assert.equal(entryMap.get(pages[0].text).toString('utf8'), 'Texto revisado del paquete');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore imports a BookSaver package without overwriting an existing project', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({
      title: 'Round trip paquete',
      author: 'Codex',
      language: 'es'
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);

    await store.updatePageText(project.id, page.id, 'Texto que vuelve');
    await store.updatePageCrop(project.id, page.id, {
      left: 0.08,
      top: 0.08,
      width: 0.84,
      height: 0.84
    });
    await store.updatePageEditorial(project.id, page.id, {
      partStart: true,
      partTitle: 'Parte ida',
      chapterStart: true,
      chapterTitle: 'Capitulo vuelta',
      chapterHeaderMode: 'page'
    });
    await store.uploadProjectCover(project.id, ONE_PIXEL_PNG);

    const exported = await store.exportPackage(project.id);
    const imported = await store.importPackage(await readFile(exported.path));
    const restored = await store.getProject(imported.project.id);
    const restoredPage = restored.pages[0];
    const payload = await store.getPagePayload(restored.id, restoredPage.id);
    const cover = await store.projectCoverImage(restored.id);

    assert.notEqual(restored.id, project.id);
    assert.equal(restored.title, 'Round trip paquete');
    assert.equal(restored.author, 'Codex');
    assert.equal(restored.pages.length, 1);
    assert.equal(restored.cover.mode, 'upload');
    assert.equal(cover.mime, 'image/png');
    assert.equal(payload.ocrText, 'Texto que vuelve');
    assert.deepEqual(restoredPage.crop, {
      left: 0.08,
      top: 0.08,
      width: 0.84,
      height: 0.84
    });
    assert.equal(restoredPage.editorial.partTitle, 'Parte ida');
    assert.equal(restoredPage.editorial.chapterTitle, 'Capitulo vuelta');
    assert.equal(imported.summary.pageCount, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore rejects BookSaver packages with unsafe paths', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);
  const archive = createStoreZip([
    {
      name: 'booksaver-package.json',
      data: JSON.stringify({
        format: 'booksaver-package',
        version: 1,
        createdAt: new Date().toISOString(),
        sourceApp: 'BookSaver',
        projectId: 'unsafe-package',
        title: 'Unsafe package',
        pageCount: 1,
        includes: {
          metadata: true,
          pages: true,
          ocrText: true,
          layout: true,
          cover: false,
          exports: false
        }
      })
    },
    {
      name: 'metadata.json',
      data: JSON.stringify({
        id: 'unsafe-package',
        title: 'Unsafe package',
        author: '',
        language: 'es'
      })
    },
    {
      name: 'pages.json',
      data: JSON.stringify({
        pages: [
          {
            id: 'page-0001',
            number: 1,
            image: '../outside.png',
            text: 'pages/page-0001/ocr.txt',
            mime: 'image/png'
          }
        ]
      })
    },
    {
      name: 'pages/page-0001/ocr.txt',
      data: ''
    }
  ]);

  try {
    await assert.rejects(() => store.importPackage(archive), /ruta no segura/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore imports an inbox folder chronologically and skips known files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const inbox = await mkdtemp(path.join(os.tmpdir(), 'booksaver-inbox-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({
      title: 'Inbox',
      language: 'es'
    });
    const older = path.join(inbox, 'IMG_0001.png');
    const newer = path.join(inbox, 'IMG_0002.png');

    await writeFile(newer, ONE_PIXEL_PNG_BYTES);
    await writeFile(older, ONE_PIXEL_PNG_BYTES);
    await utimes(older, new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:00:00Z'));
    await utimes(newer, new Date('2026-01-01T10:01:00Z'), new Date('2026-01-01T10:01:00Z'));

    await store.updateInbox(project.id, { path: inbox, watch: true });
    const firstScan = await store.importFromInbox(project.id);
    const secondScan = await store.importFromInbox(project.id);

    assert.equal(firstScan.importedCount, 2);
    assert.equal(firstScan.cleanedUpCount, 2);
    assert.equal(firstScan.importedPages[0].source.fileName, 'IMG_0001.png');
    assert.equal(firstScan.importedPages[1].source.fileName, 'IMG_0002.png');
    assert.ok(['mtime', 'metadata'].includes(firstScan.importedPages[0].source.captureSource));
    assert.equal(firstScan.importedPages[0].source.preservedOriginal, firstScan.importedPages[0].image);
    assert.equal(secondScan.importedCount, 0);
    assert.equal(secondScan.cleanedUpCount, 0);
    assert.equal(secondScan.skippedDuplicates, 0);
    await assert.rejects(stat(older), /ENOENT/);
    await assert.rejects(stat(newer), /ENOENT/);

    const stored = await store.getProject(project.id);
    assert.equal(stored.inbox.watch, true);
    assert.equal(stored.pages.length, 2);
    assert.equal(stored.inbox.lastCleanedCount, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(inbox, { recursive: true, force: true });
  }
});

test('LibraryStore falls back to the project folder when the inbox is empty', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({
      title: 'Fallback',
      language: 'es'
    });
    const misplacedOlder = path.join(root, 'books', project.id, 'IMG_1001.png');
    const misplacedNewer = path.join(root, 'books', project.id, 'IMG_1002.png');

    await writeFile(misplacedNewer, ONE_PIXEL_PNG_BYTES);
    await writeFile(misplacedOlder, ONE_PIXEL_PNG_BYTES);
    await utimes(misplacedOlder, new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:00:00Z'));
    await utimes(misplacedNewer, new Date('2026-01-01T10:01:00Z'), new Date('2026-01-01T10:01:00Z'));

    const firstScan = await store.importFromInbox(project.id);
    const secondScan = await store.importFromInbox(project.id);

    assert.equal(firstScan.scanSourceType, 'project-folder');
    assert.equal(firstScan.importedCount, 2);
    assert.equal(firstScan.cleanedUpCount, 2);
    assert.match(firstScan.notice || '', /carpeta del libro/i);
    assert.equal(firstScan.importedPages[0].source.fileName, 'IMG_1001.png');
    assert.equal(firstScan.importedPages[1].source.fileName, 'IMG_1002.png');
    assert.equal(secondScan.scanSourceType, 'inbox');
    assert.equal(secondScan.importedCount, 0);
    assert.equal(secondScan.cleanedUpCount, 0);
    assert.equal(secondScan.skippedDuplicates, 0);
    await assert.rejects(stat(misplacedOlder), /ENOENT/);
    await assert.rejects(stat(misplacedNewer), /ENOENT/);

    const stored = await store.getProject(project.id);
    assert.equal(stored.inbox.lastScanSourceType, 'inbox');
    assert.equal(stored.inbox.lastScanSourcePath, store.defaultInboxPath(project.id));
    assert.equal(stored.inbox.lastCleanedCount, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore persists editorial metadata, crop, and default inbox paths across reloads', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));

  try {
    const store = new LibraryStore(root);
    const project = await store.createProject({
      title: 'Persistencia',
      language: 'es'
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);

    await store.updatePageText(project.id, page.id, 'Texto corregido a mano');
    await store.updatePageEditorial(project.id, page.id, {
      imageMode: 'image',
      partStart: true,
      partTitle: 'Parte I',
      chapterStart: true,
      chapterTitle: 'Capitulo 1',
      chapterHeaderMode: 'page',
      chapterEnd: false
    });
    await store.updatePageCrop(project.id, page.id, {
      left: 0.12,
      top: 0.08,
      width: 0.7,
      height: 0.82
    });

    const reloadedStore = new LibraryStore(root);
    const reloadedProject = await reloadedStore.getProject(project.id);
    const reloadedPage = reloadedProject.pages[0];
    const reloadedPayload = await reloadedStore.getPagePayload(project.id, page.id);

    assert.equal(reloadedProject.inbox.path, path.join(root, 'inbox', project.id));
    assert.equal(reloadedPayload.ocrText, 'Texto corregido a mano');
    assert.equal(reloadedPage.editorial.imageMode, 'image');
    assert.equal(reloadedPage.editorial.partStart, true);
    assert.equal(reloadedPage.editorial.partTitle, 'Parte I');
    assert.equal(reloadedPage.editorial.chapterStart, true);
    assert.equal(reloadedPage.editorial.chapterTitle, 'Capitulo 1');
    assert.equal(reloadedPage.editorial.chapterHeaderMode, 'page');
    assert.deepEqual(reloadedPage.crop, {
      left: 0.12,
      top: 0.08,
      width: 0.7,
      height: 0.82
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore persists uploaded covers and clears page covers when the page is deleted', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));

  try {
    const store = new LibraryStore(root);
    const project = await store.createProject({
      title: 'Portadas',
      language: 'es'
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);

    const uploadedProject = await store.uploadProjectCover(project.id, ONE_PIXEL_PNG);
    assert.equal(uploadedProject.cover.mode, 'upload');
    assert.equal(uploadedProject.cover.image, 'cover/cover.png');

    const uploadedCover = await store.projectCoverImage(project.id);
    assert.equal(uploadedCover.mime, 'image/png');

    const reloadedStore = new LibraryStore(root);
    const reloadedProject = await reloadedStore.getProject(project.id);
    assert.equal(reloadedProject.cover.mode, 'upload');
    assert.equal(reloadedProject.cover.image, 'cover/cover.png');

    await reloadedStore.updateProjectCover(project.id, {
      mode: 'page',
      pageId: page.id
    });
    await reloadedStore.deletePage(project.id, page.id);

    const afterDelete = await reloadedStore.getProject(project.id);
    assert.equal(afterDelete.cover.mode, 'none');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore reorders pages and renumbers them', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));

  try {
    const store = new LibraryStore(root);
    const project = await store.createProject({
      title: 'Orden',
      language: 'es'
    });
    const firstPage = await store.addPage(project.id, ONE_PIXEL_PNG);
    const secondPage = await store.addPage(project.id, ONE_PIXEL_PNG);
    const thirdPage = await store.addPage(project.id, ONE_PIXEL_PNG);

    const reorderedPages = await store.reorderPages(project.id, [
      thirdPage.id,
      firstPage.id,
      secondPage.id
    ]);

    assert.deepEqual(
      reorderedPages.map((page) => [page.id, page.number]),
      [
        [thirdPage.id, 1],
        [firstPage.id, 2],
        [secondPage.id, 3]
      ]
    );

    const reloadedProject = await store.getProject(project.id);
    assert.deepEqual(
      reloadedProject.pages.map((page) => [page.id, page.number]),
      [
        [thirdPage.id, 1],
        [firstPage.id, 2],
        [secondPage.id, 3]
      ]
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore rotates pages, clears the crop, and keeps the rotation on reload', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));

  try {
    const store = new LibraryStore(root);
    const project = await store.createProject({
      title: 'Rotacion',
      language: 'es'
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);

    await store.updatePageCrop(project.id, page.id, {
      left: 0.1,
      top: 0.1,
      width: 0.8,
      height: 0.8
    });

    const rotatedPage = await store.updatePageRotation(project.id, page.id, {
      rotation: 90
    });
    const preview = await store.imagePath(project.id, page.id);
    const reloadedProject = await store.getProject(project.id);

    assert.equal(rotatedPage.rotation, 90);
    assert.equal(rotatedPage.crop, null);
    assert.match(rotatedPage.ocrWarning || '', /recorte anterior se ha quitado/i);
    assert.ok(preview.filePath.includes('-preview-rotate'));
    assert.equal(reloadedProject.pages[0].rotation, 90);
    assert.equal(reloadedProject.pages[0].crop, null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore inspects export warnings before exporting', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));

  try {
    const store = new LibraryStore(root);
    const project = await store.createProject({
      title: 'Revision exportacion',
      language: 'es'
    });
    const firstPage = await store.addPage(project.id, ONE_PIXEL_PNG);
    const secondPage = await store.addPage(project.id, ONE_PIXEL_PNG);

    await store.updatePageQualityReview(project.id, firstPage.id, { ignored: true });
    await store.updatePageQualityReview(project.id, secondPage.id, { ignored: true });
    await store.updatePageText(project.id, secondPage.id, 'Texto revisado');
    await store.updatePageEditorial(project.id, secondPage.id, {
      chapterStart: true
    });

    const check = await store.inspectExport(project.id);

    assert.equal(check.ready, false);
    assert.deepEqual(
      check.warnings.map((warning) => warning.code),
      ['missing-cover', 'missing-text', 'unreviewed-pages', 'untitled-chapter']
    );
    assert.deepEqual(
      check.warnings.find((warning) => warning.code === 'missing-text')?.pages,
      [firstPage.number]
    );
    assert.deepEqual(
      check.warnings.find((warning) => warning.code === 'untitled-chapter')?.pages,
      [secondPage.number]
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore ignores OCR warnings on pages marked as image', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));

  try {
    const store = new LibraryStore(root);
    const project = await store.createProject({
      title: 'Paginas imagen',
      language: 'es'
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);
    await store.updatePageQualityReview(project.id, page.id, { ignored: true });
    const pages = await store.readPages(project.id);

    pages[0] = {
      ...pages[0],
      status: 'ocr-complete',
      layoutStale: true,
      ocrWarning: 'Recorte cambiado; vuelve a leer texto.',
      editorial: {
        ...pages[0].editorial,
        imageMode: 'image'
      }
    };
    await store.writePages(project.id, pages);

    const check = await store.inspectExport(project.id);

    assert.equal(check.ready, false);
    assert.deepEqual(
      check.warnings.map((warning) => warning.code),
      ['missing-cover']
    );
    assert.equal(check.warnings.some((warning) => warning.code === 'stale-ocr'), false);
    assert.equal(check.warnings.some((warning) => warning.code === 'ocr-warning'), false);
    assert.equal(page.number, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore persists the reviewed flag and resets it after OCR-related changes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));

  try {
    const store = new LibraryStore(root);
    const project = await store.createProject({
      title: 'Revision manual',
      language: 'es'
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);

    const reviewedPage = await store.updatePageEditorial(project.id, page.id, {
      reviewed: true
    });
    assert.equal(reviewedPage.reviewed, true);

    const reloadedProject = await store.getProject(project.id);
    assert.equal(reloadedProject.pages[0].reviewed, true);

    const afterTextEdit = await store.updatePageText(project.id, page.id, 'Texto tocado');
    assert.equal(afterTextEdit.reviewed, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore ignores stale OCR warnings on reviewed text pages', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));

  try {
    const store = new LibraryStore(root);
    const project = await store.createProject({
      title: 'Revision hecha',
      language: 'es'
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);
    await store.updatePageQualityReview(project.id, page.id, { ignored: true });

    await store.updatePageText(project.id, page.id, 'Texto revisado');
    const pages = await store.readPages(project.id);

    pages[0] = {
      ...pages[0],
      status: 'ocr-complete',
      layoutStale: true,
      ocrWarning: 'Recorte cambiado; vuelve a leer texto.',
      reviewed: true
    };
    await store.writePages(project.id, pages);

    const check = await store.inspectExport(project.id);

    assert.equal(check.ready, false);
    assert.deepEqual(
      check.warnings.map((warning) => warning.code),
      ['missing-cover']
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore persists OCR reliability metadata', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root, {
    ocrRunner: async () => ({
      text: 'Texto fiable de la pagina.',
      tsv: '',
      layout: {
        lines: [{ text: 'Texto fiable de la pagina.', confidence: 93 }],
        blocks: [{ type: 'paragraph', text: 'Texto fiable de la pagina.', confidence: 93 }]
      },
      language: 'es',
      engine: 'apple-vision',
      warning: null,
      status: 'ocr-complete',
      ocrStrategy: 'local-improved',
      ocrProvider: 'local',
      ocrModel: null,
      ocrConfidence: 93,
      ocrQualityScore: 75,
      ocrNeedsReview: false,
      candidates: [
        {
          id: 'apple-vision:original',
          provider: 'local',
          engine: 'apple-vision',
          profile: 'original',
          model: null,
          confidence: 93,
          qualityScore: 75,
          textLength: 27,
          warning: null
        }
      ]
    })
  });

  try {
    const project = await store.createProject({
      title: 'Libro OCR',
      author: '',
      language: 'es',
      notes: ''
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);
    const updated = await store.runPageOcr(project.id, page.id, { mode: 'local-improved' });

    assert.equal(updated.ocrStrategy, 'local-improved');
    assert.equal(updated.ocrProvider, 'local');
    assert.equal(updated.ocrConfidence, 93);
    assert.equal(updated.ocrQualityScore, 75);
    assert.equal(updated.ocrNeedsReview, false);
    assert.equal(updated.ocrCandidates.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore passes allowCloud false to the OCR runner unless requested', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root, {
    ocrRunner: async (_imagePath, _language, options) => {
      assert.equal(options.allowCloud, false);
      return {
        text: 'Texto local.',
        tsv: '',
        layout: { lines: [], blocks: [{ type: 'paragraph', text: 'Texto local.', confidence: 80 }] },
        language: 'es',
        engine: 'tesseract',
        warning: null,
        status: 'ocr-complete',
        ocrStrategy: 'local-improved',
        ocrProvider: 'local',
        ocrModel: null,
        ocrConfidence: 80,
        ocrQualityScore: 70,
        ocrNeedsReview: false,
        candidates: []
      };
    }
  });

  try {
    const project = await store.createProject({ title: 'Libro', author: '', language: 'es', notes: '' });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);

    await store.runPageOcr(project.id, page.id, { mode: 'local-improved', allowCloud: false });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore inspectExport warns about low-confidence OCR pages', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({ title: 'Libro', author: '', language: 'es', notes: '' });
    await store.addPage(project.id, ONE_PIXEL_PNG);
    const pages = await store.readPages(project.id);
    pages[0] = {
      ...pages[0],
      status: 'ocr-complete',
      reviewed: false,
      ocrNeedsReview: true,
      ocrQualityScore: 41,
      ocrWarning: null
    };
    await store.writePages(project.id, pages);

    const check = await store.inspectExport(project.id);

    assert.ok(check.warnings.some((warning) => warning.code === 'low-confidence-ocr'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore builds a persisted review queue for the next page problems', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({ title: 'Cola revision', author: '', language: 'es', notes: '' });
    const firstPage = await store.addPage(project.id, ONE_PIXEL_PNG);
    const secondPage = await store.addPage(project.id, ONE_PIXEL_PNG);
    const thirdPage = await store.addPage(project.id, ONE_PIXEL_PNG);

    await store.updatePageQualityReview(project.id, firstPage.id, { ignored: true });
    await store.updatePageQualityReview(project.id, secondPage.id, { ignored: true });
    await store.updatePageQualityReview(project.id, thirdPage.id, { ignored: true });
    await store.updatePageText(project.id, firstPage.id, 'Texto pendiente');
    await store.updatePageText(project.id, secondPage.id, 'Texto dudoso');
    await store.updatePageText(project.id, thirdPage.id, 'Texto listo');

    const pages = await store.readPages(project.id);
    pages[1] = {
      ...pages[1],
      status: 'ocr-complete',
      reviewed: false,
      ocrNeedsReview: true,
      ocrQualityScore: 38
    };
    pages[2] = {
      ...pages[2],
      status: 'ocr-complete',
      layoutStale: false,
      reviewed: true
    };
    await store.writePages(project.id, pages);

    const queue = await store.inspectReviewQueue(project.id);

    assert.equal(queue.ready, false);
    assert.deepEqual(
      queue.items.map((item) => [item.code, item.pageId]),
      [
        ['low-confidence-ocr', secondPage.id],
        ['unreviewed-page', firstPage.id]
      ]
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LibraryStore migrates legacy projects into an external app data directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-legacy-'));
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'booksaver-data-'));
  const projectId = 'legacy-book-123';
  const legacyProjectDir = path.join(root, 'books', projectId);
  const legacyInboxDir = path.join(root, 'inbox', projectId);

  try {
    await mkdir(path.join(legacyProjectDir, 'pages'), { recursive: true });
    await mkdir(path.join(legacyProjectDir, 'exports'), { recursive: true });
    await mkdir(legacyInboxDir, { recursive: true });
    await writeFile(
      path.join(legacyProjectDir, 'metadata.json'),
      `${JSON.stringify(
        {
          id: projectId,
          title: 'Libro legado',
          author: '',
          language: 'es',
          notes: '',
          cover: { mode: 'none', pageId: null, image: null, mime: null, updatedAt: null },
          inbox: {
            path: legacyInboxDir,
            watch: false,
            createdAt: '2026-04-20T09:00:00.000Z',
            updatedAt: '2026-04-20T09:00:00.000Z'
          },
          createdAt: '2026-04-20T09:00:00.000Z',
          updatedAt: '2026-04-20T09:00:00.000Z'
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await writeFile(path.join(legacyProjectDir, 'pages.json'), '{ "pages": [] }\n', 'utf8');

    const store = new LibraryStore(root, { dataRootDir: dataRoot });
    await store.ensure();
    const projects = await store.listProjects();

    assert.equal(projects.length, 1);
    assert.equal(projects[0].id, projectId);
    assert.equal(projects[0].inbox.path, path.join(dataRoot, 'inbox', projectId));
    assert.equal(store.getStorageInfo().dataRootDir, dataRoot);
    assert.equal(store.getStorageInfo().migrated, true);
    await assert.rejects(stat(path.join(root, 'books', projectId)), /ENOENT/);
    await assert.rejects(stat(path.join(root, 'inbox', projectId)), /ENOENT/);
    assert.equal((await stat(path.join(dataRoot, 'books', projectId))).isDirectory(), true);
    assert.equal((await stat(path.join(dataRoot, 'inbox', projectId))).isDirectory(), true);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(dataRoot, { recursive: true, force: true });
  }
});
