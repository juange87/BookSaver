import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

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
    assert.equal(firstScan.importedPages[0].source.captureSource, 'mtime');
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

    await store.updatePageText(project.id, secondPage.id, 'Texto revisado');
    await store.updatePageEditorial(project.id, secondPage.id, {
      chapterStart: true
    });

    const check = await store.inspectExport(project.id);

    assert.equal(check.ready, false);
    assert.deepEqual(
      check.warnings.map((warning) => warning.code),
      ['missing-cover', 'missing-text', 'untitled-chapter']
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
