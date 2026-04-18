import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
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
    await store.updatePageCrop(project.id, secondPage.id, { crop: null });
    const exported = await store.exportEpub(project.id);
    const archive = await readFile(exported.path);

    assert.equal(exported.fileName, 'libro-de-prueba.epub');
    assert.ok(archive.includes(Buffer.from('Primera parte')));
    assert.ok(archive.includes(Buffer.from('Capitulo de prueba')));
    assert.ok(archive.includes(Buffer.from('OEBPS/images/page-0002.png')));
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
    assert.equal(firstScan.importedPages[0].source.fileName, 'IMG_0001.png');
    assert.equal(firstScan.importedPages[1].source.fileName, 'IMG_0002.png');
    assert.equal(secondScan.importedCount, 0);
    assert.equal(secondScan.skippedDuplicates, 2);

    const stored = await store.getProject(project.id);
    assert.equal(stored.inbox.watch, true);
    assert.equal(stored.pages.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(inbox, { recursive: true, force: true });
  }
});
